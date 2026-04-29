"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { MatrizServicio } from "@/lib/domain/types";
import {
  calcularHCDisponiblePorFranja,
  calcularHCRequeridoPorFranja,
} from "@/lib/domain/calculos";

interface Props {
  matriz: MatrizServicio;
  hcActivos: number;
  hsSemanalPromedio?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-zinc-300 mb-1">{label}</p>
      {payload.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) => (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.name}: {Number(p.value).toFixed(1)} personas
          </p>
        )
      )}
    </div>
  );
};

export function CurvaFranjaChart({ matriz, hcActivos, hsSemanalPromedio = 36 }: Props) {
  const hcReq = calcularHCRequeridoPorFranja(matriz);
  const hcDisp = calcularHCDisponiblePorFranja(hcActivos, hsSemanalPromedio);

  const data = matriz.franjas.map((franja, i) => ({
    franja,
    "Requerido": parseFloat(hcReq[i]?.toFixed(2) ?? "0"),
    "Disponible": parseFloat(hcDisp[i]?.toFixed(2) ?? "0"),
  }));

  const tickInterval = Math.floor(data.length / 8);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="gradReq" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradDisp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis
          dataKey="franja"
          tick={{ fill: "#71717a", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          interval={tickInterval}
        />
        <YAxis
          tick={{ fill: "#71717a", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: "12px", color: "#71717a" }}
          iconType="circle"
          iconSize={8}
        />
        <Area
          type="monotone"
          dataKey="Requerido"
          stroke="#f43f5e"
          strokeWidth={2}
          fill="url(#gradReq)"
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="Disponible"
          stroke="#10b981"
          strokeWidth={2}
          fill="url(#gradDisp)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
