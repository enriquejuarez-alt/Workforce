import type { ServiceDefinition } from "./services";

export const SERVICIOS_APGC: ServiceDefinition[] = [
  {
    key: "APGC",
    label: "Atención Personalizada Grandes Clientes",
    // "Unificado" es la hoja del archivo "Konecta GC PE y Reemplazos" que ya
    // trae sumadas "GC PE" + "Reemplazos GC" (verificado: 1584 + 1386 = 2970,
    // exacto). OJO: resolverHojaCPRuntime toma la PRIMERA hoja del archivo
    // que matchee cualquier alias, en el orden en que aparece en el archivo
    // (no en el orden de esta lista) — "GC PE" y "Reemplazos GC" NO se
    // agregan como alias a proposito, porque en el archivo real aparecen
    // antes que "Unificado" y matchear cualquiera de las dos partes sueltas
    // subcontaria el total real.
    hojaCP: ["Unificado", "Hoja1", "APGC", "Atención Personalizada Grandes Clientes", "Atencion Personalizada Grandes Clientes"],
    segmentosNomina: ["APGC", "Atención Personalizada Grandes Clientes", "Atencion Personalizada Grandes Clientes"],
    reductorNombres: ["APGC", "Atención Personalizada Grandes Clientes", "Atencion Personalizada Grandes Clientes"],
  },
];
