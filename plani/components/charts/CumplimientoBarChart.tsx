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
} from "recharts";
import type { ResultadoServicio } from "@/lib/domain/types";
import { nivelCumplimiento } from "@/lib/domain/types";
import { COLOR_NIVEL } from "@/lib/utils/formato";

interface Props {
  resultados: ResultadoServicio[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload as ResultadoServicio;
  const nivel = nivelCumplimiento(d.cumplimiento);
  const col = COLOR_NIVEL[nivel];
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-zinc-100 mb-1">{d.servicio}</p>
      <p className={col.text}>{d.cumplimiento.toFixed(1)}%</p>
      <p className="text-zinc-500">Hs Req: {d.hsRequeridas.toFixed(0)}</p>
      <p className="text-zinc-500">Hs Netas: {d.hsNetas.toFixed(0)}</p>
    </div>
  );
};

export function CumplimientoBarChart({ resultados }: Props) {
  const data = resultados.map((r) => ({
    ...r,
    name: r.servicio.length > 10 ? r.servicio.slice(0, 9) + "…" : r.servicio,
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fill: "#71717a", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: "#71717a", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
          domain={[0, "auto"]}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "#27272a" }} />
        <ReferenceLine
          y={100}
          stroke="#52525b"
          strokeDasharray="4 2"
          label={{ value: "100%", fill: "#71717a", fontSize: 10, position: "right" }}
        />
        <ReferenceLine
          y={103}
          stroke="#10b981"
          strokeDasharray="4 2"
          label={{ value: "103%", fill: "#10b981", fontSize: 10, position: "right" }}
        />
        <Bar dataKey="cumplimiento" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {data.map((entry) => {
            const nivel = nivelCumplimiento(entry.cumplimiento);
            return (
              <Cell
                key={entry.servicio}
                fill={COLOR_NIVEL[nivel].hex}
                fillOpacity={0.85}
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
