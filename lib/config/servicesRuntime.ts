import { SERVICIOS, normalizar } from "./services";
import type { ServiceDefinition, FrancoConfig } from "./services";
import { SERVICIOS_PPAY } from "./servicesPpay";
import { SERVICIOS_SMB } from "./servicesSmb";
import { usePlaniConfig } from "@/store/usePlaniConfig";
import { useFrancoConfig } from "@/store/useFrancoConfig";

/**
 * Returns the active service list.
 * When Plani runs embedded in Nómina, the parent sends the service registry
 * via postMessage. Services with a planiConfig override the static list;
 * new services (not in the static list) are appended.
 * Falls back to the static SERVICIOS when not connected.
 */
export function getServiciosActivos(): ServiceDefinition[] {
  const { selectedServicioKey } = useFrancoConfig.getState();
  if (selectedServicioKey === "-1") return SERVICIOS_PPAY;
  if (selectedServicioKey === "-2") return SERVICIOS_SMB;

  const { serviciosNomina } = usePlaniConfig.getState();
  if (!serviciosNomina || serviciosNomina.length === 0) return SERVICIOS;

  const result: ServiceDefinition[] = [];

  for (const s of serviciosNomina) {
    if (s.planiConfig) {
      result.push({
        key: s.planiConfig.key,
        label: s.planiConfig.label ?? s.nombre,
        hojaCP: s.planiConfig.hojaCP,
        segmentosNomina: s.planiConfig.segmentos,
        reductorNombres: s.planiConfig.reductores,
      });
    } else {
      // No explicit config — match by nombre against the static list
      const staticDef = SERVICIOS.find(
        (def) => normalizar(def.key) === normalizar(s.nombre)
      );
      if (staticDef) result.push(staticDef);
    }
  }

  return result.length > 0 ? result : SERVICIOS;
}

export function getServiciosKeys(): string[] {
  return getServiciosActivos().map((s) => s.key);
}

export function resolverServicioPorSegmentoRuntime(segmentoRaw: string): string | null {
  const norm = normalizar(segmentoRaw);
  for (const def of getServiciosActivos()) {
    if (def.segmentosNomina.some((alias) => normalizar(alias) === norm)) {
      return def.key;
    }
  }
  return null;
}

export function resolverServicioPorReductorRuntime(nombreReductor: string): string | null {
  const norm = normalizar(nombreReductor);
  for (const def of getServiciosActivos()) {
    if (def.reductorNombres.some((alias) => normalizar(alias) === norm)) {
      return def.key;
    }
  }
  return null;
}

export function resolverHojaCPRuntime(servicioKey: string, hojasPresentes: string[]): string | null {
  const def = getServiciosActivos().find((s) => s.key === servicioKey);
  if (!def) return null;
  const aliases = Array.isArray(def.hojaCP) ? def.hojaCP : [def.hojaCP];
  return aliases.find((h) => hojasPresentes.includes(h)) ?? null;
}

export function getHojasCPRuntime(servicioKey: string): string[] {
  const def = getServiciosActivos().find((s) => s.key === servicioKey);
  if (!def) return [];
  return Array.isArray(def.hojaCP) ? def.hojaCP : [def.hojaCP];
}

export function getFrancoConfigRuntime(servicioKey: string): FrancoConfig | undefined {
  const def = getServiciosActivos().find((s) => s.key === servicioKey);
  return def?.francoConfig;
}
