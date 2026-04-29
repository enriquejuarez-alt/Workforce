"use client";

import { useState } from "react";
import { Plus, Trash2, ArrowRight, Users, UserMinus, Shuffle, FileSignature, Percent } from "lucide-react";
import type { ResultadoServicio } from "@/lib/domain/types";
import { nivelCumplimiento, SERVICIOS_KEYS, type ServicioKey } from "@/lib/domain/types";
import { BadgeCumplimiento } from "@/components/ui/badge";
import { useSimulador } from "@/store/useSimulador";
import { fmtPct } from "@/lib/utils/formato";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";

interface Props {
  resultadosBase: ResultadoServicio[];
  resultadosSimulados: ResultadoServicio[];
}

// ─── Tipos de operación ────────────────────────────────────────────────────────

const OPERACIONES = [
  { tipo: "add_agents",      label: "Agregar personas",  icon: Users,         color: "text-emerald-400" },
  { tipo: "remove_agents",   label: "Dar de baja",       icon: UserMinus,     color: "text-rose-400"    },
  { tipo: "move_agents",     label: "Reasignar",         icon: Shuffle,       color: "text-sky-400"     },
  { tipo: "change_contract", label: "Cambiar contrato",  icon: FileSignature, color: "text-amber-400"   },
  { tipo: "change_reducer",  label: "Ajustar reductor",  icon: Percent,       color: "text-violet-400"  },
] as const;

type TipoOp = typeof OPERACIONES[number]["tipo"];

const selectCls = "h-8 rounded-lg border border-zinc-700 bg-zinc-800 px-2 text-xs text-zinc-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 min-w-[130px]";
const inputCls  = "w-20 h-8 bg-zinc-800 border border-zinc-700 rounded-lg px-2 text-xs text-zinc-200 tabular-nums text-center focus:outline-none focus:ring-1 focus:ring-emerald-500";

function descripcionOp(m: { tipo: string; servicio: string; servicioDestino?: string; cantidad: number; hsSemanal?: number; deslogueoOverride?: number | null; ausentismoOverride?: number | null; rotacionOverride?: number | null }): string {
  switch (m.tipo) {
    case "add_agents":      return `+${m.cantidad} personas a ${m.servicio} (${m.hsSemanal ?? 36}hs/sem)`;
    case "remove_agents":   return `−${m.cantidad} bajas en ${m.servicio}`;
    case "move_agents":     return `${m.cantidad} personas: ${m.servicio} → ${m.servicioDestino ?? "?"}`;
    case "change_contract": return `Cambiar contrato de ${m.cantidad} personas en ${m.servicio} a ${m.hsSemanal ?? 36}hs`;
    case "change_reducer":  return `Reducir ${m.servicio}: desl. ${((m.deslogueoOverride ?? 0) * 100).toFixed(1)}% / aus. ${((m.ausentismoOverride ?? 0) * 100).toFixed(1)}% / rot. ${((m.rotacionOverride ?? 0) * 100).toFixed(1)}%`;
    default: return m.tipo;
  }
}

// ─── Constructor de escenario ──────────────────────────────────────────────────

function EscenarioBuilder({ servicios }: { servicios: ServicioKey[] }) {
  const { modificaciones, addModificacion, removeModificacion, clearModificaciones } = useSimulador();

  const [tipoActivo, setTipoActivo] = useState<TipoOp>("add_agents");
  const [servicio, setServicio]     = useState<ServicioKey>(servicios[0]);
  const [destino, setDestino]       = useState<ServicioKey>(servicios[1] ?? servicios[0]);
  const [cantidad, setCantidad]     = useState(1);
  const [hsSemanal, setHsSemanal]   = useState(36);
  const [desl, setDesl]             = useState(0);
  const [aus, setAus]               = useState(0);
  const [rot, setRot]               = useState(0);

  const opCfg = OPERACIONES.find((o) => o.tipo === tipoActivo)!;

  const agregar = () => {
    const params: Record<string, unknown> = { cantidad };
    if (tipoActivo === "add_agents" || tipoActivo === "change_contract") params.hsSemanal = hsSemanal;
    if (tipoActivo === "move_agents") params.servicioDestino = destino;
    if (tipoActivo === "change_reducer") {
      params.deslogueoOverride   = desl / 100;
      params.ausentismoOverride  = aus / 100;
      params.rotacionOverride    = rot / 100;
    }
    addModificacion(tipoActivo as never, servicio, params as never);
  };

  return (
    <div className="space-y-4">
      {/* Selector de tipo de operación */}
      <div className="flex gap-2 flex-wrap">
        {OPERACIONES.map(({ tipo, label, icon: Icon, color }) => (
          <button
            key={tipo}
            onClick={() => setTipoActivo(tipo)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
              tipoActivo === tipo
                ? "border-zinc-600 bg-zinc-800 text-zinc-100"
                : "border-zinc-800 bg-transparent text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
            )}
          >
            <Icon className={cn("h-3.5 w-3.5", tipoActivo === tipo ? color : "text-zinc-600")} />
            {label}
          </button>
        ))}
      </div>

      {/* Formulario dinámico según operación */}
      <div className="rounded-xl border border-zinc-700/60 bg-zinc-800/30 p-4">
        <div className="flex flex-wrap gap-3 items-end">

          {/* Servicio origen */}
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">
              {tipoActivo === "move_agents" ? "Origen" : "Servicio"}
            </label>
            <select value={servicio} onChange={(e) => setServicio(e.target.value as ServicioKey)} className={selectCls}>
              {servicios.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Flecha + destino para move */}
          {tipoActivo === "move_agents" && (
            <>
              <ArrowRight className="h-4 w-4 text-zinc-600 self-end mb-2" />
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Destino</label>
                <select value={destino} onChange={(e) => setDestino(e.target.value as ServicioKey)} className={selectCls}>
                  {servicios.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </>
          )}

          {/* Cantidad */}
          {tipoActivo !== "change_reducer" && (
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Cantidad</label>
              <input
                type="number"
                value={cantidad}
                min={1}
                max={500}
                onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                className={inputCls}
              />
            </div>
          )}

          {/* Contrato */}
          {(tipoActivo === "add_agents" || tipoActivo === "change_contract") && (
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Contrato</label>
              <select value={hsSemanal} onChange={(e) => setHsSemanal(parseInt(e.target.value))} className={selectCls}>
                <option value={30}>30 hs/sem</option>
                <option value={35}>35 hs/sem</option>
                <option value={36}>36 hs/sem</option>
              </select>
            </div>
          )}

          {/* Reductores */}
          {tipoActivo === "change_reducer" && (
            <div className="flex gap-3 items-end flex-wrap">
              {[
                { label: "Deslogueo %", val: desl, set: setDesl },
                { label: "Ausentismo %", val: aus, set: setAus },
                { label: "Rotación %", val: rot, set: setRot },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <label className="text-xs text-zinc-500 mb-1 block">{label}</label>
                  <input
                    type="number"
                    value={val}
                    min={0}
                    max={50}
                    step={0.1}
                    onChange={(e) => set(parseFloat(e.target.value) || 0)}
                    className={inputCls}
                  />
                </div>
              ))}
            </div>
          )}

          <Button size="sm" onClick={agregar} className="gap-1.5 shrink-0">
            <Plus className="h-3.5 w-3.5" />
            Agregar al escenario
          </Button>
        </div>
      </div>

      {/* Operaciones activas */}
      {modificaciones.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-zinc-400">
              Escenario activo ({modificaciones.length} {modificaciones.length === 1 ? "operación" : "operaciones"})
            </p>
            <button
              onClick={clearModificaciones}
              className="text-xs text-zinc-600 hover:text-rose-400 transition-colors"
            >
              Borrar todo
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {modificaciones.map((m) => {
              const cfg = OPERACIONES.find((o) => o.tipo === m.tipo);
              const Icon = cfg?.icon ?? Users;
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-xs"
                >
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", cfg?.color ?? "text-zinc-500")} />
                  <span className="text-zinc-300">{descripcionOp(m)}</span>
                  <button
                    onClick={() => removeModificacion(m.id)}
                    className="text-zinc-600 hover:text-rose-400 transition-colors ml-1"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tabla de impacto ──────────────────────────────────────────────────────────

function DeltaBadge({ diff }: { diff: number }) {
  if (Math.abs(diff) < 0.05) return <span className="text-zinc-600 text-xs">sin cambio</span>;
  return (
    <span className={cn("text-xs font-semibold tabular-nums", diff > 0 ? "text-emerald-400" : "text-rose-400")}>
      {diff > 0 ? "▲" : "▼"} {Math.abs(diff).toFixed(1)}pp
    </span>
  );
}

function FaltanBadge({ delta }: { delta: number }) {
  if (delta <= 0) {
    return <span className="text-emerald-400 text-xs font-medium tabular-nums">✓ OK</span>;
  }
  return (
    <span className="text-rose-400 text-xs font-semibold tabular-nums">
      +{Math.ceil(delta)} personas
    </span>
  );
}

export function SimuladorTable({ resultadosBase, resultadosSimulados }: Props) {
  const servicios = resultadosBase.map((r) => r.servicio) as ServicioKey[];
  const hayScenario = resultadosSimulados.some((sim, i) => Math.abs(sim.cumplimiento - resultadosBase[i].cumplimiento) > 0.05);

  return (
    <div className="space-y-6">
      <EscenarioBuilder servicios={servicios} />

      {/* Tabla de impacto */}
      <div className="overflow-auto rounded-xl border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900/60">
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider">Servicio</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider whitespace-nowrap">Personas activas</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider whitespace-nowrap">Simulado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider whitespace-nowrap">Cumpl. actual</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider whitespace-nowrap">Cumpl. simulado</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider whitespace-nowrap">Cambio</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider whitespace-nowrap">Faltan para 103%</th>
            </tr>
          </thead>
          <tbody>
            {resultadosBase.map((base, i) => {
              const sim = resultadosSimulados[i];
              const nivelBase = nivelCumplimiento(base.cumplimiento);
              const nivelSim  = nivelCumplimiento(sim.cumplimiento);
              const diff      = sim.cumplimiento - base.cumplimiento;
              const personasDiff = sim.hcActivos - base.hcActivos;
              const filaModificada = Math.abs(diff) > 0.05 || personasDiff !== 0;

              return (
                <tr
                  key={base.servicio}
                  className={cn(
                    "border-b border-zinc-800/50 transition-colors",
                    filaModificada ? "bg-emerald-950/20" : i % 2 === 0 ? "bg-transparent" : "bg-zinc-900/20"
                  )}
                >
                  <td className="px-4 py-3 font-medium text-zinc-200 whitespace-nowrap">
                    {filaModificada && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />}
                    {base.servicio}
                  </td>
                  {/* Personas base */}
                  <td className="px-4 py-3 tabular-nums text-zinc-300">
                    {base.hcActivos}
                  </td>
                  {/* Personas sim */}
                  <td className="px-4 py-3 tabular-nums">
                    <span className={cn("font-semibold", personasDiff > 0 ? "text-emerald-400" : personasDiff < 0 ? "text-rose-400" : "text-zinc-500")}>
                      {sim.hcActivos}
                      {personasDiff !== 0 && (
                        <span className="ml-1 text-xs">({personasDiff > 0 ? "+" : ""}{personasDiff})</span>
                      )}
                    </span>
                  </td>
                  {/* Cumpl. base */}
                  <td className="px-4 py-3">
                    <BadgeCumplimiento nivel={nivelBase} valor={fmtPct(base.cumplimiento)} />
                  </td>
                  {/* Cumpl. sim */}
                  <td className="px-4 py-3">
                    <BadgeCumplimiento nivel={nivelSim} valor={fmtPct(sim.cumplimiento)} />
                  </td>
                  {/* Delta */}
                  <td className="px-4 py-3">
                    <DeltaBadge diff={diff} />
                  </td>
                  {/* Faltan para 103% */}
                  <td className="px-4 py-3">
                    <FaltanBadge delta={sim.deltaHC103} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Sin escenario activo */}
      {!hayScenario && (
        <p className="text-center text-xs text-zinc-600 py-2">
          Construí un escenario arriba para ver el impacto en la tabla
        </p>
      )}
    </div>
  );
}
