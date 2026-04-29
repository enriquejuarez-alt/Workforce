"use client";

import { useState } from "react";
import type { MatrizServicio, ServicioCoverage } from "@/lib/domain/types";

interface Props {
  matriz: MatrizServicio;
  coverage?: ServicioCoverage;
  hcActivos: number;
  hsSemanalPromedio: number;
}

// Escala de color basada en ratio disponible/requerido
function cellColor(hcDisp: number, hcReq: number): string {
  if (hcReq === 0) return "#18181b"; // sin requerimiento
  const ratio = hcDisp / hcReq;
  if (ratio >= 1.15) return "#14532d"; // exceso
  if (ratio >= 1.05) return "#16a34a"; // sobrante
  if (ratio >= 0.95) return "#86efac"; // ok leve
  if (ratio >= 0.90) return "#fef08a"; // justo
  if (ratio >= 0.80) return "#fca5a5"; // déficit leve
  if (ratio >= 0.70) return "#ef4444"; // déficit
  return "#7f1d1d";                    // gap severo
}

function cellTextColor(hcDisp: number, hcReq: number): string {
  if (hcReq === 0) return "#52525b";
  const ratio = hcDisp / hcReq;
  if (ratio < 0.95 || ratio >= 1.05) return "white";
  return "#1c1c1e";
}

const LEYENDA = [
  { label: "Gap severo (<70%)", color: "#7f1d1d" },
  { label: "Déficit (<80%)", color: "#ef4444" },
  { label: "Déficit leve (<90%)", color: "#fca5a5" },
  { label: "Justo (90–95%)", color: "#fef08a" },
  { label: "OK (95–105%)", color: "#86efac" },
  { label: "Sobrante (>105%)", color: "#16a34a" },
  { label: "Exceso (>115%)", color: "#14532d" },
];

export function HeatmapGaps({ matriz, coverage, hcActivos, hsSemanalPromedio }: Props) {
  const [tooltip, setTooltip] = useState<{
    dia: string;
    franja: string;
    hcReq: number;
    hcDisp: number;
    ratio: number;
    x: number;
    y: number;
  } | null>(null);

  if (!matriz) return null;

  const franjas = matriz.franjas;
  const dias = matriz.dias;

  // Determinar HC disponible por celda
  // Prioridad: datos reales del coverage engine → fallback distribución plana
  const getCoverage = (fi: number, di: number): { hcDisp: number; hcReq: number } => {
    if (coverage?.dias[di]?.franjas[fi]) {
      const fc = coverage.dias[di].franjas[fi];
      return { hcDisp: fc.hcDisponible, hcReq: fc.hcRequerido };
    }
    // Fallback: distribución plana (sin datos de turno reales)
    const hcDispFlat = hcActivos > 0 ? (hcActivos * hsSemanalPromedio) / 7 / 24 : 0;
    const hcReq = (matriz.hcMatrix[fi]?.[di] ?? 0);
    return { hcDisp: hcDispFlat, hcReq };
  };

  const usandoCoverageReal = !!coverage;

  return (
    <div className="overflow-auto rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-zinc-500">
          Hover sobre una celda para ver detalle
        </span>
        {usandoCoverageReal ? (
          <span className="text-xs text-emerald-500 font-medium">
            ✓ Cobertura real por turno
          </span>
        ) : (
          <span className="text-xs text-amber-500">
            ⚠ Distribución plana (sin HORARIOS)
          </span>
        )}
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        {LEYENDA.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className="h-3 w-6 rounded-sm" style={{ backgroundColor: item.color }} />
            <span className="text-xs text-zinc-400">{item.label}</span>
          </div>
        ))}
      </div>

      <div className="relative">
        {tooltip && (
          <div
            className="fixed z-50 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs shadow-xl pointer-events-none"
            style={{ left: tooltip.x + 12, top: tooltip.y - 60 }}
          >
            <p className="font-semibold text-zinc-100">
              Día {tooltip.dia} — {tooltip.franja}
            </p>
            <p className="text-zinc-400">Requerido: <span className="text-zinc-200">{tooltip.hcReq.toFixed(1)}</span></p>
            <p className="text-zinc-400">Disponible: <span className="text-zinc-200">{tooltip.hcDisp.toFixed(1)}</span></p>
            <p className="text-zinc-400">
              Ratio:{" "}
              <span style={{ color: tooltip.ratio >= 1 ? "#4ade80" : "#f87171" }}>
                {(tooltip.ratio * 100).toFixed(0)}%
              </span>
            </p>
          </div>
        )}

        <div className="overflow-auto max-h-[540px] max-w-full">
          <table className="border-collapse text-[10px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-zinc-900 text-zinc-500 font-normal px-2 py-1 text-right min-w-[56px]">
                  Franja
                </th>
                {dias.map((dia, di) => (
                  <th
                    key={di}
                    className={`text-zinc-500 font-normal px-1 py-1 text-center min-w-[28px] ${
                      dia.esFeriado ? "text-amber-400" : ""
                    }`}
                  >
                    {di + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {franjas.map((franja, fi) => (
                <tr key={franja}>
                  <td className="sticky left-0 z-10 bg-zinc-900 text-zinc-500 px-2 py-0.5 text-right tabular-nums">
                    {franja}
                  </td>
                  {dias.map((_, di) => {
                    const { hcDisp, hcReq } = getCoverage(fi, di);
                    const ratio = hcReq > 0 ? hcDisp / hcReq : 1;
                    const gap = hcDisp - hcReq;
                    const bg = cellColor(hcDisp, hcReq);
                    const textColor = cellTextColor(hcDisp, hcReq);
                    const showLabel = hcReq > 0 && Math.abs(gap) > 0.3;

                    return (
                      <td
                        key={di}
                        className="p-0 cursor-pointer"
                        style={{ backgroundColor: bg }}
                        onMouseEnter={(e) =>
                          setTooltip({
                            dia: String(di + 1),
                            franja,
                            hcReq,
                            hcDisp,
                            ratio,
                            x: e.clientX,
                            y: e.clientY,
                          })
                        }
                        onMouseLeave={() => setTooltip(null)}
                      >
                        <div
                          className="h-[14px] w-[28px] flex items-center justify-center tabular-nums"
                          style={{ color: textColor, fontSize: "8px" }}
                        >
                          {showLabel ? gap.toFixed(0) : ""}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
