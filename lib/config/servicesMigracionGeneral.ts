import type { ServiceDefinition } from "./services";

// Servicio "Migracion" general — distinto de Migracion Cobre AMBA/Interior
// (lib/config/servicesMigracion.ts), que son islas separadas con su propio
// franco 36hs. Este es un tercer servicio de Migracion, sin relacion directa
// con las dos islas de Cobre.
export const SERVICIOS_MIGRACION_GENERAL: ServiceDefinition[] = [
  {
    key: "MIGRACION",
    label: "Migración",
    hojaCP: ["Hoja1", "MIGRACION", "Migración", "Migracion"],
    segmentosNomina: ["MIGRACION", "Migración", "Migracion"],
    reductorNombres: ["MIGRACION", "Migración", "Migracion"],
  },
];
