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
    key: "Conectividad",
    label: "Conectividad",
    hojaCP: ["Sop_Conectividad", "Conectividad"],
    segmentosNomina: ["SOPORTE-CONECTIVIDAD", "SOPORTE CONECTIVIDAD"],
    reductorNombres: ["SOPORTE-CONECTIVIDAD", "SOPORTE CONECTIVIDAD"],
  },
  {
    key: "Entretenimiento",
    label: "Entretenimiento",
    hojaCP: "Entretenimiento",
    segmentosNomina: ["SOPORTE-ENTRETENIMIENTO", "SOPORTE ENTRETENIMIENTO"],
    reductorNombres: ["SOPORTE-ENTRETENIMIENTO", "SOPORTE ENTRETENIMIENTO"],
  },
  {
    key: "Esp.Movil",
    label: "Esp. Móvil",
    hojaCP: ["Esp_Movil", "Esp.Movil", "Esp Movil"],
    segmentosNomina: ["SOPORTE-MOVIL", "SOPORTE MOVIL", "ESP MOVIL"],
    reductorNombres: ["SOPORTE-MOVIL", "SOPORTE MOVIL"],
  },
  {
    key: "Digital",
    label: "Digital",
    hojaCP: "Digital",
    segmentosNomina: ["SOPORTE-RRSS", "SOPORTE RRSS", "RRSS"],
    reductorNombres: ["SOPORTE-RRSS", "SOPORTE RRSS"],
  },
  {
    key: "PTF",
    label: "PTF",
    hojaCP: "PTF",
    segmentosNomina: ["SOPORTE-CBS", "SOPORTE CBS", "CBS"],
    reductorNombres: ["SOPORTE-CBS", "SOPORTE CBS"],
  },
  {
    key: "Tecnica",
    label: "Tecnica",
    hojaCP: ["SMB Tec In", "SMB_Tec_In", "Tec_In", "Tecnica"],
    segmentosNomina: ["TECNICA", "TECNICA INBOUND"],
    reductorNombres: ["Tecnica", "TECNICA"],
  },
  {
    key: "Tec.RRSS",
    label: "Tec. RRSS",
    hojaCP: ["SMB_Digital", "SMB Digital", "Tec_RRSS", "Tecnica RRSS"],
    segmentosNomina: ["TECNICA RRSS"],
    reductorNombres: ["Tecnica RRSS", "TECNICA RRSS"],
  },
  {
    key: "Tec.PTF",
    label: "Tec. PTF",
    hojaCP: ["SMB PTF", "SMB_PTF", "Tec_PTF"],
    segmentosNomina: ["PWTF TECNICA", "TECNICA POWER TO FRONT"],
    reductorNombres: ["TECNICA POWER TO FRONT", "PWTF TECNICA"],
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
