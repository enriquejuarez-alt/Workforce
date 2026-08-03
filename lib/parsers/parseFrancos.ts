import * as XLSX from "xlsx";
import type { FrancoServicioDatos } from "../domain/types";
import { normalizar } from "../domain/mapeo";

const HOJA_FRANCOS = "% Francos Julio";
const HOJA_CONTRATOS = "Detalle Contratos";

export interface ParseFrancosResult {
  servicios: FrancoServicioDatos[];
  errores: string[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSheetRows(wb: any, name: string): unknown[][] {
  return XLSX.utils.sheet_to_json(wb.Sheets[name], {
    header: 1,
    defval: null,
    raw: true,
  }) as unknown[][];
}

function toNum(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}

function normalizarHeader(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

const DIAS_SEMANA_ORDEN = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
] as const;

const HEADERS_POR_AGENTE = ["nombre", "dni", "gestion", "horas", "dias", ...DIAS_SEMANA_ORDEN];

/**
 * Detecta el formato "roster por agente" (una fila por agente, con columnas
 * NOMBRE/DNI/GESTION/HORAS/DIAS/LUNES..DOMINGO donde cada columna de dia es
 * un indicador 0/1 de franco ese dia). Es el formato crudo del que sale el
 * agregado por servicio de "% Francos Julio"/"Detalle Contratos"; cuando
 * viene asi, se agrega por servicio (GESTION) en `parseFrancosPorAgente`.
 * Devuelve el nombre de la primera hoja cuyo encabezado matchea, o null.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function detectarHojaPorAgente(wb: any): string | null {
  for (const nombre of wb.SheetNames as string[]) {
    const header = (getSheetRows(wb, nombre)[0] ?? []).map(normalizarHeader);
    if (HEADERS_POR_AGENTE.every((h) => header.includes(h))) return nombre;
  }
  return null;
}

/**
 * Hoja "% Francos Julio": la tabla real esta en las columnas 0-3 (Servico/Dia/Francos/%)
 * en grupos de 8 filas (1 fila de encabezado con el servicio + dotacion, y 7 filas
 * Lun..Dom con el % de francos). El resto de las columnas a la derecha son bloques
 * incompletos/decorativos de una version anterior del archivo y se ignoran.
 */
function parseFrancosPorDia(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wb: any
): Map<string, { servicio: string; dias: number[] }> {
  const rows = getSheetRows(wb, HOJA_FRANCOS);
  const porServicio = new Map<string, { servicio: string; dias: number[] }>();

  // La tabla es una grilla fija de grupos de 8 filas (1 encabezado + Lun..Dom)
  // arrancando en la fila 1 (fila 0 es el encabezado de columnas).
  for (let i = 1; i < rows.length; i += 8) {
    const nombre = rows[i]?.[0];
    if (typeof nombre !== "string" || !nombre.trim()) continue;

    const servicio = nombre.trim();
    const dias: number[] = [];
    for (let d = 0; d < 7; d++) {
      const fila = rows[i + 1 + d];
      dias.push(toNum(fila?.[3]));
    }
    porServicio.set(normalizar(servicio), { servicio, dias });
  }

  return porServicio;
}

/**
 * Hoja "Detalle Contratos": tabla principal a partir de la fila del encabezado
 * ("Cuenta","Servicios",...,"Total general","Hs","Dias"). Servicio en columna 1,
 * dotacion/ponderado horas/ponderado dias en columnas 19/20/21. Hay un bloque
 * secundario mas a la derecha (columnas 25+) que es un resumen distinto y se ignora.
 */
function parseDetalleContratos(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wb: any
): Map<string, { servicio: string; dotacion: number; ponderadoHoras: number; ponderadoDias: number }> {
  const rows = getSheetRows(wb, HOJA_CONTRATOS);
  const resultado = new Map<
    string,
    { servicio: string; dotacion: number; ponderadoHoras: number; ponderadoDias: number }
  >();

  const idxHeader = rows.findIndex(
    (r) => r[0] === "Cuenta" && r[1] === "Servicios"
  );
  if (idxHeader < 0) return resultado;

  for (let i = idxHeader + 1; i < rows.length; i++) {
    const row = rows[i];
    const nombre = row?.[1];
    if (row?.[0] === "Total general") break;
    if (typeof nombre !== "string" || !nombre.trim()) continue;

    resultado.set(normalizar(nombre.trim()), {
      servicio: nombre.trim(),
      dotacion: toNum(row[19]),
      ponderadoHoras: toNum(row[20]),
      ponderadoDias: toNum(row[21]),
    });
  }

  return resultado;
}

function parseFrancosAgregado(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wb: any
): ParseFrancosResult {
  const francosPorDia = parseFrancosPorDia(wb);
  const contratos = parseDetalleContratos(wb);

  const claves = new Set<string>([...francosPorDia.keys(), ...contratos.keys()]);
  const servicios: FrancoServicioDatos[] = [];

  for (const clave of claves) {
    const franco = francosPorDia.get(clave);
    const contrato = contratos.get(clave);
    const [lunes, martes, miercoles, jueves, viernes, sabado, domingo] = franco?.dias ?? [0, 0, 0, 0, 0, 0, 0];

    servicios.push({
      servicio: contrato?.servicio ?? franco?.servicio ?? clave,
      servicioNorm: clave,
      dotacion: contrato?.dotacion ?? 0,
      ponderadoHoras: contrato?.ponderadoHoras ?? 0,
      ponderadoDias: contrato?.ponderadoDias ?? 0,
      francoLunes: lunes,
      francoMartes: martes,
      francoMiercoles: miercoles,
      francoJueves: jueves,
      francoViernes: viernes,
      francoSabado: sabado,
      francoDomingo: domingo,
    });
  }

  servicios.sort((a, b) => a.servicio.localeCompare(b.servicio));

  return { servicios, errores: [] };
}

interface AcumuladorAgente {
  servicio: string;
  n: number;
  sumaHoras: number;
  sumaDias: number;
  // orden: lunes, martes, miercoles, jueves, viernes, sabado, domingo
  sumaFranco: [number, number, number, number, number, number, number];
}

/**
 * Formato "roster por agente" (una fila por agente): agrega dotacion,
 * horas/dias ponderados y % de franco por dia de semana, servicio por
 * servicio (columna GESTION), a partir de los indicadores 0/1 de cada
 * columna de dia. Es el equivalente granular de lo que ya trae calculado
 * el formato "% Francos Julio"/"Detalle Contratos": dotacion = cantidad de
 * agentes del servicio, ponderado horas/dias = promedio simple de HORAS/DIAS
 * de esos agentes, y % franco de un dia = fraccion de agentes del servicio
 * con el indicador en 1 ese dia.
 */
function parseFrancosPorAgente(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  wb: any,
  hoja: string
): ParseFrancosResult {
  const rows = getSheetRows(wb, hoja);
  const header = (rows[0] ?? []).map(normalizarHeader);

  const idxGestion = header.indexOf("gestion");
  const idxHoras = header.indexOf("horas");
  const idxDias = header.indexOf("dias");
  const idxDiasSemana = DIAS_SEMANA_ORDEN.map((d) => header.indexOf(d));

  const acumuladores = new Map<string, AcumuladorAgente>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => c === null)) continue;

    const gestionRaw = row[idxGestion];
    if (typeof gestionRaw !== "string" || !gestionRaw.trim()) continue;

    const servicio = gestionRaw.trim();
    const clave = normalizar(servicio);
    let acc = acumuladores.get(clave);
    if (!acc) {
      acc = { servicio, n: 0, sumaHoras: 0, sumaDias: 0, sumaFranco: [0, 0, 0, 0, 0, 0, 0] };
      acumuladores.set(clave, acc);
    }

    acc.n += 1;
    acc.sumaHoras += toNum(row[idxHoras]);
    acc.sumaDias += toNum(row[idxDias]);
    idxDiasSemana.forEach((colIdx, d) => {
      acc!.sumaFranco[d] += toNum(row[colIdx]);
    });
  }

  const servicios: FrancoServicioDatos[] = [];
  for (const [clave, acc] of acumuladores) {
    const [lunes, martes, miercoles, jueves, viernes, sabado, domingo] = acc.sumaFranco.map(
      (s) => s / acc.n
    );
    servicios.push({
      servicio: acc.servicio,
      servicioNorm: clave,
      dotacion: acc.n,
      ponderadoHoras: acc.sumaHoras / acc.n,
      ponderadoDias: acc.sumaDias / acc.n,
      francoLunes: lunes,
      francoMartes: martes,
      francoMiercoles: miercoles,
      francoJueves: jueves,
      francoViernes: viernes,
      francoSabado: sabado,
      francoDomingo: domingo,
    });
  }

  servicios.sort((a, b) => a.servicio.localeCompare(b.servicio));

  return { servicios, errores: [] };
}

export function parseFrancos(buffer: ArrayBuffer): ParseFrancosResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wb = XLSX.read(buffer, { type: "array" }) as any;

  if (wb.SheetNames.includes(HOJA_FRANCOS) && wb.SheetNames.includes(HOJA_CONTRATOS)) {
    return parseFrancosAgregado(wb);
  }

  const hojaPorAgente = detectarHojaPorAgente(wb);
  if (hojaPorAgente) {
    return parseFrancosPorAgente(wb, hojaPorAgente);
  }

  return {
    servicios: [],
    errores: [
      `No se reconoce el formato del archivo. Se admite: hojas '${HOJA_FRANCOS}' + '${HOJA_CONTRATOS}', ` +
        `o una hoja con columnas Nombre/DNI/Gestion/Horas/Dias/Lunes..Domingo (una fila por agente).`,
    ],
  };
}

export function validarHojasFrancos(sheetNames: string[]): string[] {
  const errores: string[] = [];
  if (!sheetNames.includes(HOJA_FRANCOS)) errores.push(`Falta la hoja '${HOJA_FRANCOS}'`);
  if (!sheetNames.includes(HOJA_CONTRATOS)) errores.push(`Falta la hoja '${HOJA_CONTRATOS}'`);
  return errores;
}
