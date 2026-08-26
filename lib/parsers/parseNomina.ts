import * as XLSX from "xlsx";
import type { Agente } from "../domain/types";
import { resolverServicioPorSegmentoRuntime } from "../config/servicesRuntime";
import { extraerHorasContrato, normalizarNombreColumna } from "../utils/excel";
import type { MappingOverride } from "../domain/types";
import { normalizar } from "../domain/mapeo";

export interface ParseNominaResult {
  agentes: Agente[];
  errores: string[];
  hojas: string[];
  agentesExcluidos: number;
  segmentosNoReconocidos: string[];
}

// Punto 2: Parsea "09:00-15:00", "9 a 15", "09:00 / 15:00" → { entry, exit }
export function parsearHorario(raw: string): { entry: string | null; exit: string | null } {
  if (!raw) return { entry: null, exit: null };
  const s = raw.toString().trim();

  // Formato "HH:MM-HH:MM" o "HH:MM / HH:MM"
  const matchRango = s.match(/(\d{1,2}):(\d{2})\s*[-/]\s*(\d{1,2}):(\d{2})/);
  if (matchRango) {
    const entry = `${matchRango[1].padStart(2, "0")}:${matchRango[2]}`;
    const exit = `${matchRango[3].padStart(2, "0")}:${matchRango[4]}`;
    return { entry, exit };
  }

  // Formato "9 a 15" o "9:00 a 15:00"
  const matchA = s.match(/(\d{1,2})(?::(\d{2}))?\s+a\s+(\d{1,2})(?::(\d{2}))?/i);
  if (matchA) {
    const entry = `${matchA[1].padStart(2, "0")}:${matchA[2] ?? "00"}`;
    const exit = `${matchA[3].padStart(2, "0")}:${matchA[4] ?? "00"}`;
    return { entry, exit };
  }

  return { entry: null, exit: null };
}

export function getNominasSheetNames(buffer: ArrayBuffer): string[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wb = XLSX.read(buffer, { type: "array" }) as any;
  return wb.SheetNames as string[];
}

// Lee el Excel de nómina, mapea columnas por nombre normalizado y construye la lista de agentes.
// Los segmentos sin mapeo configurado se excluyen y se reportan en segmentosNoReconocidos.
export function parseNomina(
  buffer: ArrayBuffer,
  hoja: string,
  mappingOverrides: MappingOverride[] = [],
  resolverServicio?: (s: string) => string | null
): ParseNominaResult {
  const _resolverServicio = resolverServicio ?? resolverServicioPorSegmentoRuntime;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wb = XLSX.read(buffer, { type: "array" }) as any;
  const hojas: string[] = wb.SheetNames;

  if (!hojas.includes(hoja)) {
    return {
      agentes: [],
      errores: [`La hoja '${hoja}' no existe en la nómina`],
      hojas,
      agentesExcluidos: 0,
      segmentosNoReconocidos: [],
    };
  }

  const ws = wb.Sheets[hoja];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, {
    defval: "",
    raw: true,
  });

  if (rows.length === 0) {
    return { agentes: [], errores: [`La hoja '${hoja}' está vacía`], hojas, agentesExcluidos: 0, segmentosNoReconocidos: [] };
  }

  const primeraFila = rows[0];
  const mapeoColumnas: Record<string, string> = {};
  for (const key of Object.keys(primeraFila)) {
    mapeoColumnas[normalizarNombreColumna(key)] = key;
  }

  const encontrarCol = (...buscar: string[]): string | null => {
    for (const b of buscar) {
      const norm = normalizarNombreColumna(b);
      if (mapeoColumnas[norm]) return mapeoColumnas[norm];
      for (const [k, v] of Object.entries(mapeoColumnas)) {
        if (k.includes(norm) || norm.includes(k)) return v;
      }
    }
    return null;
  };

  const colSegmento = encontrarCol("segmento");
  const colEstado = encontrarCol("estado");
  const colContrato = encontrarCol("contrato");
  const colDNI = encontrarCol("dni");
  const colNombre = encontrarCol("nombre");
  const colUsuario = encontrarCol("usuario");
  // Punto 2
  const colHorarios = encontrarCol("horarios", "horario", "turno");
  // Punto 4
  const colSitio = encontrarCol("sitio", "sede");
  const colModalidad = encontrarCol("modalidad", "modalidad trabajo");
  const colJefe = encontrarCol("jefe", "jefe directo", "lider");
  const colSuperior = encontrarCol("superior", "gerente");
  // Capa
  const colFechaInicio = encontrarCol("fecha inicio atencion", "fecha inicio", "inicio atencion", "capa fecha", "inicio capa");

  const errores: string[] = [];
  if (!colDNI) errores.push("Columna DNI no encontrada");
  if (!colNombre) errores.push("Columna NOMBRE no encontrada");
  if (!colSegmento) errores.push("Columna SEGMENTO no encontrada");
  if (!colEstado) errores.push("Columna ESTADO no encontrada");
  if (!colContrato) errores.push("Columna CONTRATO no encontrada");
  if (errores.length > 0) return { agentes: [], errores, hojas, agentesExcluidos: 0, segmentosNoReconocidos: [] };

  // Construir mapa de overrides de segmento (case-insensitive)
  const overrideMap = new Map<string, string>();
  for (const ov of mappingOverrides) {
    overrideMap.set(normalizar(ov.segmentoRaw), ov.servicioKey);
  }

  const agentes: Agente[] = [];
  let sinSegmento = 0;
  let sinMapeo = 0;
  const segmentosExcluidos = new Set<string>();

  for (const row of rows) {
    const segmentoRaw = String(row[colSegmento!] ?? "").trim();
    if (!segmentoRaw) { sinSegmento++; continue; }

    const estado = String(row[colEstado!] ?? "").trim();
    const contratoRaw = String(row[colContrato!] ?? "");
    const hsSemanal = extraerHorasContrato(contratoRaw);

    // Resolver servicio: primero override manual, luego auto-mapeo
    let servicioKey: string | null = overrideMap.get(normalizar(segmentoRaw)) ?? null;
    if (!servicioKey) servicioKey = _resolverServicio(segmentoRaw);
    if (!servicioKey) {
      sinMapeo++;
      segmentosExcluidos.add(segmentoRaw);
      continue;
    }

    // Punto 2: parsear horario
    const horarioRaw = colHorarios ? String(row[colHorarios] ?? "") : "";
    const { entry, exit } = parsearHorario(horarioRaw);

    // Capa: parsear fecha inicio atención
    const fechaInicioRaw = colFechaInicio ? String(row[colFechaInicio] ?? "").trim() : "";
    const fechaInicioAtencion = fechaInicioRaw ? normalizarFecha(fechaInicioRaw) : null;
    const esCapa = !!fechaInicioAtencion;

    agentes.push({
      dni: String(row[colDNI!] ?? ""),
      nombre: String(row[colNombre!] ?? ""),
      usuario: String(row[colUsuario!] ?? ""),
      segmento: segmentoRaw,
      segmentoNorm: servicioKey,
      estado,
      hsSemanal,
      hsMensualBrutas: 0,
      entryTime: entry,
      exitTime: exit,
      sitio: colSitio ? String(row[colSitio] ?? "").trim() : "",
      modalidad: colModalidad ? String(row[colModalidad] ?? "").trim() : "",
      jefe: colJefe ? String(row[colJefe] ?? "").trim() : "",
      superior: colSuperior ? String(row[colSuperior] ?? "").trim() : "",
      fechaInicioAtencion,
      esCapa,
    });
  }

  return {
    agentes,
    errores: [],
    hojas,
    agentesExcluidos: sinMapeo + sinSegmento,
    segmentosNoReconocidos: Array.from(segmentosExcluidos),
  };
}

function normalizarFecha(raw: string): string | null {
  // Acepta "DD/MM/YYYY", "DD-MM-YYYY", "YYYY-MM-DD", número Excel serial
  const num = Number(raw);
  if (!isNaN(num) && num > 40000) {
    // Serial de fecha Excel: días desde 1900-01-01 (con bug del año bisiesto)
    const d = new Date((num - 25569) * 86400 * 1000);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }
  const matchDMY = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (matchDMY) {
    return `${matchDMY[3]}-${matchDMY[2].padStart(2, "0")}-${matchDMY[1].padStart(2, "0")}`;
  }
  const matchISO = raw.match(/^\d{4}-\d{2}-\d{2}$/);
  if (matchISO) return raw;
  return null;
}

export function normalizarDni(dni: string): string {
  return dni.replace(/\D/g, "");
}

/** Suma, por DNI, los días de vacaciones que caen dentro de [mesInicio, mesFin]. */
export function construirVacacionesPorDni(
  vacaciones: { agente_dni: string; fecha_desde: string | Date; fecha_hasta: string | Date }[],
  mesInicio: Date,
  mesFin: Date
): Map<string, number> {
  const mapa = new Map<string, number>();
  for (const v of vacaciones) {
    const desde = new Date(v.fecha_desde);
    const hasta = new Date(v.fecha_hasta);
    const inicio = desde < mesInicio ? mesInicio : desde;
    const fin = hasta > mesFin ? mesFin : hasta;
    if (inicio > fin) continue;
    const dias = Math.round((fin.getTime() - inicio.getTime()) / 86_400_000) + 1;
    const dni = normalizarDni(v.agente_dni);
    if (!dni) continue;
    mapa.set(dni, (mapa.get(dni) ?? 0) + dias);
  }
  return mapa;
}

// Calcula hsMensualBrutas para cada agente; los agentes CAPA prorratean según fecha de inicio
// y los agentes con vacaciones ese mes (vacacionesPorDni) prorratean por los días tomados.
export function aplicarDiasAlMes(
  agentes: Agente[],
  diasDelMes: number,
  vacacionesPorDni?: Map<string, number>
): Agente[] {
  return agentes.map((a) => {
    const diasVacacion = vacacionesPorDni?.get(normalizarDni(a.dni)) ?? 0;
    const factorVacaciones = Math.max(0, 1 - diasVacacion / diasDelMes);

    if (a.esCapa && a.fechaInicioAtencion) {
      // fechaInicioAtencion siempre llega como ISO "YYYY-MM-DD" (normalizarFecha
      // acá, o toISOString().slice(0,10) en el backend), que Date la interpreta
      // en UTC medianoche. getDate() (hora local) corre el dia 1 al mes anterior
      // en timezones detras de UTC (Argentina, UTC-3), restando un dia de menos
      // al prorrateo y sobreestimando las hs del agente CAPA.
      const inicio = new Date(a.fechaInicioAtencion);
      const diaInicio = inicio.getUTCDate(); // 1-based
      const diasDisponibles = Math.max(0, diasDelMes - diaInicio + 1);
      const proporcion = diasDisponibles / diasDelMes;
      return {
        ...a,
        hsMensualBrutas: a.hsSemanal * (diasDelMes / 7) * proporcion * factorVacaciones,
      };
    }
    return {
      ...a,
      hsMensualBrutas: a.hsSemanal * (diasDelMes / 7) * factorVacaciones,
    };
  });
}

export function validarColumnas(sheetNames: string[]): string[] {
  return sheetNames.length === 0 ? ["El archivo de nómina no tiene hojas"] : [];
}
