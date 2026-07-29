"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { useResultados } from "@/store/useResultados";
import { useUploads } from "@/store/useUploads";
import { useFrancoConfig } from "@/store/useFrancoConfig";
import { KpiCard } from "@/components/KpiCard";
import { ResumenTable } from "@/components/tables/ResumenTable";
import { CumplimientoBarChart } from "@/components/charts/CumplimientoBarChart";
import { AlertsPanel } from "@/components/alerts/AlertsPanel";
import { FilterBar } from "@/components/filters/FilterBar";
import { nivelCumplimiento } from "@/lib/domain/types";
import { fmtNumero, fmtPct, fmtHoras } from "@/lib/utils/formato";
import { filtrarAgentes, hayFiltrosActivos } from "@/lib/domain/filterEngine";
import { calcularResultados } from "@/lib/domain/calculos";
import { calcularFrancoPorServicio } from "@/lib/domain/francoEngine";
import { getServiciosKeys } from "@/lib/config/servicesRuntime";
import { exportarSimulacion } from "@/lib/utils/exportSimulador";
import { serializarMatrices } from "@/lib/domain/serializacion";
import { planificacionesGuardadasApi } from "@/lib/api";
import { Activity, Download, TrendingUp, TrendingDown, Minus, Save, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { SinDatos } from "@/components/SinDatos";
import type { MatrizServicio, ServicioKey } from "@/lib/domain/types";
import type { HistorialSnapshot } from "@/store/useResultados";

function filtrarMatricesPorIsla(
  matrices: Map<ServicioKey, MatrizServicio>,
  isla: string
): Map<ServicioKey, MatrizServicio> {
  if (!isla) return matrices;
  const matriz = matrices.get(isla as ServicioKey);
  return matriz ? new Map([[isla as ServicioKey, matriz]]) : matrices;
}

export default function DashboardPage() {
  const {
    resultado,
    agentes,
    matrices,
    reductores,
    diasDelMes,
    alertas,
    activeFilters,
    historial,
    setFilter,
    servicioKey,
    servicioNombre,
  } = useResultados();
  const { modoReductor, setModoReductor, topeFacturacion, setTopeFacturacion } = useUploads();
  const { reglas } = useFrancoConfig();

  const [showGuardarInput, setShowGuardarInput] = useState(false);
  const [nombreGuardado, setNombreGuardado] = useState("");

  const guardarPlanificacionMut = useMutation({
    mutationFn: () => {
      if (!resultado || !servicioKey || !servicioNombre) {
        throw new Error("Falta procesar una planificación antes de guardar");
      }
      return planificacionesGuardadasApi.create({
        servicio_key: servicioKey,
        servicio_nombre: servicioNombre,
        mes: resultado.mesNum,
        anio: resultado.anioNum,
        nombre: nombreGuardado.trim() || undefined,
        dias_del_mes: resultado.diasDelMes,
        tope_facturacion: topeFacturacion,
        modo_reductor: modoReductor,
        resultado,
        matrices: serializarMatrices(matrices),
        agentes,
        reductores,
        alertas,
      });
    },
    onSuccess: () => {
      toast.success("Planificación guardada");
      setShowGuardarInput(false);
      setNombreGuardado("");
    },
    onError: () => toast.error("No se pudo guardar la planificación"),
  });

  const francoMap = useMemo(() => {
    if (agentes.length === 0) return new Map<string, number>();
    const agentesParaFranco = hayFiltrosActivos(activeFilters)
      ? filtrarAgentes(agentes, activeFilters)
      : agentes;
    const resultados = calcularFrancoPorServicio(agentesParaFranco, matrices, reglas, getServiciosKeys());
    return new Map(resultados.map((r) => [r.servicio, r.hcNecesarioTotal]));
  }, [agentes, matrices, reglas, activeFilters]);

  const resultadoMostrado = useMemo(() => {
    if (!resultado || agentes.length === 0) return resultado;
    const agentesFiltrados = hayFiltrosActivos(activeFilters)
      ? filtrarAgentes(agentes, activeFilters)
      : agentes;
    const matricesFiltradas = filtrarMatricesPorIsla(matrices, activeFilters.isla);
    try {
      const recalculado = calcularResultados(
        agentesFiltrados,
        matricesFiltradas,
        reductores,
        diasDelMes,
        modoReductor,
        topeFacturacion
      );
      return activeFilters.isla
        ? {
            ...recalculado,
            resultados: recalculado.resultados.filter((r) => r.servicio === activeFilters.isla),
          }
        : recalculado;
    } catch {
      return resultado;
    }
  }, [resultado, agentes, matrices, reductores, diasDelMes, modoReductor, topeFacturacion, activeFilters]);

  if (!resultado || !resultadoMostrado) return <SinDatos />;

  const nivel = nivelCumplimiento(resultadoMostrado.cumplimientoTotal);
  const accentMap = {
    critico: "rose",
    bajo: "amber",
    ideal: "emerald",
    alto: "sky",
    exceso: "violet",
  } as const;

  const filtrado = hayFiltrosActivos(activeFilters);
  const criticas = alertas.filter((a) => a.severidad === "critical");
  const bajasEstimadasRaw = resultadoMostrado.resultados.reduce(
    (total, r) => total + r.hcActivos * r.reductoRes.rotacion,
    0
  );
  const bajasEstimadas = Math.round(bajasEstimadasRaw);
  const rotacionPonderada =
    resultadoMostrado.totalHCActivos > 0
      ? bajasEstimadasRaw / resultadoMostrado.totalHCActivos
      : 0;

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-0.5">Resumen</h2>
            <p className="text-sm text-gray-500">
              {resultado.mes} · {resultado.diasDelMes} días
              {filtrado && <span className="ml-2 text-[#0054A6] font-medium">· Filtrado</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {/* Modo de cálculo del reductor */}
            <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs text-gray-500">
              <span className={modoReductor === "aditivo" ? "font-medium text-gray-800" : ""}>Aditivo</span>
              <Switch
                checked={modoReductor === "multiplicativo"}
                onCheckedChange={(v) => setModoReductor(v ? "multiplicativo" : "aditivo")}
              />
              <span className={modoReductor === "multiplicativo" ? "font-medium text-gray-800" : ""}>
                Multiplicativo
              </span>
            </div>
            {/* Tope de facturación */}
            <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5">
              <span className="text-xs text-gray-500">Tope</span>
              <input
                type="number"
                min={100}
                max={130}
                step={0.5}
                value={topeFacturacion}
                onChange={(e) => setTopeFacturacion(parseFloat(e.target.value) || 103)}
                className="w-14 bg-transparent text-xs text-gray-700 tabular-nums text-right focus:outline-none"
              />
              <span className="text-xs text-gray-500">%</span>
            </div>
            {/* Guardar planificación */}
            {showGuardarInput ? (
              <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1">
                <input
                  type="text"
                  autoFocus
                  placeholder="Nombre (opcional)"
                  value={nombreGuardado}
                  onChange={(e) => setNombreGuardado(e.target.value)}
                  className="h-7 w-36 bg-transparent px-1 text-xs text-gray-700 outline-none"
                />
                <button
                  type="button"
                  onClick={() => guardarPlanificacionMut.mutate()}
                  disabled={guardarPlanificacionMut.isPending}
                  className="flex h-7 items-center gap-1 rounded-md bg-[#0054A6] px-2 text-xs font-semibold text-white transition-colors hover:bg-[#00449A] disabled:opacity-50"
                >
                  {guardarPlanificacionMut.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Save className="h-3 w-3" />
                  )}
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => setShowGuardarInput(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => setShowGuardarInput(true)}
              >
                <Save className="h-3.5 w-3.5" />
                Guardar planificación
              </Button>
            )}
            {/* Export */}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => resultadoMostrado && exportarSimulacion(resultadoMostrado.mes, resultadoMostrado.resultados)}
            >
              <Download className="h-3.5 w-3.5" />
              Exportar
            </Button>
            {alertas.length > 0 && <AlertsPanel alertas={alertas} compact />}
          </div>
        </div>

        {/* Filtros */}
        <div className="mb-6">
          <FilterBar />
        </div>

        {/* Alertas críticas destacadas */}
        {criticas.length > 0 && (
          <div className="mb-6">
            <AlertsPanel
              alertas={criticas}
              onServiceClick={(servicio) => setFilter("isla", servicio)}
            />
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          <KpiCard
            label="Personas activas"
            value={fmtNumero(resultadoMostrado.totalHCActivos)}
            sublabel={filtrado ? "Filtradas por criterio" : "Agentes activos en nómina"}
            accent="gray"
          />
          <KpiCard
            label="En licencia"
            value={fmtNumero(resultadoMostrado.totalHCLP)}
            sublabel="Licencias y bajas"
            accent="amber"
          />
          <KpiCard
            label="En capacitación"
            value={fmtNumero(resultadoMostrado.totalHCCapa)}
            sublabel="Capa — ingreso parcial al mes"
            accent="violet"
          />
          <KpiCard
            label="Bajas est. mensuales"
            value={fmtNumero(bajasEstimadas)}
            sublabel={`Rotación ${fmtPct(rotacionPonderada * 100)} desde reductores`}
            accent="rose"
          />
          <KpiCard
            label="Cumplimiento Total"
            value={fmtPct(resultadoMostrado.cumplimientoTotal)}
            sublabel="Objetivo 103% · Hs netas / Hs requeridas"
            accent={accentMap[nivel]}
          />
        </div>

        {/* Historial de meses */}
        {historial.length > 1 && (
          <div className="mb-2 overflow-hidden rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3">
            <p className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">Historial reciente</p>
            <div className="flex flex-wrap gap-3">
              {[...historial].sort((a, b) => a.timestamp - b.timestamp).map((h, i, arr) => {
                const prev = arr[i - 1];
                const delta = prev ? h.cumplimientoTotal - prev.cumplimientoTotal : null;
                const isActual = h.mesNum === resultado!.mesNum && h.anioNum === resultado!.anioNum;
                return (
                  <div
                    key={`${h.mesNum}-${h.anioNum}`}
                    className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 ${isActual ? "border-[#0054A6]/30 bg-white shadow-sm" : "border-slate-200 bg-white/60"}`}
                  >
                    <div>
                      <p className={`text-[11px] font-semibold capitalize ${isActual ? "text-[#0054A6]" : "text-slate-500"}`}>
                        {h.mes}{isActual && " ·actual"}
                      </p>
                      <p className="text-base font-bold tabular-nums text-slate-800">{h.cumplimientoTotal.toFixed(1)}%</p>
                    </div>
                    {delta !== null && (
                      <div className={`flex items-center gap-0.5 text-[11px] font-semibold ${delta > 0.5 ? "text-emerald-600" : delta < -0.5 ? "text-rose-600" : "text-slate-400"}`}>
                        {delta > 0.5 ? <TrendingUp className="h-3 w-3" /> : delta < -0.5 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                        {delta > 0 ? "+" : ""}{delta.toFixed(1)}pp
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* KPIs facturables */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard
            label="Hs Requeridas"
            value={fmtHoras(resultadoMostrado.totalHsRequeridas)}
            sublabel="Total del mes por cliente"
            accent="sky"
          />
          <KpiCard
            label="Tope facturable"
            value={fmtHoras(resultadoMostrado.resultados.reduce((a, r) => a + r.tope, 0))}
            sublabel={`Cap. al ${topeFacturacion}% del requerido`}
            accent="gray"
          />
          <KpiCard
            label="Teórico a facturar"
            value={fmtHoras(resultadoMostrado.totalTeoricoFacturable)}
            sublabel="min(Hs netas, Tope)"
            accent="emerald"
          />
          <KpiCard
            label="Recorte total"
            value={fmtHoras(resultadoMostrado.resultados.reduce((a, r) => a + r.recorte, 0))}
            sublabel="Exceso sobre tope — no factura"
            accent="rose"
          />
        </div>

        {/* Gráfico de barras */}
        <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800">Cumplimiento por isla</h3>
                <p className="text-[11px] text-gray-400">Comparativo mensual contra objetivo operativo</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold text-gray-500">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Objetivo 103%
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-slate-300" />
                Base 100%
              </span>
            </div>
          </div>
          <div className="px-4 py-4">
            <CumplimientoBarChart resultados={resultadoMostrado.resultados} />
          </div>
        </div>

        {/* Tabla detallada */}
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Detalle por servicio
          </h3>
          <ResumenTable resultados={resultadoMostrado.resultados} francoMap={francoMap} />
        </div>

        {/* Todas las alertas */}
        {alertas.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Alertas</h3>
            <AlertsPanel
              alertas={alertas}
              onServiceClick={(servicio) => setFilter("isla", servicio)}
            />
          </div>
        )}
      </motion.div>
    </div>
  );
}
