import * as XLSX from "xlsx";
import type { Reductor } from "@/lib/domain/types";
import { normalizar } from "@/lib/domain/mapeo";
import { resolverServicioPorReductorRuntime } from "@/lib/config/servicesRuntime";

type MetricaReductor = "deslogueo" | "ausentismo" | "rotacion";

export interface ReductorCalculadoInput {
  deslogueo: ArrayBuffer;
  ausentismo: ArrayBuffer;
  rotacion: ArrayBuffer;
}

export interface CalculoReductoresResult {
  file: File;
  reductores: Reductor[];
  errores: string[];
}

interface MetricRow {
  servicio: string;
  valor: number;
}

const WEIGHTS = [80, 90, 100];
const WEIGHT_SUM = WEIGHTS.reduce((acc, n) => acc + n, 0);
const MONTH_ORDER: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value).trim();
  const hasPercent = raw.includes("%");
  const withoutPercent = raw.replace("%", "");
  const normalized = withoutPercent.includes(",")
    ? withoutPercent.replace(/\./g, "").replace(",", ".")
    : withoutPercent;
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return hasPercent || parsed > 1 ? parsed / 100 : parsed;
}

function cellText(value: unknown): string {
  return normalizar(String(value ?? ""));
}

function isServicioHeader(value: unknown): boolean {
  const text = cellText(value);
  return text === "servicio" || text.includes("servicio");
}

function weightedAverage(values: number[]): number {
  return values.reduce((acc, value, idx) => acc + value * WEIGHTS[idx], 0) / WEIGHT_SUM;
}

function monthFromSheetName(name: string): number | null {
  const text = cellText(name);
  for (const [month, value] of Object.entries(MONTH_ORDER)) {
    if (text.includes(month)) return value;
  }
  return null;
}

function workbookRowsBySheet(buffer: ArrayBuffer): { name: string; month: number; rows: unknown[][] }[] {
  const wb = XLSX.read(buffer, { type: "array" });
  return wb.SheetNames.map((name) => {
    const month = monthFromSheetName(name);
    if (!month || cellText(name).includes("fuente")) return null;
    return {
      name,
      month,
      rows: XLSX.utils.sheet_to_json(wb.Sheets[name], {
        header: 1,
        defval: null,
        raw: true,
        blankrows: false,
      }) as unknown[][],
    };
  }).filter((sheet): sheet is { name: string; month: number; rows: unknown[][] } => sheet !== null);
}

function findHeader(rows: unknown[][], servicioNames: string[], valueNames: string[]): { row: number; servicioCol: number; valueCol: number } | null {
  for (let rowIdx = 0; rowIdx < Math.min(rows.length, 10); rowIdx++) {
    const row = rows[rowIdx] ?? [];
    const normalized = row.map(cellText);
    const servicioCol = normalized.findIndex((text) => servicioNames.some((name) => text === name || text.includes(name)));
    const valueCol = normalized.findIndex((text) => valueNames.some((name) => text === name || text.includes(name)));
    if (servicioCol >= 0 && valueCol >= 0) {
      return { row: rowIdx, servicioCol, valueCol };
    }
  }
  return null;
}

function parsePortalMetric(
  buffer: ArrayBuffer,
  servicioNames: string[],
  valueNames: string[]
): MetricRow[] {
  const sheets = workbookRowsBySheet(buffer);
  if (sheets.length < 3) return [];
  const lastThreeMonths = [...new Set(sheets.map((s) => s.month))]
    .sort((a, b) => a - b)
    .slice(-3);
  if (lastThreeMonths.length !== 3) return [];

  const byService = new Map<string, { servicio: string; monthValues: Map<number, number[]> }>();

  for (const sheet of sheets.filter((s) => lastThreeMonths.includes(s.month))) {
    const header = findHeader(sheet.rows, servicioNames, valueNames);
    if (!header) continue;

    for (let rowIdx = header.row + 1; rowIdx < sheet.rows.length; rowIdx++) {
      const row = sheet.rows[rowIdx] ?? [];
      const servicio = String(row[header.servicioCol] ?? "").trim();
      const value = toNumber(row[header.valueCol]);
      if (!servicio || cellText(servicio).includes("blanco") || cellText(servicio).includes("total") || value === null) continue;

      const key = normalizar(servicio);
      const current = byService.get(key) ?? { servicio, monthValues: new Map<number, number[]>() };
      const values = current.monthValues.get(sheet.month) ?? [];
      current.monthValues.set(sheet.month, [...values, value]);
      byService.set(key, current);
    }
  }

  return [...byService.values()]
    .map(({ servicio, monthValues }) => {
      const values = lastThreeMonths.map((month) => {
        const monthData = monthValues.get(month) ?? [];
        if (monthData.length === 0) return null;
        return monthData.reduce((a, b) => a + b, 0) / monthData.length;
      });
      if (values.some((value) => value === null)) return null;
      return { servicio, valor: weightedAverage(values as number[]) };
    })
    .filter((row): row is MetricRow => row !== null);
}

function rotationSubareaForService(servicio: string): string | null {
  const text = normalizar(servicio);
  if (text.includes("soporte") || text.includes("tecnica") || text.includes("rrss")) return "SOPORTE TECNICO";
  if (text.includes("smb")) return "SMB";
  if (text.includes("retencion")) return "RETENCION";
  if (text.includes("movil") || text.includes("individuos")) return "MOVIL";
  if (
    text.includes("hogar") ||
    text.includes("combo") ||
    text.includes("convergente") ||
    text.includes("factura") ||
    text.includes("onboarding") ||
    text.includes("whatsapp")
  ) return "HOGAR";
  if (text.includes("corporativo") || text.includes("b2b") || text.includes("bo gc")) return "CORPORATIVO B2B";
  if (text.includes("entrenamiento") || text.includes("formador") || text.includes("capa")) return "EXPERIENCIA Y ENTRENAMIENTO";
  return null;
}

function expandRotacionPorSubarea(rotacion: MetricRow[], servicios: string[]): MetricRow[] {
  const bySubarea = new Map(rotacion.map((row) => [normalizar(row.servicio), row.valor]));
  const expanded = servicios
    .map((servicio) => {
      const subarea = rotationSubareaForService(servicio);
      if (!subarea) return null;
      const valor = bySubarea.get(normalizar(subarea));
      if (valor === undefined) return null;
      return { servicio, valor };
    })
    .filter((row): row is MetricRow => row !== null);

  return expanded.length > 0 ? expanded : rotacion;
}

function readRows(buffer: ArrayBuffer): unknown[][] {
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName =
    wb.SheetNames.find((name) => cellText(name).includes("reductores proyectad")) ??
    wb.SheetNames[0];
  if (!sheetName) return [];

  return XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  }) as unknown[][];
}

function metricBlockStart(row: unknown[], metrica: MetricaReductor): number | null {
  const needles: Record<MetricaReductor, string[]> = {
    deslogueo: ["deslogueo"],
    ausentismo: ["aus", "ausent"],
    rotacion: ["rotacion"],
  };

  for (let col = 0; col < row.length; col++) {
    const text = cellText(row[col]);
    if (needles[metrica].some((needle) => text.includes(needle))) return col;
  }
  return null;
}

function parseMetricBlock(rows: unknown[][], metrica: MetricaReductor): MetricRow[] {
  let startCol: number | null = null;
  let headerRow = -1;

  for (let rowIdx = 0; rowIdx < Math.min(rows.length, 12); rowIdx++) {
    const found = metricBlockStart(rows[rowIdx] ?? [], metrica);
    if (found !== null) startCol = found;

    if (startCol !== null && isServicioHeader(rows[rowIdx]?.[startCol])) {
      headerRow = rowIdx;
      break;
    }
  }

  if (startCol === null || headerRow < 0) return [];

  const result: MetricRow[] = [];
  for (let rowIdx = headerRow + 1; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx] ?? [];
    const servicio = String(row[startCol] ?? "").trim();
    if (!servicio || cellText(servicio).includes("total")) continue;

    const values = [row[startCol + 1], row[startCol + 2], row[startCol + 3]]
      .map(toNumber)
      .filter((value): value is number => value !== null);
    if (values.length !== 3) continue;

    result.push({ servicio, valor: weightedAverage(values) });
  }

  return result;
}

function parseGenericMetric(rows: unknown[][]): MetricRow[] {
  let headerRow = -1;
  let servicioCol = -1;

  for (let rowIdx = 0; rowIdx < Math.min(rows.length, 20); rowIdx++) {
    const row = rows[rowIdx] ?? [];
    servicioCol = row.findIndex(isServicioHeader);
    if (servicioCol >= 0) {
      headerRow = rowIdx;
      break;
    }
  }

  if (headerRow < 0 || servicioCol < 0) return [];

  const result: MetricRow[] = [];
  for (let rowIdx = headerRow + 1; rowIdx < rows.length; rowIdx++) {
    const row = rows[rowIdx] ?? [];
    const servicio = String(row[servicioCol] ?? "").trim();
    if (!servicio || cellText(servicio).includes("total")) continue;

    const numericValues = row
      .slice(servicioCol + 1)
      .map(toNumber)
      .filter((value): value is number => value !== null);
    const lastThree = numericValues.slice(-3);
    if (lastThree.length !== 3) continue;

    result.push({ servicio, valor: weightedAverage(lastThree) });
  }

  return result;
}

function parseMetric(buffer: ArrayBuffer, metrica: MetricaReductor): MetricRow[] {
  const portalRows =
    metrica === "deslogueo"
      ? parsePortalMetric(buffer, ["servicio", "servico"], ["% do"])
      : metrica === "ausentismo"
      ? parsePortalMetric(buffer, ["servicio"], ["indice slp"])
      : parsePortalMetric(buffer, ["subarea", "servicio"], ["% rotacion", "rotacion"]);
  if (portalRows.length > 0) return portalRows;

  const rows = readRows(buffer);
  const blockRows = parseMetricBlock(rows, metrica);
  return blockRows.length > 0 ? blockRows : parseGenericMetric(rows);
}

function mergeMetrics(metrics: Record<MetricaReductor, MetricRow[]>): Reductor[] {
  const byServicio = new Map<string, Reductor>();

  for (const metrica of Object.keys(metrics) as MetricaReductor[]) {
    for (const row of metrics[metrica]) {
      const canonical = resolverServicioPorReductorRuntime(row.servicio) ?? row.servicio;
      const key = normalizar(canonical);
      const current =
        byServicio.get(key) ??
        ({
          servicio: canonical,
          servicioNorm: key,
          deslogueo: 0,
          ausentismo: 0,
          rotacion: 0,
        } satisfies Reductor);

      current[metrica] = row.valor;
      byServicio.set(key, current);
    }
  }

  return [...byServicio.values()].sort((a, b) => a.servicio.localeCompare(b.servicio));
}

export function buildWorkbook(reductores: Reductor[]): ArrayBuffer {
  const rows = [
    ["Servicio", "Deslogueo", "Ausentismo", "Rotacion"],
    ...reductores.map((r) => [r.servicio, r.deslogueo, r.ausentismo, r.rotacion]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 36 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "RESUMEN PONDERADO");
  return XLSX.write(wb, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
}

export async function calcularReductoresDesdeArchivos(
  input: ReductorCalculadoInput
): Promise<CalculoReductoresResult> {
  const deslogueo = parseMetric(input.deslogueo, "deslogueo");
  const ausentismo = parseMetric(input.ausentismo, "ausentismo");
  const serviciosBase = [...new Set([...deslogueo, ...ausentismo].map((row) => row.servicio))];
  const rotacion = expandRotacionPorSubarea(parseMetric(input.rotacion, "rotacion"), serviciosBase);

  const metrics = {
    deslogueo,
    ausentismo,
    rotacion,
  };

  const errores = (Object.keys(metrics) as MetricaReductor[])
    .filter((key) => metrics[key].length === 0)
    .map((key) => `No se encontraron servicios y 3 meses de datos para ${key}.`);

  const reductores = mergeMetrics(metrics);
  if (reductores.length === 0) {
    errores.push("No se pudo calcular ningún reductor.");
  }

  const buffer = buildWorkbook(reductores);
  const file = new File([buffer], "reductores-calculados.xlsx", {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    lastModified: Date.now(),
  });

  return { file, reductores, errores };
}

/** Construye un File .xlsx sintetico ("RESUMEN PONDERADO") a partir de reductores ya resueltos. */
export function reductoresAFile(reductores: Reductor[], nombre = "reductores-guardados.xlsx"): File {
  const buffer = buildWorkbook(reductores);
  return new File([buffer], nombre, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    lastModified: Date.now(),
  });
}
