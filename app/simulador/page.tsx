"use client";

import { motion } from "framer-motion";
import { RotateCcw, Download, TrendingUp, TrendingDown, Minus, CalendarRange } from "lucide-react";
import { exportarSimulacion } from "@/lib/utils/exportSimulador";
import { useResultados } from "@/store/useResultados";
import { useSimulador } from "@/store/useSimulador";
import { useResultadosSimulados, calcularDiasEfectivos } from "@/hooks/useResultadosSimulados";
import { SimuladorTable } from "@/components/tables/SimuladorTable";
import { Button } from "@/components/ui/button";
import { SinDatos } from "@/components/SinDatos";
import { cn } from "@/lib/utils/cn";

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const ANIO_ACTUAL = new Date().getFullYear();
const ANIOS = [ANIO_ACTUAL - 1, ANIO_ACTUAL, ANIO_ACTUAL + 1, ANIO_ACTUAL + 2];

function diasEnMes(mes: number, anio: number): number {
  return new Date(anio, mes, 0).getDate();
}

function fmtFecha(dia: number, mes: number, anio: number): string {
  return `${dia} ${MESES[mes - 1].slice(0, 3)} ${anio}`;
}

function PeriodoSelector() {
  const { periodoDesde, periodoHasta, setPeriodoDesde, setPeriodoHasta } = useSimulador();
  const { resultado, diasDelMes } = useResultados();

  const selCls = "h-7 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#0054A6]";
  const selDiaCls = "w-14 " + selCls;

  const hoy = new Date();
  const DEFAULTS = { dia: 1, mes: hoy.getMonth() + 1, anio: hoy.getFullYear() };

  const update = (campo: "desde" | "hasta", patch: Partial<{ dia: number; mes: number; anio: number }>) => {
    if (campo === "desde") {
      const prev = periodoDesde ?? DEFAULTS;
      const next = { ...prev, ...patch };
      const maxDia = diasEnMes(next.mes, next.anio);
      setPeriodoDesde({ ...next, dia: Math.min(next.dia, maxDia) });
    } else {
      const prev = periodoHasta ?? DEFAULTS;
      const next = { ...prev, ...patch };
      const maxDia = diasEnMes(next.mes, next.anio);
      setPeriodoHasta({ ...next, dia: Math.min(next.dia, maxDia) });
    }
  };

  const limpiar = () => { setPeriodoDesde(null); setPeriodoHasta(null); };

  const activo = periodoDesde !== null && periodoHasta !== null;

  const diasEfectivos = resultado && activo
    ? calcularDiasEfectivos(periodoDesde, periodoHasta, resultado.mesNum, resultado.anioNum, diasDelMes)
    : null;

  const diasDesde = periodoDesde ? diasEnMes(periodoDesde.mes, periodoDesde.anio) : 31;
  const diasHasta = periodoHasta ? diasEnMes(periodoHasta.mes, periodoHasta.anio) : 31;

  const renderPicker = (campo: "desde" | "hasta") => {
    const val = campo === "desde" ? periodoDesde : periodoHasta;
    const maxDias = campo === "desde" ? diasDesde : diasHasta;
    return (
      <div className="flex items-center gap-1">
        <select value={val?.dia ?? ""} onChange={(e) => update(campo, { dia: parseInt(e.target.value) })} className={selDiaCls}>
          <option value="">d</option>
          {Array.from({ length: maxDias }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select value={val?.mes ?? ""} onChange={(e) => update(campo, { mes: parseInt(e.target.value) })} className={selCls}>
          <option value="">mes</option>
          {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
        </select>
        <select value={val?.anio ?? ""} onChange={(e) => update(campo, { anio: parseInt(e.target.value) })} className={selCls}>
          <option value="">año</option>
          {ANIOS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
    );
  };

  return (
    <div className={cn(
      "rounded-xl border px-4 py-3 transition-colors",
      activo ? "border-[#0054A6]/30 bg-[#0054A6]/5" : "border-gray-200 bg-white"
    )}>
      <div className="flex flex-wrap items-center gap-3">
        <CalendarRange className={cn("h-4 w-4 shrink-0", activo ? "text-[#0054A6]" : "text-gray-400")} />
        <span className="text-xs font-medium text-gray-600 shrink-0">Período de vigencia</span>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">Desde</span>
          {renderPicker("desde")}
        </div>

        <span className="text-gray-300 text-sm">→</span>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">Hasta</span>
          {renderPicker("hasta")}
        </div>

        {activo && (
          <button onClick={limpiar} className="text-xs text-gray-400 hover:text-gray-600 transition-colors ml-auto">
            Limpiar
          </button>
        )}
      </div>

      {activo && diasEfectivos !== null && (
        <div className="mt-2.5 flex items-center gap-2">
          <span className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            diasEfectivos > 0 ? "bg-[#0054A6]/10 text-[#0054A6]" : "bg-red-50 text-red-600"
          )}>
            {diasEfectivos > 0
              ? `${diasEfectivos} día${diasEfectivos !== 1 ? "s" : ""} efectivos en el mes cargado`
              : "El período no intersecta el mes cargado"}
          </span>
          {diasEfectivos > 0 && diasEfectivos < diasDelMes && (
            <span className="text-xs text-gray-400">
              Los cambios se prorratean sobre {diasEfectivos}/{diasDelMes} días
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function SimuladorPage() {
  const { resultado } = useResultados();
  const { resetAjustes, periodoDesde, periodoHasta } = useSimulador();
  const resultadosSimulados = useResultadosSimulados();

  const exportarExcel = () => {
    if (!resultado) return;
    exportarSimulacion(resultado.mes, resultado.resultados, resultadosSimulados);
  };

  if (!resultado) return <SinDatos />;

  const totalPersonasBase = resultado.resultados.reduce((a, r) => a + r.hcActivos, 0);
  const totalPersonasSim  = resultadosSimulados.reduce((a, r) => a + r.hcActivos, 0);
  const cumplBase   = resultado.resultados.reduce((a, r) => a + r.hsNetas, 0) / Math.max(resultado.totalHsRequeridas, 1) * 100;
  const cumplSim    = resultadosSimulados.reduce((a, r) => a + r.hsNetas, 0) / Math.max(resultado.totalHsRequeridas, 1) * 100;
  const diffCumpl   = cumplSim - cumplBase;
  const diffPersonas = totalPersonasSim - totalPersonasBase;
  const serviciosEnDeficit = resultadosSimulados.filter((r) => r.deltaHC103 > 0).length;

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-0.5">Simulador de dotación</h2>
            <p className="text-sm text-gray-500">
              {resultado.mes} · {resultado.diasDelMes} días
              {periodoDesde && periodoHasta
                ? ` · Vigencia ${fmtFecha(periodoDesde.dia, periodoDesde.mes, periodoDesde.anio)} → ${fmtFecha(periodoHasta.dia, periodoHasta.mes, periodoHasta.anio)}`
                : " · Construí un escenario y ve el impacto al instante"
              }
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={resetAjustes} className="gap-1.5">
              <RotateCcw className="h-3.5 w-3.5" />
              Reiniciar
            </Button>
            <Button variant="outline" size="sm" onClick={exportarExcel} className="gap-1.5">
              <Download className="h-3.5 w-3.5" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Período de replanificación */}
        <div className="mb-4">
          <PeriodoSelector />
        </div>

        {/* KPIs del escenario */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KpiScenario
            label="Personas en escenario"
            valor={String(totalPersonasSim)}
            sub={diffPersonas !== 0 ? `${diffPersonas > 0 ? "+" : ""}${diffPersonas} vs. actual` : "Sin cambios"}
            trend={diffPersonas > 0 ? "up" : diffPersonas < 0 ? "down" : "flat"}
          />
          <KpiScenario
            label="Cumplimiento simulado"
            valor={`${cumplSim.toFixed(1)}%`}
            sub={`${diffCumpl >= 0 ? "+" : ""}${diffCumpl.toFixed(1)}pp vs. actual`}
            trend={diffCumpl > 0 ? "up" : diffCumpl < 0 ? "down" : "flat"}
          />
          <KpiScenario
            label="Servicios en déficit"
            valor={String(serviciosEnDeficit)}
            sub="con cumpl. < 103%"
            trend={serviciosEnDeficit > 3 ? "down" : serviciosEnDeficit > 0 ? "flat" : "up"}
          />
          <KpiScenario
            label="Cumplimiento actual"
            valor={`${cumplBase.toFixed(1)}%`}
            sub="base sin cambios"
            trend="flat"
          />
        </div>

        <SimuladorTable
          resultadosBase={resultado.resultados}
          resultadosSimulados={resultadosSimulados}
        />

      </motion.div>
    </div>
  );
}

function KpiScenario({ label, valor, sub, trend }: { label: string; valor: string; sub: string; trend: "up" | "down" | "flat" }) {
  const Icon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const color = trend === "up" ? "text-emerald-600" : trend === "down" ? "text-red-600" : "text-gray-400";
  const bar   = trend === "up" ? "bg-emerald-500" : trend === "down" ? "bg-red-500" : "bg-gray-300";

  return (
    <div className="relative rounded-xl border border-gray-200 bg-white shadow-sm p-4 overflow-hidden">
      <div className={cn("absolute top-0 left-0 right-0 h-0.5", bar)} />
      <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-medium pt-0.5">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <span className="text-2xl font-bold text-gray-900 tabular-nums leading-tight">{valor}</span>
        <Icon className={cn("h-4 w-4 mb-0.5 shrink-0", color)} />
      </div>
      <p className={cn("text-xs mt-1.5 tabular-nums", color)}>{sub}</p>
    </div>
  );
}
