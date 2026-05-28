"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
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
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SinDatos } from "@/components/SinDatos";

export default function DashboardPage() {
  const {
    resultado,
    agentes,
    matrices,
    reductores,
    diasDelMes,
    alertas,
    activeFilters,
  } = useResultados();
  const { modoReductor, topeFacturacion, setTopeFacturacion } = useUploads();
  const { reglas } = useFrancoConfig();

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
    try {
      return calcularResultados(agentesFiltrados, matrices, reductores, diasDelMes, modoReductor, topeFacturacion);
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
            <AlertsPanel alertas={criticas} />
          </div>
        )}

        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
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
            label="Cumplimiento Total"
            value={fmtPct(resultadoMostrado.cumplimientoTotal)}
            sublabel="Hs netas / Hs requeridas"
            accent={accentMap[nivel]}
          />
        </div>

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
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Cumplimiento % por servicio
          </h3>
          <CumplimientoBarChart resultados={resultadoMostrado.resultados} />
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
            <AlertsPanel alertas={alertas} />
          </div>
        )}
      </motion.div>
    </div>
  );
}
