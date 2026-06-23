import type { ServiceDefinition } from "./services";

export const SERVICIOS_VENTAS: ServiceDefinition[] = [
  {
    key: "VENTAS-WA",
    label: "Ventas WhatsApp",
    hojaCP: ["WhatsApp Ventas"],
    segmentosNomina: [
      "VENTAS IN- WHATS AP",
      "VENTAS WA", "VENTAS WPP", "VENTAS WHATSAPP",
      "WA VENTAS", "WPP VENTAS",
      "VENTAS - WA", "VENTAS - WPP",
    ],
    reductorNombres: [
      "VENTAS IN- WHATS AP",
      "VENTAS WA", "VENTAS WPP", "VENTAS WHATSAPP",
      "WA VENTAS", "WPP VENTAS",
    ],
  },
  {
    key: "VENTAS-WA-HOGAR",
    label: "Ventas WA Hogar",
    hojaCP: ["WhatsApp Ventas Hogar"],
    segmentosNomina: [
      "VENTAS IN- WHATS AP HOGAR",
      "VENTAS WA HOGAR", "VENTAS WPP HOGAR", "VENTAS WHATSAPP HOGAR",
      "WA VENTAS HOGAR", "WPP VENTAS HOGAR",
      "VENTAS - WA HOGAR", "VENTAS - WPP HOGAR",
      "WA HOGAR", "WPP HOGAR",
    ],
    reductorNombres: [
      "VENTAS IN- WHATS AP HOGAR",
      "VENTAS WA HOGAR", "VENTAS WPP HOGAR", "VENTAS WHATSAPP HOGAR",
      "WA HOGAR", "WPP HOGAR",
    ],
  },
  {
    key: "VENTAS-MOVIL",
    label: "Ventas Móvil",
    hojaCP: ["Ventas Móvil", "Ventas Movil"],
    segmentosNomina: [
      "VENTAS MOVIL", "VENTAS MÓVIL",
      "VENTAS IN", "VENTAS MOVIL IN", "VENTAS MÓVIL IN",
    ],
    reductorNombres: [
      "VENTAS MOVIL", "VENTAS MÓVIL", "VENTAS IN",
    ],
  },
  {
    key: "VENTAS-OUT-MOVIL",
    label: "Ventas Out Móvil",
    hojaCP: ["Ventas Out Móvil", "Ventas Out Movil"],
    segmentosNomina: [
      "VENTAS OUT MOVIL", "VENTAS OUT MÓVIL",
      "VENTAS OUT FIJOS", "VENTAS OUT", "VENTAS OUT BLENDING",
    ],
    reductorNombres: [
      "VENTAS OUT MOVIL", "VENTAS OUT MÓVIL", "VENTAS OUT FIJOS",
    ],
  },
];
