"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { Loader2, Upload, Trash2, Database, Users2 } from "lucide-react";
import ConfirmDialog from "@/components/hr/ui/ConfirmDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { nominasApi } from "@/lib/api";
import { MESES } from "@/types";

const NOMBRE_SERVICIO_GENERAL = "Nómina General";
const ANIO_ACTUAL = new Date().getFullYear();
const ANIOS_OPT = [ANIO_ACTUAL - 1, ANIO_ACTUAL, ANIO_ACTUAL + 1];

export default function NominaGeneralPage() {
  const qc = useQueryClient();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [mesSubida, setMesSubida] = useState(new Date().getMonth() + 1);
  const [anioSubida, setAnioSubida] = useState(ANIO_ACTUAL);

  const { data: nominas = [], isLoading } = useQuery({
    queryKey: ["nomina-general-lista"],
    queryFn: () => nominasApi.list({}).then((r) => r.data),
  });

  const nominasGenerales = nominas
    .filter((n) => n.servicio?.nombre === NOMBRE_SERVICIO_GENERAL)
    .sort((a, b) => b.anio - a.anio || b.mes - a.mes);

  const importarMut = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("mes", String(mesSubida));
      fd.append("anio", String(anioSubida));
      return nominasApi.importServicios(fd).then((r) => r.data);
    },
    onSuccess: (data) => {
      toast.success(`Nómina cargada: ${data.procesados} agentes (${data.creados} nuevos, ${data.actualizados} actualizados)`);
      qc.invalidateQueries({ queryKey: ["nomina-general-lista"] });
      qc.invalidateQueries({ queryKey: ["plani-nominas"] });
    },
    onError: () => toast.error("No se pudo importar la nómina de servicios"),
  });

  const periodoMut = useMutation({
    mutationFn: ({ id, mes, anio }: { id: number; mes: number; anio: number }) =>
      nominasApi.updatePeriodo(id, mes, anio),
    onSuccess: () => {
      toast.success("Período actualizado");
      qc.invalidateQueries({ queryKey: ["nomina-general-lista"] });
      qc.invalidateQueries({ queryKey: ["plani-nominas"] });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? "No se pudo actualizar el período"),
  });

  const eliminarMut = useMutation({
    mutationFn: (id: number) => nominasApi.delete(id),
    onSuccess: () => {
      toast.success("Nómina eliminada");
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: ["nomina-general-lista"] });
      qc.invalidateQueries({ queryKey: ["plani-nominas"] });
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  return (
    <div className="px-6 py-6 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">Nómina General</h2>
          <p className="text-sm text-gray-500">
            Precargá la nómina de todos los servicios de una sola vez ("Nomina de servicios.xlsx" — Dni, Representante,
            Servicios, Hs FINAL, Contratos, ACTIVO?). Queda disponible como "Nómina activa" en cualquier isla del mes que elijas.
          </p>
        </div>

        {/* Subir nueva */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Nueva carga</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-slate-500">Mes</label>
              <Select value={String(mesSubida)} onValueChange={(v) => setMesSubida(Number(v))}>
                <SelectTrigger className="h-9 w-36 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-slate-500">Año</label>
              <Select value={String(anioSubida)} onValueChange={(v) => setAnioSubida(Number(v))}>
                <SelectTrigger className="h-9 w-24 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ANIOS_OPT.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <label
              className={`flex h-9 items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 text-xs font-semibold transition-colors ${
                importarMut.isPending
                  ? "cursor-wait border-slate-200 text-slate-400"
                  : "cursor-pointer border-[#0054A6]/40 text-[#0054A6] hover:bg-blue-50/50"
              }`}
            >
              {importarMut.isPending ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" />Importando…</>
              ) : (
                <><Upload className="h-3.5 w-3.5" />Elegir archivo</>
              )}
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                disabled={importarMut.isPending}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) importarMut.mutate(file);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            Si ya existe una nómina general para ese mes/año, se actualiza (no se duplica).
          </p>
        </div>

        {/* Listado */}
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Cargadas</p>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : nominasGenerales.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center">
            <Database className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-500">Todavía no cargaste ninguna nómina general</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {nominasGenerales.map((n) => (
              <div key={n.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#0054A6]">
                  <Users2 className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{n.archivo_nombre ?? "Nómina"}</p>
                  <p className="text-[11px] text-slate-400">
                    {n.total_agentes} agentes · cargada {n.fecha_carga ? new Date(n.fecha_carga).toLocaleDateString("es-AR") : "—"}
                  </p>
                </div>

                <Select
                  value={String(n.mes)}
                  onValueChange={(v) => periodoMut.mutate({ id: n.id, mes: Number(v), anio: n.anio })}
                  disabled={periodoMut.isPending}
                >
                  <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select
                  value={String(n.anio)}
                  onValueChange={(v) => periodoMut.mutate({ id: n.id, mes: n.mes, anio: Number(v) })}
                  disabled={periodoMut.isPending}
                >
                  <SelectTrigger className="h-8 w-20 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ANIOS_OPT.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>

                <button
                  type="button"
                  onClick={() => setDeleteId(n.id)}
                  className="rounded-md p-1.5 text-slate-300 transition-colors hover:text-red-500"
                  title="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      <ConfirmDialog
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && eliminarMut.mutate(deleteId)}
        title="Eliminar nómina general"
        message="¿Seguro querés eliminar esta nómina? Va a dejar de estar disponible como Nómina activa en todas las islas. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        loading={eliminarMut.isPending}
      />
    </div>
  );
}
