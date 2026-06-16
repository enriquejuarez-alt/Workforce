import * as XLSX from "xlsx";
import type { MatrizServicio, ServicioKey } from "../domain/types";
import { SERVICIOS_PPAY, normalizar } from "../config/servicesPpay";
import { generarFranjas, safeNum, serialToDate, esFeriado } from "../utils/excel";

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

export function parseCPPpay(buffer: ArrayBuffer): ParseCPPpayResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wb = XLSX.read(buffer, { type: "array", cellDates: false }) as any;
  const errores: string[] = [];
  const matrices = new Map<ServicioKey, MatrizServicio>();

  if (!wb.SheetNames.includes(HOJA_KON)) {
    return { matrices, diasDelMes: 0, mes: "", errores: [`Falta la hoja '${HOJA_KON}'`] };
  }

  const ws = wb.Sheets[HOJA_KON];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      esFeriado: esFeriado(diaSemanaRaw),
      indiceColumna: col,
    });
    columnasValidas.push(col);
  }

  const diasDelMes = dias.length;
  let mes = "";
  if (dias.length > 0) {
    mes = dias[0].fecha.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
  }

  const franjas = generarFranjas();
  const secciones = detectarSecciones(raw);

  for (const seccion of secciones) {
    const servicioDef = SERVICIOS_PPAY.find((s) => {
      const hojas = Array.isArray(s.hojaCP) ? s.hojaCP : [s.hojaCP];
      return hojas.some(
        (h) => normalizar(h) === normalizar(seccion.nombre)
      );
    });

    if (!servicioDef) continue;
    if (seccion.totalHoras === 0) continue;

    const matriz: number[][] = [];
    const totalDiario: number[] = Array(dias.length).fill(0);

    for (let fila = seccion.filaInicio; fila < seccion.filaInicio + 48; fila++) {
      if (fila >= raw.length) break;
      const filaValores: number[] = columnasValidas.map((col) =>
        safeNum(raw[fila]?.[col])
      );
      matriz.push(filaValores);
    }

    const filaResumen = seccion.filaInicio + 48;
    if (filaResumen < raw.length) {
      for (let i = 0; i < columnasValidas.length; i++) {
        totalDiario[i] = safeNum(raw[filaResumen]?.[columnasValidas[i]]);
      }
    }

    const sample = matriz
      .flat()
      .filter((v) => v > 0)
      .slice(0, 20);
    const promedio =
      sample.length > 0 ? sample.reduce((a, b) => a + b, 0) / sample.length : 0;
    const tieneDecimales = sample.some((v) => Math.abs(v - Math.round(v)) > 0.01);
    const formato: "hc" | "hs" = !tieneDecimales && promedio > 1 ? "hc" : "hs";

    const hcMatrix = matriz.map((fila) =>
      fila.map((v) => (formato === "hs" ? v / 0.5 : v))
    );

    const totalMes =
      formato === "hc"
        ? hcMatrix.reduce((sum, fila) => sum + fila.reduce((s, v) => s + v * 0.5, 0), 0)
        : totalDiario.reduce((a, b) => a + b, 0);

    matrices.set(servicioDef.key, {
      servicio: servicioDef.key,
      franjas: franjas.slice(0, matriz.length),
      dias,
      matriz,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wb = XLSX.read(buffer, { type: "array" }) as any;
  return wb.SheetNames as string[];
}
