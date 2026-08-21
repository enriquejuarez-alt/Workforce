import type { ServiceDefinition } from "./services";

const FRANCO_36HS = { diasVentana: 4, fraccionAfectada: 1.0 };

// Reescrito para matchear "CP SMB 08-2026 v1 (Unificado).xlsx" — ese archivo
// trae una hoja separada por cada segmento real (Customer/Conectividad/Movil
// son colas distintas con datos distintos, confirmado por el codigo interno
// de cada hoja: Customer=560, Conectividad="Migra"=3504, Movil="Esim"=0 — no
// son la misma cola con 3 nombres). Antes estaban bundleados en un solo
// servicio "SMB-CUSTOMER" que solo leia la hoja "CUSTOMER SMB" y perdia el
// Requerido real de Conectividad y Movil.
export const SERVICIOS_SMB: ServiceDefinition[] = [
  {
    key: "SMB-CONVERGENTE",
    label: "SMB Convergente",
    hojaCP: ["SMB Convergente", "CONVERGENTE SMB"],
    segmentosNomina: ["SMB CONVERGENTE"],
    reductorNombres: ["SMB CONVERGENTE", "CONVERGENTE SMB"],
    francoConfig: FRANCO_36HS,
  },
  {
    key: "SMB-ALTO-VALOR",
    label: "SMB Alto Valor",
    hojaCP: ["SMB Alto Valor", "ALTO VALOR SMB"],
    segmentosNomina: ["SMB ALTO VALOR"],
    reductorNombres: ["SMB ALTO VALOR", "ALTO VALOR", "AV TOP", "DEGRADADOS"],
    francoConfig: FRANCO_36HS,
  },
  {
    key: "SMB-CUSTOMER",
    label: "SMB Customer",
    hojaCP: ["SMB Customer", "CUSTOMER SMB"],
    segmentosNomina: ["SMB CUSTOMER"],
    reductorNombres: ["SMB CUSTOMER", "CUSTOMER SMB"],
    francoConfig: FRANCO_36HS,
  },
  {
    key: "SMB-CONECTIVIDAD",
    label: "SMB Conectividad",
    hojaCP: ["SMB Conectividad", "CONECTIVIDAD SMB"],
    segmentosNomina: ["SMB CONECTIVIDAD", "SMB CONECTIVIDAD INICIO 02-07"],
    reductorNombres: ["SMB CONECTIVIDAD", "CONECTIVIDAD", "MIGRA"],
    francoConfig: FRANCO_36HS,
  },
  {
    key: "SMB-MOVIL",
    label: "SMB Movil",
    hojaCP: ["SMB Movil", "MOVIL SMB"],
    segmentosNomina: ["SMB MOVIL"],
    reductorNombres: ["SMB MOVIL", "ESIM"],
    francoConfig: FRANCO_36HS,
  },
  {
    key: "SMB-MULTISKILL",
    label: "SMB Multiskill",
    hojaCP: ["SMB Multiskill", "MULTISKILL"],
    segmentosNomina: ["SMB MULTISKILL"],
    reductorNombres: ["SMB MULTISKILL", "MULTISKILL"],
    francoConfig: FRANCO_36HS,
  },
  {
    key: "SMB-RETENCION",
    label: "SMB Retencion",
    hojaCP: ["RETEN", "SMB Retencion Crecimiento", "SMB RETENCION CRECIMIENTO"],
    segmentosNomina: ["SMB RETENCION CRECIMIENTO"],
    reductorNombres: [
      "SMB RETENCION",
      "RETENCION",
      "RETEN",
      "SMB RETENCION CRECIMIENTO",
    ],
    francoConfig: FRANCO_36HS,
  },
  {
    key: "SMB-DIGITAL-CONVERGENTE",
    label: "SMB Digital Convergente",
    hojaCP: ["SMB Digital Convergente", "WA CONVERGENTE SMB"],
    segmentosNomina: ["SMB DIGITAL CONVERGENTE"],
    reductorNombres: ["SMB DIGITAL CONVERGENTE", "WA CONVERGENTE SMB"],
    francoConfig: FRANCO_36HS,
  },
  {
    key: "SMB-DIGITAL-ALTO-VALOR",
    label: "SMB Digital Alto Valor",
    hojaCP: ["SMB Digital Alto Valor", "WA ALTO VALOR SMB"],
    segmentosNomina: ["SMB DIGITAL ALTO VALOR"],
    reductorNombres: [
      "SMB DIGITAL ALTO VALOR",
      "WA ALTO VALOR",
      "WA AV TOP",
      "WA DEGRADADOS",
    ],
    francoConfig: FRANCO_36HS,
  },
  {
    key: "SMB-DIGITAL-CONECTIVIDAD",
    label: "SMB Digital Conectividad",
    hojaCP: ["SMB Digital Conectividad", "WA CUSTOMER SMB"],
    segmentosNomina: ["SMB DIGITAL CONECTIVIDAD", "SMB DIGITAL CONECTIVIDAD 2-7"],
    reductorNombres: [
      "SMB DIGITAL CONECTIVIDAD",
      "WA CUSTOMER SMB",
      "WA CUSTOMER",
      "WA MIGRA",
    ],
    francoConfig: FRANCO_36HS,
  },
  {
    key: "SMB-DIGITAL-MULTISKILL",
    label: "SMB Digital Multiskill",
    hojaCP: ["SMB Digital Multiskill", "WA MULTISKILL"],
    segmentosNomina: ["SMB DIGITAL MULTISKILL"],
    reductorNombres: ["SMB DIGITAL MULTISKILL", "WA MULTISKILL"],
    francoConfig: FRANCO_36HS,
  },
  {
    key: "SMB-WA-RETENCION",
    label: "SMB WA Retencion",
    hojaCP: "WA RETEN SMB",
    segmentosNomina: ["SMB DIGITAL RETENCION SOHO"],
    reductorNombres: [
      "SMB DIGITAL RETENCION SOHO",
      "WA RETEN SMB",
      "WA RETENCION",
    ],
    francoConfig: FRANCO_36HS,
  },
];
