import * as XLSX from "xlsx";
import type { MatrizServicio, ServicioKey } from "../domain/types";
import {
  getServiciosActivos,
  getServiciosKeys,
  resolverHojaCPRuntime,
  getHojasCPRuntime,
} from "../config/servicesRuntime";
import { normalizar, type ServiceDefinition } from "../config/services";
import {
  esFeriado,
  generarFranjas,
  safeNum,
  serialToDate,
} from "../utils/excel";

export interface ParseCPResult {
  matrices: Map<ServicioKey, MatrizServicio>;
  diasDelMes: number;
  mes: string;
  errores: string[];
}

/**
 * Auto-detecta si las celdas de la matriz son Hs o HC.
 * Si el promedio de valores ≤ 10 y hay valores no enteros, asume Hs.
 * Si el promedio > 1 y los valores son enteros o cercanos, asume HC.
 */
function detectarFormatoCP(matriz: number[][]): "hs" | "hc" {
  const sample: number[] = [];
  for (let f = 0; f < matriz.length; f++) {
    for (let d = 0; d < matriz[f].length; d++) {
      const v = matriz[f][d];
      if (v > 0) sample.push(v);
      if (sample.length >= 200) break;
    }
    if (sample.length >= 200) break;
  }
  if (sample.length === 0) return "hs";
  const promedio = sample.reduce((a, b) => a + b, 0) / sample.length;
  const tieneDecimales = sample.some((v) => Math.abs(v - Math.round(v)) > 0.01);
  // Si los valores son enteros > 1, asumimos que ya son HC
  if (!tieneDecimales && promedio > 1) return "hc";
  return "hs";
}

function esFranjaHoraria(value: unknown): boolean {
  return /^\d{1,2}:\d{2}$/.test(String(value ?? "").trim());
}

export function parseCPConServicios(
  buffer: ArrayBuffer,
  servicios: ServiceDefinition[]
): ParseCPResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wb = XLSX.read(buffer, { type: "array", cellDates: false }) as any;
  const errores: string[] = [];
  const matrices = new Map<ServicioKey, MatrizServicio>();
  let diasDelMes = 0;
  let mes = "";

  const hojasPresentes = wb.SheetNames as string[];

  for (const servicioDef of servicios) {
    const servicio = servicioDef.key;
    const aliases = Array.isArray(servicioDef.hojaCP) ? servicioDef.hojaCP : [servicioDef.hojaCP];
    const nombreHoja = hojasPresentes.find((hoja) =>
      aliases.some((alias) => normalizar(hoja) === normalizar(alias))
    ) ?? null;
    if (!nombreHoja) {
      errores.push(
        `Falta la hoja del servicio '${servicio}' (esperadas: ${aliases.join(", ")})`
      );
      continue;
    }

    const ws = wb.Sheets[nombreHoja];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw: any[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: 0,
      raw: true,
    });

    if (raw.length < 3) {
      errores.push(`Hoja '${nombreHoja}' tiene menos de 3 filas`);
      continue;
    }

    const filaDiaSemana = raw[0] as (string | number)[];
    const filaFechas = raw[1] as (string | number)[];

    const dias = [];
    const columnasValidas: number[] = [];

    for (let col = 1; col < filaFechas.length; col++) {
      const serial = filaFechas[col];
      if (!serial || typeof serial !== "number" || serial < 1) continue;
      const fecha = serialToDate(serial);
      if (isNaN(fecha.getTime())) continue;
      const diaSemanaRaw = String(filaDiaSemana[col] ?? "");
      dias.push({
        fecha,
        diaSemana: diaSemanaRaw,
        esFeriado: esFeriado(diaSemanaRaw),
        indiceColumna: col,
      });
      columnasValidas.push(col);
    }

    if (dias.length > diasDelMes) diasDelMes = dias.length;

    if (dias.length > 0) {
      const d = dias[0].fecha;
      mes = d.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
    }

    const franjas = generarFranjas();
    const matriz: number[][] = [];
    const totalDiario: number[] = Array(dias.length).fill(0);

    const filaInicioMatriz = raw.findIndex((row) => esFranjaHoraria(row?.[0]));
    if (filaInicioMatriz < 0) {
      errores.push(`Hoja '${nombreHoja}' no tiene franjas horarias validas`);
      continue;
    }

    for (let fila = filaInicioMatriz; fila < raw.length; fila++) {
      const primeraCelda = String(raw[fila][0] ?? "").trim().toLowerCase();
      if (primeraCelda.includes("total") || primeraCelda.includes("horas")) {
        for (let i = 0; i < columnasValidas.length; i++) {
          totalDiario[i] = safeNum(raw[fila][columnasValidas[i]]);
        }
        break;
      }
      if (!esFranjaHoraria(primeraCelda)) {
        if (!primeraCelda) continue;
        break;
      }

      const filaValores: number[] = [];
      for (const col of columnasValidas) {
        filaValores.push(safeNum(raw[fila][col]));
      }
      matriz.push(filaValores);
    }

    // Punto 1: detectar formato y generar hcMatrix
    const formato = detectarFormatoCP(matriz);
    const hcMatrix: number[][] = matriz.map((fila) =>
      fila.map((v) => (formato === "hs" ? v / 0.5 : v))
    );

    // totalMes siempre en HORAS para compatibilidad con cumplimiento
    // Si CP tiene HC: total = Σ(hcReq × 0.5) para cada celda
    // Si CP tiene Hs: total = suma directa de la fila "Total diario"
    const totalMes =
      formato === "hc"
        ? hcMatrix.reduce(
            (sum, fila) => sum + fila.reduce((s, v) => s + v * 0.5, 0),
            0
          )
        : totalDiario.reduce((a, b) => a + b, 0) ||
          matriz.reduce((sum, fila) => sum + fila.reduce((s, v) => s + v, 0), 0);

    matrices.set(servicio, {
      servicio,
      franjas: franjas.slice(0, matriz.length),
      dias,
      matriz,
      hcMatrix,
      totalDiario,
      totalMes,
    });
  }

  return { matrices, diasDelMes, mes, errores };
}

export function parseCP(buffer: ArrayBuffer): ParseCPResult {
  return parseCPConServicios(buffer, getServiciosActivos());
}

export function validarHojasCP(sheetNames: string[]): string[] {
  const errores: string[] = [];
  for (const servicio of getServiciosKeys()) {
    if (!resolverHojaCPRuntime(servicio, sheetNames)) {
      const aliases = getHojasCPRuntime(servicio);
      errores.push(
        `Falta la hoja del servicio '${servicio}' (esperadas: ${aliases.join(", ")})`
      );
    }
  }
  return errores;
}

export function validarHojasCPConServicios(
  sheetNames: string[],
  servicios: ServiceDefinition[]
): string[] {
  const errores: string[] = [];
  for (const servicio of servicios) {
    const aliases = Array.isArray(servicio.hojaCP) ? servicio.hojaCP : [servicio.hojaCP];
    const encontrada = aliases.some((alias) =>
      sheetNames.some((hoja) => normalizar(hoja) === normalizar(alias))
    );
    if (!encontrada) {
      errores.push(
        `Falta la hoja del servicio '${servicio.key}' (esperadas: ${aliases.join(", ")})`
      );
    }
  }
  return errores;
}

export function getSheetNames(buffer: ArrayBuffer): string[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wb = XLSX.read(buffer, { type: "array" }) as any;
  return wb.SheetNames as string[];
}
