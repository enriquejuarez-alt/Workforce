import type {
  Agente,
  DiaCoverage,
  FranjaCoverage,
  MatrizServicio,
  ServicioCoverage,
  ServicioKey,
} from "./types";

// Duración de turno en minutos por tipo de contrato (igual que el planner)
const DURACION_TURNO_MIN: Record<number, number> = {
  30: 360, // 6h
  35: 420, // 7h
  36: 360, // 6h
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Dado un agente y una franja (en minutos desde medianoche),
 * retorna su fracción de disponibilidad en esa franja de 30 min.
 *
 * Si tiene horario real: 1 si está dentro del turno, 0 si no.
 * Multiplicado por la fracción de días laborales (5/7 o 6/7).
 * Si NO tiene horario: usa distribución plana (hsSemanal / 7 / 24).
 */
function disponibilidadAgente(agente: Agente, franjaInicioMin: number): number {
  const fraccionDias = agente.hsSemanal === 36 ? 6 / 7 : 5 / 7;

  if (agente.entryTime && agente.exitTime) {
    const inicio = timeToMinutes(agente.entryTime);
    const duracion = DURACION_TURNO_MIN[agente.hsSemanal] ?? 360;
    const fin = inicio + duracion;
    const franjaFin = franjaInicioMin + 30;

    // Manejo de cruces de medianoche
    let dentroDelTurno: boolean;
    if (fin <= 1440) {
      dentroDelTurno = franjaInicioMin >= inicio && franjaFin <= fin;
    } else {
      // turno cruza medianoche
      dentroDelTurno =
        franjaInicioMin >= inicio ||
        franjaFin <= fin - 1440;
    }

    return dentroDelTurno ? fraccionDias : 0;
  }

  // Sin horario: distribución plana
  // TODO UX: mejorar si se incorpora horario completo en la nómina
  return (agente.hsSemanal / 7) / 24;
}

/**
 * Construye la coverage por franja y día para un servicio.
 * Usa la hcMatrix del CP (valores en HC) y la disponibilidad fraccional de los agentes.
 */
export function buildServicioCoverage(
  servicio: ServicioKey,
  matriz: MatrizServicio,
  agentesActivos: Agente[]
): ServicioCoverage {
  const numFranjas = matriz.franjas.length;
  const numDias = matriz.dias.length;

  // Precalcular disponibilidad de cada agente por franja (independiente del día)
  const dispPorFranja: number[] = Array(numFranjas).fill(0);
  for (let fi = 0; fi < numFranjas; fi++) {
    const franjaMin = fi * 30; // 00:00 = 0, 00:30 = 30, etc.
    let totalDisp = 0;
    for (const agente of agentesActivos) {
      totalDisp += disponibilidadAgente(agente, franjaMin);
    }
    dispPorFranja[fi] = totalDisp;
  }

  // Contar en cuántos días cada franja está en déficit
  const diasEnDeficit: number[] = Array(numFranjas).fill(0);

  const dias: DiaCoverage[] = [];

  for (let di = 0; di < numDias; di++) {
    const diaInfo = matriz.dias[di];
    const franjasCoverage: FranjaCoverage[] = [];
    let totalGapDia = 0;

    for (let fi = 0; fi < numFranjas; fi++) {
      const hcReq = matriz.hcMatrix[fi]?.[di] ?? 0;
      const hcDisp = dispPorFranja[fi];
      const gap = hcDisp - hcReq;

      let estado: FranjaCoverage["estado"];
      if (hcReq === 0) {
        estado = "surplus";
      } else {
        const ratio = hcDisp / hcReq;
        if (ratio >= 1.05) estado = "surplus";
        else if (ratio >= 0.90) estado = "ok";
        else estado = "deficit";
      }

      if (estado === "deficit") diasEnDeficit[fi]++;

      totalGapDia += gap;
      franjasCoverage.push({
        franja: matriz.franjas[fi],
        hcRequerido: hcReq,
        hcDisponible: hcDisp,
        gap,
        estado,
      });
    }

    dias.push({
      fecha: diaInfo.fecha,
      diaSemana: diaInfo.diaSemana,
      esFeriado: diaInfo.esFeriado,
      franjas: franjasCoverage,
      totalGap: totalGapDia,
    });
  }

  // Franjas críticas: en déficit en ≥50% de los días
  const franjasCriticas = matriz.franjas.filter(
    (_, fi) => numDias > 0 && diasEnDeficit[fi] / numDias >= 0.5
  );

  // Coverage promedio del mes por franja
  const coveragePorFranja: FranjaCoverage[] = matriz.franjas.map((franja, fi) => {
    const hcReq =
      dias.reduce((sum, d) => sum + (d.franjas[fi]?.hcRequerido ?? 0), 0) / numDias;
    const hcDisp = dispPorFranja[fi];
    const gap = hcDisp - hcReq;
    const ratio = hcReq > 0 ? hcDisp / hcReq : 2;
    return {
      franja,
      hcRequerido: hcReq,
      hcDisponible: hcDisp,
      gap,
      estado: ratio >= 1.05 ? "surplus" : ratio >= 0.90 ? "ok" : "deficit",
    };
  });

  console.log(
    `[coverage] ${servicio}: ${franjasCriticas.length} franjas críticas de ${numFranjas}`
  );

  return { servicio, dias, franjasCriticas, coveragePorFranja };
}

export function buildAllCoverage(
  matrices: Map<ServicioKey, MatrizServicio>,
  agentes: Agente[]
): Map<ServicioKey, ServicioCoverage> {
  const result = new Map<ServicioKey, ServicioCoverage>();
  for (const [key, matriz] of matrices) {
    const activos = agentes.filter(
      (a) => a.segmentoNorm === key && a.estado.toUpperCase() === "ACTIVO"
    );
    result.set(key, buildServicioCoverage(key, matriz, activos));
  }
  return result;
}
