import * as XLSX from "xlsx";
import type { MatrizServicio, ServicioKey } from "../domain/types";
import { SERVICIOS_VENTAS } from "../config/servicesVentas";
import { normalizar } from "../config/services";
import { esFeriado, generarFranjas, safeNum, serialToDate } from "../utils/excel";

export interface ParseCPVentasResult {
  matrices: Map<ServicioKey, MatrizServicio>;
  diasDelMes: number;
  mes: string;
  errores: string[];
}

function detectarFormatoCP(matriz: number[][]): "hs" | "hc" {
  const sample: number[] = [];
  for (let f = 0; f < matriz.length; f++) {
    for (let d = 0; d < Math.min(matriz[f].length, 5); d++) {
      const v = matriz[f][d];
      if (v > 0) sample.push(v);
    }
    if (sample.length >= 50) break;
  }
  if (sample.length === 0) return "hs";
  const promedio = sample.reduce((a, b) => a + b, 0) / sample.length;
  const tieneDecimales = sample.some((v) => Math.abs(v - Math.round(v)) > 0.01);
  if (!tieneDecimales && promedio > 1) return "hc";
  return "hs";
}

function resolverHoja(hojaCP: string | string[], hojasPresentes: string[]): string | null {
  const aliases = Array.isArray(hojaCP) ? hojaCP : [hojaCP];
  return (
    aliases.find((alias) =>
      hojasPresentes.some((h) => normalizar(h) === normalizar(alias))
    ) ?? null
  );
}

// WA format: days at row 2 col 3+, dates at row 3 col 3+, HH:MM label at col 2 rows 4+
function parsearHojaWA(raw: unknown[][]): {
  dias: { fecha: Date; diaSemana: string; esFeriado: boolean; indiceColumna: number }[];
  columnasValidas: number[];
  matriz: number[][];
  totalDiario: number[];
} | null {
  const filaDias = raw[2] as (string | number)[];
  const filaFechas = raw[3] as (string | number)[];
  if (!filaDias || !filaFechas) return null;

  const dias: { fecha: Date; diaSemana: string; esFeriado: boolean; indiceColumna: number }[] = [];
  const columnasValidas: number[] = [];

  for (let col = 3; col < filaFechas.length; col++) {
    const serial = filaFechas[col];
    if (typeof serial !== "number" || serial < 44000) continue;
    const fecha = serialToDate(serial);
    if (isNaN(fecha.getTime())) continue;
    const diaSemanaRaw = String(filaDias[col] ?? "");
    dias.push({ fecha, diaSemana: diaSemanaRaw, esFeriado: esFeriado(diaSemanaRaw), indiceColumna: col });
    columnasValidas.push(col);
  }

  if (dias.length === 0) return null;

  const matriz: number[][] = Array.from({ length: 48 }, () => Array(dias.length).fill(0));
  const totalDiario: number[] = Array(dias.length).fill(0);

  for (let fila = 4; fila < raw.length; fila++) {
    const row = raw[fila] as (string | number)[];
    const col2 = String(row?.[2] ?? "").trim().toLowerCase();
    if (!col2) continue;
    if (col2 === "horas") {
      for (let i = 0; i < columnasValidas.length; i++) {
        totalDiario[i] = safeNum(row[columnasValidas[i]]);
      }
      break;
    }
    const match = col2.match(/^(\d{1,2}):(\d{2})/);
    if (!match) continue;
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const slotIdx = h * 2 + (m >= 30 ? 1 : 0);
    if (slotIdx < 0 || slotIdx >= 48) continue;
    for (let i = 0; i < columnasValidas.length; i++) {
      matriz[slotIdx][i] = safeNum(row[columnasValidas[i]]);
    }
  }

  return { dias, columnasValidas, matriz, totalDiario };
}

// Móvil format: section header (string col1 + day name col2), dates at next row col2+,
// data rows: decimal fraction at col1, values at col2+, "Total horas" ends the section
function parsearHojaMovil(raw: unknown[][]): {
  dias: { fecha: Date; diaSemana: string; esFeriado: boolean; indiceColumna: number }[];
  columnasValidas: number[];
  matriz: number[][];
  totalDiario: number[];
} | null {
  const DIAS_SEMANA = ["lunes","martes","miércoles","miercoles","jueves","viernes","sábado","sabado","domingo"];

  // Buscar la primera fila de sección: col1 es etiqueta de texto, col2 es nombre de día
  let sectionRow = -1;
  for (let r = 0; r < raw.length - 2; r++) {
    const c1 = (raw[r] as unknown[])?.[1];
    const c2 = (raw[r] as unknown[])?.[2];
    if (
      typeof c1 === "string" && c1.trim() &&
      !c1.toLowerCase().includes("total") &&
      c1 !== "Konecta" && c1 !== "Requerido" &&
      typeof c2 === "string" && DIAS_SEMANA.includes(normalizar(c2))
    ) {
      sectionRow = r;
      break;
    }
  }

  if (sectionRow < 0) return null;

  const datesRow = sectionRow + 1;
  const filaDias = raw[sectionRow] as (string | number)[];
  const filaFechas = raw[datesRow] as (string | number)[];
  if (!filaFechas) return null;

  const dias: { fecha: Date; diaSemana: string; esFeriado: boolean; indiceColumna: number }[] = [];
  const columnasValidas: number[] = [];

  for (let col = 2; col < filaFechas.length; col++) {
    const serial = filaFechas[col];
    if (typeof serial !== "number" || serial < 44000) continue;
    const fecha = serialToDate(serial);
    if (isNaN(fecha.getTime())) continue;
    const diaSemanaRaw = String(filaDias[col] ?? "");
    dias.push({ fecha, diaSemana: diaSemanaRaw, esFeriado: esFeriado(diaSemanaRaw), indiceColumna: col });
    columnasValidas.push(col);
  }

  if (dias.length === 0) return null;

  const matriz: number[][] = Array.from({ length: 48 }, () => Array(dias.length).fill(0));
  const totalDiario: number[] = Array(dias.length).fill(0);

  for (let fila = datesRow + 1; fila < raw.length; fila++) {
    const row = raw[fila] as (string | number)[];
    const c1 = row?.[1];
    if (typeof c1 === "string") {
      if (!c1.trim()) continue; // skip empty cells
      if (c1.toLowerCase().includes("total horas") || c1.toLowerCase().includes("total hora")) {
        for (let i = 0; i < columnasValidas.length; i++) {
          totalDiario[i] = safeNum(row[columnasValidas[i]]);
        }
      }
      break;
    }
    if (typeof c1 !== "number" || isNaN(c1) || c1 <= 0 || c1 >= 1) continue;
    const slotIdx = Math.round(c1 * 48);
    if (slotIdx < 0 || slotIdx >= 48) continue;
    for (let i = 0; i < columnasValidas.length; i++) {
      matriz[slotIdx][i] = safeNum(row[columnasValidas[i]]);
    }
  }

  return { dias, columnasValidas, matriz, totalDiario };
}

export function parseCPVentas(buffer: ArrayBuffer): ParseCPVentasResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wb = XLSX.read(buffer, { type: "array", cellDates: false }) as any;
  const hojasPresentes = wb.SheetNames as string[];
  const errores: string[] = [];
  const matrices = new Map<ServicioKey, MatrizServicio>();
  let diasDelMes = 0;
  let mes = "";

  for (const def of SERVICIOS_VENTAS) {
    const nombreHoja = resolverHoja(def.hojaCP, hojasPresentes);
    if (!nombreHoja) continue;

    const ws = wb.Sheets[nombreHoja];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: true });

    if (raw.length < 4) {
      errores.push(`Hoja '${nombreHoja}': muy pocas filas`);
      continue;
    }

    // Detectar formato WA: tiene serial de fecha en fila 3 columna 3
    const isWA = typeof (raw[3] as unknown[])?.[3] === "number" &&
      ((raw[3] as number[])[3] as number) > 44000;

    const result = isWA ? parsearHojaWA(raw) : parsearHojaMovil(raw);

    if (!result) {
      errores.push(`Hoja '${nombreHoja}': no se reconoció el formato`);
      continue;
    }

    const { dias, matriz, totalDiario } = result;

    if (dias.length > diasDelMes) diasDelMes = dias.length;
    if (!mes) mes = dias[0].fecha.toLocaleDateString("es-AR", { month: "long", year: "numeric" });

    const formato = detectarFormatoCP(matriz);
    const hcMatrix: number[][] = matriz.map((fila) =>
      fila.map((v) => (formato === "hs" ? v / 0.5 : v))
    );
    const totalMes =
      formato === "hc"
        ? hcMatrix.reduce((sum, fila) => sum + fila.reduce((s, v) => s + v * 0.5, 0), 0)
        : totalDiario.reduce((a, b) => a + b, 0);

    matrices.set(def.key, {
      servicio: def.key,
      franjas: generarFranjas(),
      dias,
      matriz,
      hcMatrix,
      totalDiario,
      totalMes,
    });
  }

  return { matrices, diasDelMes, mes, errores };
}

export function validarHojasCPVentas(sheetNames: string[]): string[] {
  const tieneAlguna = SERVICIOS_VENTAS.some((s) => resolverHoja(s.hojaCP, sheetNames) !== null);
  if (!tieneAlguna) {
    return [
      "No se encontró ninguna hoja de Ventas (esperadas: WhatsApp Ventas, Ventas Móvil, Ventas Out Móvil, WhatsApp Ventas Hogar)",
    ];
  }
  return [];
}

export function getSheetNamesVentas(buffer: ArrayBuffer): string[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wb = XLSX.read(buffer, { type: "array" }) as any;
  return wb.SheetNames as string[];
}
