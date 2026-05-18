import type { ServicioKey as _ServicioKey } from "../config/services";
export type { ServicioKey } from "../config/services";
export { SERVICIOS_KEYS } from "../config/services";
type ServicioKey = _ServicioKey;

// ─── Agente ────────────────────────────────────────────────────────────────────

export interface Agente {
  dni: string;
  nombre: string;
  usuario: string;
  segmento: string;
  segmentoNorm: string;       // ServicioKey resuelto
  estado: string;
  hsSemanal: number;
  hsMensualBrutas: number;
  // Punto 2: horarios reales para coverage fraccional
  entryTime: string | null;   // "09:00"
  exitTime: string | null;    // "15:00"
  // Punto 4: atributos para filtros
  sitio: string;
  modalidad: string;
  jefe: string;
  superior: string;
  // Capa: agentes en capacitación
  fechaInicioAtencion: string | null; // "YYYY-MM-DD" o "DD/MM/YYYY"
  esCapa: boolean;
}

// ─── Reductores ────────────────────────────────────────────────────────────────

export interface Reductor {
  servicio: string;
  servicioNorm: string;
  deslogueo: number;
  ausentismo: number;
  rotacion: number;
}

// ─── Matrices CP ───────────────────────────────────────────────────────────────

export interface DiaInfo {
  fecha: Date;
  diaSemana: string;
  esFeriado: boolean;
  indiceColumna: number;
}

export interface MatrizServicio {
  servicio: ServicioKey;
  franjas: string[];
  dias: DiaInfo[];
  /** Valores crudos de la celda (pueden ser Hs o HC según el archivo CP) */
  matriz: number[][];
  /** HC por franja por día: matriz / 0.5 si el CP usa Hs, o directo si usa HC */
  hcMatrix: number[][];
  totalDiario: number[];
  /** Total mensual en HORAS (Σ hcReq × 0.5 para cada intervalo) */
  totalMes: number;
}

// ─── Coverage por franja (Punto 2) ─────────────────────────────────────────────

export interface FranjaCoverage {
  franja: string;
  hcRequerido: number;
  hcDisponible: number;
  gap: number;
  estado: "surplus" | "ok" | "deficit";
}

export interface DiaCoverage {
  fecha: Date;
  diaSemana: string;
  esFeriado: boolean;
  franjas: FranjaCoverage[];
  totalGap: number;
}

export interface ServicioCoverage {
  servicio: ServicioKey;
  dias: DiaCoverage[];
  /** Intervalos con deficit en ≥50% de los días */
  franjasCriticas: string[];
  coveragePorFranja: FranjaCoverage[]; // promedio del mes
}

// ─── Alertas (Punto 3) ─────────────────────────────────────────────────────────

export type AlertSeveridad = "critical" | "warning" | "info";

export interface Alerta {
  id: string;
  severidad: AlertSeveridad;
  servicio: ServicioKey | "global";
  mensaje: string;
  detalle?: string;
  metrica?: number;
  metricaLabel?: string;
}

// ─── Filtros (Punto 4) ─────────────────────────────────────────────────────────

export interface ActiveFilters {
  sitio: string;
  modalidad: string;
  jefe: string;
  contrato: string;  // "30" | "35" | "36" | ""
  estado: string;    // "ACTIVO" | "LP" | ""
}

export const FILTROS_VACIOS: ActiveFilters = {
  sitio: "",
  modalidad: "",
  jefe: "",
  contrato: "",
  estado: "",
};

// ─── Simulación mejorada (Punto 5) ─────────────────────────────────────────────

export type SimModTipo =
  | "add_agents"
  | "remove_agents"
  | "move_agents"
  | "change_contract"
  | "change_reducer";

export interface SimModificacion {
  id: string;
  tipo: SimModTipo;
  servicio: ServicioKey;
  /** Para move_agents: servicio destino */
  servicioDestino?: ServicioKey;
  cantidad: number;
  /** Para add_agents / change_contract */
  hsSemanal?: number;
  /** Para change_contract: contrato origen */
  contratoDesde?: number;
  /** Para change_reducer: overrides */
  deslogueoOverride?: number | null;
  ausentismoOverride?: number | null;
  rotacionOverride?: number | null;
}

// ─── Mapeo configurable (Punto 6) ──────────────────────────────────────────────

export interface MappingOverride {
  segmentoRaw: string;
  servicioKey: ServicioKey;
}

// ─── Agentes equivalentes (Punto 7) ────────────────────────────────────────────

export interface AgentesEquivalentes {
  hs30: number;
  hs35: number;
  hs36: number;
  mix: number;
}

// ─── Pases entre servicios ──────────────────────────────────────────────────────

export interface Pase {
  id: string;
  nombre: string;
  dni: string;
  servicioOrigen: ServicioKey;
  servicioDestino: ServicioKey;
  tipo: "temporal" | "definitivo";
}

// ─── Resultado por servicio ────────────────────────────────────────────────────

export interface FrancoAjuste {
  /** Fraction of roster available on a worst-case franco day (e.g. 0.75 for 4-day window) */
  factorDisponible: number;
  /** HC needed at 103% before accounting for franco */
  hcNecesarioBruto: number;
  /** HC needed in roster to guarantee 103% coverage on franco days */
  hcConFranco: number;
  /** Extra agents in roster needed solely due to franco (hcConFranco - hcNecesarioBruto) */
  extra: number;
}

export interface ResultadoServicio {
  servicio: ServicioKey;
  hcActivos: number;
  hcLP: number;
  hcCapa: number;
  hsBrutas: number;
  factorProductivo: number;
  hsNetas: number;
  hsRequeridas: number;
  cumplimiento: number;
  deltaHC103: number;
  reductoRes: {
    deslogueo: number;
    ausentismo: number;
    rotacion: number;
  };
  // Punto 7
  agentesEquivalentes: AgentesEquivalentes;
  hsSemanalPromedio: number;
  // Unidades facturables
  tope: number;
  teoricoFacturable: number;
  recorte: number;
  faltante: number;
  // Franco dimensionamiento
  francoAjuste: FrancoAjuste | null;
}

export interface ResultadoGeneral {
  mes: string;
  mesNum: number;   // 1-12
  anioNum: number;
  diasDelMes: number;
  resultados: ResultadoServicio[];
  totalHCActivos: number;
  totalHCLP: number;
  totalHCCapa: number;
  totalHsRequeridas: number;
  totalTeoricoFacturable: number;
  cumplimientoTotal: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

export type ModoReductor = "multiplicativo" | "aditivo";

export type NivelCumplimiento = "critico" | "bajo" | "ideal" | "alto" | "exceso";

export function nivelCumplimiento(pct: number): NivelCumplimiento {
  if (pct < 95) return "critico";
  if (pct < 100) return "bajo";
  if (pct <= 103) return "ideal";
  if (pct <= 115) return "alto";
  return "exceso";
}
