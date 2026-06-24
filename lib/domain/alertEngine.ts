import type {
  Alerta,
  ResultadoGeneral,
  ResultadoServicio,
} from "./types";

// ID único para cada alerta combinando timestamp y sufijo aleatorio
function nextId() {
  return `alerta-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// Genera el listado de alertas a partir del resultado de cálculo, ordenado por severidad
export function generarAlertas(resultado: ResultadoGeneral): Alerta[] {
  const alertas: Alerta[] = [];

  // ── GLOBAL ──────────────────────────────────────────────────────────────────

  if (resultado.cumplimientoTotal < 100) {
    const deficit = resultado.totalHsRequeridas - resultado.resultados.reduce((s, r) => s + r.hsNetas, 0);
    alertas.push({
      id: nextId(),
      severidad: resultado.cumplimientoTotal < 90 ? "critical" : "warning",
      servicio: "global",
      mensaje: `Cumplimiento total por debajo del 100%`,
      detalle: `El equipo cubre el ${resultado.cumplimientoTotal.toFixed(1)}% del requerido del cliente.`,
      metrica: deficit,
      metricaLabel: "Hs de déficit",
    });
  }

  if (resultado.cumplimientoTotal > 115) {
    const exceso = resultado.resultados.reduce((s, r) => s + r.hsNetas, 0) - resultado.totalHsRequeridas;
    alertas.push({
      id: nextId(),
      severidad: "info",
      servicio: "global",
      mensaje: `Sobredotación global (${resultado.cumplimientoTotal.toFixed(1)}%)`,
      detalle: `Hay exceso de horas netas respecto al requerido.`,
      metrica: exceso,
      metricaLabel: "Hs excedentes",
    });
  }

  // ── POR SERVICIO ─────────────────────────────────────────────────────────────

  for (const r of resultado.resultados) {
    alertasServicio(r, alertas);
  }

  // Ordenar: critical → warning → info
  const orden: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  return alertas.sort((a, b) => orden[a.severidad] - orden[b.severidad]);
}

// Evalúa un servicio individual y agrega alertas según sus métricas de cumplimiento y reductores
function alertasServicio(r: ResultadoServicio, alertas: Alerta[]) {
  if (r.hcActivos === 0 && r.hsRequeridas > 0) {
    alertas.push({
      id: nextId(),
      severidad: "critical",
      servicio: r.servicio,
      mensaje: `Sin agentes activos pero con ${r.hsRequeridas.toFixed(0)} hs requeridas`,
      detalle: `Verificá el mapeo de segmento para este servicio.`,
    });
    return;
  }

  if (r.cumplimiento < 80) {
    alertas.push({
      id: nextId(),
      severidad: "critical",
      servicio: r.servicio,
      mensaje: `Déficit crítico: ${r.cumplimiento.toFixed(1)}% de cumplimiento`,
      detalle: `Faltan aprox. ${Math.ceil(r.deltaHC103)} A para alcanzar el 103%.`,
      metrica: r.deltaHC103,
      metricaLabel: "Agentes faltantes",
    });
  } else if (r.cumplimiento < 100) {
    alertas.push({
      id: nextId(),
      severidad: "warning",
      servicio: r.servicio,
      mensaje: `Cumplimiento bajo el 100% (${r.cumplimiento.toFixed(1)}%)`,
      detalle: `Delta A @ 103%: ${r.deltaHC103.toFixed(1)}`,
      metrica: r.deltaHC103,
      metricaLabel: "HC faltantes",
    });
  }

  const totalReductor =
    r.reductoRes.deslogueo + r.reductoRes.ausentismo + r.reductoRes.rotacion;
  if (totalReductor > 0.08) {
    alertas.push({
      id: nextId(),
      severidad: "warning",
      servicio: r.servicio,
      mensaje: `Reductor combinado elevado: ${(totalReductor * 100).toFixed(1)}%`,
      detalle: `Desl.: ${(r.reductoRes.deslogueo * 100).toFixed(1)}% · Aus.: ${(r.reductoRes.ausentismo * 100).toFixed(1)}% · Rot.: ${(r.reductoRes.rotacion * 100).toFixed(1)}%`,
      metrica: totalReductor * 100,
      metricaLabel: "% total",
    });
  }

  if (r.cumplimiento > 115) {
    alertas.push({
      id: nextId(),
      severidad: "info",
      servicio: r.servicio,
      mensaje: `Sobredotado (${r.cumplimiento.toFixed(1)}%)`,
      detalle: `Exceso de ${Math.abs(r.deltaHC103).toFixed(1)} A sobre el objetivo 103%.`,
      metrica: Math.abs(r.deltaHC103),
      metricaLabel: "Agentes excedentes",
    });
  }
}
