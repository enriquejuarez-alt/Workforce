import type { ServiceDefinition } from "./services";

const FRANCO_36HS = { diasVentana: 4, fraccionAfectada: 1.0 };

// segmentosNomina son una estimacion (todavia no hay archivo de Nomina real
// para este servicio) — ajustar con los valores reales de la columna
// Segmento apenas se cargue una Nomina de Hogares No Convergentes.
export const SERVICIOS_HOGAR_NOCONVERGENTE: ServiceDefinition[] = [
  {
    key: "HOGAR-NOCONV-WS-MOROSIDAD",
    label: "Hogar No Convergente WhatsApp Morosidad",
    hojaCP: ["WS MOROSIDAD", "Ws Morosidad"],
    segmentosNomina: ["HOGAR NO CONVERGENTE WS MOROSIDAD", "WS MOROSIDAD", "WHATSAPP MOROSIDAD"],
    reductorNombres: ["Whatsapp Morosidad", "WS MOROSIDAD"],
    francoConfig: FRANCO_36HS,
  },
  {
    key: "HOGAR-NOCONV-CUSTOMER",
    label: "Hogar No Convergente Customer",
    hojaCP: ["CUSTOMER HOGAR", "Customer Hogar"],
    segmentosNomina: ["HOGAR NO CONVERGENTE CUSTOMER", "CUSTOMER HOGAR"],
    reductorNombres: ["CUSTOMER HOGAR"],
    francoConfig: FRANCO_36HS,
  },
  {
    key: "HOGAR-NOCONV-WS-CUSTOMER",
    label: "Hogar No Convergente WhatsApp Customer",
    hojaCP: ["WS CUSTOMER HOGAR", "Ws Customer Hogar"],
    segmentosNomina: ["HOGAR NO CONVERGENTE WS CUSTOMER", "WS CUSTOMER HOGAR", "WHATSAPP CUSTOMER HOGAR"],
    reductorNombres: ["Whatsapp Customer Hogar", "WHATSAPP CUSTOMER HOGAR", "WS CUSTOMER HOGAR"],
    francoConfig: FRANCO_36HS,
  },
];
