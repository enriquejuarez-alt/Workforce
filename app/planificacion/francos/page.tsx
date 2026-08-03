"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { Loader2, Upload, Trash2, CalendarClock } from "lucide-react";
import ConfirmDialog from "@/components/hr/ui/ConfirmDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { francoImportacionesApi } from "@/lib/api";
import { parseFrancos } from "@/lib/parsers/parseFrancos";
import { MESES } from "@/types";

const ANIO_ACTUAL = new Date().getFullYear();
const ANIOS_OPT = [ANIO_ACTUAL - 1, ANIO_ACTUAL, ANIO_ACTUAL + 1];

export default function FrancosPage() {
  const qc = useQueryClient();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [mesSubida, setMesSubida] = useState(new Date().getMonth() + 1);
  const [anioSubida, setAnioSubida] = useState(ANIO_ACTUAL);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: importaciones = [], isLoading } = useQuery({
    queryKey: ["francos-lista"],
    queryFn: () => francoImportacionesApi.list().then((r) => r.data),
  });

  const { data: detalle, isLoading: loadingDetalle } = useQuery({
    queryKey: ["franco-detalle", expandedId],
    queryFn: () => francoImportacionesApi.get(expandedId!).then((r) => r.data),
    enabled: expandedId !== null,
  });

  const importarMut = useMutation({
    mutationFn: (data: { archivo_nombre: string; servicios: ReturnType<typeof parseFrancos>["servicios"] }) =>
      francoImportacionesApi
        .create({
          mes: mesSubida,
          anio: anioSubida,
          archivo_nombre: data.archivo_nombre,
          servicios: data.servicios.map((s) => ({
            servicio: s.servicio,
            servicioNorm: s.servicioNorm,
            dotacion: s.dotacion,
            ponderadoHoras: s.ponderadoHoras,
            ponderadoDias: s.ponderadoDias,
            francoLunes: s.francoLunes,
            francoMartes: s.francoMartes,
            francoMiercoles: s.francoMiercoles,
            francoJueves: s.francoJueves,
            francoViernes: s.francoViernes,
            francoSabado: s.francoSabado,
            francoDomingo: s.francoDomingo,
          })),
        })
        .then((r) => r.data),
    onSuccess: (data) => {
      toast.success(`Francos cargados: ${data.servicios?.length ?? 0} servicios`);
      qc.invalidateQueries({ queryKey: ["francos-lista"] });
    },
    onError: () => toast.error("No se pudo guardar los francos"),
  });

  const eliminarMut = useMutation({
    mutationFn: (id: number) => francoImportacionesApi.delete(id),
    onSuccess: () => {
      toast.success("Francos eliminados");
      setDeleteId(null);
      if (expandedId === deleteId) setExpandedId(null);
      qc.invalidateQueries({ queryKey: ["francos-lista"] });
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  const handleFile = async (file: File) => {
    setError("");
    setSubiendo(true);
    try {
      const buffer = await file.arrayBuffer();
      const { servicios, errores } = parseFrancos(buffer);
      if (errores.length > 0) { setError(errores.join(" - ")); return; }
      if (servicios.length === 0) { setError("No se encontraron servicios en el archivo."); return; }
      await importarMut.mutateAsync({ archivo_nombre: file.name, servicios });
    } catch (e) {
      setError(`Error al leer el archivo: ${e}`);
    } finally {
      setSubiendo(false);
    }
  };

  const ordenadas = [...importaciones].sort((a, b) => b.anio - a.anio || b.mes - a.mes);

  return (
    <div className="px-6 py-6 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">Francos y contratos</h2>
          <p className="text-sm text-gray-500">
            Cargá el archivo de francos para que la Planificación calcule las HS de logueo día a día
            con la rotación real de francos por servicio, en vez del modelo plano. Acepta el formato
            agregado ("% Francos" + "Detalle Contratos") o el roster por agente (Nombre/DNI/Gestión/
            Horas/Días/Lunes..Domingo) — se detecta automáticamente. Si un servicio no tiene francos
            cargados para el mes, se usa el cálculo plano como antes.
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
          </div>
          {error && <p className="mt-2 text-[11px] text-red-500 leading-relaxed">{error}</p>}
          <p className="mt-2 text-[11px] text-slate-400">
            Si ya existe una carga de francos para ese mes/año, se crea una nueva versión (no se
            pisa) — eliminá la anterior si no la necesitás más.
          </p>
        </div>

        {/* Listado */}
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Cargadas</p>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : ordenadas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center">
            <CalendarClock className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-500">Todavía no cargaste ningún archivo de francos</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {ordenadas.map((imp) => {
              const isOpen = expandedId === imp.id;
              return (
                <div key={imp.id} className="rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-wrap items-center gap-3 p-3.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#0054A6]">
                      <CalendarClock className="h-4 w-4" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isOpen ? null : imp.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {imp.archivo_nombre ?? `Francos ${MESES[imp.mes - 1]} ${imp.anio}`}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {MESES[imp.mes - 1]} {imp.anio} · {imp._count?.servicios ?? 0} servicios
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteId(imp.id)}
                      className="rounded-md p-1.5 text-slate-300 transition-colors hover:text-red-500"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {isOpen && (
                    <div className="border-t border-slate-100 p-3">
                      {loadingDetalle ? (
                        <div className="flex items-center justify-center py-4">
                          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                        </div>
                      ) : (
                        <div className="max-h-64 overflow-auto">
                          <table className="w-full text-[11px]">
                            <thead>
                              <tr className="text-left text-slate-400">
                                <th className="pb-1.5 pr-2">Servicio</th>
                                <th className="pb-1.5 pr-2 text-right">Dot.</th>
                                <th className="pb-1.5 pr-2 text-right">Hs</th>
                                <th className="pb-1.5 pr-2 text-right">Sáb</th>
                                <th className="pb-1.5 pr-2 text-right">Dom</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detalle?.servicios?.map((s) => (
                                <tr key={s.id} className="border-t border-slate-100">
                                  <td className="py-1 pr-2 font-medium text-slate-700">{s.servicio}</td>
                                  <td className="py-1 pr-2 text-right text-slate-500">{s.dotacion}</td>
                                  <td className="py-1 pr-2 text-right text-slate-500">{s.ponderado_horas.toFixed(2)}</td>
                                  <td className="py-1 pr-2 text-right text-slate-500">{(s.franco_sabado * 100).toFixed(0)}%</td>
                                  <td className="py-1 pr-2 text-right text-slate-500">{(s.franco_domingo * 100).toFixed(0)}%</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
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
        title="Eliminar francos"
        message="¿Seguro querés eliminar esta carga de francos? Los servicios de ese mes van a volver a usar el cálculo plano. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        loading={eliminarMut.isPending}
      />
    </div>
  );
}
