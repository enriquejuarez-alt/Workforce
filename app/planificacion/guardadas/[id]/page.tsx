"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowLeft, Loader2, LineChart, User, Calendar } from "lucide-react";
import { planificacionesGuardadasApi } from "@/lib/api";
import { useResultados } from "@/store/useResultados";
import { useUploads } from "@/store/useUploads";
import { useFrancoConfig } from "@/store/useFrancoConfig";
import { deserializarMatrices } from "@/lib/domain/serializacion";
import { KpiCard } from "@/components/KpiCard";
import { ResumenTable } from "@/components/tables/ResumenTable";
import { CumplimientoBarChart } from "@/components/charts/CumplimientoBarChart";
import { AlertsPanel } from "@/components/alerts/AlertsPanel";
import { Button } from "@/components/ui/button";
import { SinDatos } from "@/components/SinDatos";
import { nivelCumplimiento } from "@/lib/domain/types";
import type { ResultadoGeneral, Agente, Reductor, Alerta, FrancoServicioDatos } from "@/lib/domain/types";
import { fmtNumero, fmtPct, fmtHoras } from "@/lib/utils/formato";
import { MESES } from "@/types";

export default function PlanificacionGuardadaDetallePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);

  const { data: p, isLoading } = useQuery({
    queryKey: ["planificacion-guardada", id],
    queryFn: () => planificacionesGuardadasApi.get(id).then((r) => r.data),
    enabled: Number.isFinite(id),
  });

  const { setResultado, setMatrices, setAgentes, setReductores, setFrancosServicio, setDiasDelMes, setAlertas, setServicioActivo, clearFilters } =
    useResultados();
  const { setTopeFacturacion, setModoReductor } = useUploads();
  const { setSelectedServicioKey } = useFrancoConfig();

  const resultado = useMemo(() => (p ? (p.resultado as ResultadoGeneral) : null), [p]);
  const nivel = resultado ? nivelCumplimiento(resultado.cumplimientoTotal) : "ideal";
  const accentMap = { critico: "rose", bajo: "amber", ideal: "emerald", alto: "sky", exceso: "violet" } as const;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!p || !resultado) return <SinDatos />;

  const cargarEnSesion = () => {
    setResultado(resultado);
    setMatrices(deserializarMatrices(p.matrices));
    setAgentes(p.agentes as Agente[]);
    setReductores(p.reductores as Reductor[]);
    setFrancosServicio((p.francos_servicio as FrancoServicioDatos[]) ?? []);
    setDiasDelMes(p.dias_del_mes);
    setAlertas(p.alertas as Alerta[]);
    setServicioActivo(p.servicio_key, p.servicio_nombre);
    setTopeFacturacion(p.tope_facturacion);
    setModoReductor(p.modo_reductor as "multiplicativo" | "aditivo");
    setSelectedServicioKey(p.servicio_key);
    clearFilters();
    router.push("/planificacion/resumen");
  };

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <Link
          href="/planificacion/guardadas"
          className="mb-4 flex items-center gap-1.5 text-xs font-semibold text-slate-500 transition-colors hover:text-[#0054A6]"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Planificaciones guardadas
        </Link>

        <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-0.5">
              {p.servicio_nombre}
              {p.nombre && <span className="font-medium text-gray-500"> · {p.nombre}</span>}
            </h2>
            <p className="text-sm text-gray-500">
              {MESES[p.mes - 1]} {p.anio} · {p.dias_del_mes} días
            </p>
            <div className="mt-1.5 flex items-center gap-3 text-[11px] text-slate-400">
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" /> Guardado por {p.guardador?.nombre ?? "—"}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {new Date(p.fecha_guardado).toLocaleString("es-AR")}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Button size="sm" className="gap-1.5" onClick={cargarEnSesion}>
              <LineChart className="h-3.5 w-3.5" />
              Cargar en sesión activa
            </Button>
            <p className="max-w-[220px] text-right text-[11px] text-slate-400">
              Habilita Curvas, Francos y Simulador sobre esta planificación.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <KpiCard
            label="Personas activas"
            value={fmtNumero(resultado.totalHCActivos)}
            sublabel="Agentes activos en nómina"
            accent="gray"
          />
          <KpiCard
            label="Cumplimiento Total"
            value={fmtPct(resultado.cumplimientoTotal)}
            sublabel="Objetivo 103% · Hs netas / Hs requeridas"
            accent={accentMap[nivel]}
          />
          <KpiCard
            label="Hs Requeridas"
            value={fmtHoras(resultado.totalHsRequeridas)}
            sublabel="Total del mes por cliente"
            accent="sky"
          />
          <KpiCard
            label="Teórico a facturar"
            value={fmtHoras(resultado.totalTeoricoFacturable)}
            sublabel="min(Hs netas, Tope)"
            accent="emerald"
          />
        </div>

        {(p.alertas as Alerta[]).length > 0 && (
          <div className="mb-6">
            <AlertsPanel alertas={p.alertas as Alerta[]} />
          </div>
        )}

        <div className="mb-6">
          <CumplimientoBarChart resultados={resultado.resultados} />
        </div>

        <ResumenTable resultados={resultado.resultados} />
      </motion.div>
    </div>
  );
}
