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

export function parseFrancos(buffer: ArrayBuffer): ParseFrancosResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wb = XLSX.read(buffer, { type: "array" }) as any;
  const errores: string[] = [];

  if (!wb.SheetNames.includes(HOJA_FRANCOS)) {
    errores.push(`No se encontró la hoja '${HOJA_FRANCOS}'`);
  }
  if (!wb.SheetNames.includes(HOJA_CONTRATOS)) {
    errores.push(`No se encontró la hoja '${HOJA_CONTRATOS}'`);
  }
  if (errores.length > 0) return { servicios: [], errores };

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

export function validarHojasFrancos(sheetNames: string[]): string[] {
  const errores: string[] = [];
  if (!sheetNames.includes(HOJA_FRANCOS)) errores.push(`Falta la hoja '${HOJA_FRANCOS}'`);
  if (!sheetNames.includes(HOJA_CONTRATOS)) errores.push(`Falta la hoja '${HOJA_CONTRATOS}'`);
  return errores;
}
