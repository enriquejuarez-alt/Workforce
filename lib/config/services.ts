export interface ServiceDefinition {
  key: string;
  label: string;
  /** Primary sheet name or list of accepted aliases (first match wins) */
  hojaCP: string | string[];
  /** All nómina segment name aliases that map to this service */
  segmentosNomina: string[];
  /** All reductor name aliases that map to this service */
  reductorNombres: string[];
}

export const SERVICIOS: ServiceDefinition[] = [
  {
    key: "SOPORTE-CBS",
    label: "SOPORTE-CBS",
    hojaCP: ["PTF", "CBS", "Soporte CBS"],
    segmentosNomina: ["SOPORTE-CBS", "SOPORTE CBS", "CBS"],
    reductorNombres: ["SOPORTE-CBS", "SOPORTE CBS"],
  },
  {
    key: "SOPORTE-CONECTIVIDAD",
    label: "SOPORTE-CONECTIVIDAD",
    hojaCP: ["Sop_Conectividad", "Conectividad", "SOPORTE-CONECTIVIDAD"],
    segmentosNomina: ["SOPORTE-CONECTIVIDAD", "SOPORTE CONECTIVIDAD"],
    reductorNombres: ["SOPORTE-CONECTIVIDAD", "SOPORTE CONECTIVIDAD"],
  },
  {
    key: "SOPORTE-ENTRETENIMIENTO",
    label: "SOPORTE-ENTRETENIMIENTO",
    hojaCP: ["Entretenimiento", "SOPORTE-ENTRETENIMIENTO"],
    segmentosNomina: ["SOPORTE-ENTRETENIMIENTO", "SOPORTE ENTRETENIMIENTO"],
    reductorNombres: ["SOPORTE-ENTRETENIMIENTO", "SOPORTE ENTRETENIMIENTO"],
  },
  {
    key: "SOPORTE-MOVIL",
    label: "SOPORTE-MOVIL",
    hojaCP: ["Esp_Movil", "Esp.Movil", "Esp Movil", "SOPORTE-MOVIL"],
    segmentosNomina: ["SOPORTE-MOVIL", "SOPORTE MOVIL", "ESP MOVIL"],
    reductorNombres: ["SOPORTE-MOVIL", "SOPORTE MOVIL"],
  },
  {
    key: "SOPORTE-RRSS",
    label: "SOPORTE-RRSS",
    hojaCP: ["Digital", "SOPORTE-RRSS", "RRSS"],
    segmentosNomina: ["SOPORTE-RRSS", "SOPORTE RRSS", "RRSS"],
    reductorNombres: ["SOPORTE-RRSS", "SOPORTE RRSS"],
  },
];

export type ServicioKey = string;

export const SERVICIOS_KEYS: ServicioKey[] = SERVICIOS.map((s) => s.key);

export function normalizar(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Returns the first sheet name alias that is present in hojasPresentes,
 * or null if none of the aliases are found.
 */
export function resolverHojaCP(
  servicioKey: ServicioKey,
  hojasPresentes: string[]
): string | null {
  const def = SERVICIOS.find((s) => s.key === servicioKey);
  if (!def) return null;
  const aliases = Array.isArray(def.hojaCP) ? def.hojaCP : [def.hojaCP];
  return aliases.find((h) => hojasPresentes.includes(h)) ?? null;
}

/**
 * Returns the ServicioKey for a nómina segment string, checking all aliases.
 */
export function resolverServicioPorSegmento(
  segmentoRaw: string
): ServicioKey | null {
  const norm = normalizar(segmentoRaw);
  for (const def of SERVICIOS) {
    if (def.segmentosNomina.some((alias) => normalizar(alias) === norm)) {
      return def.key;
    }
  }
  return null;
}

/**
 * Returns the ServicioKey for a reductor name string, checking all aliases.
 */
export function resolverServicioPorReductor(
  nombreReductor: string
): ServicioKey | null {
  const norm = normalizar(nombreReductor);
  for (const def of SERVICIOS) {
    if (def.reductorNombres.some((alias) => normalizar(alias) === norm)) {
      return def.key;
    }
  }
  return null;
}

/**
 * Returns all accepted hojaCP aliases for a service (for error messages).
 */
export function getHojasCP(servicioKey: ServicioKey): string[] {
  const def = SERVICIOS.find((s) => s.key === servicioKey);
  if (!def) return [];
  return Array.isArray(def.hojaCP) ? def.hojaCP : [def.hojaCP];
}
