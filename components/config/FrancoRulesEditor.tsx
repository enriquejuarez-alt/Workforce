"use client";

import { useMemo, useState } from "react";
import { useFrancoConfig } from "@/store/useFrancoConfig";
import {
  DIAS_SEMANA,
  DIA_LABELS,
  type DiaSemana,
  type DistribucionJornada,
  type ReglaFrancoContrato,
} from "@/lib/config/francoRules";
import { cn } from "@/lib/utils/cn";
import { Info, Plus, RotateCcw, Trash2 } from "lucide-react";

const DIA_COMPLETO: Record<DiaSemana, string> = {
  lunes: "Lunes",
  martes: "Martes",
  miercoles: "Miércoles",
  jueves: "Jueves",
  viernes: "Viernes",
  sabado: "Sábado",
  domingo: "Domingo",
};

const CONTRATOS_COMUNES = [30, 35, 36, 40];

function describirVentana(dias: DiaSemana[]) {
  if (dias.length === 0) return "Sin días habilitados";
  if (dias.length === 7) return "Cualquier día";
  return dias.map((d) => DIA_LABELS[d]).join(", ");
}

function describirDistribucion(distribucion?: DistribucionJornada) {
  if (!distribucion || distribucion.tipo === "uniforme") return "Distribución uniforme";
  const dias = distribucion.diasLaborables?.map((d) => DIA_LABELS[d]).join(", ") || "sin días";
  const extra =
    distribucion.hsExtraDia && distribucion.hsExtraDia > 0
      ? ` + ${distribucion.hsExtraDia} hs extra`
      : "";
  return `${distribucion.hsBaseDia ?? 0} hs${extra} en ${dias}`;
}

/** Compact 7-day week bar showing which days are active */
function WeekBar({ dias, color = "#0054A6" }: { dias: DiaSemana[]; color?: string }) {
  return (
    <div className="flex gap-0.5">
      {DIAS_SEMANA.map((d) => {
        const activo = dias.includes(d);
        return (
          <div
            key={d}
            title={DIA_COMPLETO[d]}
            className={cn(
              "h-4 w-4 rounded-sm text-[8px] font-bold flex items-center justify-center transition-colors",
              activo ? "text-white" : "bg-gray-100 text-gray-300"
            )}
            style={activo ? { backgroundColor: color } : undefined}
          >
            {DIA_LABELS[d][0]}
          </div>
        );
      })}
    </div>
  );
}

interface FrancoRulesEditorProps {
  activeReglas?: ReglaFrancoContrato[];
}

export function FrancoRulesEditor({ activeReglas }: FrancoRulesEditorProps) {
  const {
    reglas: globalReglas,
    addContrato,
    updateContrato,
    removeContrato,
    setVentana,
    addFranco,
    removeFranco,
    resetToDefaults,
  } = useFrancoConfig();

  const reglas = activeReglas ?? globalReglas;
  const [nuevoContrato, setNuevoContrato] = useState("");
  const [showInfo, setShowInfo] = useState(false);

  const contratosExistentes = useMemo(
    () => new Set(reglas.map((r) => r.hsSemanal)),
    [reglas]
  );

  const handleAddContrato = (hs?: number) => {
    const val = hs ?? Number(nuevoContrato);
    if (!Number.isFinite(val) || val <= 0 || contratosExistentes.has(val)) return;
    addContrato(val);
    setNuevoContrato("");
  };

  const toggleDia = (hsSemanal: number, francoIndex: number, dia: DiaSemana) => {
    const regla = reglas.find((r) => r.hsSemanal === hsSemanal);
    const ventana = regla?.francos[francoIndex];
    if (!ventana) return;
    const dias = ventana.dias.includes(dia)
      ? ventana.dias.filter((d) => d !== dia)
      : [...ventana.dias, dia];
    setVentana(hsSemanal, francoIndex, { dias });
  };

  const updateDistribucion = (regla: ReglaFrancoContrato, patch: DistribucionJornada) => {
    updateContrato(regla.hsSemanal, { distribucion: patch });
  };

  const toggleDiaDistribucion = (
    regla: ReglaFrancoContrato,
    field: "diasLaborables" | "diasExtra",
    dia: DiaSemana
  ) => {
    const distribucion =
      regla.distribucion?.tipo === "base_extra_diario"
        ? regla.distribucion
        : {
            tipo: "base_extra_diario" as const,
            diasLaborables: [],
            hsBaseDia: 0,
            hsExtraDia: 0,
            diasExtra: [],
          };
    const actual = distribucion[field] ?? [];
    const next = actual.includes(dia) ? actual.filter((d) => d !== dia) : [...actual, dia];
    updateDistribucion(regla, { ...distribucion, [field]: next });
  };

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-800">Configuración de contratos</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Definí francos semanales y ventanas de días por tipo de contrato.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowInfo((v) => !v)}
            className={cn(
              "rounded-lg p-1.5 transition-colors",
              showInfo ? "bg-blue-50 text-[#0054A6]" : "text-gray-300 hover:text-gray-500"
            )}
            title="Cómo se interpreta"
          >
            <Info className="h-4 w-4" />
          </button>
          <button
            onClick={resetToDefaults}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-500 shadow-sm transition-colors hover:border-gray-300 hover:text-gray-700"
          >
            <RotateCcw className="h-3 w-3" />
            Restaurar defaults
          </button>
        </div>
      </div>

      {showInfo && (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-relaxed text-blue-800">
          <strong>Cómo se interpreta:</strong> cada fila es un contrato, y cada bloque "Franco"
          es un franco semanal. Si un franco puede caer entre lunes y viernes, cada uno de esos
          días toma 1/5 de probabilidad de ausencia para ese contrato.
        </div>
      )}

      {/* Add contract */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">
          Agregar contrato
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {CONTRATOS_COMUNES.map((hs) => (
            <button
              key={hs}
              onClick={() => handleAddContrato(hs)}
              disabled={contratosExistentes.has(hs)}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:border-[#0054A6]/40 hover:bg-blue-50/40 hover:text-[#0054A6] disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-600"
            >
              {hs} hs
            </button>
          ))}
          <div className="flex items-center gap-2 border-l border-slate-200 pl-3 ml-1">
            <input
              type="number"
              min={1}
              step={0.5}
              value={nuevoContrato}
              onChange={(e) => setNuevoContrato(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddContrato(); }}
              placeholder="Ej: 32.5"
              className="h-9 w-24 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-[#0054A6] focus:ring-2 focus:ring-[#0054A6]/10"
            />
            <span className="text-xs text-gray-400">hs</span>
            <button
              onClick={() => handleAddContrato()}
              disabled={!nuevoContrato || contratosExistentes.has(Number(nuevoContrato))}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0054A6] px-3 text-xs font-semibold text-white transition-colors hover:bg-[#004080] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              Agregar
            </button>
          </div>
        </div>
      </div>

      {/* Contract cards */}
      <div className="space-y-3">
        {reglas.map((regla) => (
          <section
            key={regla.hsSemanal}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            {/* Card header */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0054A6]/10">
                  <span className="text-sm font-black text-[#0054A6]">{regla.hsSemanal}</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-800">
                      {regla.hsSemanal} hs / sem
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                      {regla.francos.length} franco{regla.francos.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {describirDistribucion(regla.distribucion)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => addFranco(regla.hsSemanal)}
                  className="inline-flex items-center gap-1 rounded-lg border border-blue-100 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#0054A6] shadow-sm transition-colors hover:bg-blue-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar franco
                </button>
                <button
                  onClick={() => removeContrato(regla.hsSemanal)}
                  className="rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500"
                  title="Eliminar contrato"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Distribución jornada */}
            <div className="border-b border-slate-100 px-4 py-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-700">Distribución de jornada</p>
                  <p className="text-[11px] text-gray-400">
                    Usala cuando las horas no se reparten de forma pareja. Ej: 32.5 hs con media hora extra L-V.
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => updateContrato(regla.hsSemanal, { distribucion: { tipo: "uniforme" } })}
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                      !regla.distribucion || regla.distribucion.tipo === "uniforme"
                        ? "border-[#0054A6] bg-blue-50 text-[#0054A6]"
                        : "border-slate-200 text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    Uniforme
                  </button>
                  <button
                    onClick={() =>
                      updateDistribucion(regla, {
                        tipo: "base_extra_diario",
                        diasLaborables: ["lunes", "martes", "miercoles", "jueves", "viernes"],
                        hsBaseDia: 6,
                        hsExtraDia: 0.5,
                        diasExtra: ["lunes", "martes", "miercoles", "jueves", "viernes"],
                      })
                    }
                    className={cn(
                      "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                      regla.distribucion?.tipo === "base_extra_diario"
                        ? "border-[#0054A6] bg-blue-50 text-[#0054A6]"
                        : "border-slate-200 text-slate-500 hover:bg-slate-50"
                    )}
                  >
                    Base + extra diario
                  </button>
                </div>
              </div>

              {regla.distribucion?.tipo === "base_extra_diario" && (
                <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                        Horas base por día
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={regla.distribucion.hsBaseDia ?? 0}
                        onChange={(e) =>
                          updateDistribucion(regla, { ...regla.distribucion!, hsBaseDia: Number(e.target.value) })
                        }
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#0054A6] focus:ring-2 focus:ring-[#0054A6]/10"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                        Extra por día
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={0.5}
                        value={regla.distribucion.hsExtraDia ?? 0}
                        onChange={(e) =>
                          updateDistribucion(regla, { ...regla.distribucion!, hsExtraDia: Number(e.target.value) })
                        }
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-[#0054A6] focus:ring-2 focus:ring-[#0054A6]/10"
                      />
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Días laborables
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {DIAS_SEMANA.map((dia) => {
                        const activo = regla.distribucion?.diasLaborables?.includes(dia);
                        return (
                          <button
                            key={dia}
                            onClick={() => toggleDiaDistribucion(regla, "diasLaborables", dia)}
                            className={cn(
                              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                              activo
                                ? "bg-[#0054A6] text-white shadow-sm"
                                : "bg-white border border-slate-200 text-slate-400 hover:border-[#0054A6]/30 hover:text-[#0054A6]"
                            )}
                            title={DIA_COMPLETO[dia]}
                          >
                            {DIA_LABELS[dia]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Días con extra
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {DIAS_SEMANA.map((dia) => {
                        const activo = regla.distribucion?.diasExtra?.includes(dia);
                        return (
                          <button
                            key={dia}
                            onClick={() => toggleDiaDistribucion(regla, "diasExtra", dia)}
                            className={cn(
                              "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                              activo
                                ? "bg-emerald-500 text-white shadow-sm"
                                : "bg-white border border-slate-200 text-slate-400 hover:border-emerald-400/40 hover:text-emerald-600"
                            )}
                            title={DIA_COMPLETO[dia]}
                          >
                            {DIA_LABELS[dia]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Francos */}
            <div className="divide-y divide-slate-100">
              {regla.francos.map((ventana, francoIndex) => (
                <div key={`${regla.hsSemanal}-${francoIndex}`} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-black text-slate-500">
                        {francoIndex + 1}
                      </span>
                      <div>
                        <p className="text-xs font-semibold text-slate-700">
                          Franco {francoIndex + 1}
                        </p>
                        <p className="text-[11px] text-gray-400">{describirVentana(ventana.dias)}</p>
                      </div>
                      <WeekBar dias={ventana.dias} />
                    </div>
                    {regla.francos.length > 1 && (
                      <button
                        onClick={() => removeFranco(regla.hsSemanal, francoIndex)}
                        className="text-[11px] font-semibold text-gray-300 transition-colors hover:text-red-400"
                      >
                        Quitar
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {DIAS_SEMANA.map((dia) => {
                      const activo = ventana.dias.includes(dia);
                      return (
                        <button
                          key={dia}
                          onClick={() => toggleDia(regla.hsSemanal, francoIndex, dia)}
                          className={cn(
                            "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                            activo
                              ? "bg-[#0054A6] text-white shadow-sm"
                              : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                          )}
                          title={DIA_COMPLETO[dia]}
                        >
                          {DIA_LABELS[dia]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}

        {reglas.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
            <p className="text-sm font-semibold text-slate-400">Sin contratos configurados</p>
            <p className="mt-1 text-xs text-slate-300">Agregá uno arriba para empezar.</p>
          </div>
        )}
      </div>
    </div>
  );
}
