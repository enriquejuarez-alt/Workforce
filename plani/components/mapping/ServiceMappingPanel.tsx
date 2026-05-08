"use client";

import { useState } from "react";
import { Plus, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useResultados } from "@/store/useResultados";
import { SERVICIOS_KEYS, type ServicioKey } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";

export function ServiceMappingPanel() {
  const { mappingOverrides, addMappingOverride, removeMappingOverride } = useResultados();
  const [segmentoInput, setSegmentoInput] = useState("");
  const [servicioInput, setServicioInput] = useState<ServicioKey>(SERVICIOS_KEYS[0]);

  const handleAdd = () => {
    const seg = segmentoInput.trim();
    if (!seg) return;
    addMappingOverride({ segmentoRaw: seg, servicioKey: servicioInput });
    setSegmentoInput("");
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-0.5">Mapeo de segmentos</h3>
        <p className="text-xs text-gray-500">
          Si un SEGMENTO de la nómina no se mapea automáticamente, configuralo acá.
        </p>
      </div>

      {mappingOverrides.length > 0 && (
        <div className="space-y-1.5">
          {mappingOverrides.map((ov) => (
            <div
              key={ov.segmentoRaw}
              className="flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2"
            >
              <span className="text-xs text-gray-600 font-mono flex-1">
                {ov.segmentoRaw}
              </span>
              <ArrowRight className="h-3 w-3 text-gray-400 shrink-0" />
              <span className="text-xs text-[#0054A6] font-medium shrink-0">
                {ov.servicioKey}
              </span>
              <button
                onClick={() => removeMappingOverride(ov.segmentoRaw)}
                className="text-gray-400 hover:text-red-500 transition-colors ml-1"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="text-xs text-gray-500 mb-1 block">
            Segmento en nómina (exacto)
          </label>
          <input
            value={segmentoInput}
            onChange={(e) => setSegmentoInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="Ej: SOPORTE HOGARES"
            className={cn(
              "w-full h-8 rounded-lg border border-gray-300 bg-white px-3 text-xs text-gray-700",
              "placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#0054A6] focus:border-[#0054A6]"
            )}
          />
        </div>
        <div className="w-44">
          <label className="text-xs text-gray-500 mb-1 block">Servicio destino</label>
          <select
            value={servicioInput}
            onChange={(e) => setServicioInput(e.target.value as ServicioKey)}
            className="w-full h-8 rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#0054A6]"
          >
            {SERVICIOS_KEYS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={!segmentoInput.trim()}
          className="gap-1.5 shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar
        </Button>
      </div>
    </div>
  );
}
