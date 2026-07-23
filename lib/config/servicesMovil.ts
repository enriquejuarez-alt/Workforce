import type { ServiceDefinition } from "./services";

const FRANCO_36HS = { diasVentana: 4, fraccionAfectada: 1.0 };

// segmentosNomina son una estimacion (todavia no hay archivo de Nomina real
// para este servicio) — ajustar con los valores reales de la columna
// Segmento apenas se cargue una Nomina de Movil.
export const SERVICIOS_MOVIL: ServiceDefinition[] = [
  {
    key: "MOVIL-ABONOS",
    label: "Movil Abonos",
    hojaCP: ["ABONOS", "Abonos"],
    segmentosNomina: ["MOVIL ABONOS", "ABONOS", "INDIVIDUOS ABONO FIJO"],
    reductorNombres: ["Individuos Abono Fijo", "ABONOS"],
    francoConfig: FRANCO_36HS,
  },
  {
    key: "MOVIL-PREPAGO",
    label: "Movil Prepago",
    hojaCP: ["PREPAGO", "Prepago"],
    segmentosNomina: ["MOVIL PREPAGO", "PREPAGO", "INDIVIDUOS TARJETA"],
    reductorNombres: ["Individuos Tarjeta", "PREPAGO"],
    francoConfig: FRANCO_36HS,
  },
  {
    key: "MOVIL-WS",
    label: "Movil WhatsApp",
    hojaCP: ["WS MOVIL", "Ws Movil"],
    segmentosNomina: ["MOVIL WS", "WS MOVIL", "WHATSAPP MOVIL"],
    reductorNombres: ["Whatsapp Movil", "WS MOVIL"],
    francoConfig: FRANCO_36HS,
  },
  {
    key: "MOVIL-DEGRADADOS",
    label: "Movil Degradados",
    hojaCP: ["DEGRADADOS", "Degradados"],
    segmentosNomina: ["MOVIL DEGRADADOS", "DEGRADADOS", "ISLA DEGRADADOS"],
    reductorNombres: ["Isla Degradados", "DEGRADADOS"],
    francoConfig: FRANCO_36HS,
  },
  {
    key: "MOVIL-MADRUGADA",
    label: "Movil Madrugada",
    hojaCP: ["MADRUGADA", "Madrugada"],
    segmentosNomina: ["MOVIL MADRUGADA", "MADRUGADA"],
    reductorNombres: ["Madrugada"],
    francoConfig: FRANCO_36HS,
  },
];
