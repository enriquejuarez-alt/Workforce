import * as XLSX from "xlsx";
import type { MatrizServicio, ServicioKey } from "../domain/types";
import { SERVICIOS_PPAY, normalizar } from "../config/servicesPpay";
import { generarFranjas, safeNum, serialToDate, esDiaFeriado } from "../utils/excel";

export interface ParseCPPpayResult {
  matrices: Map<ServicioKey, MatrizServicio>;
  diasDelMes: number;
  mes: string;
  errores: string[];
}

const HOJA_KON = "KON";

interface Seccion {
  nombre: string;
  filaInicio: number;
  totalHoras: number;
}

function detectarSecciones(raw: unknown[][]): Seccion[] {
  const secciones: Seccion[] = [];

  for (let i = 2; i < raw.length - 50; i++) {
    const col0 = String((raw[i] as unknown[])?.[0] ?? "").trim();
    const col1 = (raw[i] as unknown[])?.[1];

    const esHeader =
      col0 &&
      !normalizar(col0).startsWith("requerida") &&
      col0 !== "RQ" &&
      (!col1 || col1 === "");

    if (!esHeader) continue;

    for (let j = i + 1; j < Math.min(i + 6, raw.length); j++) {
      const c0 = normalizar(String((raw[j] as unknown[])?.[0] ?? "")).trim();
      if (c0.startsWith("requerida")) {
        const filaResumen = j + 48;
        const col1Resumen =
          filaResumen < raw.length ? (raw[filaResumen] as unknown[])?.[1] : undefined;
        const totalHoras = typeof col1Resumen === "number" ? col1Resumen : 0;

        secciones.push({ nombre: col0, filaInicio: j, totalHoras });
        break;
      }
    }
  }

  return secciones;
}

function esSeccionGeneralPpay(nombre: string): boolean {
  const norm = normalizar(nombre);
  return norm === "pay general" || norm === "pay digital" || norm === "personal pay";
}

export function parseCPPpay(buffer: ArrayBuffer): ParseCPPpayResult {
  const wb = XLSX.read(buffer, { type: "array", cellDates: false }) as any;
  const errores: string[] = [];
  const matrices = new Map<ServicioKey, MatrizServicio>();

  if (!wb.SheetNames.includes(HOJA_KON)) {
    return { matrices, diasDelMes: 0, mes: "", errores: [`Falta la hoja '${HOJA_KON}'`] };
  }

  const ws = wb.Sheets[HOJA_KON];
  const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true });

  if (raw.length < 4) {
    return { matrices, diasDelMes: 0, mes: "", errores: ["La hoja KON tiene menos de 4 filas"] };
  }

  const filaDiaSemana = raw[0] as (string | number)[];
  const filaFechas = raw[1] as (string | number)[];

  const dias = [];
  const columnasValidas: number[] = [];
  const fechasVistas = new Set<string>();

  for (let col = 2; col < filaFechas.length; col++) {
    const serial = filaFechas[col];
    if (!serial || typeof serial !== "number" || serial < 1) continue;
    const fecha = serialToDate(serial);
    if (isNaN(fecha.getTime())) continue;
    const fechaKey = fecha.toISOString().slice(0, 10);
    if (fechasVistas.has(fechaKey)) continue;
    fechasVistas.add(fechaKey);
    const diaSemanaRaw = String(filaDiaSemana[col] ?? "");
    dias.push({
      fecha,
      diaSemana: diaSemanaRaw,
      esFeriado: esDiaFeriado(diaSemanaRaw, fecha),
      indiceColumna: col,
    });
    columnasValidas.push(col);
  }

  const diasDelMes = dias.length;
  let mes = "";
  if (dias.length > 0) {
    mes = dias[0].fecha.toLocaleDateString("es-AR", { month: "long", year: "numeric", timeZone: "UTC" });
  }

  const franjas = generarFranjas();
  const secciones = detectarSecciones(raw);
  const servicioPpay = SERVICIOS_PPAY[0];
  const matrizAgrupada: number[][] = Array.from({ length: 48 }, () =>
    Array(dias.length).fill(0)
  );
  let seccionesConHoras = 0;

  for (const seccion of secciones) {
    if (!esSeccionGeneralPpay(seccion.nombre)) continue;
    if (seccion.totalHoras === 0) continue;
    seccionesConHoras += 1;

    for (let offset = 0; offset < 48; offset++) {
      const fila = seccion.filaInicio + offset;
      if (fila >= raw.length) break;
      for (let i = 0; i < columnasValidas.length; i++) {
        matrizAgrupada[offset][i] += safeNum(raw[fila]?.[columnasValidas[i]]);
      }
    }
  }

  if (seccionesConHoras > 0 && servicioPpay) {
    const totalDiario: number[] = Array(dias.length).fill(0);
    const sample = matrizAgrupada
      .flat()
      .filter((v) => v > 0)
      .slice(0, 20);
    const promedio =
      sample.length > 0 ? sample.reduce((a, b) => a + b, 0) / sample.length : 0;
    const tieneDecimales = sample.some((v) => Math.abs(v - Math.round(v)) > 0.01);
    const formato: "hc" | "hs" = !tieneDecimales && promedio > 1 ? "hc" : "hs";

    const hcMatrix = matrizAgrupada.map((fila) =>
      fila.map((v) => (formato === "hs" ? v / 0.5 : v))
    );

    for (let dia = 0; dia < dias.length; dia++) {
      for (const fila of hcMatrix) {
        totalDiario[dia] += fila[dia] * 0.5;
      }
    }

    const totalMes =
      formato === "hc"
        ? hcMatrix.reduce((sum, fila) => sum + fila.reduce((s, v) => s + v * 0.5, 0), 0)
        : totalDiario.reduce((a, b) => a + b, 0);

    matrices.set(servicioPpay.key, {
      servicio: servicioPpay.key,
      franjas: franjas.slice(0, matrizAgrupada.length),
      dias,
      matriz: matrizAgrupada,
      hcMatrix,
      totalDiario,
      totalMes,
    });
  }

  if (matrices.size === 0) {
    errores.push("No se encontraron servicios activos en la hoja KON");
  }

  return { matrices, diasDelMes, mes, errores };
}

export function validarHojasCPPpay(sheetNames: string[]): string[] {
  const errores: string[] = [];
  if (!sheetNames.includes(HOJA_KON)) errores.push(`Falta la hoja '${HOJA_KON}'`);
  if (!sheetNames.includes("Resumen")) errores.push("Falta la hoja 'Resumen'");
  return errores;
}

export function getSheetNamesPpay(buffer: ArrayBuffer): string[] {
  const wb = XLSX.read(buffer, { type: "array" }) as any;
  return wb.SheetNames as string[];
}
