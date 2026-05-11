"use client";

import { useState } from "react";
import {
  Plus, Trash2, ArrowRight, Users, UserMinus, Shuffle,
  FileSignature, Wand2, Save, FolderOpen, X, Settings2, RotateCcw,
} from "lucide-react";
import type { ResultadoServicio } from "@/lib/domain/types";
import { type ServicioKey } from "@/lib/domain/types";
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
    default: return m.tipo;
  }
}

// ── Auto-sugerencia ──────────────────────────────────────────────────────────

function sugerirReasignaciones(resultados: ResultadoServicio[]) {
  const surplus = resultados
    .filter((r) => r.deltaHC103 < 0)
    .map((r) => ({ servicio: r.servicio as ServicioKey, disponible: Math.floor(Math.abs(r.deltaHC103)) }))
    .filter((s) => s.disponible > 0)
    .sort((a, b) => b.disponible - a.disponible);

  const deficits = resultados
    .filter((r) => r.deltaHC103 > 0)
    .map((r) => ({ servicio: r.servicio as ServicioKey, necesita: Math.ceil(r.deltaHC103) }))
    .sort((a, b) => b.necesita - a.necesita);

  const moves: { tipo: "move_agents"; servicio: ServicioKey; servicioDestino: ServicioKey; cantidad: number; hsSemanal: number }[] = [];

  for (const d of deficits) {
    let restante = d.necesita;
    for (const s of surplus) {
      if (s.disponible <= 0 || restante <= 0) continue;
      const mover = Math.min(s.disponible, restante);
      moves.push({ tipo: "move_agents", servicio: s.servicio, servicioDestino: d.servicio, cantidad: mover, hsSemanal: 36 });
      s.disponible -= mover;
      restante -= mover;
    }
  }
  return moves;
}

// ── Progress bar de cumplimiento ─────────────────────────────────────────────

const BAR_MAX = 130;

function CumplBar({ valor }: { valor: number }) {
  const fill = Math.min(valor, BAR_MAX) / BAR_MAX * 100;
  const markerPct = 103 / BAR_MAX * 100;
  const color = valor >= 103 ? "bg-emerald-500" : valor >= 90 ? "bg-amber-400" : "bg-rose-500";

  return (
    <div>
      <span className={cn(
        "text-xs font-semibold tabular-nums",
        valor >= 103 ? "text-emerald-700" : valor >= 90 ? "text-amber-700" : "text-rose-600"
      )}>
        {fmtPct(valor)}
      </span>
      <div className="relative mt-1 h-1.5 w-20 rounded-full bg-gray-100 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-300", color)} style={{ width: `${fill}%` }} />
        <div className="absolute inset-y-0 w-px bg-gray-400" style={{ left: `${markerPct}%` }} />
      </div>
    </div>
  );
}

// ── Balance (surplus / déficit) ───────────────────────────────────────────────

function BalanceBadge({ sim }: { sim: ResultadoServicio }) {
  const delta = sim.deltaHC103;
  const min   = Math.round(sim.hcActivos - Math.abs(delta));

  if (delta <= 0 && Math.abs(delta) < 0.5) {
    return <span className="text-emerald-600 text-xs font-medium">✓ OK</span>;
  }

  if (delta < 0) {
    const puede = Math.floor(Math.abs(delta));
    return (
      <div>
        <span className="text-emerald-700 text-xs font-semibold tabular-nums">Puede ceder {puede}</span>
        <p className="text-[10px] text-gray-400 tabular-nums mt-0.5">tiene {sim.hcActivos} · mínimo ~{min}</p>
      </div>
    );
  }

  return (
    <div>
      <span className="text-rose-600 text-xs font-semibold tabular-nums">Faltan {Math.ceil(delta)}</span>
      <p className="text-[10px] text-gray-400 tabular-nums mt-0.5">tiene {sim.hcActivos} · necesita ~{sim.hcActivos + Math.ceil(delta)}</p>
    </div>
  );
}

// ── ReductoresEditor ─────────────────────────────────────────────────────────

function ReductoresEditor({ resultadosBase }: { resultadosBase: ResultadoServicio[] }) {
  const { ajustes, setAjuste } = useSimulador();
  const [open, setOpen] = useState(false);

  const inputCls = "w-16 h-7 bg-white border border-gray-300 rounded-lg px-2 text-xs tabular-nums text-center focus:outline-none focus:ring-1 focus:ring-[#0054A6]";

  const tieneOverrides = resultadosBase.some((r) => {
    const aj = ajustes[r.servicio];
    return aj.deslogueoOverride !== null || aj.ausentismoOverride !== null || aj.rotacionOverride !== null;
  });

  const resetAll = () => {
    for (const r of resultadosBase) {
      setAjuste(r.servicio as ServicioKey, { deslogueoOverride: null, ausentismoOverride: null, rotacionOverride: null });
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center justify-between gap-3 px-5 py-3 text-sm transition-colors",
          open ? "bg-violet-50 border-b border-violet-100" : "hover:bg-gray-50"
        )}
      >
        <div className="flex items-center gap-2">
          <Settings2 className={cn("h-4 w-4", open ? "text-violet-600" : "text-gray-400")} />
          <span className={cn("font-semibold", open ? "text-violet-700" : "text-gray-700")}>
            Modificar reductores
          </span>
          {tieneOverrides && (
            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700">
              Con cambios
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-gray-500">
              Sobreescribí los reductores por servicio para este escenario. Dejá vacío para usar el valor base.
            </p>
            {tieneOverrides && (
              <button
                onClick={resetAll}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors shrink-0 ml-4"
              >
                <RotateCcw className="h-3 w-3" />
                Resetear todo
              </button>
            )}
          </div>

          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left pb-2 text-gray-500 font-medium pr-4">Servicio</th>
                  <th className="text-center pb-2 text-gray-500 font-medium px-2 whitespace-nowrap">Deslogueo %</th>
                  <th className="text-center pb-2 text-gray-500 font-medium px-2 whitespace-nowrap">Ausentismo %</th>
                  <th className="text-center pb-2 text-gray-500 font-medium px-2 whitespace-nowrap">Rotación %</th>
                  <th className="pb-2 px-2" />
                </tr>
              </thead>
              <tbody>
                {resultadosBase.map((r) => {
                  const aj = ajustes[r.servicio as ServicioKey];
                  const base = r.reductoRes;
                  const hasOverride = aj.deslogueoOverride !== null || aj.ausentismoOverride !== null || aj.rotacionOverride !== null;

                  return (
                    <tr key={r.servicio} className={cn("border-b border-gray-50", hasOverride && "bg-violet-50/40")}>
                      <td className="py-2 pr-4 font-medium text-gray-700 whitespace-nowrap">
                        {hasOverride && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-violet-500 inline-block" />}
                        {r.servicio}
                      </td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          placeholder={`${(base.deslogueo * 100).toFixed(1)}`}
                          value={aj.deslogueoOverride !== null ? (aj.deslogueoOverride * 100).toFixed(1) : ""}
                          onChange={(e) => {
                            const v = e.target.value === "" ? null : parseFloat(e.target.value) / 100;
                            setAjuste(r.servicio as ServicioKey, { deslogueoOverride: v });
                          }}
                          className={cn(inputCls, aj.deslogueoOverride !== null && "border-violet-400 bg-violet-50")}
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          placeholder={`${(base.ausentismo * 100).toFixed(1)}`}
                          value={aj.ausentismoOverride !== null ? (aj.ausentismoOverride * 100).toFixed(1) : ""}
                          onChange={(e) => {
                            const v = e.target.value === "" ? null : parseFloat(e.target.value) / 100;
                            setAjuste(r.servicio as ServicioKey, { ausentismoOverride: v });
                          }}
                          className={cn(inputCls, aj.ausentismoOverride !== null && "border-violet-400 bg-violet-50")}
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          placeholder={`${(base.rotacion * 100).toFixed(1)}`}
                          value={aj.rotacionOverride !== null ? (aj.rotacionOverride * 100).toFixed(1) : ""}
                          onChange={(e) => {
                            const v = e.target.value === "" ? null : parseFloat(e.target.value) / 100;
                            setAjuste(r.servicio as ServicioKey, { rotacionOverride: v });
                          }}
                          className={cn(inputCls, aj.rotacionOverride !== null && "border-violet-400 bg-violet-50")}
                        />
                      </td>
                      <td className="py-2 px-2">
                        {hasOverride && (
                          <button
                            onClick={() => setAjuste(r.servicio as ServicioKey, { deslogueoOverride: null, ausentismoOverride: null, rotacionOverride: null })}
                            className="text-gray-300 hover:text-red-400 transition-colors"
                            title="Resetear este servicio"
                          >
                            <RotateCcw className="h-3 w-3" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── EscenarioBuilder ─────────────────────────────────────────────────────────

function EscenarioBuilder({ servicios, resultadosSimulados }: { servicios: ServicioKey[]; resultadosSimulados: ResultadoServicio[] }) {
  const { modificaciones, escenarios, addModificacion, bulkAddModificaciones, removeModificacion, clearModificaciones, saveEscenario, loadEscenario, deleteEscenario } = useSimulador();

  const [tipoActivo, setTipoActivo] = useState<TipoOp>("add_agents");
  const [servicio, setServicio]     = useState<ServicioKey>(servicios[0]);
  const [destino, setDestino]       = useState<ServicioKey>(servicios[1] ?? servicios[0]);
  const [cantidad, setCantidad]     = useState(1);
  const [hsSemanal, setHsSemanal]   = useState(36);
  const [saveNombre, setSaveNombre]     = useState("");
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [showEscenarios, setShowEscenarios] = useState(false);

  const opCfg = OPERACIONES.find((o) => o.tipo === tipoActivo)!;

  const agregar = () => {
    const params: Record<string, unknown> = { cantidad };
    if (tipoActivo === "add_agents" || tipoActivo === "change_contract") params.hsSemanal = hsSemanal;
    if (tipoActivo === "move_agents") params.servicioDestino = destino;
    addModificacion(tipoActivo as never, servicio, params as never);
  };

  const handleAutoSugerir = () => {
    const mods = sugerirReasignaciones(resultadosSimulados);
    if (mods.length === 0) return;
    bulkAddModificaciones(mods);
  };

  const handleSave = () => {
    if (!saveNombre.trim()) return;
    saveEscenario(saveNombre.trim());
    setSaveNombre("");
    setShowSaveInput(false);
  };

  const deficitCount = resultadosSimulados.filter((r) => r.deltaHC103 > 0).length;
  const surplusCount = resultadosSimulados.filter((r) => r.deltaHC103 < 0).length;
  const canAutoSuggest = deficitCount > 0 && surplusCount > 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 space-y-4">
      {/* Header con auto-sugerencia y guardar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-gray-700">Constructor de escenario</h3>
        <div className="flex items-center gap-2 flex-wrap">
          {canAutoSuggest && (
            <button
              onClick={handleAutoSugerir}
              className="flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 hover:bg-violet-100 transition-colors"
              title="Calcula las reasignaciones mínimas para que todos los servicios lleguen al 103%"
            >
              <Wand2 className="h-3.5 w-3.5" />
              Sugerirme reasignaciones
            </button>
          )}

          {/* Guardar escenario */}
          {modificaciones.length > 0 && !showSaveInput && (
            <button
              onClick={() => setShowSaveInput(true)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Save className="h-3.5 w-3.5" />
              Guardar escenario
            </button>
          )}
          {showSaveInput && (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                value={saveNombre}
                onChange={(e) => setSaveNombre(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setShowSaveInput(false); }}
                placeholder="Nombre del escenario…"
                className="h-7 rounded-lg border border-gray-300 px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#0054A6] w-44"
              />
              <button
                onClick={handleSave}
                disabled={!saveNombre.trim()}
                className="h-7 px-2.5 rounded-lg bg-[#0054A6] text-white text-xs font-medium disabled:opacity-40 hover:bg-[#004080] transition-colors"
              >
                Guardar
              </button>
              <button onClick={() => setShowSaveInput(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Cargar escenario */}
          {escenarios.length > 0 && (
            <button
              onClick={() => setShowEscenarios((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              {escenarios.length} guardado{escenarios.length !== 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>

      {/* Lista de escenarios guardados */}
      {showEscenarios && escenarios.length > 0 && (
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-1.5">
          <p className="text-xs font-medium text-gray-500 mb-2">Escenarios guardados</p>
          {escenarios.map((e) => (
            <div key={e.id} className="flex items-center justify-between gap-2 rounded-lg bg-white border border-gray-200 px-3 py-2">
              <div>
                <p className="text-xs font-medium text-gray-700">{e.nombre}</p>
                <p className="text-[10px] text-gray-400">
                  {e.modificaciones.length} operaciones · {new Date(e.timestamp).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { loadEscenario(e.id); setShowEscenarios(false); }}
                  className="text-xs text-[#0054A6] hover:underline font-medium"
                >
                  Cargar
                </button>
                <button
                  onClick={() => deleteEscenario(e.id)}
                  className="text-gray-300 hover:text-red-400 transition-colors ml-2"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

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
            <button onClick={clearModificaciones} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
              Borrar todo
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {modificaciones.map((m) => {
              const cfg  = OPERACIONES.find((o) => o.tipo === m.tipo);
              const Icon = cfg?.icon ?? Users;
              return (
                <div key={m.id} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs">
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", cfg?.color ?? "text-gray-400")} />
                  <span className="text-gray-700">{descripcionOp(m)}</span>
                  <button onClick={() => removeModificacion(m.id)} className="text-gray-400 hover:text-red-500 transition-colors ml-1">
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

// ── ReductoresCell ────────────────────────────────────────────────────────────

function ReductoresCell({
  base,
  sim,
}: {
  base: ResultadoServicio;
  sim: ResultadoServicio;
}) {
  const rows = [
    { label: "Desl.", base: base.reductoRes.deslogueo, sim: sim.reductoRes.deslogueo },
    { label: "Aus.",  base: base.reductoRes.ausentismo, sim: sim.reductoRes.ausentismo },
    { label: "Rot.",  base: base.reductoRes.rotacion,   sim: sim.reductoRes.rotacion  },
  ];

  return (
    <div className="space-y-0.5">
      {rows.map(({ label, base: bv, sim: sv }) => {
        const changed = Math.abs(sv - bv) > 0.0005;
        return (
          <div key={label} className="flex items-center gap-1">
            <span className="text-[10px] text-gray-400 w-7 shrink-0">{label}</span>
            <span className={cn("text-[10px] tabular-nums font-medium", changed ? "text-violet-600" : "text-gray-600")}>
              {(sv * 100).toFixed(1)}%
            </span>
            {changed && (
              <span className="text-[9px] text-gray-400 tabular-nums">
                ({(bv * 100).toFixed(1)})
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── DeltaBadge ────────────────────────────────────────────────────────────────

function DeltaBadge({ diff }: { diff: number }) {
  if (Math.abs(diff) < 0.05) return <span className="text-gray-400 text-xs">sin cambio</span>;
  return (
    <span className={cn("text-xs font-semibold tabular-nums", diff > 0 ? "text-emerald-600" : "text-red-600")}>
      {diff > 0 ? "▲" : "▼"} {Math.abs(diff).toFixed(1)}pp
    </span>
  );
}

// ── Tabla principal ───────────────────────────────────────────────────────────

export function SimuladorTable({ resultadosBase, resultadosSimulados }: Props) {
  const servicios = resultadosBase.map((r) => r.servicio) as ServicioKey[];
  const hayScenario = resultadosSimulados.some((sim, i) => Math.abs(sim.cumplimiento - resultadosBase[i].cumplimiento) > 0.05);

  return (
    <div className="space-y-5">
      <EscenarioBuilder servicios={servicios} resultadosSimulados={resultadosSimulados} />
      <ReductoresEditor resultadosBase={resultadosBase} />

      <div className="overflow-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Servicio</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Activos</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Simulado</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Cumpl. actual</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Cumpl. simulado</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Δ</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Reductores</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Balance para 103%</th>
            </tr>
          </thead>
          <tbody>
            {resultadosBase.map((base, i) => {
              const sim          = resultadosSimulados[i];
              const diff         = sim.cumplimiento - base.cumplimiento;
              const personasDiff = sim.hcActivos - base.hcActivos;
              const filaModificada = Math.abs(diff) > 0.05 || personasDiff !== 0;

              return (
                <tr
                  key={base.servicio}
                  className={cn(
                    "border-b border-gray-100 transition-colors",
                    filaModificada ? "bg-emerald-50/60" : i % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                  )}
                >
                  <td className="px-4 py-3 font-medium text-gray-800 whitespace-nowrap">
                    {filaModificada && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />}
                    {base.servicio}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-gray-600 text-xs">
                    {base.hcActivos}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    <span className={cn("text-xs font-semibold", personasDiff > 0 ? "text-emerald-600" : personasDiff < 0 ? "text-red-600" : "text-gray-400")}>
                      {sim.hcActivos}
                      {personasDiff !== 0 && (
                        <span className="ml-1 font-normal text-[11px]">({personasDiff > 0 ? "+" : ""}{personasDiff})</span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <CumplBar valor={base.cumplimiento} />
                  </td>
                  <td className="px-4 py-3">
                    <CumplBar valor={sim.cumplimiento} />
                  </td>
                  <td className="px-4 py-3">
                    <DeltaBadge diff={diff} />
                  </td>
                  <td className="px-4 py-3">
                    <ReductoresCell base={base} sim={sim} />
                  </td>
                  <td className="px-4 py-3">
                    <BalanceBadge sim={sim} />
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
