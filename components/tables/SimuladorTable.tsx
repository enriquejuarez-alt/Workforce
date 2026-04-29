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

const OPERACIONES = [
  { tipo: "add_agents",      label: "Agregar personas",  icon: Users,         color: "text-emerald-600" },
  { tipo: "remove_agents",   label: "Dar de baja",       icon: UserMinus,     color: "text-red-600"     },
  { tipo: "move_agents",     label: "Reasignar",         icon: Shuffle,       color: "text-sky-600"     },
  { tipo: "change_contract", label: "Cambiar contrato",  icon: FileSignature, color: "text-amber-600"   },
  { tipo: "change_reducer",  label: "Ajustar reductor",  icon: Percent,       color: "text-violet-600"  },
] as const;

type TipoOp = typeof OPERACIONES[number]["tipo"];

const selectCls = "h-8 rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#0054A6] min-w-[130px]";
const inputCls  = "w-20 h-8 bg-white border border-gray-300 rounded-lg px-2 text-xs text-gray-700 tabular-nums text-center focus:outline-none focus:ring-1 focus:ring-[#0054A6]";

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
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">Constructor de escenario</h3>

      {/* Selector de tipo de operación */}
      <div className="flex gap-2 flex-wrap">
        {OPERACIONES.map(({ tipo, label, icon: Icon, color }) => (
          <button
            key={tipo}
            onClick={() => setTipoActivo(tipo)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all",
              tipoActivo === tipo
                ? "border-[#0054A6] bg-[#0054A6]/5 text-[#0054A6]"
                : "border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
            )}
          >
            <Icon className={cn("h-3.5 w-3.5", tipoActivo === tipo ? color : "text-gray-400")} />
            {label}
          </button>
        ))}
      </div>

      {/* Formulario dinámico */}
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-4">
        <div className="flex flex-wrap gap-3 items-end">

          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              {tipoActivo === "move_agents" ? "Origen" : "Servicio"}
            </label>
            <select value={servicio} onChange={(e) => setServicio(e.target.value as ServicioKey)} className={selectCls}>
              {servicios.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {tipoActivo === "move_agents" && (
            <>
              <ArrowRight className="h-4 w-4 text-gray-400 self-end mb-2" />
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Destino</label>
                <select value={destino} onChange={(e) => setDestino(e.target.value as ServicioKey)} className={selectCls}>
                  {servicios.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </>
          )}

          {tipoActivo !== "change_reducer" && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Cantidad</label>
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

          {(tipoActivo === "add_agents" || tipoActivo === "change_contract") && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Contrato</label>
              <select value={hsSemanal} onChange={(e) => setHsSemanal(parseInt(e.target.value))} className={selectCls}>
                <option value={30}>30 hs/sem</option>
                <option value={35}>35 hs/sem</option>
                <option value={36}>36 hs/sem</option>
              </select>
            </div>
          )}

          {tipoActivo === "change_reducer" && (
            <div className="flex gap-3 items-end flex-wrap">
              {[
                { label: "Deslogueo %", val: desl, set: setDesl },
                { label: "Ausentismo %", val: aus, set: setAus },
                { label: "Rotación %", val: rot, set: setRot },
              ].map(({ label, val, set }) => (
                <div key={label}>
                  <label className="text-xs text-gray-500 mb-1 block">{label}</label>
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
            <p className="text-xs font-medium text-gray-500">
              Escenario activo · {modificaciones.length} {modificaciones.length === 1 ? "operación" : "operaciones"}
            </p>
            <button
              onClick={clearModificaciones}
              className="text-xs text-gray-400 hover:text-red-500 transition-colors"
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
                  className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs"
                >
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", cfg?.color ?? "text-gray-400")} />
                  <span className="text-gray-700">{descripcionOp(m)}</span>
                  <button
                    onClick={() => removeModificacion(m.id)}
                    className="text-gray-400 hover:text-red-500 transition-colors ml-1"
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

function DeltaBadge({ diff }: { diff: number }) {
  if (Math.abs(diff) < 0.05) return <span className="text-gray-400 text-xs">sin cambio</span>;
  return (
    <span className={cn("text-xs font-semibold tabular-nums", diff > 0 ? "text-emerald-600" : "text-red-600")}>
      {diff > 0 ? "▲" : "▼"} {Math.abs(diff).toFixed(1)}pp
    </span>
  );
}

function FaltanBadge({ delta }: { delta: number }) {
  if (delta <= 0) {
    return <span className="text-emerald-600 text-xs font-medium tabular-nums">✓ OK</span>;
  }
  return (
    <span className="text-red-600 text-xs font-semibold tabular-nums">
      +{Math.ceil(delta)} personas
    </span>
  );
}

export function SimuladorTable({ resultadosBase, resultadosSimulados }: Props) {
  const servicios = resultadosBase.map((r) => r.servicio) as ServicioKey[];
  const hayScenario = resultadosSimulados.some((sim, i) => Math.abs(sim.cumplimiento - resultadosBase[i].cumplimiento) > 0.05);

  return (
    <div className="space-y-5">
      <EscenarioBuilder servicios={servicios} />

      {/* Tabla de impacto */}
      <div className="overflow-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Servicio</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Personas activas</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Simulado</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Cumpl. actual</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Cumpl. simulado</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Cambio</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Faltan para 103%</th>
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
                    "border-b border-gray-100 transition-colors",
                    filaModificada ? "bg-emerald-50" : i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                  )}
                >
                  <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                    {filaModificada && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />}
                    {base.servicio}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-gray-600">
                    {base.hcActivos}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    <span className={cn("font-semibold", personasDiff > 0 ? "text-emerald-600" : personasDiff < 0 ? "text-red-600" : "text-gray-400")}>
                      {sim.hcActivos}
                      {personasDiff !== 0 && (
                        <span className="ml-1 text-xs">({personasDiff > 0 ? "+" : ""}{personasDiff})</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <BadgeCumplimiento nivel={nivelBase} valor={fmtPct(base.cumplimiento)} />
                  </td>
                  <td className="px-4 py-3">
                    <BadgeCumplimiento nivel={nivelSim} valor={fmtPct(sim.cumplimiento)} />
                  </td>
                  <td className="px-4 py-3">
                    <DeltaBadge diff={diff} />
                  </td>
                  <td className="px-4 py-3">
                    <FaltanBadge delta={sim.deltaHC103} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!hayScenario && (
        <p className="text-center text-xs text-gray-400 py-2">
          Construí un escenario arriba para ver el impacto en la tabla
        </p>
      )}
    </div>
  );
}
