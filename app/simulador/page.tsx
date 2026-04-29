"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { RotateCcw, Download, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { exportarSimulacion } from "@/lib/utils/exportSimulador";
import { useResultados } from "@/store/useResultados";
import { useSimulador } from "@/store/useSimulador";
import { useUploads } from "@/store/useUploads";
import { SimuladorTable } from "@/components/tables/SimuladorTable";
import { Button } from "@/components/ui/button";
import {
  calcularFactorProductivo,
  calcularCumplimiento,
  calcularDeltaHC103,
  calcularAgentesEquivalentes,
} from "@/lib/domain/calculos";
import type { ResultadoServicio, ServicioKey } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";

export default function SimuladorPage() {
  const router = useRouter();
  const { resultado, diasDelMes } = useResultados();
  const { ajustes, modificaciones, resetAjustes } = useSimulador();
  const { modoReductor } = useUploads();

  useEffect(() => {
    if (!resultado) router.replace("/");
  }, [resultado, router]);

  const resultadosSimulados: ResultadoServicio[] = useMemo(() => {
    if (!resultado) return [];

    const deltaHC      = new Map<ServicioKey, number>();
    const deltaHsTotal = new Map<ServicioKey, number>();
    const reducerOvr   = new Map<ServicioKey, { deslogueo?: number; ausentismo?: number; rotacion?: number }>();

    for (const mod of modificaciones) {
      const base = resultado.resultados.find((r) => r.servicio === mod.servicio);
      if (!base) continue;

      if (mod.tipo === "add_agents") {
        deltaHC.set(mod.servicio, (deltaHC.get(mod.servicio) ?? 0) + mod.cantidad);
        const hsExtra = mod.cantidad * (mod.hsSemanal ?? 36) * (diasDelMes / 7);
        deltaHsTotal.set(mod.servicio, (deltaHsTotal.get(mod.servicio) ?? 0) + hsExtra);
      }

      if (mod.tipo === "remove_agents") {
        const hsPorAgente = base.hsBrutas / Math.max(base.hcActivos, 1);
        deltaHC.set(mod.servicio, (deltaHC.get(mod.servicio) ?? 0) - mod.cantidad);
        deltaHsTotal.set(mod.servicio, (deltaHsTotal.get(mod.servicio) ?? 0) - mod.cantidad * hsPorAgente);
      }

      if (mod.tipo === "change_contract" && mod.hsSemanal) {
        const hsPorAgenteBase = base.hsBrutas / Math.max(base.hcActivos, 1);
        const hsSemanalBase   = hsPorAgenteBase / (diasDelMes / 7);
        const deltaHs = mod.cantidad * (mod.hsSemanal - hsSemanalBase) * (diasDelMes / 7);
        deltaHsTotal.set(mod.servicio, (deltaHsTotal.get(mod.servicio) ?? 0) + deltaHs);
      }

      if (mod.tipo === "move_agents" && mod.servicioDestino) {
        const hsPorAgente = base.hsBrutas / Math.max(base.hcActivos, 1);
        deltaHC.set(mod.servicio, (deltaHC.get(mod.servicio) ?? 0) - mod.cantidad);
        deltaHsTotal.set(mod.servicio, (deltaHsTotal.get(mod.servicio) ?? 0) - mod.cantidad * hsPorAgente);
        deltaHC.set(mod.servicioDestino, (deltaHC.get(mod.servicioDestino) ?? 0) + mod.cantidad);
        deltaHsTotal.set(mod.servicioDestino, (deltaHsTotal.get(mod.servicioDestino) ?? 0) + mod.cantidad * hsPorAgente);
      }

      if (mod.tipo === "change_reducer") {
        reducerOvr.set(mod.servicio, {
          deslogueo:  mod.deslogueoOverride  ?? undefined,
          ausentismo: mod.ausentismoOverride ?? undefined,
          rotacion:   mod.rotacionOverride   ?? undefined,
        });
      }
    }

    return resultado.resultados.map((base) => {
      const ajuste = ajustes[base.servicio];
      const ov     = reducerOvr.get(base.servicio) ?? {};

      const deslogueo  = ov.deslogueo  !== undefined ? ov.deslogueo  : ajuste.deslogueoOverride  !== null ? ajuste.deslogueoOverride  : base.reductoRes.deslogueo;
      const ausentismo = ov.ausentismo !== undefined ? ov.ausentismo : ajuste.ausentismoOverride !== null ? ajuste.ausentismoOverride : base.reductoRes.ausentismo;
      const rotacion   = ov.rotacion   !== undefined ? ov.rotacion   : ajuste.rotacionOverride   !== null ? ajuste.rotacionOverride   : base.reductoRes.rotacion;

      const factorProductivo  = calcularFactorProductivo(deslogueo, ausentismo, rotacion, modoReductor);
      const hcExtraSimple     = ajuste.hcExtra;
      const hcExtraMods       = deltaHC.get(base.servicio) ?? 0;
      const hcExtra           = hcExtraSimple + hcExtraMods;

      const hsBrutasExtraSimple = hcExtraSimple > 0
        ? hcExtraSimple * ajuste.hsSemanalExtra * (diasDelMes / 7)
        : hcExtraSimple * (base.hsBrutas / Math.max(base.hcActivos, 1));
      const hsBrutasExtraMods = deltaHsTotal.get(base.servicio) ?? 0;

      const hcActivos    = base.hcActivos + hcExtra;
      const hsBrutas     = base.hsBrutas + hsBrutasExtraSimple + hsBrutasExtraMods;
      const hsNetas      = hsBrutas * factorProductivo;
      const cumplimiento = calcularCumplimiento(hsNetas, base.hsRequeridas);

      const hsSemanalProm = hcActivos > 0
        ? ((base.hcActivos * base.hsSemanalPromedio) +
           (hcExtraSimple > 0 ? hcExtraSimple * ajuste.hsSemanalExtra : 0) +
           (hsBrutasExtraMods / (diasDelMes / 7))) / hcActivos
        : 36;

      const deltaHC103 = calcularDeltaHC103(hcActivos, factorProductivo, hsSemanalProm, diasDelMes, base.hsRequeridas);
      const agentesEquivalentes = calcularAgentesEquivalentes(deltaHC103, factorProductivo, diasDelMes, hsSemanalProm);

      const { tope } = base;
      const teoricoFacturable = Math.min(hsNetas, tope);
      const recorte = Math.max(0, hsNetas - tope);
      const faltante = Math.max(0, base.hsRequeridas - hsNetas);
      return { ...base, hcActivos, hsBrutas, factorProductivo, hsNetas, cumplimiento, deltaHC103, agentesEquivalentes, hsSemanalPromedio: hsSemanalProm, reductoRes: { deslogueo, ausentismo, rotacion }, tope, teoricoFacturable, recorte, faltante };
    });
  }, [resultado, ajustes, modificaciones, modoReductor, diasDelMes]);

  const exportarExcel = () => {
    if (!resultado) return;
    exportarSimulacion(resultado.mes, resultado.resultados, resultadosSimulados);
  };

  if (!resultado) return null;

  // KPIs del escenario simulado
  const totalPersonasBase = resultado.resultados.reduce((a, r) => a + r.hcActivos, 0);
  const totalPersonasSim  = resultadosSimulados.reduce((a, r) => a + r.hcActivos, 0);
  const cumplBase   = resultado.resultados.reduce((a, r) => a + r.hsNetas, 0) / Math.max(resultado.totalHsRequeridas, 1) * 100;
  const cumplSim    = resultadosSimulados.reduce((a, r) => a + r.hsNetas, 0) / Math.max(resultado.totalHsRequeridas, 1) * 100;
  const diffCumpl   = cumplSim - cumplBase;
  const diffPersonas = totalPersonasSim - totalPersonasBase;
  const serviciosEnDeficit = resultadosSimulados.filter((r) => r.deltaHC103 > 0).length;

  return (
    <div className="px-8 py-10 max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-zinc-100 mb-1">Simulador de dotación</h2>
            <p className="text-sm text-zinc-500">
              {resultado.mes} · {resultado.diasDelMes} días · Construí un escenario y ve el impacto al instante
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

        {/* KPIs resumen del escenario */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
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

        {/* Tabla con builder integrado */}
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
  const color = trend === "up" ? "text-emerald-400" : trend === "down" ? "text-rose-400" : "text-zinc-500";
  const bar   = trend === "up" ? "bg-emerald-500" : trend === "down" ? "bg-rose-500" : "bg-zinc-700";

  return (
    <div className="relative rounded-xl border border-zinc-800 bg-zinc-900 p-4 overflow-hidden">
      <div className={cn("absolute top-0 left-0 right-0 h-0.5", bar)} />
      <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wider font-medium pt-0.5">{label}</p>
      <div className="flex items-end justify-between gap-2">
        <span className="text-2xl font-bold text-zinc-100 tabular-nums leading-tight">{valor}</span>
        <Icon className={cn("h-4 w-4 mb-0.5 shrink-0", color)} />
      </div>
      <p className={cn("text-xs mt-1.5 tabular-nums", color)}>{sub}</p>
    </div>
  );
}
