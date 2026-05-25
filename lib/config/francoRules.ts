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

export interface ReglaFrancoContrato {
  hsSemanal: number;
  label: string;
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
