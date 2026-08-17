"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { Loader2, Upload, Trash2, FileSpreadsheet, CheckCircle2, XCircle } from "lucide-react";
import ConfirmDialog from "@/components/hr/ui/ConfirmDialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cpImportacionesApi } from "@/lib/api";
import { serializarMatrices } from "@/lib/domain/serializacion";
import { getSheetNames, validarHojasCPConServicios, parseCPConServicios } from "@/lib/parsers/parseCP";
import { getSheetNamesVentas, validarHojasCPVentas, parseCPVentas } from "@/lib/parsers/parseCPVentas";
import { getSheetNamesSmb, validarHojasCPSmb, parseCPSmb } from "@/lib/parsers/parseCPSmb";
import { getSheetNamesOnb, validarHojasCPOnb, parseCPOnb } from "@/lib/parsers/parseCPOnb";
import { getSheetNamesPpay, validarHojasCPPpay, parseCPPpay } from "@/lib/parsers/parseCPPpay";
import { SERVICIOS } from "@/lib/config/services";
import { SERVICIOS_RETENCION } from "@/lib/config/servicesRetencion";
import { SERVICIOS_MOVIL } from "@/lib/config/servicesMovil";
import { SERVICIOS_HOGAR_CONVERGENTE } from "@/lib/config/servicesHogarConvergente";
import { SERVICIOS_HOGAR_NOCONVERGENTE } from "@/lib/config/servicesHogarNoConvergente";
import type { MatrizServicio, ServicioKey } from "@/lib/domain/types";
import { MESES } from "@/types";

const ANIO_ACTUAL = new Date().getFullYear();
const ANIOS_OPT = [ANIO_ACTUAL - 1, ANIO_ACTUAL, ANIO_ACTUAL + 1];

const FORMATOS_ELEGIBLES = [
  { value: "soporte", label: "General (Soporte / Retención / Móvil / Hogares)" },
  { value: "ventas", label: "Ventas" },
  { value: "smb", label: "SMB" },
  { value: "onboarding", label: "Onboarding" },
  { value: "ppay", label: "Personal Pay" },
] as const;

type Formato = (typeof FORMATOS_ELEGIBLES)[number]["value"];

const FORMATOS = [
  { value: "auto", label: "Detectar automáticamente" },
  ...FORMATOS_ELEGIBLES,
] as const;

// Orden de prueba para la deteccion automatica: los formatos con validacion
// mas estricta (una sola hoja obligatoria puntual, sin ambiguedad posible)
// van primero; "soporte" (el universo General, mucho mas amplio) va al
// final para minimizar falsos positivos.
const ORDEN_DETECCION: Formato[] = ["ventas", "smb", "onboarding", "ppay", "soporte"];

// La mayoria de las islas (Soporte Tecnico, Retencion, Movil, Hogares
// Convergentes/No Convergentes) usan exactamente el mismo parser (una hoja
// por servicio nombrada igual al servicio) — la unica diferencia entre
// ellas es a que universo de ServiceDefinition pertenecen. En el flujo
// principal esto se resuelve con getServiciosActivos(), que depende del
// servicio seleccionado en ese momento (estado global mutable) — pero esta
// pantalla no tiene un "servicio activo", asi que en vez de heredar lo que
// haya quedado seleccionado en otra parte de la app, se valida contra la
// union de estos universos de una sola vez.
//
// OJO: BO GC, TECH, Integral Movil (Amba/Interior) y Migracion Cobre
// (Amba/Interior) quedan AFUERA a proposito — sus ServiceDefinition usan
// alias de hoja placeholder ("hoja1"/"Konecta") pensados para cuando el
// runtime ya sabe de antemano cual es el UNICO servicio activo (getServi
// ciosActivos les devuelve un array de un solo elemento) — combinarlos en
// un universo generico haria que un archivo con una hoja literal "hoja1"
// matchee ambiguamente contra varios de ellos a la vez.
const SERVICIOS_GENERICO = [
  ...SERVICIOS,
  ...SERVICIOS_RETENCION,
  ...SERVICIOS_MOVIL,
  ...SERVICIOS_HOGAR_CONVERGENTE,
  ...SERVICIOS_HOGAR_NOCONVERGENTE,
];

// "Falta la hoja del servicio X" es un aviso no bloqueante — normal que un
// CP puntual no traiga TODAS las islas del universo contra el que se
// valida (mas todavia en el universo "General", que junta varios
// universos a la vez). Solo importa como error real si literalmente
// NINGUNA hoja matcheo — eso es lo que filtra esta funcion, tanto en el
// resultado de la validacion previa como en el errores[] que devuelve el
// parser en si (que reporta las mismas ausencias de nuevo al parsear).
function sinAvisosDeHojaFaltante(errores: string[]): string[] {
  return errores.filter((e) => !e.startsWith("Falta la hoja del servicio"));
}

function parsearPorFormato(formato: Formato, buffer: ArrayBuffer): {
  matrices: Map<ServicioKey, MatrizServicio>;
  diasDelMes: number;
  errores: string[];
} {
  if (formato === "ventas") {
    const hojas = getSheetNamesVentas(buffer);
    const errValidacion = validarHojasCPVentas(hojas);
    if (errValidacion.length > 0) return { matrices: new Map(), diasDelMes: 0, errores: errValidacion };
    const resultado = parseCPVentas(buffer);
    return { ...resultado, errores: sinAvisosDeHojaFaltante(resultado.errores) };
  }
  if (formato === "smb") {
    const hojas = getSheetNamesSmb(buffer);
    const errValidacion = sinAvisosDeHojaFaltante(validarHojasCPSmb(hojas));
    if (errValidacion.length > 0) return { matrices: new Map(), diasDelMes: 0, errores: errValidacion };
    const resultado = parseCPSmb(buffer);
    return { ...resultado, errores: sinAvisosDeHojaFaltante(resultado.errores) };
  }
  if (formato === "onboarding") {
    const hojas = getSheetNamesOnb(buffer);
    const errValidacion = sinAvisosDeHojaFaltante(validarHojasCPOnb(hojas));
    if (errValidacion.length > 0) return { matrices: new Map(), diasDelMes: 0, errores: errValidacion };
    const resultado = parseCPOnb(buffer);
    return { ...resultado, errores: sinAvisosDeHojaFaltante(resultado.errores) };
  }
  if (formato === "ppay") {
    const hojas = getSheetNamesPpay(buffer);
    const errValidacion = validarHojasCPPpay(hojas);
    if (errValidacion.length > 0) return { matrices: new Map(), diasDelMes: 0, errores: errValidacion };
    const resultado = parseCPPpay(buffer);
    return { ...resultado, errores: sinAvisosDeHojaFaltante(resultado.errores) };
  }
  const hojas = getSheetNames(buffer);
  const errValidacion = validarHojasCPConServicios(hojas, SERVICIOS_GENERICO);
  const matcheados = SERVICIOS_GENERICO.length - errValidacion.length;
  if (matcheados === 0) {
    return {
      matrices: new Map(),
      diasDelMes: 0,
      errores: ["No se reconoció ninguna hoja de servicio en el archivo — verificá que sea un CP válido."],
    };
  }
  const resultado = parseCPConServicios(buffer, SERVICIOS_GENERICO);
  return { ...resultado, errores: sinAvisosDeHojaFaltante(resultado.errores) };
}

// Prueba cada formato en ORDEN_DETECCION y se queda con el primero que
// realmente encuentre servicios (no alcanza con "sin errores bloqueantes":
// algunos validadores, como el de Onboarding, no garantizan matrices > 0
// incluso cuando no reportan error — probado contra los 13 CP reales de
// agosto, cada archivo matcheo con exactamente un formato de la lista).
function detectarFormato(buffer: ArrayBuffer): { formato: Formato; resultado: ReturnType<typeof parsearPorFormato> } | null {
  for (const formato of ORDEN_DETECCION) {
    try {
      const resultado = parsearPorFormato(formato, buffer);
      if (resultado.matrices.size > 0) return { formato, resultado };
    } catch {
      // este formato no aplica a este archivo, seguir probando los demas
    }
  }
  return null;
}

export default function CpPage() {
  const qc = useQueryClient();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [mesSubida, setMesSubida] = useState(new Date().getMonth() + 1);
  const [anioSubida, setAnioSubida] = useState(ANIO_ACTUAL);
  const [formato, setFormato] = useState<Formato | "auto">("auto");
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [resultadosBatch, setResultadosBatch] = useState<{ archivo: string; ok: boolean; mensaje: string }[]>([]);

  const { data: importaciones = [], isLoading } = useQuery({
    queryKey: ["cp-lista"],
    queryFn: () => cpImportacionesApi.list().then((r) => r.data),
  });

  const { data: detalle, isLoading: loadingDetalle } = useQuery({
    queryKey: ["cp-detalle", expandedId],
    queryFn: () => cpImportacionesApi.get(expandedId!).then((r) => r.data),
    enabled: expandedId !== null,
  });

  const importarMut = useMutation({
    mutationFn: (data: {
      mes: number;
      anio: number;
      formato: Formato;
      archivo_nombre: string;
      matrices: Map<ServicioKey, MatrizServicio>;
      diasDelMes: number;
    }) => {
      const entries = serializarMatrices(data.matrices);
      return cpImportacionesApi
        .create({
          mes: data.mes,
          anio: data.anio,
          formato: data.formato,
          archivo_nombre: data.archivo_nombre,
          servicios: entries.map(([key, matriz]) => ({
            servicio: key,
            servicioNorm: key,
            diasDelMes: data.diasDelMes,
            totalMes: matriz.totalMes,
            matriz,
          })),
        })
        .then((r) => r.data);
    },
  });

  const eliminarMut = useMutation({
    mutationFn: (id: number) => cpImportacionesApi.delete(id),
    onSuccess: () => {
      toast.success("CP eliminado");
      setDeleteId(null);
      if (expandedId === deleteId) setExpandedId(null);
      qc.invalidateQueries({ queryKey: ["cp-lista"] });
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  // Soporta arrastrar/elegir varios CP a la vez, de formatos distintos entre
  // si: con "Detectar automáticamente" (default), cada archivo prueba los 5
  // formatos y se queda con el que realmente encuentre servicios — no hace
  // falta separar en tandas por formato ni elegir nada de antemano. Si se
  // fuerza un formato puntual en el selector, todos los archivos del lote
  // se procesan con ESE formato (util si la deteccion automatica se
  // equivoca con algun archivo particular). Ademas, cada archivo detecta su
  // propio mes/año a partir de las fechas que trae adentro (misma fecha que
  // usa el resto de la app para matchear Francos/Reductores por mes) — si
  // no trae fechas validas, cae al mes/año elegido arriba como fallback.
  const handleFiles = async (files: FileList | File[]) => {
    const lista = Array.from(files);
    if (lista.length === 0) return;
    setError("");
    setResultadosBatch([]);
    setSubiendo(true);
    const resultados: typeof resultadosBatch = [];

    for (const file of lista) {
      try {
        const buffer = await file.arrayBuffer();

        let formatoUsado: Formato;
        let matrices: Map<ServicioKey, MatrizServicio>;
        let diasDelMes: number;
        let errores: string[];

        if (formato === "auto") {
          const detectado = detectarFormato(buffer);
          if (!detectado) {
            resultados.push({ archivo: file.name, ok: false, mensaje: "No coincide con ningún formato conocido." });
            continue;
          }
          formatoUsado = detectado.formato;
          ({ matrices, diasDelMes, errores } = detectado.resultado);
        } else {
          formatoUsado = formato;
          ({ matrices, diasDelMes, errores } = parsearPorFormato(formato, buffer));
        }

        if (errores.length > 0) {
          resultados.push({ archivo: file.name, ok: false, mensaje: errores.join(" - ") });
          continue;
        }
        if (matrices.size === 0) {
          resultados.push({ archivo: file.name, ok: false, mensaje: "No se encontraron servicios en el archivo." });
          continue;
        }
        const primerDia = matrices.values().next().value?.dias[0]?.fecha;
        const mes = primerDia ? primerDia.getUTCMonth() + 1 : mesSubida;
        const anio = primerDia ? primerDia.getUTCFullYear() : anioSubida;
        const guardado = await importarMut.mutateAsync({ mes, anio, formato: formatoUsado, archivo_nombre: file.name, matrices, diasDelMes });
        const etiquetaFormato = FORMATOS_ELEGIBLES.find((f) => f.value === formatoUsado)?.label ?? formatoUsado;
        resultados.push({
          archivo: file.name,
          ok: true,
          mensaje: `${etiquetaFormato} · ${MESES[mes - 1]} ${anio} · ${guardado.servicios?.length ?? matrices.size} servicios`,
        });
      } catch (e) {
        resultados.push({ archivo: file.name, ok: false, mensaje: `Error al leer el archivo: ${e}` });
      }
    }

    setResultadosBatch(resultados);
    setSubiendo(false);
    qc.invalidateQueries({ queryKey: ["cp-lista"] });
    const exitos = resultados.filter((r) => r.ok).length;
    if (exitos > 0) toast.success(`${exitos} de ${resultados.length} CP${resultados.length > 1 ? "s" : ""} cargado${exitos > 1 ? "s" : ""}`);
    if (exitos < resultados.length) toast.error(`${resultados.length - exitos} archivo${resultados.length - exitos > 1 ? "s" : ""} con error`);
  };

  const ordenadas = [...importaciones].sort((a, b) => b.anio - a.anio || b.mes - a.mes);
  const formatoLabel = (f: string) => FORMATOS.find((x) => x.value === f)?.label ?? f;

  return (
    <div className="px-6 py-6 max-w-4xl mx-auto">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">CPs (Requerido del cliente)</h2>
          <p className="text-sm text-gray-500">
            Cargá acá los archivos de CP por mes, año y formato. Una vez cargado, en Planificación
            podés elegir "CP guardado" en vez de subir el archivo de nuevo cada vez que proceses ese
            servicio y mes.
          </p>
        </div>

        {/* Subir nueva */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Nueva carga</p>
          <div className="mb-3 flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-slate-500">Formato</label>
              <Select value={formato} onValueChange={(v) => setFormato(v as Formato)}>
                <SelectTrigger className="h-9 w-64 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FORMATOS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-slate-500">Mes (fallback)</label>
              <Select value={String(mesSubida)} onValueChange={(v) => setMesSubida(Number(v))}>
                <SelectTrigger className="h-9 w-36 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MESES.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-semibold text-slate-500">Año (fallback)</label>
              <Select value={String(anioSubida)} onValueChange={(v) => setAnioSubida(Number(v))}>
                <SelectTrigger className="h-9 w-24 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ANIOS_OPT.map((a) => <SelectItem key={a} value={String(a)}>{a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <label
            onDragOver={(e) => { e.preventDefault(); if (!subiendo) setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              if (subiendo) return;
              if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
            }}
            className={`flex min-h-[100px] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed text-center transition-colors ${
              subiendo
                ? "cursor-wait border-slate-200 bg-slate-50/40"
                : dragging
                  ? "cursor-pointer border-[#0054A6] bg-blue-50"
                  : "cursor-pointer border-[#0054A6]/40 bg-blue-50/20 hover:border-[#0054A6]/60 hover:bg-blue-50/40"
            }`}
          >
            {subiendo ? (
              <Loader2 className="h-5 w-5 animate-spin text-[#0054A6]" />
            ) : (
              <Upload className="h-5 w-5 text-[#0054A6]" />
            )}
            <p className="text-xs font-semibold text-slate-700">
              {subiendo ? "Importando…" : "Arrastrá uno o varios CP acá, o hacé clic para elegir"}
            </p>
            {!subiendo && (
              <p className="text-[11px] text-slate-400">
                Cada archivo detecta su propio mes/año automáticamente — podés soltar varios meses juntos
              </p>
            )}
            <input
              type="file"
              accept=".xlsx,.xls,.xlsb"
              multiple
              className="hidden"
              disabled={subiendo}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </label>

          {error && <p className="mt-2 text-[11px] text-red-500 leading-relaxed">{error}</p>}

          {resultadosBatch.length > 0 && (
            <div className="mt-3 space-y-1">
              {resultadosBatch.map((r, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px]">
                  {r.ok ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                  )}
                  <span className="min-w-0 truncate font-semibold text-slate-700">{r.archivo}</span>
                  <span className={`shrink-0 ${r.ok ? "text-slate-400" : "text-red-500"}`}>{r.mensaje}</span>
                </div>
              ))}
            </div>
          )}

          <p className="mt-2 text-[11px] text-slate-400">
            Si ya existe un CP para ese mes/año/formato, se crea una nueva versión (no se pisa) —
            eliminá la anterior si no la necesitás más.
          </p>
        </div>

        {/* Listado */}
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Cargados</p>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : ordenadas.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center">
            <FileSpreadsheet className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-500">Todavía no cargaste ningún CP</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {ordenadas.map((imp) => {
              const isOpen = expandedId === imp.id;
              return (
                <div key={imp.id} className="rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-wrap items-center gap-3 p-3.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#0054A6]">
                      <FileSpreadsheet className="h-4 w-4" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isOpen ? null : imp.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-semibold text-slate-800">
                        {imp.archivo_nombre ?? `CP ${MESES[imp.mes - 1]} ${imp.anio}`}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {MESES[imp.mes - 1]} {imp.anio} · {formatoLabel(imp.formato)} · {imp._count?.servicios ?? 0} servicios
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
                                <th className="pb-1.5 pr-2 text-right">Días</th>
                                <th className="pb-1.5 pr-2 text-right">Hs requeridas</th>
                              </tr>
                            </thead>
                            <tbody>
                              {detalle?.servicios?.map((s) => (
                                <tr key={s.id} className="border-t border-slate-100">
                                  <td className="py-1 pr-2 font-medium text-slate-700">{s.servicio}</td>
                                  <td className="py-1 pr-2 text-right text-slate-500">{s.dias_del_mes}</td>
                                  <td className="py-1 pr-2 text-right text-slate-500">{s.total_mes.toFixed(1)}</td>
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
        title="Eliminar CP"
        message="¿Seguro querés eliminar este CP guardado? Ya no vas a poder elegirlo desde Planificación — vas a tener que volver a subir el archivo si lo necesitás. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        loading={eliminarMut.isPending}
      />
    </div>
  );
}
