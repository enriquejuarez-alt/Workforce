import type {
  Agente,
  AgentesEquivalentes,
  MatrizServicio,
  ModoReductor,
  Reductor,
  ResultadoGeneral,
  ResultadoServicio,
  ServicioKey,
} from "./types";
import { SERVICIOS_KEYS } from "./types";
import { resolverServicioPorReductor } from "./mapeo";

// ─── Funciones puras de cálculo ────────────────────────────────────────────────

export function calcularHsMensualBrutas(
  hsSemanal: number,
  diasDelMes: number
): number {
  return hsSemanal * (diasDelMes / 7);
}

export function calcularFactorProductivo(
  deslogueo: number,
  ausentismo: number,
  rotacion: number,
  modo: ModoReductor
): number {
  if (modo === "multiplicativo") {
    return (1 - deslogueo) * (1 - ausentismo) * (1 - rotacion);
  }
  return 1 - (deslogueo + ausentismo + rotacion);
}

export function calcularCumplimiento(
  hsNetas: number,
  hsRequeridas: number
): number {
  if (hsRequeridas === 0) return 0;
  return (hsNetas / hsRequeridas) * 100;
}

export function calcularDeltaHC103(
  hcActivos: number,
  factorProductivo: number,
  hsSemanalPromedio: number,
  diasDelMes: number,
  hsRequeridas: number
): number {
  const hsNetasPor103 = hsRequeridas * 1.03;
  const hsBrutasNecesarias =
    factorProductivo > 0 ? hsNetasPor103 / factorProductivo : 0;
  const hsBrutasActuales = hcActivos * hsSemanalPromedio * (diasDelMes / 7);
  const diffHsBrutas = hsBrutasNecesarias - hsBrutasActuales;
  const hsPorAgente = hsSemanalPromedio * (diasDelMes / 7);
  if (hsPorAgente === 0) return 0;
  return diffHsBrutas / hsPorAgente;
}

// Punto 7: cuántos agentes de cada tipo hacen falta para cubrir el gap
export function calcularAgentesEquivalentes(
  deltaHC103: number,
  factorProductivo: number,
  diasDelMes: number,
  hsSemanalPromedio: number
): AgentesEquivalentes {
  if (deltaHC103 >= 0) {
    // ya hay déficit: cuántos agentes de cada tipo hacen falta
    const calcEq = (hs: number) => {
      const hsPorAgente = hs * (diasDelMes / 7) * factorProductivo;
      if (hsPorAgente === 0) return 0;
      // deltaHC103 en HC, convertir a hs gap
      const hsPorHC = hsSemanalPromedio * (diasDelMes / 7);
      const hsGap = deltaHC103 * hsPorHC;
      return hsGap / hsPorAgente;
    };
    return {
      hs30: calcEq(30),
      hs35: calcEq(35),
      hs36: calcEq(36),
      mix: deltaHC103, // ya en HC con promedio del pool
    };
  }
  return { hs30: 0, hs35: 0, hs36: 0, mix: 0 };
}

// ─── Agrupación de agentes ─────────────────────────────────────────────────────

interface GrupoServicio {
  hcActivos: number;
  hcLP: number;
  hcCapa: number;
  hsBrutas: number;
  hsSemanalSuma: number;
  hsSemanalConteo: number;
}

function agruparAgentesPorServicio(
  agentes: Agente[]
): Map<ServicioKey, GrupoServicio> {
  const mapa = new Map<ServicioKey, GrupoServicio>();
  for (const key of SERVICIOS_KEYS) {
    mapa.set(key, { hcActivos: 0, hcLP: 0, hcCapa: 0, hsBrutas: 0, hsSemanalSuma: 0, hsSemanalConteo: 0 });
  }

  for (const agente of agentes) {
    const grupo = mapa.get(agente.segmentoNorm as ServicioKey);
    if (!grupo) continue;

    if (agente.estado.toUpperCase() === "ACTIVO") {
      grupo.hcActivos += 1;
      grupo.hsBrutas += isNaN(agente.hsMensualBrutas) ? 0 : agente.hsMensualBrutas;
      grupo.hsSemanalSuma += isNaN(agente.hsSemanal) ? 36 : agente.hsSemanal;
      grupo.hsSemanalConteo += 1;
      if (agente.esCapa) grupo.hcCapa += 1;
    } else {
      grupo.hcLP += 1;
    }
  }

  return mapa;
}

// ─── Cálculo principal ─────────────────────────────────────────────────────────

export function calcularResultados(
  agentes: Agente[],
  matrices: Map<ServicioKey, MatrizServicio>,
  reductores: Reductor[],
  diasDelMes: number,
  modo: ModoReductor,
  topeFacturacion = 103
): ResultadoGeneral {
  const reductorPorServicio = new Map<ServicioKey, Reductor>();
  for (const r of reductores) {
    const key = resolverServicioPorReductor(r.servicioNorm);
    if (key) reductorPorServicio.set(key, r);
  }

  const grupos = agruparAgentesPorServicio(agentes);
  const resultados: ResultadoServicio[] = [];

  for (const servicio of SERVICIOS_KEYS) {
    const grupo = grupos.get(servicio) ?? {
      hcActivos: 0,
      hcLP: 0,
      hcCapa: 0,
      hsBrutas: 0,
      hsSemanalSuma: 0,
      hsSemanalConteo: 0,
    };
    const hsSemanalPromedio =
      grupo.hsSemanalConteo > 0
        ? grupo.hsSemanalSuma / grupo.hsSemanalConteo
        : 36;

    const reductor = reductorPorServicio.get(servicio);
    const deslogueo = reductor?.deslogueo ?? 0;
    const ausentismo = reductor?.ausentismo ?? 0;
    const rotacion = reductor?.rotacion ?? 0;

    const factorProductivo = calcularFactorProductivo(deslogueo, ausentismo, rotacion, modo);
    const hsNetas = grupo.hsBrutas * factorProductivo;
    const rawHsReq = matrices.get(servicio)?.totalMes ?? 0;
    const hsRequeridas = isNaN(rawHsReq) ? 0 : rawHsReq;
    const cumplimiento = calcularCumplimiento(hsNetas, hsRequeridas);
    const deltaHC103 = calcularDeltaHC103(
      grupo.hcActivos,
      factorProductivo,
      hsSemanalPromedio,
      diasDelMes,
      hsRequeridas
    );
    const agentesEquivalentes = calcularAgentesEquivalentes(
      deltaHC103,
      factorProductivo,
      diasDelMes,
      hsSemanalPromedio
    );

    const tope = hsRequeridas * (topeFacturacion / 100);
    const teoricoFacturable = Math.min(hsNetas, tope);
    const recorte = Math.max(0, hsNetas - tope);
    const faltante = Math.max(0, hsRequeridas - hsNetas);

    resultados.push({
      servicio,
      hcActivos: grupo.hcActivos,
      hcLP: grupo.hcLP,
      hcCapa: grupo.hcCapa,
      hsBrutas: grupo.hsBrutas,
      factorProductivo,
      hsNetas,
      hsRequeridas,
      cumplimiento,
      deltaHC103,
      reductoRes: { deslogueo, ausentismo, rotacion },
      agentesEquivalentes,
      hsSemanalPromedio,
      tope,
      teoricoFacturable,
      recorte,
      faltante,
    });
  }

  const safeAdd = (a: number, v: number) => a + (isNaN(v) ? 0 : v);
  const totalHCActivos = resultados.reduce((a, r) => safeAdd(a, r.hcActivos), 0);
  const totalHCLP = resultados.reduce((a, r) => safeAdd(a, r.hcLP), 0);
  const totalHCCapa = resultados.reduce((a, r) => safeAdd(a, r.hcCapa), 0);
  const totalHsRequeridas = resultados.reduce((a, r) => safeAdd(a, r.hsRequeridas), 0);
  const totalHsNetas = resultados.reduce((a, r) => safeAdd(a, r.hsNetas), 0);
  const totalTeoricoFacturable = resultados.reduce((a, r) => safeAdd(a, r.teoricoFacturable), 0);
  const cumplimientoTotal = calcularCumplimiento(totalHsNetas, totalHsRequeridas);

  const primeraMatriz = matrices.values().next().value as MatrizServicio | undefined;
  const mes = primeraMatriz?.dias[0]?.fecha
    ? primeraMatriz.dias[0].fecha.toLocaleDateString("es-AR", {
        month: "long",
        year: "numeric",
      })
    : "Sin fecha";

  return {
    mes,
    diasDelMes,
    resultados,
    totalHCActivos,
    totalHCLP,
    totalHCCapa,
    totalHsRequeridas,
    totalTeoricoFacturable,
    cumplimientoTotal,
  };
}

// ─── Coverage helpers (para gráficos) ──────────────────────────────────────────

export function calcularHCRequeridoPorFranja(
  matriz: MatrizServicio
): number[] {
  return matriz.hcMatrix.map((franjaRow) =>
    franjaRow.reduce((a, b) => a + b, 0) / franjaRow.length
  );
}

export function calcularHCDisponiblePorFranja(
  hcActivos: number,
  hsSemanalPromedio: number
): number[] {
  // Distribución plana (fallback si no hay horarios)
  const hcPorFranja = (hcActivos * hsSemanalPromedio) / 7 / 24;
  return Array(48).fill(hcPorFranja);
}
