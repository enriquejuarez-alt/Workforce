"use client";

import { useFrancoConfig } from "@/store/useFrancoConfig";
import { DIAS_SEMANA, DIA_LABELS, type DiaSemana } from "@/lib/config/francoRules";
import { cn } from "@/lib/utils/cn";
import { Plus, Trash2, RotateCcw } from "lucide-react";

export function FrancoRulesEditor() {
  const { reglas, setVentana, addFranco, removeFranco, resetToDefaults } = useFrancoConfig();

  const toggleDia = (hsSemanal: number, francoIndex: number, dia: DiaSemana) => {
    const regla = reglas.find((r) => r.hsSemanal === hsSemanal);
    if (!regla) return;
    const ventana = regla.francos[francoIndex];
    const diasActuales = ventana.dias;
    const nuevos = diasActuales.includes(dia)
      ? diasActuales.filter((d) => d !== dia)
      : [...diasActuales, dia];
    setVentana(hsSemanal, francoIndex, { dias: nuevos });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Reglas de franco por contrato</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Definí la ventana de días en que puede caer cada franco según el tipo de contrato.
          </p>
        </div>
        <button
          onClick={resetToDefaults}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Restaurar defaults
        </button>
      </div>

      <div className="space-y-4">
        {reglas.map((regla) => (
          <div
            key={regla.hsSemanal}
            className="rounded-xl border border-gray-200 bg-white overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-800">{regla.label}</span>
                <span className="text-xs text-gray-400">
                  {regla.francos.length} franco{regla.francos.length !== 1 ? "s" : ""} por semana
                </span>
              </div>
              <button
                onClick={() => addFranco(regla.hsSemanal)}
                className="flex items-center gap-1 text-xs text-[#0054A6] hover:underline"
              >
                <Plus className="h-3 w-3" />
                Agregar franco
              </button>
            </div>

            <div className="divide-y divide-gray-100">
              {regla.francos.map((ventana, fi) => (
                <div key={fi} className="flex items-center gap-4 px-5 py-3">
                  <span className="text-xs text-gray-400 w-16 shrink-0">
                    Franco {fi + 1}
                  </span>

                  <div className="flex items-center gap-1.5 flex-1">
                    {DIAS_SEMANA.map((dia) => {
                      const activo = ventana.dias.includes(dia);
                      return (
                        <button
                          key={dia}
                          onClick={() => toggleDia(regla.hsSemanal, fi, dia)}
                          className={cn(
                            "px-2.5 py-1 rounded-md text-xs font-medium transition-all select-none",
                            activo
                              ? "text-white"
                              : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                          )}
                          style={activo ? { backgroundColor: "#0054A6" } : undefined}
                          title={dia}
                        >
                          {DIA_LABELS[dia]}
                        </button>
                      );
                    })}
                  </div>

                  <span className="text-xs text-gray-400 w-24 text-right shrink-0">
                    {ventana.dias.length > 0
                      ? `1 de ${ventana.dias.length} días`
                      : "sin días"}
                  </span>

                  {regla.francos.length > 1 && (
                    <button
                      onClick={() => removeFranco(regla.hsSemanal, fi)}
                      className="text-gray-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-700">
        <strong>Cómo funciona:</strong> si un contrato tiene franco en una ventana de N días,
        cada día dentro de esa ventana tiene probabilidad 1/N de ser el día de franco del agente.
        El panel Franco muestra el HC disponible esperado por día usando esta distribución.
      </div>
    </div>
  );
}
