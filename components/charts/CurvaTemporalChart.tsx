"use client";

import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceDot,
  ResponsiveContainer,
} from "recharts";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import type { Agente, MatrizServicio, ResultadoServicio } from "@/lib/domain/types";
import {
  horasContratoDia,
  probabilidadFrancoDia,
  type DiaSemana,
  type ReglaFrancoContrato,
} from "@/lib/config/francoRules";
import { cn } from "@/lib/utils/cn";

const DEFAULT_WINDOW = 7;
const PRESETS = [7, 14, 21] as const;

interface Props {
  matriz: MatrizServicio;
  resultado: ResultadoServicio;
  diasDelMes: number;
  agentes: Agente[];
  reglasFranco: ReglaFrancoContrato[];
}

interface TooltipPayload {
  dataKey: string;
  name: string;
  value: number;
  color: string;
}

interface TooltipDiaProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

const TooltipDia = ({ active, payload, label }: TooltipDiaProps) => {
  if (!active || !payload?.length) return null;
  const req = payload.find((p) => p.dataKey === "Requeridas")?.value;
  const disp = payload.find((p) => p.dataKey === "Disponibles")?.value;
  const diff = req != null && disp != null ? disp - req : null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="mb-1.5 font-semibold text-gray-700">Dia {label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}:{" "}
          <span className="font-semibold tabular-nums">
            {Number(p.value).toFixed(1)} hs
          </span>
        </p>
      ))}
      {diff != null && (
        <p className={cn("mt-1.5 border-t border-gray-100 pt-1.5 font-semibold tabular-nums", diff >= 0 ? "text-emerald-600" : "text-rose-500")}>
          {diff >= 0 ? "+" : ""}
          {diff.toFixed(1)} hs
        </p>
      )}
    </div>
  );
};

function normalizarDiaSemana(raw: string): DiaSemana | null {
  const key = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const map: Record<string, DiaSemana> = {
    lunes: "lunes",
    martes: "martes",
    miercoles: "miercoles",
    jueves: "jueves",
    viernes: "viernes",
    sabado: "sabado",
    domingo: "domingo",
    lun: "lunes",
    mar: "martes",
    mie: "miercoles",
    jue: "jueves",
    vie: "viernes",
    sab: "sabado",
    dom: "domingo",
  };
  return map[key] ?? null;
}

export function CurvaTemporalChart({ matriz, resultado, diasDelMes, agentes, reglasFranco }: Props) {
  const agentesServicio = agentes.filter(
    (a) => a.estado.toUpperCase() === "ACTIVO" && a.segmentoNorm === resultado.servicio
  );

  const disponibilidadPorDia = (diaSemanaRaw: string) => {
    const diaSemana = normalizarDiaSemana(diaSemanaRaw);
    return agentesServicio.reduce((total, agente) => {
      const regla = reglasFranco.find((r) => r.hsSemanal === agente.hsSemanal);
      const hsPorDistribucion = diaSemana && regla ? horasContratoDia(regla, diaSemana) : null;
      const hsBaseDia = hsPorDistribucion === null
        ? diasDelMes > 0 ? agente.hsMensualBrutas / diasDelMes : 0
        : hsPorDistribucion * (
            agente.hsSemanal > 0
              ? agente.hsMensualBrutas / Math.max(agente.hsSemanal * (diasDelMes / 7), 1)
              : 1
          );
      const probFranco = diaSemana && regla ? probabilidadFrancoDia(regla, diaSemana) : 0;
      return total + hsBaseDia * resultado.factorProductivo * Math.max(0, 1 - probFranco);
    }, 0);
  };

  const data = matriz.dias.map((dia, i) => {
    const requeridas = matriz.totalDiario[i] ?? 0;
    const disponibles = disponibilidadPorDia(dia.diaSemana);
    return {
      label: `${i + 1}`,
      Requeridas: parseFloat(requeridas.toFixed(1)),
      Disponibles: parseFloat(disponibles.toFixed(1)),
      feriado: dia.esFeriado,
    };
  });

  const maxIdx = data.length - 1;
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(Math.min(DEFAULT_WINDOW - 1, maxIdx));

  const windowSize = end - start + 1;
  const canPrev = start > 0;
  const canNext = end < maxIdx;
  const isFullView = start === 0 && end === maxIdx;

  const movePrev = () => {
    const newStart = Math.max(0, start - windowSize);
    setStart(newStart);
    setEnd(newStart + windowSize - 1);
  };

  const moveNext = () => {
    const newEnd = Math.min(maxIdx, end + windowSize);
    setEnd(newEnd);
    setStart(newEnd - windowSize + 1);
  };

  const applyPreset = (days: number) => {
    const newEnd = Math.min(start + days - 1, maxIdx);
    if (newEnd === maxIdx && maxIdx - days + 1 >= 0) {
      setStart(maxIdx - days + 1);
    }
    setEnd(newEnd);
  };

  const handleStartInput = (val: number) => {
    const clamped = Math.max(1, Math.min(val, end + 1));
    setStart(clamped - 1);
  };

  const handleEndInput = (val: number) => {
    const clamped = Math.max(start + 1, Math.min(val, maxIdx + 1));
    setEnd(clamped - 1);
  };

  const visibleData = data.slice(start, end + 1);
  const feriadosVisibles = visibleData.filter((d) => d.feriado).map((d) => d.label);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          {PRESETS.map((n) => (
            <button
              key={n}
              onClick={() => applyPreset(n)}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                windowSize === n && !isFullView
                  ? "border-[#0054A6] bg-[#0054A6] text-white"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-400 hover:text-gray-800"
              )}
            >
              {n}d
            </button>
          ))}
          <button
            onClick={() => {
              setStart(0);
              setEnd(maxIdx);
            }}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
              isFullView
                ? "border-[#0054A6] bg-[#0054A6] text-white"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-400 hover:text-gray-800"
            )}
          >
            Mes completo
          </button>
        </div>

        <div className="h-4 w-px bg-gray-200" />

        <div className="flex items-center gap-1">
          <button
            onClick={movePrev}
            disabled={!canPrev}
            className="rounded-lg border border-gray-200 p-1.5 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
            title="Periodo anterior"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[72px] px-1 text-center text-xs tabular-nums text-gray-500">
            Dia {start + 1} - {end + 1}
          </span>
          <button
            onClick={moveNext}
            disabled={!canNext}
            className="rounded-lg border border-gray-200 p-1.5 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-30"
            title="Periodo siguiente"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="h-4 w-px bg-gray-200" />

        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
          <span>Desde</span>
          <input
            type="number"
            min={1}
            max={end + 1}
            value={start + 1}
            onChange={(e) => handleStartInput(Number(e.target.value))}
            className="w-12 rounded-md border border-gray-200 px-1.5 py-1 text-center text-xs tabular-nums focus:border-[#0054A6] focus:outline-none"
          />
          <span>hasta</span>
          <input
            type="number"
            min={start + 1}
            max={maxIdx + 1}
            value={end + 1}
            onChange={(e) => handleEndInput(Number(e.target.value))}
            className="w-12 rounded-md border border-gray-200 px-1.5 py-1 text-center text-xs tabular-nums focus:border-[#0054A6] focus:outline-none"
          />
        </div>
      </div>

      <ResponsiveContainer width="100%" height={340}>
        <AreaChart data={visibleData} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="gReq" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gDisp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: "#9ca3af", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fill: "#9ca3af", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            unit=" hs"
            width={52}
          />
          <Tooltip content={<TooltipDia />} />
          <Legend wrapperStyle={{ fontSize: "12px", color: "#6b7280" }} iconType="circle" iconSize={8} />

          <Area
            type="monotone"
            dataKey="Requeridas"
            stroke="#f43f5e"
            strokeWidth={2}
            fill="url(#gReq)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
          <Area
            type="monotone"
            dataKey="Disponibles"
            stroke="#10b981"
            strokeWidth={2}
            fill="url(#gDisp)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />

          {visibleData.filter((d) => d.feriado).map((f) => (
            <ReferenceDot
              key={f.label}
              x={f.label}
              y={f.Requeridas}
              r={5}
              fill="#f59e0b"
              stroke="#fff"
              strokeWidth={1.5}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>

      {feriadosVisibles.length > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-amber-600">
          <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
          Feriados en vista: dias {feriadosVisibles.join(", ")}
        </p>
      )}
    </div>
  );
}
