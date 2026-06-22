import type { ServiceDefinition } from "./services";

const FRANCO_36HS = { diasVentana: 4, fraccionAfectada: 1.0 };

export const SERVICIOS_RETENCION: ServiceDefinition[] = [
  {
    key: "RETENCION-MOVIL",
    label: "Retencion",
    hojaCP: ["Retencion Movil", "RETENCION MOVIL"],
    segmentosNomina: ["RETENCION", "RETENCION Movil", "RETENCION MOVIL", "Retencion Movil"],
    reductorNombres: ["RETENCION", "RETENCION MOVIL", "RETENCION Movil", "Retencion Movil"],
    francoConfig: FRANCO_36HS,
  },
  {
    key: "RETENCION-CONVERGENTE",
    label: "Retencion Convergente",
    hojaCP: ["Retencion Convergente", "PLP Total vinculante"],
    segmentosNomina: [
      "RETENCION Convergente",
      "RETENCION CONVERGENTE",
      "Retencion Convergente",
    ],
    reductorNombres: [
      "RETENCION CONVERGENTE",
      "RETENCION Convergente",
      "Retencion Convergente",
      "RETENCION",
    ],
    francoConfig: FRANCO_36HS,
  },
];
