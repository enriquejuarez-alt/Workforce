import type { ActiveFilters, Agente } from "./types";
import { normalizar } from "./mapeo";

export function filtrarAgentes(agentes: Agente[], filtros: ActiveFilters): Agente[] {
  return agentes.filter((a) => {
    if (filtros.sitio && normalizar(a.sitio) !== normalizar(filtros.sitio)) return false;
    if (filtros.modalidad && normalizar(a.modalidad) !== normalizar(filtros.modalidad)) return false;
    if (filtros.jefe && normalizar(a.jefe) !== normalizar(filtros.jefe)) return false;
    if (filtros.contrato && String(a.hsSemanal) !== filtros.contrato) return false;
    if (filtros.estado && a.estado.toUpperCase() !== filtros.estado.toUpperCase()) return false;
    return true;
  });
}

export interface OpcionesFiltros {
  sitios: string[];
  modalidades: string[];
  jefes: string[];
  contratos: string[];
}

export function extraerOpciones(agentes: Agente[]): OpcionesFiltros {
  const sitios = [...new Set(agentes.map((a) => a.sitio).filter(Boolean))].sort();
  const modalidades = [...new Set(agentes.map((a) => a.modalidad).filter(Boolean))].sort();
  const jefes = [...new Set(agentes.map((a) => a.jefe).filter(Boolean))].sort();
  const contratos = [...new Set(agentes.map((a) => String(a.hsSemanal)).filter(Boolean))].sort();
  return { sitios, modalidades, jefes, contratos };
}

export function hayFiltrosActivos(filtros: ActiveFilters): boolean {
  return Object.values(filtros).some((v) => v !== "");
}
