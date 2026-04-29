"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import type { Agente, ServicioKey } from "@/lib/domain/types";
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
  /** HC efectivo ponderado por disponibilidad diaria (5/7 o 6/7) */
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
    const otros = activos.filter(
      (a) => ![30, 35, 36].includes(a.hsSemanal)
    ).length;
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
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-zinc-100 mb-1.5">{label}</p>
      <p className="text-zinc-400">30 hs: <span className="text-emerald-400 font-medium">{row.hs30}</span></p>
      <p className="text-zinc-400">35 hs: <span className="text-sky-400 font-medium">{row.hs35}</span></p>
      <p className="text-zinc-400">36 hs: <span className="text-violet-400 font-medium">{row.hs36}</span></p>
      <div className="mt-1.5 pt-1.5 border-t border-zinc-700">
        <p className="text-zinc-400">Total personas: <span className="text-zinc-200 font-semibold">{row.total}</span></p>
        <p className="text-zinc-400">Disponibilidad real*: <span className="text-amber-400 font-semibold">{row.hcEfectivo.toFixed(1)}</span></p>
        <p className="text-zinc-600 mt-0.5">*ponderado por días laborales (5/7 o 6/7)</p>
      </div>
    </div>
  );
}

export function ContratosMixChart({ agentes }: Props) {
  const data = buildData(agentes);

  if (data.length === 0) {
    return (
      <div className="text-center text-zinc-500 text-sm py-10">
        Sin datos de agentes
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Gráfico de barras apiladas */}
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} barSize={32} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
          <XAxis
            dataKey="servicio"
            tick={{ fontSize: 11, fill: "#71717a" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#52525b" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }}
            iconType="square"
            iconSize={10}
          />
          <Bar dataKey="hs30" name="30 hs" stackId="a" fill="#34d399" radius={[0, 0, 0, 0]} />
          <Bar dataKey="hs35" name="35 hs" stackId="a" fill="#38bdf8" radius={[0, 0, 0, 0]} />
          <Bar dataKey="hs36" name="36 hs" stackId="a" fill="#a78bfa" radius={[4, 4, 0, 0]}>
            <LabelList
              dataKey="total"
              position="top"
              style={{ fontSize: 10, fill: "#a1a1aa" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Tabla de eficiencia */}
      <div className="overflow-auto rounded-xl border border-zinc-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/60">
              {["Servicio", "30 hs", "35 hs", "36 hs", "Total", "Disponibilidad*", "Eficiencia"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => {
              const eficiencia = r.total > 0 ? (r.hcEfectivo / r.total) * 100 : 0;
              return (
                <tr
                  key={r.servicio}
                  className={`border-b border-zinc-800/50 ${i % 2 === 0 ? "bg-transparent" : "bg-zinc-900/20"}`}
                >
                  <td className="px-4 py-2.5 font-medium text-zinc-200">{r.servicio}</td>
                  <td className="px-4 py-2.5 tabular-nums text-emerald-400">{r.hs30}</td>
                  <td className="px-4 py-2.5 tabular-nums text-sky-400">{r.hs35}</td>
                  <td className="px-4 py-2.5 tabular-nums text-violet-400">{r.hs36}</td>
                  <td className="px-4 py-2.5 tabular-nums text-zinc-200 font-semibold">{r.total}</td>
                  <td className="px-4 py-2.5 tabular-nums text-amber-400 font-semibold">{r.hcEfectivo.toFixed(1)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-zinc-800">
                        <div
                          className="h-1.5 rounded-full bg-amber-500"
                          style={{ width: `${Math.min(eficiencia, 100)}%` }}
                        />
                      </div>
                      <span className="tabular-nums text-zinc-400">{eficiencia.toFixed(1)}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="px-4 py-2 text-xs text-zinc-600">
          * Disponibilidad real = Σ(personas × días laborales / 7). Contratos 30/35hs trabajan 5/7 días; 36hs trabajan 6/7 días.
        </p>
      </div>
    </div>
  );
}
