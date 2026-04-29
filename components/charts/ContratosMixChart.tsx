"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LabelList,
  Cell,
} from "recharts";
import type { Agente } from "@/lib/domain/types";
import { SERVICIOS_KEYS } from "@/lib/domain/types";

interface Props {
  agentes: Agente[];
}

interface FilaServicio {
  servicio: string;
  hs30: number;
  hs35: number;
  hs36: number;
  total: number;
  hcEfectivo: number;
}

const DIAS_DISPONIBLES: Record<number, number> = {
  30: 5 / 7,
  35: 5 / 7,
  36: 6 / 7,
};

function buildData(agentes: Agente[]): FilaServicio[] {
  return SERVICIOS_KEYS.map((servicio) => {
    const activos = agentes.filter(
      (a) => a.segmentoNorm === servicio && a.estado.toUpperCase() === "ACTIVO"
    );
    const hs30 = activos.filter((a) => a.hsSemanal === 30).length;
    const hs35 = activos.filter((a) => a.hsSemanal === 35).length;
    const hs36 = activos.filter((a) => a.hsSemanal === 36).length;
    const otros = activos.filter((a) => ![30, 35, 36].includes(a.hsSemanal)).length;
    const total = activos.length;
    const hcEfectivo =
      hs30 * DIAS_DISPONIBLES[30] +
      hs35 * DIAS_DISPONIBLES[35] +
      hs36 * DIAS_DISPONIBLES[36] +
      otros * DIAS_DISPONIBLES[36];
    return { servicio, hs30, hs35, hs36: hs36 + otros, total, hcEfectivo };
  }).filter((r) => r.total > 0);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as FilaServicio;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs shadow-lg">
      <p className="font-semibold text-gray-800 mb-2">{label}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-gray-500">
            <span className="h-2 w-2 rounded-sm bg-emerald-400 inline-block" />30 hs
          </span>
          <span className="font-semibold text-gray-800">{row.hs30}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-gray-500">
            <span className="h-2 w-2 rounded-sm bg-sky-400 inline-block" />35 hs
          </span>
          <span className="font-semibold text-gray-800">{row.hs35}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-gray-500">
            <span className="h-2 w-2 rounded-sm bg-violet-400 inline-block" />36 hs
          </span>
          <span className="font-semibold text-gray-800">{row.hs36}</span>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="text-gray-500">Total</span>
          <span className="font-semibold text-gray-800">{row.total}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-gray-500">Disponibilidad real</span>
          <span className="font-semibold text-amber-600">{row.hcEfectivo.toFixed(1)}</span>
        </div>
      </div>
    </div>
  );
}

const LEGEND = [
  { label: "30 hs", color: "#34d399" },
  { label: "35 hs", color: "#38bdf8" },
  { label: "36 hs", color: "#a78bfa" },
];

export function ContratosMixChart({ agentes }: Props) {
  const data = buildData(agentes);

  if (data.length === 0) {
    return (
      <div className="text-center text-gray-400 text-sm py-10">
        Sin datos de agentes
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Leyenda */}
      <div className="flex items-center gap-4">
        {LEGEND.map(({ label, color }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs text-gray-500">
            <span className="h-2.5 w-2.5 rounded-sm inline-block" style={{ backgroundColor: color }} />
            {label}
          </div>
        ))}
      </div>

      {/* Gráfico */}
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} barSize={30} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="servicio"
            tick={{ fontSize: 11, fill: "#9ca3af" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#d1d5db" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f3f4f6" }} />
          <Bar dataKey="hs30" name="30 hs" stackId="a" fill="#34d399" radius={[0, 0, 0, 0]} />
          <Bar dataKey="hs35" name="35 hs" stackId="a" fill="#38bdf8" radius={[0, 0, 0, 0]} />
          <Bar dataKey="hs36" name="36 hs" stackId="a" fill="#a78bfa" radius={[4, 4, 0, 0]}>
            <LabelList
              dataKey="total"
              position="top"
              style={{ fontSize: 10, fill: "#9ca3af" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Tabla de eficiencia */}
      <div className="overflow-auto rounded-lg border border-gray-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {["Servicio", "30 hs", "35 hs", "36 hs", "Total", "Disponibilidad real*", "Eficiencia"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => {
              const eficiencia = r.total > 0 ? (r.hcEfectivo / r.total) * 100 : 0;
              return (
                <tr key={r.servicio} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                  <td className="px-4 py-2.5 font-medium text-gray-800">{r.servicio}</td>
                  <td className="px-4 py-2.5 tabular-nums">
                    <span className="font-medium text-emerald-600">{r.hs30}</span>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">
                    <span className="font-medium text-sky-600">{r.hs35}</span>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">
                    <span className="font-medium text-violet-600">{r.hs36}</span>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums font-semibold text-gray-800">{r.total}</td>
                  <td className="px-4 py-2.5 tabular-nums font-semibold text-amber-600">{r.hcEfectivo.toFixed(1)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-gray-200 min-w-[60px]">
                        <div
                          className="h-1.5 rounded-full bg-amber-400"
                          style={{ width: `${Math.min(eficiencia, 100)}%` }}
                        />
                      </div>
                      <span className="tabular-nums text-gray-600 w-10 text-right">{eficiencia.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="px-4 py-2 text-[11px] text-gray-400 border-t border-gray-100">
          * Disponibilidad real = Σ(personas × días laborales / 7). Contratos 30/35 hs: 5/7 días — 36 hs: 6/7 días.
        </p>
      </div>
    </div>
  );
}
