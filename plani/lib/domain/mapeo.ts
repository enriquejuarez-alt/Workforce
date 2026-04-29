import {
  SERVICIOS,
  normalizar,
  resolverServicioPorSegmento,
  resolverServicioPorReductor,
} from "../config/services";
import type { ServicioKey } from "./types";

export { normalizar, resolverServicioPorSegmento, resolverServicioPorReductor };

// ─── Legacy shape kept for backward compatibility ───────────────────────────

export interface MapeoServicio {
  hojaCP: string;
  segmentoNomina: string;
  reductor: string;
}

/**
 * Backward-compat record built from ServiceDefinition[].
 * hojaCP uses the first alias; segmentoNomina/reductor use the first alias.
 * New code should import from lib/config/services directly.
 */
export const MAPEO_SERVICIOS: Record<ServicioKey, MapeoServicio> =
  Object.fromEntries(
    SERVICIOS.map((def) => [
      def.key,
      {
        hojaCP: Array.isArray(def.hojaCP) ? def.hojaCP[0] : def.hojaCP,
        segmentoNomina: def.segmentosNomina[0],
        reductor: def.reductorNombres[0],
      } satisfies MapeoServicio,
    ])
  ) as Record<ServicioKey, MapeoServicio>;

export function matchSegmentoNomina(
  segmentoRaw: string,
  servicio: ServicioKey
): boolean {
  return resolverServicioPorSegmento(segmentoRaw) === servicio;
}
