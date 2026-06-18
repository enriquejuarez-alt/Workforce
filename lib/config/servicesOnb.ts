import type { ServiceDefinition } from "./services";

const FRANCO_36HS = { diasVentana: 4, fraccionAfectada: 1.0 };

export const SERVICIOS_ONB: ServiceDefinition[] = [
  {
    key: "ONB-WHATSAPP",
    label: "ONB WhatsApp",
    hojaCP: "Wapp Onb",
    segmentosNomina: [
      "ONBOARDING - WHATSAPP",
      "ONBOARDING WHATSAPP",
      "ONB WHATSAPP",
      "WAPP ONB",
    ],
    reductorNombres: [
      "ONBOARDING - WHATSAPP",
      "ONBOARDING WHATSAPP",
      "ONB WHATSAPP",
      "WAPP ONB",
      "Wapp Onb",
    ],
    francoConfig: FRANCO_36HS,
  },
  {
    key: "ONB-HOGAR",
    label: "ONB Hogar",
    hojaCP: "Onb Cust Tel",
    segmentosNomina: [
      "ONBOARDING - HOGAR",
      "ONBOARDING HOGAR",
      "ONB HOGAR",
      "ONB CUST TEL",
    ],
    reductorNombres: [
      "ONBOARDING - HOGAR",
      "ONBOARDING HOGAR",
      "ONB HOGAR",
      "ONB CUST TEL",
      "Onb Cust Tel",
    ],
    francoConfig: FRANCO_36HS,
  },
  {
    key: "ONB-MOVIL",
    label: "ONB Movil",
    hojaCP: "Onb Movil Tel",
    segmentosNomina: [
      "Onboarding",
      "ONBOARDING",
      "ONBOARDING MOVIL",
      "ONB MOVIL",
      "ONB MOVIL TEL",
    ],
    reductorNombres: [
      "ONBOARDING",
      "Onboarding",
      "ONBOARDING MOVIL",
      "ONB MOVIL",
      "ONB MOVIL TEL",
      "Onb Movil Tel",
    ],
    francoConfig: FRANCO_36HS,
  },
];
