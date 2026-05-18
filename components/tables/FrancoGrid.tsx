"use client";

import { cn } from "@/lib/utils/cn";
import { DIAS_SEMANA, DIA_LABELS } from "@/lib/config/francoRules";
import type { FrancoResultadoServicio, EstadoFranco } from "@/lib/domain/francoEngine";

interface Props {
  resultados: FrancoResultadoServicio[];
}

function colorEstado(estado: EstadoFranco): string {
  if (estado === "surplus") return "bg-green-50 text-green-700 border-green-200";
  if (estado === "ok") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (estado === "justo") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-red-50 text-red-700 border-red-200";
}

function dotColor(estado: EstadoFranco): string {
  if (estado === "surplus") return "bg-green-500";
  if (estado === "ok") return "bg-emerald-500";
  if (estado === "justo") return "bg-amber-500";
  return "bg-red-500";
}

export function FrancoGrid({ resultados }: Props) {
  if (resultados.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-6 py-12 text-center text-sm text-gray-400">
        Cargá la nómina para ver el análisis de francos.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header row */}
      <div className="overflow-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap w-40">
                Servicio
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Activos
              </th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                Contratos
              </th>
              {DIAS_SEMANA.map((dia) => (
                <th
                  key={dia}
                  className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap"
                >
                  {DIA_LABELS[dia]}
                </th>
              ))}
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                HC necesario
              </th>
            </tr>
          </thead>
          <tbody>
            {resultados.map((r, i) => (
              <tr
                key={r.servicio}
                className={cn(
                  "border-b border-gray-100 hover:bg-gray-50 transition-colors",
                  i % 2 === 0 ? "bg-white" : "bg-gray-50/40"
                )}
              >
                {/* Service name */}
                <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                  {r.servicio}
                </td>

                {/* Active HC */}
                <td className="px-3 py-3 tabular-nums text-gray-600 text-center">
                  {Math.round(r.hcActivos)}
                </td>

                {/* Composition */}
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1">
                    {r.composicion.map(({ hsSemanal, cantidad }) => (
                      <span
                        key={hsSemanal}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 tabular-nums whitespace-nowrap"
                      >
                        {hsSemanal}h·{cantidad}
                      </span>
                    ))}
                    {r.composicion.length === 0 && (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </div>
                </td>

                {/* Day cells */}
                {r.dias.map((d) => (
                  <td key={d.dia} className="px-2 py-2 text-center">
                    <div
                      className={cn(
                        "inline-flex flex-col items-center rounded-lg border px-2 py-1 min-w-[52px]",
                        colorEstado(d.estado)
                      )}
                    >
                      <span className="text-xs font-semibold tabular-nums">
                        {Math.round(d.hcDisponible)}
                      </span>
                      {d.hcRequerido !== null && (
                        <span className="text-[10px] opacity-60 tabular-nums">
                          /{Math.round(d.hcRequerido)}
                        </span>
                      )}
                    </div>
                  </td>
                ))}

                {/* HC necesario total */}
                <td className="px-4 py-3 text-right tabular-nums">
                  <span className="font-semibold text-orange-600">
                    {Math.ceil(r.hcNecesarioTotal)}
                  </span>
                  {r.hcNecesarioTotal > r.hcActivos && (
                    <span className="text-xs text-gray-400 ml-1">
                      (+{Math.ceil(r.hcNecesarioTotal - r.hcActivos)})
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-gray-500 px-1">
        <span className="font-medium text-gray-600">Estado:</span>
        {(["surplus", "ok", "justo", "deficit"] as EstadoFranco[]).map((e) => (
          <span key={e} className="flex items-center gap-1">
            <span className={cn("h-2 w-2 rounded-full", dotColor(e))} />
            {e === "surplus" && "Exceso (≥103%)"}
            {e === "ok" && "OK (100–103%)"}
            {e === "justo" && "Justo (95–100%)"}
            {e === "deficit" && "Déficit (<95%)"}
          </span>
        ))}
        <span className="ml-auto text-gray-400">
          Celda: HC disponible / HC requerido CP (promedio del mes para ese día)
        </span>
      </div>
    </div>
  );
}
