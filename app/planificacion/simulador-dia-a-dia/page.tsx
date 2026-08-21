"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { CalendarClock, Plus, Trash2, UserPlus, UserMinus, Shuffle, ArrowRight, Sliders, FolderOpen, Loader2, Database } from "lucide-react";
import { useResultados } from "@/store/useResultados";
import {
  useSimuladorDiaADia,
  eventosADeltasPorDia,
  type TipoEventoDotacion,
} from "@/store/useSimuladorDiaADia";
import { simularDiaADiaServicio, calcularCumplimiento } from "@/lib/domain/calculos";
import { obtenerNombreNomina } from "@/lib/config/nombresNomina";
import { deserializarMatrices } from "@/lib/domain/serializacion";
import { planificacionesGuardadasApi } from "@/lib/api";
import type { Agente, Reductor, FrancoServicioDatos, ResultadoGeneral, ServicioKey } from "@/lib/domain/types";
import { SinDatos } from "@/components/SinDatos";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { fmtPct, fmtNumero, fmtHoras } from "@/lib/utils/formato";
import { MESES } from "@/types";

function FuenteDeDatos() {
  const { resultado, setResultado, setMatrices, setAgentes, setReductores, setFrancosServicio, setDiasDelMes, setServicioActivo } =
    useResultados();
  const [seleccion, setSeleccion] = useState("");

  const { data: guardadas = [], isLoading } = useQuery({
    queryKey: ["planificaciones-guardadas"],
    queryFn: () => planificacionesGuardadasApi.list().then((r) => r.data),
  });

  const cargarMut = useMutation({
    mutationFn: (id: number) => planificacionesGuardadasApi.get(id).then((r) => r.data),
    onSuccess: (p) => {
      setResultado(p.resultado as ResultadoGeneral);
      setMatrices(deserializarMatrices(p.matrices));
      setAgentes(p.agentes as Agente[]);
      setReductores(p.reductores as Reductor[]);
      setFrancosServicio((p.francos_servicio as FrancoServicioDatos[]) ?? []);
      setDiasDelMes(p.dias_del_mes);
      setServicioActivo(p.servicio_key, p.servicio_nombre);
      toast.success(`Cargado: ${p.servicio_nombre} · ${MESES[p.mes - 1]} ${p.anio}`);
    },
    onError: () => toast.error("No se pudo cargar la planificación guardada"),
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 mb-4">
      <div className="flex flex-wrap items-center gap-3">
        <Database className="h-4 w-4 text-gray-400 shrink-0" />
        <span className="text-xs font-medium text-gray-600 shrink-0">Fuente de datos</span>
        <span className="text-xs text-gray-400">
          {resultado ? `Activa: ${resultado.mes} (sesión actual)` : "Sin datos cargados"}
        </span>
        <div className="flex items-center gap-2 ml-auto">
          <select
            value={seleccion}
            onChange={(e) => setSeleccion(e.target.value)}
            disabled={isLoading || guardadas.length === 0}
            className="h-8 rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#0054A6] min-w-[220px]"
          >
            <option value="">
              {isLoading ? "Cargando guardadas…" : guardadas.length === 0 ? "No hay planificaciones guardadas" : "Elegir planificación guardada…"}
            </option>
            {guardadas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.servicio_nombre}{p.nombre ? ` · ${p.nombre}` : ""} · {MESES[p.mes - 1]} {p.anio} · {fmtPct(p.cumplimiento_total)}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            disabled={!seleccion || cargarMut.isPending}
            onClick={() => seleccion && cargarMut.mutate(Number(seleccion))}
          >
            {cargarMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderOpen className="h-3.5 w-3.5" />}
            Cargar
          </Button>
        </div>
      </div>
      <p className="text-[10px] text-gray-400 mt-1.5">
        Al cargar una guardada, reemplaza los datos de la sesión activa (Resumen, Curvas, Simulador y este simulador día a día usan la misma fuente).
      </p>
    </div>
  );
}

const TIPOS: { tipo: TipoEventoDotacion; label: string; icon: typeof UserPlus; color: string }[] = [
  { tipo: "alta", label: "Alta", icon: UserPlus, color: "text-emerald-600" },
  { tipo: "baja", label: "Baja", icon: UserMinus, color: "text-red-600" },
  { tipo: "cambio_servicio", label: "Cambio de servicio", icon: Shuffle, color: "text-sky-600" },
];

const selectCls = "h-8 rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-[#0054A6] min-w-[120px]";
const inputCls = "w-20 h-8 bg-white border border-gray-300 rounded-lg px-2 text-xs text-gray-700 tabular-nums text-center focus:outline-none focus:ring-1 focus:ring-[#0054A6]";

function descripcionEvento(e: { tipo: TipoEventoDotacion; dia: number; cantidad: number; servicio: string; servicioDestino?: string }): string {
  const servicio = obtenerNombreNomina(e.servicio, e.servicio);
  if (e.tipo === "alta") return `Día ${e.dia}: +${e.cantidad} altas en ${servicio}`;
  if (e.tipo === "baja") return `Día ${e.dia}: −${e.cantidad} bajas en ${servicio}`;
  const servicioDestino = e.servicioDestino ? obtenerNombreNomina(e.servicioDestino, e.servicioDestino) : "?";
  return `Día ${e.dia}: ${e.cantidad} personas ${servicio} → ${servicioDestino}`;
}

export default function SimuladorDiaADiaPage() {
  const { resultado, matrices, agentes, reductores, francosServicio, diasDelMes } = useResultados();
  const { eventos, servicioActivo, setServicioActivo, addEvento, removeEvento, clearEventos } = useSimuladorDiaADia();

  const [tipoActivo, setTipoActivo] = useState<TipoEventoDotacion>("baja");
  const [dia, setDia] = useState(1);
  const [cantidad, setCantidad] = useState(1);
  const [destino, setDestino] = useState<ServicioKey | "">("");

  // Solo tiene sentido simular dia a dia en servicios donde el motor real esta
  // activo (Francos reales cargados) — en modelo plano el prorrateo lineal del
  // simulador clasico (/planificacion/simulador) ya es exacto.
  const serviciosDiaADia = useMemo(() => {
    if (!resultado) return [];
    return resultado.resultados
      .map((r) => r.servicio)
      .filter((s) => simularDiaADiaServicio(s, agentes, matrices, reductores, francosServicio, diasDelMes) !== null);
  }, [resultado, agentes, matrices, reductores, francosServicio, diasDelMes]);

  const servicio = servicioActivo && serviciosDiaADia.includes(servicioActivo) ? servicioActivo : serviciosDiaADia[0] ?? null;

  const eventosServicio = useMemo(
    () => eventos.filter((e) => e.servicio === servicio || (e.tipo === "cambio_servicio" && e.servicioDestino === servicio)),
    [eventos, servicio]
  );

  const base = useMemo(() => {
    if (!servicio) return null;
    return simularDiaADiaServicio(servicio, agentes, matrices, reductores, francosServicio, diasDelMes);
  }, [servicio, agentes, matrices, reductores, francosServicio, diasDelMes]);

  const conEventos = useMemo(() => {
    if (!servicio) return null;
    const eventosPorDia = eventosADeltasPorDia(eventos, servicio);
    if (eventosPorDia.size === 0) return base;
    return simularDiaADiaServicio(servicio, agentes, matrices, reductores, francosServicio, diasDelMes, eventosPorDia);
  }, [servicio, agentes, matrices, reductores, francosServicio, diasDelMes, eventos, base]);

  const hsRequeridas = servicio ? matrices.get(servicio)?.totalMes ?? 0 : 0;
  const cumplBase = base ? calcularCumplimiento(base.totalHsLogueo, hsRequeridas) : 0;
  const cumplConEventos = conEventos ? calcularCumplimiento(conEventos.totalHsLogueo, hsRequeridas) : 0;

  const handleAgregar = () => {
    if (!servicio || cantidad <= 0) return;
    if (tipoActivo === "cambio_servicio" && (!destino || destino === servicio)) return;
    addEvento({
      servicio,
      dia,
      tipo: tipoActivo,
      cantidad,
      servicioDestino: tipoActivo === "cambio_servicio" ? (destino as ServicioKey) : undefined,
    });
  };

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-0.5">Simulador día a día</h2>
            <p className="text-sm text-gray-500">
              {resultado ? `${resultado.mes} · ` : ""}cargá altas, bajas o cambios de servicio en una fecha puntual y mirá el
              impacto real, corrido con el mismo motor día a día que usamos para validar contra la planificación del cliente.
            </p>
          </div>
          <Link
            href="/planificacion/simulador"
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-500 transition-colors hover:border-[#0054A6]/30 hover:text-[#0054A6] shrink-0"
          >
            <Sliders className="h-3.5 w-3.5" />
            Simulador clásico
          </Link>
        </div>

        <FuenteDeDatos />

        {!resultado ? (
          <SinDatos />
        ) : serviciosDiaADia.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center">
            <CalendarClock className="h-8 w-8 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-700 mb-1">Ningún servicio tiene el motor día a día activo</p>
            <p className="text-xs text-gray-500 mb-4">
              Este simulador solo aplica a servicios con Francos reales cargados (el motor día a día). Para servicios en
              modelo plano, el <Link href="/planificacion/simulador" className="text-[#0054A6] hover:underline">simulador clásico</Link> ya
              es exacto.
            </p>
            <Link href="/planificacion/francos" className="text-xs text-[#0054A6] hover:underline font-medium">
              Cargar Francos reales →
            </Link>
          </div>
        ) : (
      <>
        {/* Selector de servicio */}
        <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 mb-4 flex items-center gap-3">
          <label className="text-xs font-medium text-gray-600 shrink-0">Servicio</label>
          <select
            value={servicio ?? ""}
            onChange={(e) => setServicioActivo(e.target.value as ServicioKey)}
            className={selectCls}
          >
            {serviciosDiaADia.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Kpi label="HS logueo base" valor={fmtHoras(base?.totalHsLogueo ?? 0)} />
          <Kpi label="HS logueo con eventos" valor={fmtHoras(conEventos?.totalHsLogueo ?? 0)} destacado />
          <Kpi label="Cumplimiento base" valor={fmtPct(cumplBase)} />
          <Kpi label="Cumplimiento con eventos" valor={fmtPct(cumplConEventos)} destacado />
        </div>

        {/* Alta de eventos */}
        <div className="rounded-xl border border-gray-200 bg-white p-4 mb-4">
          <p className="text-sm font-semibold text-gray-800 mb-3">Registrar evento</p>
          <div className="flex gap-2 flex-wrap mb-3">
            {TIPOS.map(({ tipo, label, icon: Icon, color }) => (
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

          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Día del mes</label>
              <select value={dia} onChange={(e) => setDia(parseInt(e.target.value))} className={selectCls}>
                {Array.from({ length: diasDelMes }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Cantidad</label>
              <input type="number" min={1} value={cantidad} onChange={(e) => setCantidad(Math.max(1, parseInt(e.target.value) || 1))} className={inputCls} />
            </div>
            {tipoActivo === "cambio_servicio" && (
              <>
                <ArrowRight className="h-4 w-4 text-gray-400 self-end mb-2" />
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Servicio destino</label>
                  <select value={destino} onChange={(e) => setDestino(e.target.value as ServicioKey)} className={selectCls}>
                    <option value="">Seleccionar…</option>
                    {resultado.resultados.map((r) => r.servicio).filter((s) => s !== servicio).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <Button size="sm" onClick={handleAgregar} className="gap-1.5 h-8">
              <Plus className="h-3.5 w-3.5" />
              Agregar
            </Button>
          </div>

          {eventosServicio.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {eventosServicio
                .slice()
                .sort((a, b) => a.dia - b.dia)
                .map((e) => (
                  <div key={e.id} className="flex items-center justify-between rounded-lg bg-gray-50 border border-gray-100 px-3 py-1.5">
                    <span className="text-xs text-gray-700">{descripcionEvento(e)}</span>
                    <button onClick={() => removeEvento(e.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              <button
                onClick={() => servicio && clearEventos(servicio)}
                className="text-xs text-gray-400 hover:text-gray-600 mt-1"
              >
                Limpiar todos los eventos de este servicio
              </button>
            </div>
          )}
        </div>

        {/* Tabla dia a dia */}
        {conEventos && base && (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-800">Detalle día a día</p>
              <p className="text-xs text-gray-400">Nómina inicial: {fmtNumero(conEventos.input.nominaInicial, 1)} personas</p>
            </div>
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white">
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 px-3 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Día</th>
                    <th className="text-left py-2 px-3 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Sem.</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Nómina base</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Nómina activa</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Francos</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Ausentes</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">Presentes</th>
                    <th className="text-right py-2 px-3 font-semibold text-gray-500 uppercase tracking-wider text-[10px]">HS logueo</th>
                    <th className="text-right py-2 px-3 font-semibold text-[#0054A6] uppercase tracking-wider text-[10px]">Δ vs. base</th>
                  </tr>
                </thead>
                <tbody>
                  {conEventos.dias.map((d, i) => {
                    const dBase = base.dias[i];
                    const delta = d.hsLogueo - (dBase?.hsLogueo ?? 0);
                    const eventoHoy = d.nominaBase !== dBase?.nominaBase;
                    return (
                      <tr key={d.dia} className={cn("border-b border-gray-50 hover:bg-gray-50", eventoHoy && "bg-amber-50/60")}>
                        <td className="py-1.5 px-3 font-medium text-gray-800 tabular-nums">{d.dia}</td>
                        <td className="py-1.5 px-3 text-gray-400 capitalize">{d.diaSemana.slice(0, 3)}</td>
                        <td className={cn("py-1.5 px-3 text-right tabular-nums", eventoHoy ? "font-semibold text-amber-700" : "text-gray-600")}>
                          {fmtNumero(d.nominaBase, 1)}
                        </td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-gray-600">{fmtNumero(d.nominaActiva, 1)}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-gray-500">{fmtNumero(d.agentesFranco, 1)}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-gray-500">{fmtNumero(d.agentesAusentes, 1)}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums text-gray-600">{fmtNumero(d.agentesPresentes, 1)}</td>
                        <td className="py-1.5 px-3 text-right tabular-nums font-medium text-gray-800">{fmtHoras(d.hsLogueo)}</td>
                        <td className={cn("py-1.5 px-3 text-right tabular-nums font-semibold", delta > 0.01 ? "text-emerald-600" : delta < -0.01 ? "text-red-600" : "text-gray-300")}>
                          {Math.abs(delta) < 0.01 ? "—" : `${delta > 0 ? "+" : ""}${fmtHoras(delta)}`}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
                    <td colSpan={7} className="py-2 px-3 text-right text-gray-600">Total mes</td>
                    <td className="py-2 px-3 text-right tabular-nums text-gray-800">{fmtHoras(conEventos.totalHsLogueo)}</td>
                    <td className={cn("py-2 px-3 text-right tabular-nums", conEventos.totalHsLogueo - base.totalHsLogueo < 0 ? "text-red-600" : "text-emerald-600")}>
                      {fmtHoras(conEventos.totalHsLogueo - base.totalHsLogueo)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </>
        )}
      </motion.div>
    </div>
  );
}

function Kpi({ label, valor, destacado }: { label: string; valor: string; destacado?: boolean }) {
  return (
    <div className={cn("rounded-xl border bg-white shadow-sm p-4", destacado ? "border-[#0054A6]/30" : "border-gray-200")}>
      <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider font-medium">{label}</p>
      <span className={cn("text-2xl font-bold tabular-nums leading-tight", destacado ? "text-[#0054A6]" : "text-gray-900")}>{valor}</span>
    </div>
  );
}
