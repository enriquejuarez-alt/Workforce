import type {
  Agente,
  AgentesEquivalentes,
  FrancoAjuste,
  FrancoServicioDatos,
  MatrizServicio,
  ModoReductor,
  Reductor,
  ResultadoGeneral,
  ResultadoServicio,
  ServicioKey,
} from "./types";
import {
  getServiciosKeys,
  resolverServicioPorReductorRuntime,
  getServiciosActivos,
  getFrancoConfigRuntime,
} from "../config/servicesRuntime";
import { normalizar } from "../config/services";
import { calcularHsLogueoDiaADia } from "./hsLogueoDiaADia";

// ─── Funciones puras de cálculo ────────────────────────────────────────────────

// Convierte las horas semanales del contrato en horas brutas del mes
export function calcularHsMensualBrutas(
  hsSemanal: number,
  diasDelMes: number
): number {
  return hsSemanal * (diasDelMes / 7);
}

// Factor productivo: proporción real de horas trabajadas tras descontar reductores.
// Modo multiplicativo: (1-d)*(1-a)*(1-r); modo aditivo: 1-(d+a+r)
export function calcularFactorProductivo(
  deslogueo: number,
  ausentismo: number,
  rotacion: number,
  modo: ModoReductor
): number {
  const d = Math.min(1, Math.max(0, deslogueo));
  const a = Math.min(1, Math.max(0, ausentismo));
  const r = Math.min(1, Math.max(0, rotacion));
  if (modo === "multiplicativo") {
    return (1 - d) * (1 - a) * (1 - r);
  }
  return Math.max(0, 1 - (d + a + r));
}

// Porcentaje de cobertura de las horas requeridas por el cliente
export function calcularCumplimiento(
  hsNetas: number,
  hsRequeridas: number
): number {
  if (hsRequeridas === 0) return 0;
  return (hsNetas / hsRequeridas) * 100;
}

// Diferencia en HC para alcanzar el objetivo del 103% de facturación.
// Positivo = faltan agentes, negativo = hay excedente
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

// Totales por servicio: HC activos, LP (licencia/permiso), capacitaciones y horas brutas
interface GrupoServicio {
  hcActivos: number;
  hcLP: number;
  hcCapa: number;
  hsBrutas: number;
  hsSemanalSuma: number;
  hsSemanalConteo: number;
}

// Recorre la nómina y acumula métricas por segmento normalizado (ServicioKey)
function agruparAgentesPorServicio(
  agentes: Agente[]
): Map<ServicioKey, GrupoServicio> {
  const mapa = new Map<ServicioKey, GrupoServicio>();
  for (const key of getServiciosKeys()) {
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

// Función central: cruza nómina, matrices CP y reductores para producir ResultadoGeneral.
// topeFacturacion (por defecto 103) limita las horas que se pueden facturar al cliente.
export function calcularResultados(
  agentes: Agente[],
  matrices: Map<ServicioKey, MatrizServicio>,
  reductores: Reductor[],
  diasDelMes: number,
  modo: ModoReductor,
  topeFacturacion = 103,
  francosServicio: FrancoServicioDatos[] = []
): ResultadoGeneral {
  const reductorPorServicio = new Map<ServicioKey, Reductor>();
  for (const r of reductores) {
    const keys = getServiciosActivos()
      .filter((def) =>
        def.reductorNombres.some((alias) => normalizar(alias) === normalizar(r.servicioNorm))
      )
      .map((def) => def.key);
    const resolvedKeys = keys.length > 0 ? keys : [resolverServicioPorReductorRuntime(r.servicioNorm)].filter(Boolean);
    for (const key of resolvedKeys) {
      reductorPorServicio.set(key as ServicioKey, r);
    }
  }

  const francoPorServicio = new Map<ServicioKey, FrancoServicioDatos>();
  for (const f of francosServicio) {
    const keys = getServiciosActivos()
      .filter((def) =>
        def.reductorNombres.some((alias) => normalizar(alias) === normalizar(f.servicioNorm))
      )
      .map((def) => def.key);
    const resolvedKeys = keys.length > 0 ? keys : [resolverServicioPorReductorRuntime(f.servicioNorm)].filter(Boolean);
    for (const key of resolvedKeys) {
      francoPorServicio.set(key as ServicioKey, f);
    }
  }

  const primeraMatrizPre = matrices.values().next().value as MatrizServicio | undefined;
  const primerFechaPre = primeraMatrizPre?.dias[0]?.fecha;
  const mesNumPre = primerFechaPre ? primerFechaPre.getMonth() + 1 : null;
  const anioNumPre = primerFechaPre ? primerFechaPre.getFullYear() : null;

  const grupos = agruparAgentesPorServicio(agentes);
  const resultados: ResultadoServicio[] = [];

  for (const servicio of getServiciosKeys()) {
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

    const factorProductivoPlano = calcularFactorProductivo(deslogueo, ausentismo, rotacion, modo);
    let hsNetas = grupo.hsBrutas * factorProductivoPlano;
    let factorProductivo = factorProductivoPlano;

    const franco = francoPorServicio.get(servicio);
    if (franco && mesNumPre && anioNumPre && franco.ponderadoHoras > 0) {
      // Nomina inicial "efectiva" (activos ya ajustados por vacaciones parciales,
      // ver aplicarDiasAlMes) + LP, ya que el motor dia-a-dia resta LP el mes entero.
      const nominaInicialEfectiva =
        hsSemanalPromedio > 0
          ? grupo.hsBrutas / (hsSemanalPromedio * (diasDelMes / 7))
          : grupo.hcActivos;
      const nominaInicial = nominaInicialEfectiva + grupo.hcLP;

      const { totalHsLogueo } = calcularHsLogueoDiaADia({
        nominaInicial,
        diasDelMes,
        anio: anioNumPre,
        mes: mesNumPre,
        licenciaConstante: grupo.hcLP,
        rotacionMensual: rotacion,
        ausentismoMensual: ausentismo,
        deslogueoMensual: deslogueo,
        ponderadoHoras: franco.ponderadoHoras,
        francoPorDiaSemana: {
          lunes: franco.francoLunes,
          martes: franco.francoMartes,
          miercoles: franco.francoMiercoles,
          jueves: franco.francoJueves,
          viernes: franco.francoViernes,
          sabado: franco.francoSabado,
          domingo: franco.francoDomingo,
        },
      });

      hsNetas = totalHsLogueo;
      factorProductivo = grupo.hsBrutas > 0 ? hsNetas / grupo.hsBrutas : factorProductivoPlano;
    }

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
    const hsFacturable100 = Math.min(hsNetas, hsRequeridas);
    const recorte = Math.max(0, hsNetas - tope);
    const faltante = Math.max(0, hsRequeridas - hsNetas);

    const francoConfig = getFrancoConfigRuntime(servicio);
    let francoAjuste: FrancoAjuste | null = null;
    if (francoConfig && francoConfig.fraccionAfectada > 0) {
      const factorDisponible = 1 - francoConfig.fraccionAfectada / francoConfig.diasVentana;
      const hcNecesarioBruto = grupo.hcActivos + deltaHC103;
      const hcConFranco = factorDisponible > 0 ? hcNecesarioBruto / factorDisponible : hcNecesarioBruto;
      francoAjuste = { factorDisponible, hcNecesarioBruto, hcConFranco, extra: hcConFranco - hcNecesarioBruto };
    }

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
      hsFacturable100,
      recorte,
      faltante,
      francoAjuste,
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

  const mes = primerFechaPre
    ? primerFechaPre.toLocaleDateString("es-AR", { month: "long", year: "numeric" })
    : "Sin fecha";
  const mesNum  = mesNumPre ?? new Date().getMonth() + 1;
  const anioNum = anioNumPre ?? new Date().getFullYear();

  return {
    mes,
    mesNum,
    anioNum,
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

// Promedio de HC requerido en cada franja horaria según la matriz del CP
export function calcularHCRequeridoPorFranja(
  matriz: MatrizServicio
): number[] {
  return matriz.hcMatrix.map((franjaRow) =>
    franjaRow.reduce((a, b) => a + b, 0) / franjaRow.length
  );
}

// HC disponible por franja usando distribución plana cuando no hay horarios individuales
export function calcularHCDisponiblePorFranja(
  hcActivos: number,
  hsSemanalPromedio: number
): number[] {
  // Distribución plana (fallback si no hay horarios) — 48 franjas de 30 min
  const hcPorFranja = (hcActivos * hsSemanalPromedio) / 7 / 48;
  return Array(48).fill(hcPorFranja);
}
