import {
  DIAS_SEMANA,
  FRANCO_DEFAULTS,
  probabilidadFrancoDia,
  type DiaSemana,
} from "../config/francoRules";
import type { MatrizServicio } from "./types";

// getUTCDay(): 0=domingo ... 6=sabado
const DIA_SEMANA_POR_INDICE: DiaSemana[] = [
  "domingo",
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
];

export interface InputDiaADia {
  /** Nomina inicial del servicio: activos + no activos (LP), constante para todo el mes. */
  nominaInicial: number;
  diasDelMes: number;
  anio: number;
  mes: number; // 1-12
  /** Agentes de vacaciones para un dia dado (1-based). Default: 0. */
  vacacionesPorDia?: (dia: number) => number;
  /** Agentes de LP para un dia dado. Si no se pasa, se usa `licenciaConstante`. */
  licenciaPorDia?: (dia: number) => number;
  licenciaConstante?: number;
  rotacionMensual: number; // fraccion 0-1
  ausentismoMensual: number; // fraccion 0-1
  deslogueoMensual: number; // fraccion 0-1
  /** Horas por dia trabajado, ya ponderadas por el mix de contratos del servicio. */
  ponderadoHoras: number;
  /** % (0-1) de agentes de franco por dia de la semana, ya ponderado por mix de contratos. */
  francoPorDiaSemana: Record<DiaSemana, number>;
}

export interface ResultadoDia {
  dia: number;
  diaSemana: DiaSemana;
  nominaActiva: number;
  bajasRotacion: number;
  agentesFranco: number;
  agentesAusentes: number;
  agentesPresentes: number;
  hsLogueo: number;
}

export interface ResultadoDiaADia {
  dias: ResultadoDia[];
  totalHsLogueo: number;
}

/**
 * Replica el calculo dia a dia de HS de logueo descripto por el area de referencia:
 * nomina activa -> franco -> ausentismo -> presentes -> hs logueo, sumado a lo largo del mes.
 */
export function calcularHsLogueoDiaADia(input: InputDiaADia): ResultadoDiaADia {
  const dias: ResultadoDia[] = [];
  let totalHsLogueo = 0;

  for (let dia = 1; dia <= input.diasDelMes; dia++) {
    const fecha = new Date(Date.UTC(input.anio, input.mes - 1, dia));
    const diaSemana = DIA_SEMANA_POR_INDICE[fecha.getUTCDay()];

    const vacaciones = input.vacacionesPorDia ? input.vacacionesPorDia(dia) : 0;
    const licencia = input.licenciaPorDia
      ? input.licenciaPorDia(dia)
      : input.licenciaConstante ?? 0;
    const bajasRotacion =
      (input.rotacionMensual / input.diasDelMes) * dia * input.nominaInicial;

    const nominaActiva = Math.max(
      0,
      input.nominaInicial - vacaciones - licencia - bajasRotacion
    );

    const francoPct = input.francoPorDiaSemana[diaSemana] ?? 0;
    const agentesFranco = francoPct * nominaActiva;

    const agentesAusentes = Math.max(0, nominaActiva - agentesFranco) * input.ausentismoMensual;
    const agentesPresentes = Math.max(0, nominaActiva - agentesFranco - agentesAusentes);

    const hsLogueo = agentesPresentes * input.ponderadoHoras * (1 - input.deslogueoMensual);

    dias.push({
      dia,
      diaSemana,
      nominaActiva,
      bajasRotacion,
      agentesFranco,
      agentesAusentes,
      agentesPresentes,
      hsLogueo,
    });
    totalHsLogueo += hsLogueo;
  }

  return { dias, totalHsLogueo };
}

/**
 * Detecta que dias de la semana un servicio NO atiende (cierre total), promediando
 * el requerido de la curva CP por dia de semana a lo largo del mes. Si el promedio
 * de un dia da <= umbral, se considera cerrado ese dia (nadie trabaja, no es una
 * rotacion de franco). Esto viene de la curva del cliente que ya subimos cada mes,
 * no requiere configuracion manual.
 */
export function detectarDiasCerrados(
  matriz: MatrizServicio,
  umbral = 0.5
): Set<DiaSemana> {
  const suma: Partial<Record<DiaSemana, number>> = {};
  const conteo: Partial<Record<DiaSemana, number>> = {};

  matriz.dias.forEach((d, i) => {
    const dia = DIA_SEMANA_POR_INDICE[new Date(d.fecha).getUTCDay()];
    suma[dia] = (suma[dia] ?? 0) + (matriz.totalDiario[i] ?? 0);
    conteo[dia] = (conteo[dia] ?? 0) + 1;
  });

  const cerrados = new Set<DiaSemana>();
  for (const dia of DIAS_SEMANA) {
    const promedio = conteo[dia] ? (suma[dia] ?? 0) / conteo[dia]! : 0;
    if (promedio <= umbral) cerrados.add(dia);
  }
  return cerrados;
}

/**
 * Deriva franco % por dia de semana y horas ponderadas por dia trabajado, a partir
 * de una composicion de contratos (hsSemanal -> cantidad de agentes), las reglas
 * de franco disponibles (FRANCO_DEFAULTS por defecto) y los dias que el servicio
 * cierra por completo (`diasCerrados`, ver `detectarDiasCerrados`).
 *
 * Los dias cerrados cuentan como descanso total (nadie trabaja). El descanso
 * contractual normal (ej. 1 dia/semana para 36hs) solo se redistribuye entre los
 * dias abiertos si EXCEDE lo que ya cubre el cierre — si el cierre ya da 2 dias
 * libres y el contrato solo pide 1, no se resta nada mas dentro de los dias
 * abiertos (coincide con lo observado en servicios reales que cierran fin de
 * semana: 0% de franco adicional entre semana).
 *
 * OJO: dentro de los dias abiertos, esto sigue siendo una aproximacion generica
 * por tipo de contrato — el % real de rotacion (ej. sabado con rotacion parcial)
 * sale del roster real, que no siempre tenemos.
 */
export function derivarFrancoYPonderado(
  composicion: Map<number, number>,
  diasCerrados: Set<DiaSemana> = new Set(),
  reglas = FRANCO_DEFAULTS
): { francoPorDiaSemana: Record<DiaSemana, number>; ponderadoHoras: number } {
  const total = Array.from(composicion.values()).reduce((a, b) => a + b, 0) || 1;
  const reglaPorDefault = reglas.find((r) => r.hsSemanal === 36) ?? reglas[0];
  const diasAbiertos = DIAS_SEMANA.filter((d) => !diasCerrados.has(d));
  const nAbiertos = diasAbiertos.length || 1;

  const francoPorDiaSemana = {} as Record<DiaSemana, number>;
  for (const dia of DIAS_SEMANA) francoPorDiaSemana[dia] = diasCerrados.has(dia) ? 1 : 0;

  let ponderadoHoras = 0;
  for (const [hsSemanal, cantidad] of composicion) {
    const regla = reglas.find((r) => r.hsSemanal === hsSemanal) ?? reglaPorDefault;
    const descansoTotal = DIAS_SEMANA.reduce(
      (acc, d) => acc + probabilidadFrancoDia(regla, d),
      0
    );
    const descansoAdicional = Math.max(0, descansoTotal - diasCerrados.size);
    const diasTrabajados = Math.max(0.01, nAbiertos - descansoAdicional);
    const hsPorDia = hsSemanal / diasTrabajados;
    ponderadoHoras += (cantidad / total) * hsPorDia;

    for (const dia of diasAbiertos) {
      francoPorDiaSemana[dia] += (cantidad / total) * (descansoAdicional / nAbiertos);
    }
  }

  return { francoPorDiaSemana, ponderadoHoras };
}
