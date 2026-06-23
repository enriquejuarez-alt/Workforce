import type { ServiceDefinition } from "./services";

const FRANCO_36HS = { diasVentana: 4, fraccionAfectada: 1.0 };

export const SERVICIOS_MIGRACION: ServiceDefinition[] = [
  {
    key: "MIGRACION-COBRE-AMBA",
    label: "Migracion Cobre AMBA",
    hojaCP: [
      "Hoja1",
      "MIGRACION COBRE AMBA",
      "Migracion Cobre AMBA",
      "COBRE AMBA",
      "Mig Cobre AMBA",
      "Konecta Migra Cobre AMBA",
    ],
    segmentosNomina: [
      "MIGRACION COBRE AMBA",
      "Migracion Cobre AMBA",
      "COBRE AMBA",
    ],
    reductorNombres: [
      "MIGRACION COBRE AMBA",
      "Migracion Cobre AMBA",
      "COBRE AMBA",
    ],
    francoConfig: FRANCO_36HS,
  },
  {
    key: "MIGRACION-COBRE-INTERIOR",
    label: "Migracion Cobre Interior",
    hojaCP: [
      "Hoja1",
      "MIGRACION COBRE INTERIOR",
      "Migracion Cobre Interior",
      "COBRE INTERIOR",
      "Mig Cobre Interior",
      "Konecta Migra Cobre Interior",
    ],
    segmentosNomina: [
      "MIGRACION COBRE INTERIOR",
      "Migracion Cobre Interior",
      "COBRE INTERIOR",
    ],
    reductorNombres: [
      "MIGRACION COBRE INTERIOR",
      "Migracion Cobre Interior",
      "COBRE INTERIOR",
    ],
    francoConfig: FRANCO_36HS,
  },
];
