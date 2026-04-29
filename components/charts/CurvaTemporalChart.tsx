"use client";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceDot,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { MatrizServicio, ResultadoServicio } from "@/lib/domain/types";

export type Granularity = "dias" | "semanas" | "mes";

interface Props {
  matriz: MatrizServicio;
  resultado: ResultadoServicio;
  diasDelMes: number;
  granularity: Granularity;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TooltipHs = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-zinc-300 mb-1">{label}</p>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: {Number(p.value).toFixed(0)} hs
        </p>
      ))}
    </div>
  );
};

// ── Vista por días ──────────────────────────────────────────────────────────
function DiaView({ matriz, resultado, diasDelMes }: Omit<Props, "granularity">) {
  const hsPorDia = diasDelMes > 0 ? resultado.hsNetas / diasDelMes : 0;

  const data = matriz.dias.map((dia, i) => ({
    label: `${i + 1}`,
    Requeridas: parseFloat((matriz.totalDiario[i] ?? 0).toFixed(1)),
    Disponibles: parseFloat(hsPorDia.toFixed(1)),
    feriado: dia.esFeriado,
  }));

  const feriados = data.filter((d) => d.feriado);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="gReq" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gDisp" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} interval={Math.floor(data.length / 10)} />
        <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip content={<TooltipHs />} />
        <Legend wrapperStyle={{ fontSize: "12px", color: "#71717a" }} iconType="circle" iconSize={8} />
        <Area type="monotone" dataKey="Requeridas" stroke="#f43f5e" strokeWidth={2} fill="url(#gReq)" dot={false} />
        <Area type="monotone" dataKey="Disponibles" stroke="#10b981" strokeWidth={2} fill="url(#gDisp)" dot={false} />
        {feriados.map((f) => (
          <ReferenceDot key={f.label} x={f.label} y={f.Requeridas} r={4} fill="#f59e0b" stroke="none" />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Vista por semanas ───────────────────────────────────────────────────────
function SemanaView({ matriz, resultado, diasDelMes }: Omit<Props, "granularity">) {
  const hsPorDia = diasDelMes > 0 ? resultado.hsNetas / diasDelMes : 0;
  const n = matriz.totalDiario.length;

  const semanas: { label: string; Requeridas: number; Disponibles: number; feriados: number }[] = [];
  let s = 0;
  while (s * 7 < n) {
    const start = s * 7;
    const end   = Math.min(start + 7, n);
    const reqSemana  = matriz.totalDiario.slice(start, end).reduce((a, v) => a + (v ?? 0), 0);
    const dispSemana = hsPorDia * (end - start);
    const feriados   = matriz.dias.slice(start, end).filter((d) => d.esFeriado).length;
    semanas.push({
      label: `Sem ${s + 1}\n(días ${start + 1}–${end})`,
      Requeridas: parseFloat(reqSemana.toFixed(1)),
      Disponibles: parseFloat(dispSemana.toFixed(1)),
      feriados,
    });
    s++;
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={semanas} barGap={4} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip content={<TooltipHs />} />
        <Legend wrapperStyle={{ fontSize: "12px", color: "#71717a" }} iconType="square" iconSize={8} />
        <Bar dataKey="Requeridas" fill="#f43f5e" radius={[3, 3, 0, 0]} maxBarSize={48} />
        <Bar dataKey="Disponibles" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Vista mensual ───────────────────────────────────────────────────────────
function MesView({ matriz, resultado }: Omit<Props, "granularity" | "diasDelMes">) {
  const requeridas  = matriz.totalMes;
  const disponibles = resultado.hsNetas;
  const cumpl       = requeridas > 0 ? (disponibles / requeridas) * 100 : 0;

  const data = [
    { label: "Mes completo", Requeridas: parseFloat(requeridas.toFixed(0)), Disponibles: parseFloat(disponibles.toFixed(0)) },
  ];

  const cumplColor = cumpl >= 103 ? "#10b981" : cumpl >= 90 ? "#f59e0b" : "#f43f5e";

  return (
    <div className="space-y-6">
      {/* Gauge simple */}
      <div className="flex items-center justify-center gap-10 py-4">
        <div className="text-center">
          <p className="text-xs text-zinc-500 mb-1">Hs Requeridas</p>
          <p className="text-3xl font-bold text-zinc-100 tabular-nums">{requeridas.toFixed(0)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-zinc-500 mb-1">Cumplimiento</p>
          <p className="text-4xl font-bold tabular-nums" style={{ color: cumplColor }}>{cumpl.toFixed(1)}%</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-zinc-500 mb-1">Hs Disponibles</p>
          <p className="text-3xl font-bold text-zinc-100 tabular-nums">{disponibles.toFixed(0)}</p>
        </div>
      </div>

      {/* Barra comparativa */}
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
          <XAxis type="number" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} width={80} />
          <Tooltip content={<TooltipHs />} />
          <Legend wrapperStyle={{ fontSize: "12px", color: "#71717a" }} iconType="square" iconSize={8} />
          <Bar dataKey="Requeridas" fill="#f43f5e" radius={[0, 3, 3, 0]} maxBarSize={28} />
          <Bar dataKey="Disponibles" radius={[0, 3, 3, 0]} maxBarSize={28}>
            {data.map((_, i) => (
              <Cell key={i} fill={cumplColor} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Diferencia */}
      <div className="flex justify-center">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-6 py-3 text-center">
          <p className="text-xs text-zinc-500 mb-0.5">Diferencia mensual</p>
          <p className="text-xl font-semibold tabular-nums" style={{ color: cumplColor }}>
            {disponibles - requeridas >= 0 ? "+" : ""}{(disponibles - requeridas).toFixed(0)} hs
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Componente principal ────────────────────────────────────────────────────
export function CurvaTemporalChart({ matriz, resultado, diasDelMes, granularity }: Props) {
  if (granularity === "semanas") return <SemanaView matriz={matriz} resultado={resultado} diasDelMes={diasDelMes} />;
  if (granularity === "mes")     return <MesView    matriz={matriz} resultado={resultado} />;
  return <DiaView matriz={matriz} resultado={resultado} diasDelMes={diasDelMes} />;
}
