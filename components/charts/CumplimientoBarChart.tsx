"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import type { ResultadoServicio } from "@/lib/domain/types";
import { nivelCumplimiento } from "@/lib/domain/types";
import { COLOR_NIVEL, fmtHoras } from "@/lib/utils/formato";

interface Props {
  resultados: ResultadoServicio[];
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ResultadoServicio }>;
}

const CustomTooltip = ({ active, payload }: TooltipProps) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload as ResultadoServicio;
  const nivel = nivelCumplimiento(d.cumplimiento);
  const color = COLOR_NIVEL[nivel].hex;

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-3.5 py-3 text-xs shadow-xl shadow-gray-200/70">
      <div className="mb-2 flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <p className="font-bold text-gray-800">{d.servicio}</p>
      </div>
      <p className="text-2xl font-bold tabular-nums" style={{ color }}>
        {d.cumplimiento.toFixed(1)}%
      </p>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] text-gray-500">
        <span>Req.</span>
        <span className="text-right font-semibold text-gray-700">{fmtHoras(d.hsRequeridas)}</span>
        <span>Netas</span>
        <span className="text-right font-semibold text-gray-700">{fmtHoras(d.hsNetas)}</span>
      </div>
    </div>
  );
};

export function CumplimientoBarChart({ resultados }: Props) {
  const data = resultados.map((r) => ({
    ...r,
    name: r.servicio.replace(/^SOPORTE[- ]?/i, ""),
    label: `${r.cumplimiento.toFixed(0)}%`,
  }));
  const maxCumplimiento = Math.max(120, ...data.map((r) => r.cumplimiento + 12));

  return (
    <ResponsiveContainer width="100%" height={310}>
      <BarChart data={data} margin={{ top: 24, right: 22, bottom: 8, left: -8 }} barCategoryGap="28%">
        <CartesianGrid strokeDasharray="4 6" stroke="#E5E7EB" vertical={false} />
        <XAxis
          dataKey="name"
          interval={0}
          tick={{ fill: "#64748B", fontSize: 11, fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
          tickMargin={10}
        />
        <YAxis
          tick={{ fill: "#94A3B8", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
          domain={[0, maxCumplimiento]}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "#F1F5F9" }} />
        <ReferenceLine
          y={100}
          stroke="#CBD5E1"
          strokeDasharray="5 4"
          label={{ value: "100%", fill: "#64748B", fontSize: 10, fontWeight: 700, position: "right" }}
        />
        <ReferenceLine
          y={103}
          stroke="#10b981"
          strokeDasharray="5 4"
          label={{ value: "103%", fill: "#059669", fontSize: 10, fontWeight: 700, position: "right" }}
        />
        <Bar dataKey="cumplimiento" radius={[8, 8, 4, 4]} maxBarSize={54}>
          <LabelList dataKey="label" position="top" fill="#334155" fontSize={11} fontWeight={700} />
          {data.map((entry) => {
            const nivel = nivelCumplimiento(entry.cumplimiento);
            return (
              <Cell
                key={entry.servicio}
                fill={COLOR_NIVEL[nivel].hex}
                fillOpacity={0.88}
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
