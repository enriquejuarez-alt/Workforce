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
  /**
   * De la LP total (arriba), cuantos agentes tienen licencia PAGA (vs no
   * paga) para un dia dado. Si no se pasa, se usa `licenciaPagaConstante`; si
   * tampoco se pasa, se asume que TODA la LP es paga (comportamiento previo a
   * distinguir esto). Solo importa en un dia de cierre total del servicio
   * (ver `francoBaseSobre` mas abajo) — un dia normal no la usa para nada.
   */
  licenciaPagaPorDia?: (dia: number) => number;
  licenciaPagaConstante?: number;
  rotacionMensual: number; // fraccion 0-1
  ausentismoMensual: number; // fraccion 0-1
  deslogueoMensual: number; // fraccion 0-1
  /** Horas por dia trabajado, ya ponderadas por el mix de contratos del servicio. */
  ponderadoHoras: number;
  /** % (0-1) de agentes de franco por dia de la semana, ya ponderado por mix de contratos. */
  francoPorDiaSemana: Record<DiaSemana, number>;
  /**
   * % (0-1, puede superar 1) de Requerido feriado / Requerido promedio de
   * dias similares, por dia del mes (1-based), calculado por
   * `calcularFrancoFeriados`. En un dia con entrada acá, la cantidad de
   * francos NO reemplaza al franco normal del dia de semana — se le suma un
   * extra sobre la nomina activa:
   *
   *   agentesFrancoExtra = (1 - %francoNormal) * (1 - %hsRequeridasFeriado) * nominaActiva
   *
   * Si el cliente pide el 100% de lo habitual, el extra da 0 (el feriado se
   * comporta como un dia normal de esa semana). Si pide 0% (cierre total),
   * el extra manda a franco a todos los que quedaban.
   */
  francoFeriadoPorDia?: Map<number, number>;
  /**
   * Eventos de dotación fechados (bajas/altas/cambios de servicio puntuales),
   * keyeados por día del mes (1-based). El valor es el delta NETO de ese día
   * puntual (no acumulado) — positivo para altas, negativo para bajas. Se
   * acumulan internamente día a día: a partir del día del evento, la nómina
   * base queda desplazada por la suma de los deltas anteriores, replicando la
   * columna "Ingresos" del archivo de referencia del cliente (que hace que la
   * Nómina Final baje/suba en una fecha puntual en vez de asumir una nómina
   * constante todo el mes).
   */
  eventosPorDia?: Map<number, number>;
}

export interface ResultadoDia {
  dia: number;
  diaSemana: DiaSemana;
  /** nominaInicial + eventos de dotacion acumulados hasta este dia (antes de vacaciones/LP/rotacion). */
  nominaBase: number;
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
  let acumuladoEventos = 0;

  for (let dia = 1; dia <= input.diasDelMes; dia++) {
    const fecha = new Date(Date.UTC(input.anio, input.mes - 1, dia));
    const diaSemana = DIA_SEMANA_POR_INDICE[fecha.getUTCDay()];

    acumuladoEventos += input.eventosPorDia?.get(dia) ?? 0;
    const nominaBase = input.nominaInicial + acumuladoEventos;

    const vacaciones = input.vacacionesPorDia ? input.vacacionesPorDia(dia) : 0;
    const licencia = input.licenciaPorDia
      ? input.licenciaPorDia(dia)
      : input.licenciaConstante ?? 0;
    // La rampa de rotacion se calcula sobre la nomina BASE del dia (ya con
    // los eventos acumulados hasta ese punto), no sobre la nomina inicial
    // constante — verificado contra la formula real de la referencia
    // (Excel: Rotacion = %Rotacion * (dia/diasDelMes) * Nomina Final del
    // dia, con "Nomina Final" arrastrando los Ingresos acumulados). Si no
    // hay eventos, nominaBase === nominaInicial todo el mes y esto se
    // comporta exactamente igual que antes.
    const bajasRotacion =
      (input.rotacionMensual / input.diasDelMes) * dia * nominaBase;

    const nominaActiva = nominaBase - vacaciones - licencia - bajasRotacion;

    const licenciaPagaRaw = input.licenciaPagaPorDia
      ? input.licenciaPagaPorDia(dia)
      : input.licenciaPagaConstante ?? licencia;
    const licenciaPaga = Math.min(licencia, licenciaPagaRaw);

    const francoPctNormal = input.francoPorDiaSemana[diaSemana] ?? 0;
    const pctHsRequeridasFeriado = input.francoFeriadoPorDia?.get(dia);
    // Replica la planilla de referencia del area. Dos componentes de franco,
    // con bases distintas (verificado contra los ejemplos reales de Integral
    // Movil AMBA e Interior, dia a dia):
    //  - Franco normal del dia de semana: si la tasa es 100% (cierre TOTAL
    //    del servicio ese dia, ej. findes de un call center que no atiende),
    //    se aplica sobre la nomina activa MAS la LP paga — la referencia
    //    sigue contando a la gente en LP paga en el franco del cierre (sigue
    //    "en el roster"), pero a la LP NO paga ya la excluyo del todo (no
    //    entra ni como presente ni como franco). Si la tasa es parcial
    //    (rotacion normal de descanso entre el staff activo), se aplica sobre
    //    la nomina activa sola, sin sumar LP de ningun tipo (ejemplo real:
    //    Individuos Abono Fijo, donde LP nunca entra en la rotacion de
    //    francos).
    //  - Extra por feriado: siempre sobre la nomina activa, sea cual sea la
    //    tasa normal del dia.
    // Sin piso en cero: un cierre total de fin de semana con LP paga manda a
    // franco a mas gente de la que hay activa, y ese dia aporta HS LOGUEO
    // NEGATIVO al mes — igual que la referencia, que no clampea este calculo.
    const francoBaseSobre = francoPctNormal >= 1 ? nominaActiva + licenciaPaga : nominaActiva;
    const francoExtra =
      pctHsRequeridasFeriado === undefined
        ? 0
        : (1 - francoPctNormal) * (1 - pctHsRequeridasFeriado) * nominaActiva;
    const agentesFranco = francoPctNormal * francoBaseSobre + francoExtra;

    const agentesAusentes = (nominaActiva - agentesFranco) * input.ausentismoMensual;
    const agentesPresentes = nominaActiva - agentesFranco - agentesAusentes;

    const hsLogueo = agentesPresentes * input.ponderadoHoras * (1 - input.deslogueoMensual);

    dias.push({
      dia,
      diaSemana,
      nominaBase,
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
 * Deriva %HS REQUERIDAS FERIADO por cada dia feriado de la matriz CP: el
 * Requerido del cliente ese feriado puntual, sobre el promedio de Requerido
 * de los demas dias con el mismo dia de semana (no feriados) del mes —
 * "dias similares". Si el cliente pide la mitad de lo habitual, da 0.5; si
 * pide lo mismo de siempre, da 1; si pide 0 (cierre total), da 0.
 *
 * El valor devuelto se usa en `calcularHsLogueoDiaADia` para ajustar la
 * cantidad de francos de ese dia (ver formula en `InputDiaADia.francoFeriadoPorDia`).
 *
 * Sin dias no-feriados con el mismo dia de semana para comparar, no se puede
 * derivar una base — ese feriado queda sin entrada en el mapa (se calcula
 * como un dia normal, sin ajuste).
 */
export function calcularFrancoFeriados(matriz: MatrizServicio): Map<number, number> {
  const requeridoPorDiaSemana = new Map<number, number[]>();

  matriz.dias.forEach((dia, i) => {
    if (dia.esFeriado) return;
    const diaSemanaIdx = new Date(dia.fecha).getUTCDay();
    const arr = requeridoPorDiaSemana.get(diaSemanaIdx) ?? [];
    arr.push(matriz.totalDiario[i] ?? 0);
    requeridoPorDiaSemana.set(diaSemanaIdx, arr);
  });

  const pctHsRequeridasFeriado = new Map<number, number>();
  matriz.dias.forEach((dia, i) => {
    if (!dia.esFeriado) return;
    const fecha = new Date(dia.fecha);
    const similares = requeridoPorDiaSemana.get(fecha.getUTCDay()) ?? [];
    if (similares.length === 0) return;

    const promedioSimilar = similares.reduce((a, b) => a + b, 0) / similares.length;
    if (promedioSimilar <= 0) return;

    const requeridoFeriado = matriz.totalDiario[i] ?? 0;
    pctHsRequeridasFeriado.set(fecha.getUTCDate(), requeridoFeriado / promedioSimilar);
  });

  return pctHsRequeridasFeriado;
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
