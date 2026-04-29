"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceDot,
  ResponsiveContainer,
} from "recharts";
import type { MatrizServicio, ResultadoServicio } from "@/lib/domain/types";

interface Props {
  matriz: MatrizServicio;
  resultado: ResultadoServicio;
  diasDelMes: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-zinc-300 mb-1">Día {label}</p>
      {payload.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) => (
          <p key={p.dataKey} style={{ color: p.color }}>
            {p.name}: {Number(p.value).toFixed(1)} hs
          </p>
        )
      )}
    </div>
  );
};

export function CurvaDiaChart({ matriz, resultado, diasDelMes }: Props) {
  const hsDisponiblePorDia =
    diasDelMes > 0 ? resultado.hsNetas / diasDelMes : 0;

  const data = matriz.dias.map((dia, i) => ({
    dia: i + 1,
    "Hs Requeridas": parseFloat(matriz.totalDiario[i]?.toFixed(1) ?? "0"),
    "Hs Disponibles": parseFloat(hsDisponiblePorDia.toFixed(1)),
    feriado: dia.esFeriado,
  }));

  const feriados = data.filter((d) => d.feriado);

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis
          dataKey="dia"
          tick={{ fill: "#71717a", fontSize: 11 }}
          axisLine={false}
          tickLine={false}
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
        <Line
          type="monotone"
          dataKey="Hs Requeridas"
          stroke="#f43f5e"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="Hs Disponibles"
          stroke="#10b981"
          strokeWidth={2}
          strokeDasharray="4 2"
          dot={false}
        />
        {feriados.map((f) => (
          <ReferenceDot
            key={f.dia}
            x={f.dia}
            y={f["Hs Requeridas"]}
            r={5}
            fill="#f59e0b"
            stroke="none"
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
