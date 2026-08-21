// Mapea la clave interna de servicio (ServicioKey, ej. "BO-GC") al nombre
// real tal cual aparece en la nomina cargada (ej. "BO GC"). Se usa solo para
// mostrar en pantalla — el matching real sigue usando segmentosNomina en
// cada ServiceDefinition. Generado a partir de los agentes activos reales
// (ver investigacion de agosto 2026); los 4 servicios sin match today
// (ningun agente real cargado con ese segmento) no estan en el mapa y caen
// al fallback (la clave o el label, segun quien llame a
// obtenerNombreNomina).
export const NOMBRES_NOMINA: Record<string, string> = {
  "SOPORTE-CBS": "SOPORTE-CBS",
  "SOPORTE-CONECTIVIDAD": "SOPORTE-CONECTIVIDAD",
  "SOPORTE-ENTRETENIMIENTO": "SOPORTE-ENTRETENIMIENTO",
  "SOPORTE-MOVIL": "SOPORTE-MOVIL",
  "SOPORTE-RRSS": "SOPORTE-RRSS",
  "SMB-TEC-IN": "Tecnica",
  "SMB-TEC-MOVIL": "Tecnica Movil",
  "SMB-DIGITAL": "TECNICA RRSS",
  "SMB-PTF": "TECNICA POWER TO FRONT",
  "RETENCION-MOVIL": "RETENCION Movil",
  "RETENCION-CONVERGENTE": "RETENCION Convergente",
  "BO-GC": "BO GC",
  "TECH": "TECH",
  "INTEGRAL-MOVIL-AMBA": "INTEGRAL MOVIL Amba",
  "INTEGRAL-MOVIL-INTERIOR": "INTEGRAL MOVIL Interior",
  "MIGRACION-COBRE-AMBA": "MIGRACION COBRE AMBA",
  "MIGRACION-COBRE-INTERIOR": "MIGRACION COBRE INTERIOR",
  "MOVIL-ABONOS": "INDIVIDUOS ABONO FIJO",
  "MOVIL-PREPAGO": "INDIVIDUOS TARJETA",
  "MOVIL-WS": "WHATSAPP MOVIL",
  "MOVIL-DEGRADADOS": "ISLA DEGRADADOS",
  "MOVIL-MADRUGADA": "MADRUGADA",
  "HOGAR-CONV-WS-FACTURA": "WHATSAPP FACTURA UNIFICADA",
  "HOGAR-CONV-FTU": "FACTURA UNIFICADA",
  "HOGAR-CONV-FLOWPLUS": "Flow Plus",
  "HOGAR-NOCONV-CUSTOMER": "CUSTOMER HOGAR",
  "HOGAR-NOCONV-WS-CUSTOMER": "WHATSAPP CUSTOMER HOGAR",
  "VENTAS-WA": "VENTAS IN- WHATS AP",
  "VENTAS-WA-HOGAR": "VENTAS IN- WHATS AP HOGAR",
  "VENTAS-MOVIL": "VENTAS IN",
  "SMB-CONVERGENTE": "SMB CONVERGENTE",
  "SMB-ALTO-VALOR": "SMB ALTO VALOR",
  "SMB-CONECTIVIDAD": "SMB CONECTIVIDAD",
  "SMB-MOVIL": "SMB MOVIL",
  "SMB-MULTISKILL": "SMB MULTISKILL",
  "SMB-RETENCION": "SMB RETENCION CRECIMIENTO",
  "SMB-DIGITAL-CONVERGENTE": "SMB DIGITAL CONVERGENTE",
  "SMB-DIGITAL-ALTO-VALOR": "SMB DIGITAL ALTO VALOR",
  "SMB-DIGITAL-CONECTIVIDAD": "SMB DIGITAL CONECTIVIDAD",
  "SMB-DIGITAL-MULTISKILL": "SMB DIGITAL MULTISKILL",
  "ONB-WHATSAPP": "ONBOARDING - WHATSAPP",
  "ONB-HOGAR": "ONBOARDING - HOGAR",
  "ONB-MOVIL": "Onboarding",
  "PPAY": "PERSONAL PAY",
  "APGC": "Atención Personalizada Grandes Clientes",
  "IMPLEMENTACION-TECNICA": "IMPLEMENTACION TECNICA",
  "MIGRACION": "MIGRACION",
};

/** Nombre de nomina para una clave de servicio; si no hay agentes reales con
 * ese segmento todavia, cae al `fallback` (label o la clave cruda). */
export function obtenerNombreNomina(servicioKey: string, fallback: string): string {
  return NOMBRES_NOMINA[servicioKey] ?? fallback;
}
