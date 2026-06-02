export type DiaSemana =
  | "lunes"
  | "martes"
  | "miercoles"
  | "jueves"
  | "viernes"
  | "sabado"
  | "domingo";

export const DIAS_SEMANA: DiaSemana[] = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
];

export const DIA_LABELS: Record<DiaSemana, string> = {
  lunes: "Lun",
  martes: "Mar",
  miercoles: "Mié",
  jueves: "Jue",
  viernes: "Vie",
  sabado: "Sáb",
  domingo: "Dom",
};

export interface FrancoVentana {
  dias: DiaSemana[];
}

export type TipoDistribucionJornada = "uniforme" | "base_extra_diario";

export interface DistribucionJornada {
  tipo: TipoDistribucionJornada;
  diasLaborables?: DiaSemana[];
  hsBaseDia?: number;
  hsExtraDia?: number;
  diasExtra?: DiaSemana[];
}

export interface ReglaFrancoContrato {
  hsSemanal: number;
  label: string;
  distribucion?: DistribucionJornada;
  francos: FrancoVentana[];
}

export const FRANCO_DEFAULTS: ReglaFrancoContrato[] = [
  {
    hsSemanal: 24,
    label: "24 hs",
    francos: [
      { dias: ["lunes", "martes", "miercoles", "jueves", "viernes"] },
      { dias: ["sabado", "domingo"] },
    ],
  },
  {
    hsSemanal: 30,
    label: "30 hs",
    francos: [
      { dias: ["lunes", "martes", "miercoles", "jueves", "viernes"] },
      { dias: ["sabado", "domingo"] },
    ],
  },
  {
    hsSemanal: 35,
    label: "35 hs",
    francos: [
      { dias: ["lunes", "martes", "miercoles", "jueves", "viernes"] },
      { dias: ["sabado", "domingo"] },
    ],
  },
  {
    hsSemanal: 36,
    label: "36 hs",
    francos: [{ dias: ["jueves", "viernes", "sabado", "domingo"] }],
  },
];

/**
 * Returns the expected fraction of agents on franco for a given day.
 * Formula: for each franco window that contains the day, add 1/|window|.
 * Windows are non-overlapping by design so there is no double-counting.
 */
export function probabilidadFrancoDia(
  regla: ReglaFrancoContrato,
  dia: DiaSemana
): number {
  let p = 0;
  for (const ventana of regla.francos) {
    if (ventana.dias.includes(dia)) {
      p += 1 / ventana.dias.length;
    }
  }
  return p;
}

export function horasContratoDia(regla: ReglaFrancoContrato, dia: DiaSemana): number | null {
  const distribucion = regla.distribucion;
  if (!distribucion || distribucion.tipo === "uniforme") return null;

  if (distribucion.tipo === "base_extra_diario") {
    const diasLaborables = distribucion.diasLaborables ?? [];
    if (!diasLaborables.includes(dia)) return 0;

    const base = distribucion.hsBaseDia ?? 0;
    const extra = distribucion.diasExtra?.includes(dia) ? distribucion.hsExtraDia ?? 0 : 0;
    return base + extra;
  }

  return null;
}
