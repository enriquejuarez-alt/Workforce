import type { Agente, MatrizServicio, ServicioKey } from "./types";
import {
  DIAS_SEMANA,
  DIA_LABELS,
  probabilidadFrancoDia,
  type DiaSemana,
  type ReglaFrancoContrato,
} from "../config/francoRules";

export type EstadoFranco = "surplus" | "ok" | "justo" | "deficit";

export interface FrancoResultadoDia {
  dia: DiaSemana;
  label: string;
  hcDisponible: number;
  ausentes: number;
  hcRequerido: number | null;
  estado: EstadoFranco;
}

export interface FrancoResultadoServicio {
  servicio: ServicioKey;
  hcActivos: number;
  composicion: { hsSemanal: number; cantidad: number }[];
  dias: FrancoResultadoDia[];
  peorDia: DiaSemana;
  hcNecesarioTotal: number;
}

function clasificarEstado(disponible: number, requerido: number | null): EstadoFranco {
  if (requerido === null || requerido === 0) return "ok";
  const ratio = disponible / requerido;
  if (ratio >= 1.03) return "surplus";
  if (ratio >= 1.0) return "ok";
  if (ratio >= 0.95) return "justo";
  return "deficit";
}

// Agrupa agentes activos por servicio y tipo de contrato (horas semanales)
function composicionPorServicio(
  agentes: Agente[]
): Map<ServicioKey, Map<number, number>> {
  const mapa = new Map<ServicioKey, Map<number, number>>();
  for (const a of agentes) {
    if (a.estado.toUpperCase() !== "ACTIVO") continue;
    const svc = a.segmentoNorm as ServicioKey;
    if (!mapa.has(svc)) mapa.set(svc, new Map());
    const hs = isNaN(a.hsSemanal) ? 36 : a.hsSemanal;
    const contrato = mapa.get(svc)!;
    contrato.set(hs, (contrato.get(hs) ?? 0) + 1);
  }
  return mapa;
}

// Calcula el requerido promedio de CP por día de la semana para un servicio,
// promediando totalDiario agrupado por diaSemana a lo largo del mes
function requeridoPorDiaSemana(
  matriz: MatrizServicio | undefined
): Map<DiaSemana, number> {
  const resultado = new Map<DiaSemana, number>();
  if (!matriz) return resultado;

  const acum = new Map<DiaSemana, { suma: number; count: number }>();
  for (const [i, diaInfo] of matriz.dias.entries()) {
    const raw = diaInfo.diaSemana.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const dia = normalizarDiaSemana(raw);
    if (!dia) continue;
    const hcReq = (matriz.totalDiario[i] ?? 0);
    const entry = acum.get(dia) ?? { suma: 0, count: 0 };
    acum.set(dia, { suma: entry.suma + hcReq, count: entry.count + 1 });
  }

  for (const [dia, { suma, count }] of acum) {
    resultado.set(dia, count > 0 ? suma / count : 0);
  }
  return resultado;
}

function normalizarDiaSemana(raw: string): DiaSemana | null {
  const map: Record<string, DiaSemana> = {
    lunes: "lunes",
    martes: "martes",
    miercoles: "miercoles",
    miércoles: "miercoles",
    jueves: "jueves",
    viernes: "viernes",
    sabado: "sabado",
    sábado: "sabado",
    domingo: "domingo",
    // formas abreviadas
    lun: "lunes",
    mar: "martes",
    mie: "miercoles",
    mié: "miercoles",
    jue: "jueves",
    vie: "viernes",
    sab: "sabado",
    sáb: "sabado",
    dom: "domingo",
  };
  return map[raw] ?? null;
}

export function calcularFrancoPorServicio(
  agentes: Agente[],
  matrices: Map<ServicioKey, MatrizServicio>,
  reglas: ReglaFrancoContrato[],
  servicios: ServicioKey[]
): FrancoResultadoServicio[] {
  const composicion = composicionPorServicio(agentes);

  return servicios.map((servicio) => {
    const contratoMap = composicion.get(servicio) ?? new Map<number, number>();
    const hcActivos = Array.from(contratoMap.values()).reduce((a, b) => a + b, 0);
    const composicionArr = Array.from(contratoMap.entries())
      .map(([hsSemanal, cantidad]) => ({ hsSemanal, cantidad }))
      .sort((a, b) => a.hsSemanal - b.hsSemanal);

    const cpPorDia = requeridoPorDiaSemana(matrices.get(servicio));

    const dias: FrancoResultadoDia[] = DIAS_SEMANA.map((dia) => {
      let ausentes = 0;
      for (const { hsSemanal, cantidad } of composicionArr) {
        const regla = reglas.find((r) => r.hsSemanal === hsSemanal);
        if (!regla) continue;
        ausentes += cantidad * probabilidadFrancoDia(regla, dia);
      }

      const hcDisponible = hcActivos - ausentes;
      const hcRequerido = cpPorDia.has(dia) ? (cpPorDia.get(dia) ?? null) : null;

      return {
        dia,
        label: DIA_LABELS[dia],
        hcDisponible,
        ausentes,
        hcRequerido,
        estado: clasificarEstado(hcDisponible, hcRequerido),
      };
    });

    const peorDia = dias.reduce((peor, d) => {
      const gapActual = (d.hcRequerido ?? 0) - d.hcDisponible;
      const gapPeor = (peor.hcRequerido ?? 0) - peor.hcDisponible;
      return gapActual > gapPeor ? d : peor;
    }, dias[0]).dia;

    // HC total necesario para cubrir el peor día considerando la tasa de ausentismo
    const diasConReq = dias.filter((d) => d.hcRequerido !== null && d.hcRequerido > 0);
    let hcNecesarioTotal = hcActivos;
    for (const d of diasConReq) {
      const pAusente = d.ausentes / (hcActivos || 1);
      const disponibleFraction = 1 - pAusente;
      const needed = disponibleFraction > 0 ? (d.hcRequerido ?? 0) / disponibleFraction : hcActivos;
      if (needed > hcNecesarioTotal) hcNecesarioTotal = needed;
    }

    return { servicio, hcActivos, composicion: composicionArr, dias, peorDia, hcNecesarioTotal };
  });
}
