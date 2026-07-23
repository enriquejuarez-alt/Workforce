import type { Agente } from "./types";

export interface AgenteHipoteticoRow {
  id: string;
  servicio: string; // ServicioKey destino (isla/servicio)
  servicioLabel: string; // label para mostrar, ya que servicio es solo la key
  cantidad: number;
  contrato: string; // "30" | "35" | "36" | "40" | valor libre
  horarioDesde?: string; // "09:00", opcional — sin horario usa distribución plana en coverageEngine
  horarioHasta?: string;
}

/**
 * Expande las filas de agentes hipotéticos a objetos Agente reales, listos
 * para concatenar al array de agentes de la nómina antes de aplicarDiasAlMes.
 * Sin datos reales (DNI/usuario/nombre): solo sirven para simular dotación
 * que todavía no existe en el sistema.
 */
export function expandirAgentesHipoteticos(rows: AgenteHipoteticoRow[]): Agente[] {
  const agentes: Agente[] = [];

  for (const row of rows) {
    const hsSemanal = parseFloat(row.contrato) || 36;
    const cantidad = Math.max(0, Math.floor(row.cantidad) || 0);

    for (let i = 1; i <= cantidad; i++) {
      agentes.push({
        dni: `HIP-${row.id}-${i}`,
        nombre: `Agente hipotético ${i} (${row.contrato}hs)`,
        usuario: `hipotetico-${row.id}-${i}`,
        segmento: row.servicioLabel,
        segmentoNorm: row.servicio,
        estado: "ACTIVO",
        hsSemanal,
        hsMensualBrutas: 0, // se completa en aplicarDiasAlMes, igual que los agentes reales
        entryTime: row.horarioDesde || null,
        exitTime: row.horarioHasta || null,
        sitio: "",
        modalidad: "",
        jefe: "",
        superior: "(Hipotético)",
        fechaInicioAtencion: null,
        esCapa: false,
      });
    }
  }

  return agentes;
}

export function contarAgentesHipoteticos(rows: AgenteHipoteticoRow[]): number {
  return rows.reduce((acc, r) => acc + Math.max(0, Math.floor(r.cantidad) || 0), 0);
}
