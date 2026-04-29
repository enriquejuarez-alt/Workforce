"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { ResultadoServicio } from "@/lib/domain/types";

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
      const hsDeslogueo = r.hsBrutas * deslogueo;
      const hsAusentismo = r.hsBrutas * ausentismo;
      const hsRotacion = r.hsBrutas * rotacion;
      const totalPerdido = r.hsBrutas - r.hsNetas;
      const pctPerdido = r.hsBrutas > 0 ? (totalPerdido / r.hsBrutas) * 100 : 0;
      return {
        servicio: r.servicio,
        deslogueo: parseFloat(hsDeslogueo.toFixed(1)),
        ausentismo: parseFloat(hsAusentismo.toFixed(1)),
        rotacion: parseFloat(hsRotacion.toFixed(1)),
        totalPerdido: parseFloat(totalPerdido.toFixed(1)),
        pctPerdido: parseFloat(pctPerdido.toFixed(1)),
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
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs shadow-xl">
      <p className="font-semibold text-zinc-100 mb-1.5">{label}</p>
      <p className="text-zinc-400">Deslogueo: <span className="text-rose-400 font-medium">{row.deslogueo.toFixed(0)} hs</span></p>
      <p className="text-zinc-400">Ausentismo: <span className="text-amber-400 font-medium">{row.ausentismo.toFixed(0)} hs</span></p>
      <p className="text-zinc-400">Rotación: <span className="text-orange-400 font-medium">{row.rotacion.toFixed(0)} hs</span></p>
      <div className="mt-1.5 pt-1.5 border-t border-zinc-700">
        <p className="text-zinc-400">Total perdido: <span className="text-zinc-200 font-semibold">{row.totalPerdido.toFixed(0)} hs</span></p>
        <p className="text-zinc-400">% sobre brutas: <span className="text-zinc-200 font-semibold">{row.pctPerdido.toFixed(1)}%</span></p>
      </div>
    </div>
  );
}

export function ReduccionRankingChart({ resultados }: Props) {
  const data = buildData(resultados);

  if (data.length === 0) {
    return (
      <div className="text-center text-zinc-500 text-sm py-10">
        Sin datos de reductores
      </div>
    );
  }

  const totalPerdidoGlobal = data.reduce((a, r) => a + r.totalPerdido, 0);
  const promedioReductor = data.length > 0
    ? data.reduce((a, r) => a + r.pctPerdido, 0) / data.length
    : 0;

  return (
    <div className="space-y-6">
      {/* KPIs globales */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-xs text-zinc-500 mb-1">Total horas perdidas</p>
          <p className="text-xl font-bold text-rose-400 tabular-nums">
            {totalPerdidoGlobal.toFixed(0)} hs
          </p>
          <p className="text-xs text-zinc-600 mt-0.5">en el mes</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-xs text-zinc-500 mb-1">Reductor promedio</p>
          <p className="text-xl font-bold text-amber-400 tabular-nums">
            {promedioReductor.toFixed(1)}%
          </p>
          <p className="text-xs text-zinc-600 mt-0.5">de las hs brutas</p>
        </div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
          <p className="text-xs text-zinc-500 mb-1">Servicio más afectado</p>
          <p className="text-lg font-bold text-zinc-200">
            {data[0]?.servicio ?? "—"}
          </p>
          <p className="text-xs text-zinc-600 mt-0.5">
            {data[0]?.totalPerdido.toFixed(0)} hs perdidas
          </p>
        </div>
      </div>

      {/* Gráfico de barras apiladas (ordenado por total perdido) */}
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} barSize={28} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
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
            unit=" hs"
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "#a1a1aa" }}
            iconType="square"
            iconSize={10}
          />
          <Bar dataKey="deslogueo" name="Deslogueo" stackId="a" fill="#f87171" radius={[0, 0, 0, 0]} />
          <Bar dataKey="ausentismo" name="Ausentismo" stackId="a" fill="#fbbf24" radius={[0, 0, 0, 0]} />
          <Bar dataKey="rotacion" name="Rotación" stackId="a" fill="#fb923c" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Tabla de detalle */}
      <div className="overflow-auto rounded-xl border border-zinc-800">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/60">
              {["#", "Servicio", "Desl.", "Aus.", "Rot.", "Total perdido", "% Brutas"].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr
                key={r.servicio}
                className={`border-b border-zinc-800/50 ${i % 2 === 0 ? "bg-transparent" : "bg-zinc-900/20"}`}
              >
                <td className="px-4 py-2.5 text-zinc-600">{i + 1}</td>
                <td className="px-4 py-2.5 font-medium text-zinc-200">{r.servicio}</td>
                <td className="px-4 py-2.5 tabular-nums text-rose-400">{r.deslogueo.toFixed(0)} hs</td>
                <td className="px-4 py-2.5 tabular-nums text-amber-400">{r.ausentismo.toFixed(0)} hs</td>
                <td className="px-4 py-2.5 tabular-nums text-orange-400">{r.rotacion.toFixed(0)} hs</td>
                <td className="px-4 py-2.5 tabular-nums text-zinc-200 font-semibold">{r.totalPerdido.toFixed(0)} hs</td>
                <td className="px-4 py-2.5">
                  <span className={`tabular-nums font-medium ${r.pctPerdido > 10 ? "text-rose-400" : r.pctPerdido > 7 ? "text-amber-400" : "text-zinc-400"}`}>
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
