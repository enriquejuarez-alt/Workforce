import { SERVICIOS, normalizar } from "./services";
import type { ServiceDefinition, FrancoConfig } from "./services";
import { SERVICIOS_PPAY } from "./servicesPpay";
import { SERVICIOS_SMB } from "./servicesSmb";
import { SERVICIOS_ONB } from "./servicesOnb";
import { SERVICIOS_MIGRACION } from "./servicesMigracion";
import { SERVICIOS_RETENCION } from "./servicesRetencion";
import { SERVICIOS_BO } from "./servicesBo";
import { SERVICIOS_TECH } from "./servicesTech";
import { SERVICIOS_INTEGRAL } from "./servicesIntegral";
import { SERVICIOS_VENTAS } from "./servicesVentas";
import { SERVICIOS_MOVIL } from "./servicesMovil";
import { SERVICIOS_HOGAR_CONVERGENTE } from "./servicesHogarConvergente";
import { SERVICIOS_HOGAR_NOCONVERGENTE } from "./servicesHogarNoConvergente";
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
  if (selectedServicioKey === "-3") return SERVICIOS_ONB;
  if (selectedServicioKey === "-4") return SERVICIOS_MIGRACION;
  if (selectedServicioKey === "-11") return [SERVICIOS_MIGRACION[0]];
  if (selectedServicioKey === "-12") return [SERVICIOS_MIGRACION[1]];
  if (selectedServicioKey === "-5") return [SERVICIOS_RETENCION[0]];
  if (selectedServicioKey === "-6") return [SERVICIOS_RETENCION[1]];
  if (selectedServicioKey === "-7") return SERVICIOS_BO;
  if (selectedServicioKey === "-8") return SERVICIOS_TECH;
  if (selectedServicioKey === "-9") return [SERVICIOS_INTEGRAL[0]];
  if (selectedServicioKey === "-10") return [SERVICIOS_INTEGRAL[1]];
  if (selectedServicioKey === "-13") return SERVICIOS_VENTAS.filter((s) => s.key === "VENTAS-WA");
  if (selectedServicioKey === "-14") return SERVICIOS_VENTAS.filter((s) => s.key === "VENTAS-WA-HOGAR");
  if (selectedServicioKey === "-15") return SERVICIOS_VENTAS.filter((s) => s.key === "VENTAS-MOVIL" || s.key === "VENTAS-OUT-MOVIL");
  if (selectedServicioKey === "-16") return SERVICIOS;
  if (selectedServicioKey === "-17") return SERVICIOS_MOVIL;
  if (selectedServicioKey === "-18") return SERVICIOS_HOGAR_CONVERGENTE;
  if (selectedServicioKey === "-19") return SERVICIOS_HOGAR_NOCONVERGENTE;

  const { serviciosNomina } = usePlaniConfig.getState();
  if (!serviciosNomina || serviciosNomina.length === 0) return SERVICIOS;

  const selected = serviciosNomina.find((s) => String(s.id) === selectedServicioKey);
  if (selected) {
    const nombre = normalizar(selected.nombre);
    if (nombre.includes("retencion") && nombre.includes("convergente")) return [SERVICIOS_RETENCION[1]];
    if (nombre === "retencion" || nombre.includes("retencion")) return [SERVICIOS_RETENCION[0]];
    if (nombre.includes("migracion") && nombre.includes("cobre") && nombre.includes("amba")) return [SERVICIOS_MIGRACION[0]];
    if (nombre.includes("migracion") && nombre.includes("cobre") && nombre.includes("interior")) return [SERVICIOS_MIGRACION[1]];
    if (nombre.includes("soporte") && nombre.includes("tecnico")) return SERVICIOS;
    if (nombre === "movil") return SERVICIOS_MOVIL;
    if (nombre.includes("hogares") && nombre.includes("no") && nombre.includes("convergente")) return SERVICIOS_HOGAR_NOCONVERGENTE;
    if (nombre.includes("hogares") && nombre.includes("convergente")) return SERVICIOS_HOGAR_CONVERGENTE;
    if (nombre === "bo gc" || nombre.includes("back office")) return SERVICIOS_BO;
    if (nombre === "tech" || nombre.includes("tech admin")) return SERVICIOS_TECH;
    if (nombre.includes("integral movil") && nombre.includes("amba")) return [SERVICIOS_INTEGRAL[0]];
    if (nombre.includes("integral movil") && nombre.includes("interior")) return [SERVICIOS_INTEGRAL[1]];
    if (!selected.planiConfig && nombre.startsWith("ventas")) {
      const specific = SERVICIOS_VENTAS.find(
        (s) =>
          s.segmentosNomina.some((seg) => normalizar(seg) === nombre) ||
          normalizar(s.key.replace(/-/g, " ")) === nombre
      );
      return specific ? [specific] : SERVICIOS_VENTAS;
    }
  }

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
      const staticDef = [
        ...SERVICIOS,
        ...SERVICIOS_RETENCION,
        ...SERVICIOS_BO,
        ...SERVICIOS_TECH,
        ...SERVICIOS_INTEGRAL,
      ].find(
        (def) =>
          normalizar(def.key) === normalizar(s.nombre) ||
          normalizar(def.label) === normalizar(s.nombre)
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
  return hojasPresentes.find((hoja) =>
    aliases.some((h) => normalizar(hoja) === normalizar(h))
  ) ?? null;
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
