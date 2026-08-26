"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import toast from "react-hot-toast";
import { Loader2, Upload, Trash2, FileCheck2 } from "lucide-react";
import ConfirmDialog from "@/components/hr/ui/ConfirmDialog";
import { licenciasPagaApi } from "@/lib/api";

export default function LicenciasPagaPage() {
  const qc = useQueryClient();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");

  const { data: importaciones = [], isLoading: cargandoImportaciones } = useQuery({
    queryKey: ["licencias-paga-importaciones"],
    queryFn: () => licenciasPagaApi.importaciones().then((r) => r.data),
  });

  const { data: licencias = [], isLoading } = useQuery({
    queryKey: ["licencias-paga"],
    queryFn: () => licenciasPagaApi.list().then((r) => r.data),
  });

  const importarMut = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return licenciasPagaApi.import(fd).then((r) => r.data);
    },
    onSuccess: (data) => {
      toast.success(`${data.total_periodos} licencias importadas (${data.agentes_encontrados} con match)`);
      qc.invalidateQueries({ queryKey: ["licencias-paga"] });
      qc.invalidateQueries({ queryKey: ["licencias-paga-importaciones"] });
    },
    onError: (err: any) => setError(err.response?.data?.error || "No se pudo importar el archivo"),
  });

  const eliminarMut = useMutation({
    mutationFn: (id: number) => licenciasPagaApi.deleteImportacion(id),
    onSuccess: () => {
      toast.success("Archivo eliminado");
      setDeleteId(null);
      qc.invalidateQueries({ queryKey: ["licencias-paga"] });
      qc.invalidateQueries({ queryKey: ["licencias-paga-importaciones"] });
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  const handleFile = async (file: File) => {
    setError("");
    setSubiendo(true);
    try {
      await importarMut.mutateAsync(file);
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div className="px-6 py-6 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">Licencias — condición de pago</h2>
          <p className="text-sm text-gray-500">
            Cargá el reporte de RRHH ("LP AL &lt;fecha&gt;") para que el motor día a día sepa si cada
            licencia (LP) es <strong>paga</strong> o <strong>no paga</strong>. En un día de cierre total
            del servicio, la LP paga se suma al franco de ese día (sigue "en el roster"); la LP no paga
            queda directamente afuera del cálculo. Sin este dato, el motor asume LP paga por defecto.
          </p>
        </div>

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Nueva carga</p>
          <label
            className={`flex h-9 w-fit items-center justify-center gap-1.5 rounded-lg border border-dashed px-4 text-xs font-semibold transition-colors ${
              subiendo
                ? "cursor-wait border-slate-200 text-slate-400"
                : "cursor-pointer border-[#0054A6]/40 text-[#0054A6] hover:bg-blue-50/50"
            }`}
          >
            {subiendo ? (
              <><Loader2 className="h-3.5 w-3.5 animate-spin" />Importando…</>
            ) : (
              <><Upload className="h-3.5 w-3.5" />Elegir archivo</>
            )}
            <input
              type="file"
              accept=".xlsx,.xls,.xlsb"
              className="hidden"
              disabled={subiendo}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
          </label>
          {error && <p className="mt-2 text-[11px] text-red-500 leading-relaxed">{error}</p>}
          <p className="mt-2 text-[11px] text-slate-400">
            Busca automáticamente la hoja "LP AL ..." dentro del archivo. Cada carga nueva reemplaza el
            estado de licencia paga/no paga vigente.
          </p>
        </div>

        {!cargandoImportaciones && importaciones.length > 0 && (
          <div className="mb-6 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Archivos importados</p>
            {importaciones.map((imp) => (
              <div key={imp.id} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
                <FileCheck2 className="h-4 w-4 shrink-0 text-emerald-500" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-700">{imp.archivo_nombre}</p>
                  <p className="text-[11px] text-slate-400">
                    {format(new Date(imp.fecha_importacion), "dd/MM/yyyy HH:mm", { locale: es })} ·{" "}
                    {imp._count?.licencias ?? imp.total_periodos} licencias ·{" "}
                    {imp.agentes_encontrados} con match
                  </p>
                </div>
                <button
                  className="text-slate-400 transition-colors hover:text-red-500"
                  title="Eliminar archivo"
                  onClick={() => setDeleteId(imp.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
            Licencias vigentes ({licencias.length})
          </p>
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Agente</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">DNI</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Servicio</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Desde</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Hasta</th>
                  <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pagada</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-xs text-slate-400">Cargando…</td></tr>
                ) : licencias.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-xs text-slate-400">Sin licencias importadas todavía.</td></tr>
                ) : (
                  licencias.map((l) => (
                    <tr key={l.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-2 text-xs font-medium text-slate-700">{l.agente_nombre}</td>
                      <td className="px-4 py-2 text-xs text-slate-500">{l.agente_dni}</td>
                      <td className="px-4 py-2 text-xs text-slate-500">{l.servicio_wf || "—"}</td>
                      <td className="px-4 py-2 text-xs text-slate-500">{format(new Date(l.fecha_desde), "dd/MM/yyyy")}</td>
                      <td className="px-4 py-2 text-xs text-slate-500">{format(new Date(l.fecha_hasta), "dd/MM/yyyy")}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            l.pagada ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                          }`}
                        >
                          {l.pagada ? "Paga" : "No paga"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && eliminarMut.mutate(deleteId)}
        title="Eliminar archivo importado"
        message="Esto eliminará todas las licencias de este archivo. ¿Continuar?"
        confirmLabel="Eliminar"
        variant="danger"
        loading={eliminarMut.isPending}
      />
    </div>
  );
}
