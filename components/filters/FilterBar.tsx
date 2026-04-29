"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useResultados } from "@/store/useResultados";
import { extraerOpciones, hayFiltrosActivos } from "@/lib/domain/filterEngine";
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
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500">{label}</label>
      <select
        value={valor}
        onChange={(e) => onChange(campo, e.target.value)}
        className={cn(
          "h-8 rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-700",
          "focus:outline-none focus:ring-1 focus:ring-[#0054A6] focus:border-[#0054A6]",
          valor && "border-[#0054A6] text-[#0054A6]"
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
  const opciones = extraerOpciones(agentes);
  const activo = hayFiltrosActivos(activeFilters);

  const haySitios = opciones.sitios.length > 1;
  const hayModalidades = opciones.modalidades.length > 1;
  const hayJefes = opciones.jefes.length > 1;

  if (agentes.length === 0) return null;

  return (
    <div className="flex items-end gap-3 flex-wrap rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mr-1 self-center">Filtros</p>

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

      {activo && (
        <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1.5 self-end">
          <X className="h-3 w-3" />
          Limpiar
        </Button>
      )}
    </div>
  );
}
