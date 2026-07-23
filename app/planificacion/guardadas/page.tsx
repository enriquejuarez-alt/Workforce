"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import Link from "next/link";
import toast from "react-hot-toast";
import { Loader2, FolderOpen, Trash2, User, Calendar, Filter } from "lucide-react";
import ConfirmDialog from "@/components/hr/ui/ConfirmDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { planificacionesGuardadasApi } from "@/lib/api";
import { MESES } from "@/types";
import { fmtPct, fmtNumero } from "@/lib/utils/formato";
import { nivelCumplimiento } from "@/lib/domain/types";

const ACCENT: Record<string, string> = {
  critico: "text-rose-600 bg-rose-50",
  bajo: "text-amber-600 bg-amber-50",
  ideal: "text-emerald-600 bg-emerald-50",
  alto: "text-sky-600 bg-sky-50",
  exceso: "text-violet-600 bg-violet-50",
};

export default function PlanificacionesGuardadasPage() {
  const qc = useQueryClient();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [filtroServicio, setFiltroServicio] = useState<string>("");
  const [filtroMesAnio, setFiltroMesAnio] = useState<string>("");

  const { data: planificaciones = [], isLoading } = useQuery({
    queryKey: ["planificaciones-guardadas"],
    queryFn: () => planificacionesGuardadasApi.list().then((r) => r.data),
  });

  const servicios = useMemo(
    () => [...new Set(planificaciones.map((p) => p.servicio_nombre))].sort(),
    [planificaciones]
  );
  const mesesAnios = useMemo(() => {
    const set = new Map<string, string>();
    for (const p of planificaciones) {
      const key = `${p.mes}-${p.anio}`;
      set.set(key, `${MESES[p.mes - 1]} ${p.anio}`);
    }
    return [...set.entries()].sort(([a], [b]) => {
      const [ma, aa] = a.split("-").map(Number);
      const [mb, ab] = b.split("-").map(Number);
      return ab - aa || mb - ma;
    });
  }, [planificaciones]);

  const planificacionesFiltradas = useMemo(() => {
    return planificaciones.filter((p) => {
      if (filtroServicio && p.servicio_nombre !== filtroServicio) return false;
      if (filtroMesAnio && `${p.mes}-${p.anio}` !== filtroMesAnio) return false;
      return true;
    });
  }, [planificaciones, filtroServicio, filtroMesAnio]);

  const eliminarMut = useMutation({
    mutationFn: (id: number) => planificacionesGuardadasApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["planificaciones-guardadas"] });
      setDeleteId(null);
      toast.success("Planificación eliminada");
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">Planificaciones guardadas</h2>
          <p className="text-sm text-gray-500">
            Fotos completas de corridas ya procesadas — CP, reductores, cumplimiento por isla, curvas y francos.
          </p>
        </div>

        {!isLoading && planificaciones.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-1.5 text-slate-400">
              <Filter className="h-3.5 w-3.5" />
              <span className="text-[11px] font-bold uppercase tracking-wider">Filtros</span>
            </div>
            <Select value={filtroServicio || "__todos"} onValueChange={(v) => setFiltroServicio(v === "__todos" ? "" : v)}>
              <SelectTrigger className="h-8 w-48 text-xs">
                <SelectValue placeholder="Servicio" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos">Todos los servicios</SelectItem>
                {servicios.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroMesAnio || "__todos"} onValueChange={(v) => setFiltroMesAnio(v === "__todos" ? "" : v)}>
              <SelectTrigger className="h-8 w-40 text-xs">
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__todos">Todos los meses</SelectItem>
                {mesesAnios.map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(filtroServicio || filtroMesAnio) && (
              <button
                type="button"
                onClick={() => { setFiltroServicio(""); setFiltroMesAnio(""); }}
                className="text-[11px] font-semibold text-slate-400 hover:text-slate-600"
              >
                Limpiar
              </button>
            )}
            <span className="ml-auto text-[11px] text-slate-400">
              {planificacionesFiltradas.length} de {planificaciones.length}
            </span>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : planificaciones.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-14 text-center">
            <FolderOpen className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-500">Todavía no guardaste ninguna planificación</p>
            <p className="mt-1 text-xs text-slate-400">
              Procesá una nómina y usá "Guardar planificación" en la pantalla de Resumen.
            </p>
          </div>
        ) : planificacionesFiltradas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-14 text-center">
            <FolderOpen className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-500">Ninguna planificación coincide con esos filtros</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {planificacionesFiltradas.map((p) => {
              const nivel = nivelCumplimiento(p.cumplimiento_total);
              return (
                <div
                  key={p.id}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/60 transition-shadow hover:shadow-md"
                >
                  <Link href={`/planificacion/guardadas/${p.id}`} className="block p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-800">
                          {p.servicio_nombre}
                          {p.nombre && <span className="font-medium text-slate-500"> · {p.nombre}</span>}
                        </p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {MESES[p.mes - 1]} {p.anio}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums ${ACCENT[nivel]}`}>
                        {fmtPct(p.cumplimiento_total)}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" /> {p.guardador?.nombre ?? "—"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(p.fecha_guardado).toLocaleDateString("es-AR")}
                      </span>
                    </div>

                    <div className="mt-2 text-[11px] text-slate-500">
                      {fmtNumero(p.personas_activas)} personas activas · {fmtNumero(p.hs_requeridas)} hs requeridas
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setDeleteId(p.id);
                    }}
                    className="absolute right-3 top-3 rounded-md p-1 text-slate-300 opacity-0 transition-opacity hover:text-red-500 group-hover:opacity-100"
                    title="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && eliminarMut.mutate(deleteId)}
        title="Eliminar planificación guardada"
        message="¿Seguro querés eliminar esta planificación guardada? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        loading={eliminarMut.isPending}
      />
    </div>
  );
}
