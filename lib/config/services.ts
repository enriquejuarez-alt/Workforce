export interface FrancoConfig {
  /** Days in the franco rotation window (e.g. 4 for Thu–Sun) */
  diasVentana: number;
  /** Fraction of agents subject to franco (0–1). 1.0 = all agents */
  fraccionAfectada: number;
}

export interface ServiceDefinition {
  key: string;
  label: string;
  /** Primary sheet name or list of accepted aliases (first match wins) */
  hojaCP: string | string[];
  /** All nómina segment name aliases that map to this service */
  segmentosNomina: string[];
  /** All reductor name aliases that map to this service */
  reductorNombres: string[];
  /** Franco rotation config for 36hs contracts (Thu–Sun window) */
  francoConfig?: FrancoConfig;
}

const FRANCO_36HS: FrancoConfig = { diasVentana: 4, fraccionAfectada: 1.0 };

export const SERVICIOS: ServiceDefinition[] = [
  {
    key: "SOPORTE-CBS",
    label: "SOPORTE-CBS",
    hojaCP: ["PTF", "CBS", "Soporte CBS"],
    segmentosNomina: ["SOPORTE-CBS", "SOPORTE CBS", "CBS"],
    reductorNombres: ["SOPORTE-CBS", "SOPORTE CBS"],
    francoConfig: FRANCO_36HS,
  },
  {
    key: "SOPORTE-CONECTIVIDAD",
    label: "SOPORTE-CONECTIVIDAD",
    hojaCP: ["Sop_Conectividad", "Conectividad", "SOPORTE-CONECTIVIDAD"],
    segmentosNomina: ["SOPORTE-CONECTIVIDAD", "SOPORTE CONECTIVIDAD"],
    reductorNombres: ["SOPORTE-CONECTIVIDAD", "SOPORTE CONECTIVIDAD"],
    francoConfig: FRANCO_36HS,
  },
  {
    key: "SOPORTE-ENTRETENIMIENTO",
    label: "SOPORTE-ENTRETENIMIENTO",
    hojaCP: ["Entretenimiento", "SOPORTE-ENTRETENIMIENTO"],
    segmentosNomina: ["SOPORTE-ENTRETENIMIENTO", "SOPORTE ENTRETENIMIENTO"],
    reductorNombres: ["SOPORTE-ENTRETENIMIENTO", "SOPORTE ENTRETENIMIENTO"],
    francoConfig: FRANCO_36HS,
  },
  {
    key: "SOPORTE-MOVIL",
    label: "SOPORTE-MOVIL",
    hojaCP: ["Esp_Movil", "Esp.Movil", "Esp Movil", "SOPORTE-MOVIL"],
    segmentosNomina: ["SOPORTE-MOVIL", "SOPORTE MOVIL", "ESP MOVIL"],
    reductorNombres: ["SOPORTE-MOVIL", "SOPORTE MOVIL"],
    francoConfig: FRANCO_36HS,
  },
  {
    key: "SOPORTE-RRSS",
    label: "SOPORTE-RRSS",
    hojaCP: ["Digital", "SOPORTE-RRSS", "RRSS"],
    segmentosNomina: ["SOPORTE-RRSS", "SOPORTE RRSS", "RRSS"],
    reductorNombres: ["SOPORTE-RRSS", "SOPORTE RRSS"],
    francoConfig: FRANCO_36HS,
  },
  {
    key: "SMB-TEC-IN",
    label: "SMB Tec In",
    hojaCP: ["SMB TEC IN", "SMB Tec In", "SMB_TEC_IN", "SMB-TEC-IN"],
    segmentosNomina: [
      "SMB-TEC-IN",
      "SMB TEC IN",
      "TECNICA",
      "TÉCNICA",
      "CBS TECNICA",
      "CBS TÉCNICA",
    ],
    reductorNombres: ["SMB-TEC-IN", "SMB TEC IN"],
    francoConfig: FRANCO_36HS,
  },
  {
    key: "SMB-TEC-MOVIL",
    label: "SMB Tec Movil",
    hojaCP: ["SMB Tec Movil", "SMB TEC MOVIL", "SMB_TEC_MOVIL", "SMB-TEC-MOVIL"],
    segmentosNomina: [
      "SMB-TEC-MOVIL",
      "SMB TEC MOVIL",
      "TECNICA MOVIL",
      "TÉCNICA MOVIL",
    ],
    reductorNombres: ["SMB-TEC-MOVIL", "SMB TEC MOVIL", "SMB Tec Movil"],
    francoConfig: FRANCO_36HS,
  },
  {
    key: "SMB-DIGITAL",
    label: "SMB Digital",
    hojaCP: ["SMB DIGITAL", "SMB Digital", "SMB_Digital", "SMB-DIGITAL"],
    segmentosNomina: [
      "SMB-DIGITAL",
      "SMB DIGITAL",
      "TECNICA RRSS",
      "TÉCNICA RRSS",
    ],
    reductorNombres: ["SMB-DIGITAL", "SMB DIGITAL"],
    francoConfig: FRANCO_36HS,
  },
  {
    key: "SMB-PTF",
    label: "SMB PTF",
    hojaCP: ["SMB PTF", "SMB-PTF", "SMB_PTF"],
    segmentosNomina: [
      "SMB-PTF",
      "SMB PTF",
      "TECNICA POWER TO FRONT",
      "TÉCNICA POWER TO FRONT",
      "PWTF TECNICA",
      "PWTF TÉCNICA",
      "PTF TECNICA",
      "PTF TÉCNICA",
    ],
    reductorNombres: ["SMB-PTF", "SMB PTF"],
    francoConfig: FRANCO_36HS,
  },
];

export type ServicioKey = string;

export const SERVICIOS_KEYS: ServicioKey[] = SERVICIOS.map((s) => s.key);

export function normalizar(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
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
