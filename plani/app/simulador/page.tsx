"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  RotateCcw, Download, TrendingUp, TrendingDown, Minus,
  AlertTriangle, Clock, GitCompare, X, Save, ChevronDown,
} from "lucide-react";
import { exportarSimulacion } from "@/lib/utils/exportSimulador";
import { useResultados } from "@/store/useResultados";
import { useSimulador } from "@/store/useSimulador";
import { useUploads } from "@/store/useUploads";
import { SimuladorTable } from "@/components/tables/SimuladorTable";
import { Button } from "@/components/ui/button";
import { SinDatos } from "@/components/SinDatos";
import { buildAllCoverage } from "@/lib/domain/coverageEngine";
import {
  calcularFactorProductivo,
  calcularCumplimiento,
  calcularDeltaHC103,
  calcularAgentesEquivalentes,
} from "@/lib/domain/calculos";
import type { ResultadoServicio, ServicioKey } from "@/lib/domain/types";
import { cn } from "@/lib/utils/cn";
import { fmtPct } from "@/lib/utils/formato";

// ── helpers de cálculo ────────────────────────────────────────────────────────

function calcularResultadosSimulados(
  resultado: NonNullable<ReturnType<typeof useResultados.getState>["resultado"]>,
  ajustes: ReturnType<typeof useSimulador.getState>["ajustes"],
  modificaciones: ReturnType<typeof useSimulador.getState>["modificaciones"],
  modoReductor: string,
  diasDelMes: number
): ResultadoServicio[] {
  const deltaHC      = new Map<ServicioKey, number>();
  const deltaHsTotal = new Map<ServicioKey, number>();
  const reducerOvr   = new Map<ServicioKey, { deslogueo?: number; ausentismo?: number; rotacion?: number }>();

  for (const mod of modificaciones) {
    const base = resultado.resultados.find((r) => r.servicio === mod.servicio);
    if (!base) continue;

    if (mod.tipo === "add_agents") {
      deltaHC.set(mod.servicio, (deltaHC.get(mod.servicio) ?? 0) + mod.cantidad);
      deltaHsTotal.set(mod.servicio, (deltaHsTotal.get(mod.servicio) ?? 0) + mod.cantidad * (mod.hsSemanal ?? 36) * (diasDelMes / 7));
    }
    if (mod.tipo === "remove_agents") {
      const hsPorAgente = base.hsBrutas / Math.max(base.hcActivos, 1);
      deltaHC.set(mod.servicio, (deltaHC.get(mod.servicio) ?? 0) - mod.cantidad);
      deltaHsTotal.set(mod.servicio, (deltaHsTotal.get(mod.servicio) ?? 0) - mod.cantidad * hsPorAgente);
    }
    if (mod.tipo === "change_contract" && mod.hsSemanal) {
      const hsSemanalBase = base.hsBrutas / Math.max(base.hcActivos, 1) / (diasDelMes / 7);
      deltaHsTotal.set(mod.servicio, (deltaHsTotal.get(mod.servicio) ?? 0) + mod.cantidad * (mod.hsSemanal - hsSemanalBase) * (diasDelMes / 7));
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

    const factorProductivo = calcularFactorProductivo(deslogueo, ausentismo, rotacion, modoReductor as any);
    const hcExtra    = ajuste.hcExtra + (deltaHC.get(base.servicio) ?? 0);
    const hsBrutasExtraSimple = ajuste.hcExtra > 0
      ? ajuste.hcExtra * ajuste.hsSemanalExtra * (diasDelMes / 7)
      : ajuste.hcExtra * (base.hsBrutas / Math.max(base.hcActivos, 1));
    const hsBrutasExtraMods = deltaHsTotal.get(base.servicio) ?? 0;

    const hcActivos    = base.hcActivos + hcExtra;
    const hsBrutas     = base.hsBrutas + hsBrutasExtraSimple + hsBrutasExtraMods;
    const hsNetas      = hsBrutas * factorProductivo;
    const cumplimiento = calcularCumplimiento(hsNetas, base.hsRequeridas);

    const hsSemanalProm = hcActivos > 0
      ? ((base.hcActivos * base.hsSemanalPromedio) +
         (ajuste.hcExtra > 0 ? ajuste.hcExtra * ajuste.hsSemanalExtra : 0) +
         (hsBrutasExtraMods / (diasDelMes / 7))) / hcActivos
      : 36;

    const deltaHC103 = calcularDeltaHC103(hcActivos, factorProductivo, hsSemanalProm, diasDelMes, base.hsRequeridas);
    const agentesEquivalentes = calcularAgentesEquivalentes(deltaHC103, factorProductivo, diasDelMes, hsSemanalProm);
    const { tope } = base;
    const teoricoFacturable = Math.min(hsNetas, tope);
    const recorte  = Math.max(0, hsNetas - tope);
    const faltante = Math.max(0, base.hsRequeridas - hsNetas);

    return { ...base, hcActivos, hsBrutas, factorProductivo, hsNetas, cumplimiento, deltaHC103, agentesEquivalentes, hsSemanalPromedio: hsSemanalProm, reductoRes: { deslogueo, ausentismo, rotacion }, tope, teoricoFacturable, recorte, faltante };
  });
}

// ── Alertas por franja ────────────────────────────────────────────────────────

function AlertasFranja({ resultadosSimulados, resultadosBase }: {
  resultadosSimulados: ResultadoServicio[];
  resultadosBase: ResultadoServicio[];
}) {
  const { matrices, agentes } = useResultados();
  const [expandido, setExpandido] = useState(false);

  const alertasFranja = useMemo(() => {
    if (!matrices.size || !agentes.length) return [];
    const coverage = buildAllCoverage(matrices, agentes);
    const alertas: Array<{ servicio: string; franjas: string[]; scaleFactor: number; cumplSim: number }> = [];

    for (const [key, cov] of coverage) {
      const base = resultadosBase.find((r) => r.servicio === key);
      const sim  = resultadosSimulados.find((r) => r.servicio === key);
      if (!base || !sim || cov.franjasCriticas.length === 0) continue;

      // Factor de escala: si el simulador agregó/quitó HC, proporcionar la cobertura
      const scaleFactor = base.hcActivos > 0 ? sim.hcActivos / base.hcActivos : 1;
      // Franjas críticas que SIGUEN siendo déficit incluso con el cambio simulado
      const franjasCriticasPost = cov.coveragePorFranja
        .filter((f) => {
          const hcDispSim = f.hcDisponible * scaleFactor;
          return f.hcRequerido > 0 && hcDispSim / f.hcRequerido < 0.9;
        })
        .map((f) => f.franja);

      if (franjasCriticasPost.length > 0) {
        alertas.push({ servicio: key, franjas: franjasCriticasPost, scaleFactor, cumplSim: sim.cumplimiento });
      }
    }
    return alertas.sort((a, b) => a.cumplSim - b.cumplSim);
  }, [matrices, agentes, resultadosBase, resultadosSimulados]);

  if (alertasFranja.length === 0) return null;

  const visibles = expandido ? alertasFranja : alertasFranja.slice(0, 3);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-amber-600" />
          <p className="text-sm font-semibold text-amber-800">
            Déficit por franja horaria · {alertasFranja.length} servicio{alertasFranja.length !== 1 ? "s" : ""}
          </p>
        </div>
        {alertasFranja.length > 3 && (
          <button
            onClick={() => setExpandido((v) => !v)}
            className="text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1"
          >
            {expandido ? "Ver menos" : `Ver todos (${alertasFranja.length})`}
            <ChevronDown className={cn("h-3 w-3 transition-transform", expandido && "rotate-180")} />
          </button>
        )}
      </div>
      <div className="space-y-2">
        {visibles.map((a) => (
          <div key={a.servicio} className="flex items-start gap-3 rounded-lg bg-white border border-amber-100 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-gray-800">{a.servicio}</span>
                <span className={cn("text-xs font-medium tabular-nums", a.cumplSim < 90 ? "text-red-600" : "text-amber-600")}>
                  {fmtPct(a.cumplSim)}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                Franjas críticas: {a.franjas.slice(0, 6).join(" · ")}
                {a.franjas.length > 6 && ` +${a.franjas.length - 6} más`}
              </p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-amber-500 mt-2">Calculado sobre agentes base, escalado por variación de HC simulada.</p>
    </div>
  );
}

// ── Panel de comparación de escenarios ───────────────────────────────────────

function ComparacionPanel({ resultadosActual, resultadosBase }: {
  resultadosActual: ResultadoServicio[];
  resultadosBase: ResultadoServicio[];
}) {
  const { escenarios, escenarioComparar, setEscenarioComparar, ajustes } = useSimulador();
  const { diasDelMes } = useResultados();
  const { modoReductor } = useUploads();
  const { resultado } = useResultados();

  const escenarioSel = escenarios.find((e) => e.id === escenarioComparar);

  const resultadosGuardado = useMemo(() => {
    if (!escenarioSel || !resultado) return [];
    return calcularResultadosSimulados(resultado, ajustes, escenarioSel.modificaciones, modoReductor, diasDelMes);
  }, [escenarioSel, resultado, ajustes, modoReductor, diasDelMes]);

  if (escenarios.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <GitCompare className="h-4 w-4 text-gray-400" />
          <p className="text-sm font-semibold text-gray-600">Comparación de escenarios</p>
        </div>
        <p className="text-xs text-gray-400">
          Guardá un escenario desde la tabla de abajo para poder compararlo con el actual.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#0054A6]/20 bg-white p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <GitCompare className="h-4 w-4 text-[#0054A6]" />
          <p className="text-sm font-semibold text-gray-800">Comparar con escenario guardado</p>
        </div>
        {escenarioComparar && (
          <button onClick={() => setEscenarioComparar(null)} className="text-gray-400 hover:text-gray-600">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <select
          className="flex-1 h-8 rounded-lg border border-gray-200 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#0054A6]"
          value={escenarioComparar ?? ""}
          onChange={(e) => setEscenarioComparar(e.target.value || null)}
        >
          <option value="">Seleccionar escenario…</option>
          {escenarios.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre} · {new Date(e.timestamp).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </option>
          ))}
        </select>
      </div>

      {escenarioSel && resultadosGuardado.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-1.5 pr-3 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Servicio</th>
                <th className="text-right py-1.5 px-2 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">HC actual</th>
                <th className="text-right py-1.5 px-2 font-semibold text-[#0054A6] uppercase tracking-wider text-[10px]">HC "{escenarioSel.nombre}"</th>
                <th className="text-right py-1.5 px-2 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Δ HC</th>
                <th className="text-right py-1.5 px-2 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Cumpl. actual</th>
                <th className="text-right py-1.5 pl-2 font-semibold text-[#0054A6] uppercase tracking-wider text-[10px]">Cumpl. guardado</th>
                <th className="text-right py-1.5 pl-2 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Δ pp</th>
              </tr>
            </thead>
            <tbody>
              {resultadosActual.map((sim, i) => {
                const guard = resultadosGuardado[i];
                if (!guard) return null;
                const deltaHC  = guard.hcActivos - sim.hcActivos;
                const deltaCumpl = guard.cumplimiento - sim.cumplimiento;
                return (
                  <tr key={sim.servicio} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-1.5 pr-3 font-medium text-gray-800">{sim.servicio}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums text-gray-600">{sim.hcActivos}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums font-semibold text-[#0054A6]">{guard.hcActivos}</td>
                    <td className={cn("py-1.5 px-2 text-right tabular-nums font-semibold", deltaHC > 0 ? "text-emerald-600" : deltaHC < 0 ? "text-red-600" : "text-gray-400")}>
                      {deltaHC > 0 ? `+${deltaHC}` : deltaHC === 0 ? "—" : deltaHC}
                    </td>
                    <td className={cn("py-1.5 px-2 text-right tabular-nums", sim.cumplimiento < 100 ? "text-red-600" : "text-gray-600")}>
                      {fmtPct(sim.cumplimiento)}
                    </td>
                    <td className={cn("py-1.5 pl-2 text-right tabular-nums font-semibold", guard.cumplimiento < 100 ? "text-red-600" : "text-[#0054A6]")}>
                      {fmtPct(guard.cumplimiento)}
                    </td>
                    <td className={cn("py-1.5 pl-2 text-right tabular-nums font-semibold", deltaCumpl > 0 ? "text-emerald-600" : deltaCumpl < 0 ? "text-red-600" : "text-gray-400")}>
                      {deltaCumpl === 0 ? "—" : `${deltaCumpl > 0 ? "+" : ""}${deltaCumpl.toFixed(1)}pp`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Guardar escenario inline ─────────────────────────────────────────────────

function GuardarEscenario() {
  const { saveEscenario, modificaciones } = useSimulador();
  const [nombre, setNombre] = useState("");
  const [abierto, setAbierto] = useState(false);

  if (modificaciones.length === 0) return null;

  const guardar = () => {
    if (!nombre.trim()) return;
    saveEscenario(nombre.trim());
    setNombre("");
    setAbierto(false);
  };

  return (
    <div className="relative">
      <Button variant="secondary" size="sm" onClick={() => setAbierto((v) => !v)} className="gap-1.5">
        <Save className="h-3.5 w-3.5" />
        Guardar escenario
      </Button>
      {abierto && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-xl shadow-lg p-3 w-56">
          <p className="text-xs font-medium text-gray-600 mb-2">Nombre del escenario</p>
          <input
            autoFocus
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && guardar()}
            placeholder="Ej: +5 en Soporte"
            className="w-full h-7 text-xs border border-gray-200 rounded-lg px-2 focus:outline-none focus:ring-1 focus:ring-[#0054A6] mb-2"
          />
          <Button size="sm" onClick={guardar} disabled={!nombre.trim()} className="w-full text-xs h-7">
            Guardar
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────

export default function SimuladorPage() {
  const { resultado, diasDelMes } = useResultados();
  const { ajustes, modificaciones, resetAjustes } = useSimulador();
  const { modoReductor } = useUploads();

  const resultadosSimulados: ResultadoServicio[] = useMemo(() => {
    if (!resultado) return [];
    return calcularResultadosSimulados(resultado, ajustes, modificaciones, modoReductor, diasDelMes);
  }, [resultado, ajustes, modificaciones, modoReductor, diasDelMes]);

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
              {resultado.mes} · {resultado.diasDelMes} días · Construí un escenario y ve el impacto al instante
            </p>
          </div>
          <div className="flex items-center gap-2">
            <GuardarEscenario />
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

        {/* Alertas por franja horaria */}
        <AlertasFranja
          resultadosSimulados={resultadosSimulados}
          resultadosBase={resultado.resultados}
        />

        {/* Comparación de escenarios */}
        <ComparacionPanel
          resultadosActual={resultadosSimulados}
          resultadosBase={resultado.resultados}
        />

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
