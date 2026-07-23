import type { ServiceDefinition } from "./services";

const FRANCO_36HS = { diasVentana: 4, fraccionAfectada: 1.0 };

// segmentosNomina son una estimacion (todavia no hay archivo de Nomina real
// para este servicio) — ajustar con los valores reales de la columna
// Segmento apenas se cargue una Nomina de Hogares Convergentes.
export const SERVICIOS_HOGAR_CONVERGENTE: ServiceDefinition[] = [
  {
    key: "HOGAR-CONV-WS-FACTURA",
    label: "Hogar Convergente WhatsApp Factura Unificada",
    hojaCP: ["WS FACTURA UNIFICADA", "Ws Factura Unificada"],
    segmentosNomina: ["HOGAR CONVERGENTE WS FACTURA", "WS FACTURA UNIFICADA", "WHATSAPP FACTURA UNIFICADA"],
    reductorNombres: ["Whatsapp Factura Unificada", "WS FACTURA UNIFICADA"],
    francoConfig: FRANCO_36HS,
  },
  {
    key: "HOGAR-CONV-FTU",
    label: "Hogar Convergente FTU",
    hojaCP: ["FTU", "Ftu"],
    segmentosNomina: ["HOGAR CONVERGENTE FTU", "FTU", "FACTURA UNIFICADA"],
    reductorNombres: ["FACTURA UNIFICADA", "FTU"],
    francoConfig: FRANCO_36HS,
  },
  {
    key: "HOGAR-CONV-FLOWPLUS",
    label: "Hogar Convergente Flow Plus",
    hojaCP: ["FLOWPLUS", "FLOW PLUS", "Flowplus"],
    segmentosNomina: ["HOGAR CONVERGENTE FLOW PLUS", "FLOWPLUS", "FLOW PLUS"],
    reductorNombres: ["FLOW PLUS", "FLOWPLUS"],
    francoConfig: FRANCO_36HS,
  },
];
