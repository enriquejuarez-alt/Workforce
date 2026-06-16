import * as XLSX from "xlsx";
import type { Reductor } from "../domain/types";
import { normalizar } from "../domain/mapeo";

const HOJA_RESUMEN = "RESUMEN PONDERADO";

// Formato moderno: un archivo con 3 hojas separadas (Rotacion, Ausentismo, Deslogueo)
// donde cada hoja ya tiene la columna ponderada calculada.
const HOJAS_SEPARADAS = ["Rotacion", "Ausentismo", "Deslogueo"] as const;

export interface ParseReductoresResult {
  reductores: Reductor[];
  errores: string[];
}

function toNum(v: unknown): number {
  if (v === null || v === undefined || v === "" || v === "-") return 0;
  const n = parseFloat(String(v));
  return Number.isFinite(n) ? n : 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSheetRows(wb: any, name: string): unknown[][] {
  return XLSX.utils.sheet_to_json(wb.Sheets[name], {
    header: 1,
    defval: "",
    raw: true,
  }) as unknown[][];
}

/**
 * Formato "RESUMEN PONDERADO": una sola hoja con columnas
 * Servicio | Deslogueo | Ausentismo | Rotacion
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseFormatoResumen(wb: any): ParseReductoresResult {
  const errores: string[] = [];
  const rows = getSheetRows(wb, HOJA_RESUMEN);

  if (rows.length < 2) {
    return { reductores: [], errores: ["La hoja de reductores está vacía"] };
  }

  const encabezado = (rows[0] as string[]).map((c) => normalizar(String(c ?? "")));
  const idxServicio  = encabezado.findIndex((c) => c.includes("servicio"));
  const idxDeslogueo = encabezado.findIndex((c) => c.includes("deslog") || c.includes("login"));
  const idxAusentismo = encabezado.findIndex((c) => c.includes("ausent"));
  const idxRotacion  = encabezado.findIndex((c) => c.includes("rotac"));

  if (idxServicio < 0 || idxDeslogueo < 0 || idxAusentismo < 0 || idxRotacion < 0) {
    errores.push(
      `Columnas no encontradas en '${HOJA_RESUMEN}'. ` +
      `Buscadas: Servicio, Deslogueo, Ausentismo, Rotacion. ` +
      `Encontradas: ${encabezado.join(", ")}`
    );
    return { reductores: [], errores };
  }

  const reductores: Reductor[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    const servicio = String(row[idxServicio] ?? "").trim();
    if (!servicio) continue;
    reductores.push({
      servicio,
      servicioNorm: normalizar(servicio),
      deslogueo:   toNum(row[idxDeslogueo]),
      ausentismo:  toNum(row[idxAusentismo]),
      rotacion:    toNum(row[idxRotacion]),
    });
  }
  return { reductores, errores };
}

/**
 * Formato moderno (3 hojas separadas):
 *   Rotacion  — col 0 = servicio, col 4 = ponderado
 *   Ausentismo — col 0 = servicio, col 4 = ponderado
 *   Deslogueo — col 12 = servicio (sección "% DESLOGUEO OP"), col 16 = ponderado
 * Filas de datos a partir de la fila 3 (índice 0-base).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseFormatoSeparado(wb: any): ParseReductoresResult {
  const rotRows  = getSheetRows(wb, "Rotacion");
  const ausRows  = getSheetRows(wb, "Ausentismo");
  const desRows  = getSheetRows(wb, "Deslogueo");

  // Construimos mapas normalizados → valor ponderado
  const rotMap  = new Map<string, number>();
  const ausMap  = new Map<string, number>();
  const desMap  = new Map<string, number>();

  for (let i = 3; i < rotRows.length; i++) {
    const row = rotRows[i] as unknown[];
    const serv = String(row[0] ?? "").trim();
    if (serv) rotMap.set(normalizar(serv), toNum(row[4]));
  }
  for (let i = 3; i < ausRows.length; i++) {
    const row = ausRows[i] as unknown[];
    const serv = String(row[0] ?? "").trim();
    if (serv) ausMap.set(normalizar(serv), toNum(row[4]));
  }
  for (let i = 3; i < desRows.length; i++) {
    const row = desRows[i] as unknown[];
    const serv = String(row[12] ?? "").trim();
    if (serv) desMap.set(normalizar(serv), toNum(row[16]));
  }

  // Usamos Rotación como lista maestra de servicios
  const reductores: Reductor[] = [];
  for (let i = 3; i < rotRows.length; i++) {
    const row = rotRows[i] as unknown[];
    const servicio = String(row[0] ?? "").trim();
    if (!servicio) continue;
    const key = normalizar(servicio);
    reductores.push({
      servicio,
      servicioNorm: key,
      rotacion:    rotMap.get(key) ?? 0,
      ausentismo:  ausMap.get(key) ?? 0,
      deslogueo:   desMap.get(key) ?? 0,
    });
  }

  return { reductores, errores: [] };
}

export function parseReductores(buffer: ArrayBuffer): ParseReductoresResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wb = XLSX.read(buffer, { type: "array" }) as any;

  // Detectar formato por nombre de hojas
  const tieneHojasSeparadas = HOJAS_SEPARADAS.every((h) => wb.SheetNames.includes(h));
  if (tieneHojasSeparadas) {
    return parseFormatoSeparado(wb);
  }

  if (wb.SheetNames.includes(HOJA_RESUMEN)) {
    return parseFormatoResumen(wb);
  }

  return {
    reductores: [],
    errores: [
      `Formato no reconocido. El archivo debe tener la hoja '${HOJA_RESUMEN}' ` +
      `o las hojas '${HOJAS_SEPARADAS.join("', '")}'.`,
    ],
  };
}

export function validarHojasReductores(sheetNames: string[]): string[] {
  if (sheetNames.includes(HOJA_RESUMEN)) return [];
  if (HOJAS_SEPARADAS.every((h) => sheetNames.includes(h))) return [];
  return [
    `Formato no reconocido. Necesitás la hoja '${HOJA_RESUMEN}' ` +
    `o las hojas '${HOJAS_SEPARADAS.join("', '")}'.`,
  ];
}
