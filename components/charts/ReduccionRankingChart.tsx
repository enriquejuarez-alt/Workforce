"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ResultadoServicio } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";
import { obtenerNombreNomina } from "@/lib/config/nombresNomina";

interface Props {
  resultados: ResultadoServicio[];
}

interface FilaReduccion {
  servicio: string;
  deslogueo: number;
  ausentismo: number;
  rotacion: number;
  totalPerdido: number;
  pctPerdido: number;
}

function buildData(resultados: ResultadoServicio[]): FilaReduccion[] {
  return resultados
    .map((r) => {
      const { deslogueo, ausentismo, rotacion } = r.reductoRes;
      return {
        servicio: r.servicio,
        deslogueo:    parseFloat((r.hsBrutas * deslogueo).toFixed(1)),
        ausentismo:   parseFloat((r.hsBrutas * ausentismo).toFixed(1)),
        rotacion:     parseFloat((r.hsBrutas * rotacion).toFixed(1)),
        totalPerdido: parseFloat((r.hsBrutas - r.hsNetas).toFixed(1)),
        pctPerdido:   r.hsBrutas > 0 ? parseFloat(((r.hsBrutas - r.hsNetas) / r.hsBrutas * 100).toFixed(1)) : 0,
      };
    })
    .filter((r) => r.totalPerdido > 0)
    .sort((a, b) => b.totalPerdido - a.totalPerdido);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as FilaReduccion;
  return (
    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs shadow-lg">
      <p className="font-semibold text-gray-800 mb-2">{label}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-gray-500">
            <span className="h-2 w-2 rounded-sm bg-red-400 inline-block" />Deslogueo
          </span>
          <span className="font-semibold text-gray-800">{row.deslogueo.toFixed(0)} hs</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-gray-500">
            <span className="h-2 w-2 rounded-sm bg-amber-400 inline-block" />Ausentismo
          </span>
          <span className="font-semibold text-gray-800">{row.ausentismo.toFixed(0)} hs</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-gray-500">
            <span className="h-2 w-2 rounded-sm bg-orange-400 inline-block" />Rotación
          </span>
          <span className="font-semibold text-gray-800">{row.rotacion.toFixed(0)} hs</span>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-gray-100 space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="text-gray-500">Total perdido</span>
          <span className="font-semibold text-red-600">{row.totalPerdido.toFixed(0)} hs</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-gray-500">% sobre brutas</span>
          <span className="font-semibold text-gray-800">{row.pctPerdido.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}

const LEGEND = [
  { label: "Deslogueo",  color: "#f87171" },
  { label: "Ausentismo", color: "#fbbf24" },
  { label: "Rotación",   color: "#fb923c" },
];

export function ReduccionRankingChart({ resultados }: Props) {
  const data = buildData(resultados);

  if (data.length === 0) {
    return (
      <div className="text-center text-gray-400 text-sm py-10">
        Sin datos de reductores
      </div>
    );
  }

  const totalPerdidoGlobal = data.reduce((a, r) => a + r.totalPerdido, 0);
  const promedioReductor   = data.reduce((a, r) => a + r.pctPerdido, 0) / data.length;
  const masAfectado        = data[0];

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3">
          <p className="text-[11px] text-red-500 font-semibold uppercase tracking-wider mb-1">Total perdido</p>
          <p className="text-2xl font-bold text-red-600 tabular-nums">{totalPerdidoGlobal.toFixed(0)}<span className="text-sm font-normal ml-1">hs</span></p>
          <p className="text-[11px] text-red-400 mt-0.5">en el mes</p>
        </div>
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-4 py-3">
          <p className="text-[11px] text-amber-600 font-semibold uppercase tracking-wider mb-1">Reductor promedio</p>
          <p className="text-2xl font-bold text-amber-600 tabular-nums">{promedioReductor.toFixed(1)}<span className="text-sm font-normal ml-0.5">%</span></p>
          <p className="text-[11px] text-amber-500 mt-0.5">de las hs brutas</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3">
          <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider mb-1">Más afectado</p>
          <p className="text-lg font-bold text-gray-800 truncate">{masAfectado?.servicio ?? "—"}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{masAfectado?.totalPerdido.toFixed(0)} hs perdidas</p>
        </div>
      </div>

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
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} barSize={28} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
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
            unit=" hs"
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#f3f4f6" }} />
          <Bar dataKey="deslogueo"  name="Deslogueo"  stackId="a" fill="#f87171" radius={[0, 0, 0, 0]} />
          <Bar dataKey="ausentismo" name="Ausentismo" stackId="a" fill="#fbbf24" radius={[0, 0, 0, 0]} />
          <Bar dataKey="rotacion"   name="Rotación"   stackId="a" fill="#fb923c" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Tabla de ranking */}
      <div className="overflow-auto rounded-lg border border-gray-200">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              {["#", "Servicio", "Deslogueo", "Ausentismo", "Rotación", "Total perdido", "% Brutas"].map((h) => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={r.servicio} className={`border-b border-gray-100 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                <td className="px-4 py-2.5 text-gray-400 font-medium">{i + 1}</td>
                <td className="px-4 py-2.5 font-medium text-gray-800">{obtenerNombreNomina(r.servicio, r.servicio)}</td>
                <td className="px-4 py-2.5 tabular-nums text-red-500 font-medium">{r.deslogueo.toFixed(0)} hs</td>
                <td className="px-4 py-2.5 tabular-nums text-amber-600 font-medium">{r.ausentismo.toFixed(0)} hs</td>
                <td className="px-4 py-2.5 tabular-nums text-orange-500 font-medium">{r.rotacion.toFixed(0)} hs</td>
                <td className="px-4 py-2.5 tabular-nums font-bold text-gray-800">{r.totalPerdido.toFixed(0)} hs</td>
                <td className="px-4 py-2.5">
                  <span className={cn(
                    "tabular-nums font-semibold",
                    r.pctPerdido > 10 ? "text-red-600" :
                    r.pctPerdido > 7  ? "text-amber-600" : "text-gray-500"
                  )}>
                    {r.pctPerdido.toFixed(1)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
