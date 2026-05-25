"use client";

import { useMemo, useState } from "react";
import { useFrancoConfig } from "@/store/useFrancoConfig";
import { DIAS_SEMANA, DIA_LABELS, type DiaSemana } from "@/lib/config/francoRules";
import { cn } from "@/lib/utils/cn";
import { Plus, RotateCcw, Trash2 } from "lucide-react";

const DIA_COMPLETO: Record<DiaSemana, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
};

function describirVentana(dias: DiaSemana[]) {
  if (dias.length === 0) return "Sin días habilitados";
  if (dias.length === 7) return "Cualquier día";
  return dias.map((d) => DIA_LABELS[d]).join(", ");
}

export function FrancoRulesEditor() {
  const {
    reglas,
    addContrato,
    updateContrato,
    removeContrato,
    setVentana,
    addFranco,
    removeFranco,
    resetToDefaults,
  } = useFrancoConfig();
  const [nuevoContrato, setNuevoContrato] = useState("");

  const contratosExistentes = useMemo(
    () => new Set(reglas.map((r) => r.hsSemanal)),
    [reglas]
  );

  const handleAddContrato = () => {
    const hs = Number(nuevoContrato);
    if (!Number.isFinite(hs) || hs <= 0 || contratosExistentes.has(hs)) return;
    addContrato(hs);
    setNuevoContrato("");
  };

  const toggleDia = (hsSemanal: number, francoIndex: number, dia: DiaSemana) => {
    const regla = reglas.find((r) => r.hsSemanal === hsSemanal);
    const ventana = regla?.francos[francoIndex];
    if (!ventana) return;
    const dias = ventana.dias.includes(dia)
      ? ventana.dias.filter((d) => d !== dia)
      : [...ventana.dias, dia];
    setVentana(hsSemanal, francoIndex, { dias });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Configuración de contratos</h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Definí cuántos francos semanales tiene cada contrato y en qué días puede caer cada uno.
            Esta matriz alimenta la vista de planificación de francos.
          </p>
        </div>
        <button
          onClick={resetToDefaults}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 transition-colors hover:text-gray-800"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Restaurar defaults
        </button>
      </div>

      <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-800">
        <strong>Cómo se interpreta:</strong> cada fila representa un contrato, y cada bloque “Franco”
        representa un franco semanal. Si un franco puede caer entre lunes y viernes, cada uno de esos
        días toma 1/5 de probabilidad de ausencia para ese contrato.
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Agregar contrato
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              type="number"
              min={1}
              step={1}
              value={nuevoContrato}
              onChange={(e) => setNuevoContrato(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddContrato();
              }}
              placeholder="Ej: 32"
              className="h-9 w-28 rounded-md border border-gray-200 px-3 text-sm outline-none focus:border-[#0054A6]"
            />
            <span className="text-sm text-gray-500">horas semanales</span>
          </div>
        </div>
        <button
          onClick={handleAddContrato}
          disabled={!nuevoContrato || contratosExistentes.has(Number(nuevoContrato))}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[#0054A6] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#004080] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar
        </button>
      </div>

      <div className="space-y-4">
        {reglas.map((regla) => (
          <section
            key={regla.hsSemanal}
            className="overflow-hidden rounded-lg border border-gray-200 bg-white"
          >
            <div className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                    Contrato
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={regla.hsSemanal}
                      onChange={(e) => {
                        const hs = Number(e.target.value);
                        if (!Number.isFinite(hs) || hs <= 0 || contratosExistentes.has(hs)) return;
                        updateContrato(regla.hsSemanal, { hsSemanal: hs, label: `${hs} hs` });
                      }}
                      className="h-8 w-20 rounded-md border border-gray-200 px-2 text-sm font-semibold text-gray-800 outline-none focus:border-[#0054A6]"
                    />
                    <span className="text-xs text-gray-500">hs/sem</span>
                  </div>
                </div>
                <div className="rounded-md bg-white px-3 py-2 text-xs text-gray-500">
                  {regla.francos.length} franco{regla.francos.length !== 1 ? "s" : ""} semanal
                  {regla.francos.length !== 1 ? "es" : ""}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => addFranco(regla.hsSemanal)}
                  className="inline-flex items-center gap-1 rounded-md border border-blue-100 bg-white px-2.5 py-1.5 text-xs font-medium text-[#0054A6] hover:bg-blue-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar franco
                </button>
                <button
                  onClick={() => removeContrato(regla.hsSemanal)}
                  className="rounded-md p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
                  title="Eliminar contrato"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="divide-y divide-gray-100">
              {regla.francos.map((ventana, francoIndex) => (
                <div key={`${regla.hsSemanal}-${francoIndex}`} className="px-4 py-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-800">Franco {francoIndex + 1}</p>
                      <p className="text-xs text-gray-400">{describirVentana(ventana.dias)}</p>
                    </div>
                    {regla.francos.length > 1 && (
                      <button
                        onClick={() => removeFranco(regla.hsSemanal, francoIndex)}
                        className="text-xs font-medium text-gray-300 transition-colors hover:text-red-500"
                      >
                        Quitar
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {DIAS_SEMANA.map((dia) => {
                      const activo = ventana.dias.includes(dia);
                      return (
                        <button
                          key={dia}
                          onClick={() => toggleDia(regla.hsSemanal, francoIndex, dia)}
                          className={cn(
                            "rounded-md px-3 py-1.5 text-xs font-semibold transition-all",
                            activo
                              ? "bg-[#0054A6] text-white shadow-sm"
                              : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                          )}
                          title={DIA_COMPLETO[dia]}
                        >
                          {DIA_LABELS[dia]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
