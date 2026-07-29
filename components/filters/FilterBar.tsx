"use client";

import { useMemo } from "react";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useResultados } from "@/store/useResultados";
import { extraerOpciones, hayFiltrosActivos } from "@/lib/domain/filterEngine";
import { getServiciosKeys } from "@/lib/config/servicesRuntime";
import type { ActiveFilters } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";

function FiltroSelect({
  label,
  campo,
  opciones,
  valor,
  onChange,
}: {
  label: string;
  campo: keyof ActiveFilters;
  opciones: string[];
  valor: string;
  onChange: (campo: keyof ActiveFilters, valor: string) => void;
}) {
  if (opciones.length === 0) return null;
  return (
    <div className="flex min-w-[128px] flex-col gap-1.5">
      <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400">{label}</label>
      <select
        value={valor}
        onChange={(e) => onChange(campo, e.target.value)}
        className={cn(
          "h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 shadow-sm",
          "focus:outline-none focus:ring-2 focus:ring-[#0054A6]/15 focus:border-[#0054A6]",
          valor && "border-[#0054A6]/50 bg-blue-50/50 text-[#0054A6]"
        )}
      >
        <option value="">Todos</option>
        {opciones.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

export function FilterBar() {
  const { agentes, activeFilters, setFilter, clearFilters } = useResultados();
  // La nomina puede traer agentes de TODA la empresa (nomina general precargada);
  // los filtros solo deben ofrecer las islas que realmente se cargaron con requerido
  // este mes, no cualquier segmento presente en la nomina.
  const agentesRelevantes = useMemo(() => {
    const keys = new Set(getServiciosKeys());
    return agentes.filter((a) => keys.has(a.segmentoNorm));
  }, [agentes]);
  const opciones = extraerOpciones(agentesRelevantes);
  const activo = hayFiltrosActivos(activeFilters);

  const haySitios = opciones.sitios.length > 1;
  const hayIslas = opciones.islas.length > 1;
  const hayModalidades = opciones.modalidades.length > 1;
  const hayJefes = opciones.jefes.length > 1;

  if (agentes.length === 0) return null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0054A6]/10 text-[#0054A6]">
            <Filter className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-gray-500">Filtros</p>
            <p className="text-[11px] text-gray-400">Ajustá la vista por isla y condiciones de nómina</p>
          </div>
        </div>

        {activo && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 text-gray-500">
            <X className="h-3 w-3" />
            Limpiar
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {hayIslas && (
          <FiltroSelect label="Isla" campo="isla" opciones={opciones.islas} valor={activeFilters.isla ?? ""} onChange={setFilter} />
        )}
        {haySitios && (
          <FiltroSelect label="Sitio" campo="sitio" opciones={opciones.sitios} valor={activeFilters.sitio} onChange={setFilter} />
        )}
        {hayModalidades && (
          <FiltroSelect label="Modalidad" campo="modalidad" opciones={opciones.modalidades} valor={activeFilters.modalidad} onChange={setFilter} />
        )}
        {hayJefes && (
          <FiltroSelect label="Jefe" campo="jefe" opciones={opciones.jefes} valor={activeFilters.jefe} onChange={setFilter} />
        )}
        <FiltroSelect label="Contrato" campo="contrato" opciones={opciones.contratos} valor={activeFilters.contrato} onChange={setFilter} />
        <FiltroSelect label="Estado" campo="estado" opciones={["ACTIVO", "LP"]} valor={activeFilters.estado} onChange={setFilter} />
      </div>
    </div>
  );
}
