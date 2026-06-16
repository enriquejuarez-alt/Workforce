"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertCircle, ArrowRight, ChevronDown, AlertTriangle,
  Loader2, CheckCircle2, X, FilePen, Calculator, Database, RotateCcw,
} from "lucide-react";
import { DropZone } from "@/components/upload/DropZone";
import { FilePreview } from "@/components/upload/FilePreview";
import { Button } from "@/components/ui/button";
import { useUploads } from "@/store/useUploads";
import { useResultados } from "@/store/useResultados";
import { usePlaniConfig, type ServicioNominaRef } from "@/store/usePlaniConfig";
import { useFrancoConfig } from "@/store/useFrancoConfig";
import { getSheetNames, parseCP, validarHojasCP } from "@/lib/parsers/parseCP";
import {
  getSheetNamesPpay,
  parseCPPpay,
  validarHojasCPPpay,
} from "@/lib/parsers/parseCPPpay";
import {
  getSheetNamesSmb,
  parseCPSmb,
  validarHojasCPSmb,
} from "@/lib/parsers/parseCPSmb";
import {
  getNominasSheetNames,
  parseNomina,
  aplicarDiasAlMes,
} from "@/lib/parsers/parseNomina";
import { parseReductores } from "@/lib/parsers/parseReductores";
import { calcularReductoresDesdeArchivos } from "@/lib/parsers/calcularReductores";
import { calcularResultados } from "@/lib/domain/calculos";
import type { Reductor } from "@/lib/domain/types";
import { generarAlertas } from "@/lib/domain/alertEngine";
import {
  getServiciosActivos,
  resolverServicioPorReductorRuntime,
} from "@/lib/config/servicesRuntime";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/store/auth";
import { isReadOnly } from "@/lib/utils/roles";

const MESES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

// Sub-servicios que no deben aparecer como opción de primer nivel
// (son islas dentro de Soporte Técnico)
const SERVICIOS_OCULTOS = [
  "atención al cliente",
  "atencion al cliente",
  "backoffice",
  "cobranzas",
  "soporte conectividad",
  "soporte entretenimiento",
];

const SERVICIOS_DEMO: ServicioNominaRef[] = [
  { id: -1, nombre: "Personal Pay", planiConfig: null },
  { id: -2, nombre: "SMB", planiConfig: null },
];

const fade = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

type ModoCargaReductores = "archivo" | "calculadora";
type FuenteCalculadora = "deslogueo" | "ausentismo" | "rotacion";

export default function UploadPage() {
  const router = useRouter();
  const {
    archivoCP, archivoReductores, archivoNomina,
    hojaNomina, hojasNomina, modoReductor, topeFacturacion,
    setArchivoCP, setArchivoReductores, setArchivoNomina, setHojaNomina,
  } = useUploads();

  const {
    mappingOverrides, pases,
    setResultado, setMatrices, setAgentes, setReductores,
    setDiasDelMes, setAlertas, setProcesando, setErrores,
    setAgentesExcluidos, clearAgentesDesdeApi,
    errores, agentesExcluidos, segmentosNoReconocidos,
    agentesDesdeApi, mesDesdeApi, anioDesdeApi, clearFilters,
  } = useResultados();

  const { serviciosNomina } = usePlaniConfig();
  const { selectedServicioKey, setSelectedServicioKey } = useFrancoConfig();

  const [loadingCP, setLoadingCP] = useState(false);
  const [loadingRed, setLoadingRed] = useState(false);
  const [loadingNom, setLoadingNom] = useState(false);
  const [modoCargaReductores, setModoCargaReductores] = useState<ModoCargaReductores>("archivo");
  const [calculandoReductores, setCalculandoReductores] = useState(false);
  const [reductoresCalculados, setReductoresCalculados] = useState<number | null>(null);
  const [procesandoLocal, setProcesandoLocal] = useState(false);
  const [pasoActual, setPasoActual] = useState("");
  const [errCP, setErrCP] = useState<string>("");
  const [errRed, setErrRed] = useState<string>("");
  const [errNom, setErrNom] = useState<string>("");
  const [hojasCP, setHojasCP] = useState<string[]>([]);
  const [fuentesReductores, setFuentesReductores] = useState<
    Partial<Record<FuenteCalculadora, { file: File; buffer: ArrayBuffer }>>
  >({});
  const [reductoresPreview, setReductoresPreview] = useState<Reductor[]>([]);
  const [reqMes, setReqMes] = useState(new Date().getMonth() + 1);
  const [reqAnio, setReqAnio] = useState(new Date().getFullYear());
  const [cargandoNomina, setCargandoNomina] = useState(false);
  const [useArchivoNomina, setUseArchivoNomina] = useState(false);

  // Derive numeric service ID from the shared selectedServicioKey
  const reqServicioId = selectedServicioKey ? parseInt(selectedServicioKey) : null;

  // Filtered service list — hide sub-services that belong to Soporte Técnico
  const serviciosFiltrados = useMemo(() => {
    if (!serviciosNomina) return [];
    const visibles = serviciosNomina.filter(
      (s) => !SERVICIOS_OCULTOS.includes(s.nombre.toLowerCase())
    );
    const nombresVisibles = new Set(visibles.map((s) => s.nombre.toLowerCase()));
    const demosFaltantes = SERVICIOS_DEMO.filter((s) => !nombresVisibles.has(s.nombre.toLowerCase()));
    return [...visibles, ...demosFaltantes];
  }, [serviciosNomina]);

  const servicioActivo = serviciosFiltrados.find((s) => s.id === reqServicioId);
  const servicioDemoActivo = !!servicioActivo && servicioActivo.id < 0;
  const esPersonalPay = reqServicioId === -1 ||
    (servicioActivo?.nombre ?? "").toLowerCase().includes("personal pay");
  const esSmb = reqServicioId === -2 ||
    (servicioActivo?.nombre ?? "").toLowerCase().includes("smb");

  const reductoresUtilizados = useMemo(() => {
    if (reductoresPreview.length === 0) return [];

    const serviciosActivos = getServiciosActivos();
    const label = (servicioActivo?.planiConfig?.label ?? servicioActivo?.nombre ?? "").toLowerCase();
    const selectedKey = servicioActivo?.planiConfig?.key ?? null;

    const keysSeleccionadas = new Set<string>();
    if (selectedKey) {
      keysSeleccionadas.add(selectedKey);
    } else if (label.includes("smb")) {
      serviciosActivos
        .filter((s) => s.key.toLowerCase().startsWith("smb"))
        .forEach((s) => keysSeleccionadas.add(s.key));
    } else if (label.includes("soporte") || label.includes("tecnico") || label.includes("técnico")) {
      serviciosActivos
        .filter((s) => {
          const key = s.key.toLowerCase();
          return key.startsWith("soporte") || key.startsWith("smb");
        })
        .forEach((s) => keysSeleccionadas.add(s.key));
    }

    const reconocidos = reductoresPreview.map((r) => ({
      ...r,
      servicioKey: resolverServicioPorReductorRuntime(r.servicioNorm) ?? r.servicioNorm,
    }));

    if (keysSeleccionadas.size === 0) return reconocidos;
    const filtrados = reconocidos.filter((r) => keysSeleccionadas.has(r.servicioKey));
    return filtrados.length > 0 ? filtrados : reconocidos;
  }, [reductoresPreview, servicioActivo]);

  useEffect(() => {
    if (agentesDesdeApi) setCargandoNomina(false);
  }, [agentesDesdeApi]);

  useEffect(() => {
    if (!serviciosNomina && typeof window !== "undefined" && window.parent !== window) {
      window.parent.postMessage({ type: "PLANI_REQUEST_CONFIG" }, "*");
    }
  }, [serviciosNomina]);

  useEffect(() => {
    if (!archivoReductores || reductoresPreview.length > 0) return;
    let cancelled = false;
    archivoReductores.arrayBuffer()
      .then((buffer) => {
        if (cancelled) return;
        const { reductores, errores } = parseReductores(buffer);
        if (errores.length === 0) setReductoresPreview(reductores);
      })
      .catch(() => {
        if (!cancelled) setReductoresPreview([]);
      });
    return () => { cancelled = true; };
  }, [archivoReductores, reductoresPreview.length]);

  const handleServicioSelect = useCallback(
    (id: number) => {
      const key = String(id);
      setSelectedServicioKey(selectedServicioKey === key ? null : key);
      // Reset nómina from API when service changes
      clearAgentesDesdeApi();
    },
    [selectedServicioKey, setSelectedServicioKey, clearAgentesDesdeApi]
  );

  const handleCP = useCallback(async (file: File, buffer: ArrayBuffer) => {
    setLoadingCP(true);
    setErrCP("");
    try {
      const hojas = esPersonalPay
        ? getSheetNamesPpay(buffer)
        : esSmb
          ? getSheetNamesSmb(buffer)
          : getSheetNames(buffer);
      const errValidacion = esPersonalPay
        ? validarHojasCPPpay(hojas)
        : esSmb
          ? validarHojasCPSmb(hojas)
          : validarHojasCP(hojas);
      if (errValidacion.length > 0) { setErrCP(errValidacion.join(" · ")); return; }
      setHojasCP(hojas);
      setArchivoCP(file);
    } catch (e) {
      setErrCP(`Error al leer el archivo: ${e}`);
    } finally {
      setLoadingCP(false);
    }
  }, [esPersonalPay, esSmb, setArchivoCP]);

  const handleReductores = useCallback(async (file: File, buffer: ArrayBuffer) => {
    setLoadingRed(true);
    setErrRed("");
    setReductoresCalculados(null);
    setReductoresPreview([]);
    try {
      const { reductores, errores: err } = parseReductores(buffer);
      if (err.length > 0) { setErrRed(err.join(" · ")); return; }
      setReductoresPreview(reductores);
      setArchivoReductores(file);
    } catch (e) {
      setErrRed(`Error al leer el archivo: ${e}`);
    } finally {
      setLoadingRed(false);
    }
  }, [setArchivoReductores]);

  const handleFuenteReductor = useCallback(
    (tipo: FuenteCalculadora) => async (file: File, buffer: ArrayBuffer) => {
      setErrRed("");
      setReductoresCalculados(null);
      setReductoresPreview([]);
      setFuentesReductores((prev) => ({ ...prev, [tipo]: { file, buffer } }));
    },
    []
  );

  const handleCalcularReductores = useCallback(async () => {
    const deslogueo = fuentesReductores.deslogueo?.buffer;
    const ausentismo = fuentesReductores.ausentismo?.buffer;
    const rotacion = fuentesReductores.rotacion?.buffer;
    if (!deslogueo || !ausentismo || !rotacion) {
      setErrRed("Subí los archivos de deslogueo, ausentismo y rotación.");
      return;
    }
    setCalculandoReductores(true);
    setErrRed("");
    setReductoresPreview([]);
    try {
      const result = await calcularReductoresDesdeArchivos({ deslogueo, ausentismo, rotacion });
      if (result.errores.length > 0) { setErrRed(result.errores.join(" · ")); return; }
      setArchivoReductores(result.file);
      setReductoresPreview(result.reductores);
      setReductoresCalculados(result.reductores.length);
    } catch (e) {
      setErrRed(`Error al calcular reductores: ${String(e)}`);
    } finally {
      setCalculandoReductores(false);
    }
  }, [fuentesReductores, setArchivoReductores]);

  const handleNomina = useCallback(async (file: File, buffer: ArrayBuffer) => {
    setLoadingNom(true);
    setErrNom("");
    try {
      const hojas = getNominasSheetNames(buffer);
      if (hojas.length === 0) { setErrNom("El archivo de nómina no tiene hojas"); return; }
      setArchivoNomina(file, hojas);
      clearAgentesDesdeApi();
    } catch (e) {
      setErrNom(`Error al leer el archivo: ${e}`);
    } finally {
      setLoadingNom(false);
    }
  }, [setArchivoNomina, clearAgentesDesdeApi]);

  const handleSolicitarNomina = useCallback(() => {
    if (!reqServicioId) return;
    setCargandoNomina(true);
    window.parent.postMessage(
      { type: "PLANI_REQUEST_NOMINA", servicioId: reqServicioId, mes: reqMes, anio: reqAnio },
      "*"
    );
    setTimeout(() => setCargandoNomina(false), 10000);
  }, [reqServicioId, reqMes, reqAnio]);

  const handleProcesar = useCallback(async () => {
    const nominaDesdeApi = !!agentesDesdeApi;
    const nominaDesdeArchivo = !!(archivoNomina && hojaNomina);
    if (!archivoCP || !archivoReductores || (!nominaDesdeApi && !nominaDesdeArchivo)) return;

    setProcesandoLocal(true);
    setProcesando(true);
    setErrores([]);
    setPasoActual("Leyendo archivos…");

    try {
      const buffers = nominaDesdeApi
        ? await Promise.all([archivoCP.arrayBuffer(), archivoReductores.arrayBuffer()])
        : await Promise.all([archivoCP.arrayBuffer(), archivoReductores.arrayBuffer(), archivoNomina!.arrayBuffer()]);

      const [bufCP, bufRed] = buffers;

      setPasoActual("Procesando requerido del cliente…");
      const { matrices, diasDelMes, errores: errCP2 } = esPersonalPay
        ? parseCPPpay(bufCP)
        : esSmb
          ? parseCPSmb(bufCP)
          : parseCP(bufCP);

      setPasoActual("Procesando reductores y nómina…");
      const { reductores, errores: errRed2 } = parseReductores(bufRed);

      let agentesRaw = agentesDesdeApi ?? [];
      let excl = 0;
      let segs: string[] = [];
      const errNom2: string[] = [];

      if (!nominaDesdeApi) {
        const result = parseNomina(buffers[2]!, hojaNomina!, mappingOverrides);
        agentesRaw = result.agentes;
        excl = result.agentesExcluidos;
        segs = result.segmentosNoReconocidos;
        errNom2.push(...result.errores);
      }

      const todosErrores = [...errCP2, ...errRed2, ...errNom2];
      if (todosErrores.length > 0) { setErrores(todosErrores); return; }

      setPasoActual("Calculando cumplimiento…");
      const paseMap = new Map(pases.map((p) => [p.dni.trim().toLowerCase(), p.servicioDestino]));
      const agentesConPases = agentesRaw.map((a) => {
        const dest = paseMap.get(a.dni.trim().toLowerCase());
        return dest ? { ...a, segmentoNorm: dest } : a;
      });
      const agentes = aplicarDiasAlMes(agentesConPases, diasDelMes);
      const resultado = calcularResultados(agentes, matrices, reductores, diasDelMes, modoReductor, topeFacturacion);

      setPasoActual("Generando alertas…");
      const alertas = generarAlertas(resultado);

      setMatrices(matrices);
      setAgentes(agentes);
      setReductores(reductores);
      setDiasDelMes(diasDelMes);
      setResultado(resultado);
      setAlertas(alertas);
      setAgentesExcluidos(excl, segs);
      clearFilters();

      router.push("/planificacion/resumen");
      if (window.parent !== window) {
        window.parent.postMessage({ type: "PLANI_PAGE_CHANGE", page: "resumen" }, "*");
      }
    } catch (e) {
      setErrores([`Error inesperado al procesar: ${String(e)}`]);
    } finally {
      setProcesandoLocal(false);
      setProcesando(false);
      setPasoActual("");
    }
  }, [
    agentesDesdeApi, archivoCP, archivoReductores, archivoNomina,
    hojaNomina, modoReductor, topeFacturacion, mappingOverrides, pases,
    setResultado, setMatrices, setAgentes, setReductores, setDiasDelMes,
    setAlertas, setProcesando, setErrores, setAgentesExcluidos, clearFilters, router, esPersonalPay, esSmb,
  ]);

  const currentUser = useAuthStore((s) => s.user);
  const readOnly = isReadOnly(currentUser?.rol);

  const nominaLista = !!agentesDesdeApi || !!(archivoNomina && hojaNomina);
  const listo = !!(archivoCP && archivoReductores && nominaLista) && !procesandoLocal && !readOnly;

  const stepDot = (done: boolean, color: string, n: number) => (
    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ring-4 ring-white transition-colors ${done ? `${color} text-white shadow-sm` : "bg-slate-100 text-slate-400"}`}>
      {done ? "✓" : n}
    </div>
  );

  const fmtReductorPct = (value: number) => `${(value * 100).toFixed(1)}%`;

  return (
    <div className="min-h-full bg-gradient-to-b from-slate-50 to-white px-4 py-5 sm:px-6">
      <motion.div {...fade} className="mx-auto max-w-6xl space-y-5">

        {/* Header */}
        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white/95 px-5 py-4 shadow-sm shadow-slate-200/60 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-950 leading-tight">Carga de archivos</h2>
            <p className="text-xs text-gray-400 mt-0.5">Procesamiento local · los datos no salen del navegador</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/planificacion/contratos"
              className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 shadow-sm transition-colors hover:border-[#0054A6]/30 hover:text-[#0054A6]"
            >
              <FilePen className="h-3.5 w-3.5" />
              Contratos y francos
              {servicioActivo && (
                <span className="ml-0.5 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-[#0054A6]">
                  {servicioActivo.nombre}
                </span>
              )}
            </Link>
          </div>
          {/* Mini stepper */}
          <div className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 sm:flex">
            {stepDot(!!archivoCP, "bg-blue-500", 1)}
            <div className="h-px w-6 bg-slate-200" />
            {stepDot(!!archivoReductores, "bg-purple-500", 2)}
            <div className="h-px w-6 bg-slate-200" />
            {stepDot(nominaLista, "bg-green-500", 3)}
            <div className="h-px w-6 bg-slate-200" />
            <div className={`flex h-6 items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold transition-colors ${listo ? "bg-[#0054A6] text-white shadow-sm" : "bg-white text-slate-400"}`}>
              <ArrowRight className="h-2.5 w-2.5" /> Procesar
            </div>
          </div>
        </div>

        {/* ── Selector de servicio ── */}
        {serviciosNomina && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/60">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
              <div>
                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Servicio</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {servicioActivo
                    ? `Editando: ${servicioActivo.nombre}`
                    : "Seleccioná el servicio antes de cargar los archivos"}
                </p>
              </div>
              {servicioActivo && (
                <button
                  onClick={() => setSelectedServicioKey(null)}
                  className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-white hover:text-slate-700"
                >
                  <RotateCcw className="h-3 w-3" />
                  Limpiar
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2 p-3.5">
              {serviciosFiltrados.map((s) => {
                const isActive = reqServicioId === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => handleServicioSelect(s.id)}
                    className={`rounded-lg border px-3.5 py-2 text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-[#0054A6] text-white border-[#0054A6] shadow-sm"
                        : "bg-white text-slate-600 border-slate-200 hover:border-[#0054A6]/50 hover:bg-blue-50/40 hover:text-[#0054A6]"
                    }`}
                  >
                    {s.nombre}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Read-only notice */}
        {readOnly && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-xs font-medium text-amber-700">
              Tu perfil es <strong>Visualizador</strong> — podés ver los resultados de la planificación
              pero no cargar archivos ni ejecutar cálculos.
            </p>
          </div>
        )}

        {/* Step cards */}
        <div className={`grid grid-cols-1 gap-4 md:grid-cols-3 ${readOnly ? "pointer-events-none opacity-50 select-none" : ""}`}>

          {/* Card 1 — CP */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
            <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
            <div className="flex min-h-[300px] flex-col gap-3 p-4">
              <div className="flex items-center gap-2.5 pt-1">
                {stepDot(!!archivoCP, "bg-blue-500", 1)}
                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Requerido del cliente</p>
              </div>
              <DropZone
                label="CP_Soporte_MM-AAAA.xlsx"
                onFile={handleCP}
                hasFile={!!archivoCP}
                fileName={archivoCP?.name}
                error={errCP}
                loading={loadingCP}
              />
              {archivoCP && (
                <FilePreview nombre={archivoCP.name} tamanio={archivoCP.size} hojas={hojasCP} />
              )}
            </div>
          </div>

          {/* Card 2 — Reductores */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
            <div className="absolute top-0 left-0 right-0 h-1 bg-purple-500" />
            <div className="flex min-h-[300px] flex-col gap-3 p-4">
              <div className="flex items-center gap-2.5 pt-1">
                {stepDot(!!archivoReductores, "bg-purple-500", 2)}
                <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Reductores operativos</p>
              </div>

              <div className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-100/80 p-1">
                {([
                  ["archivo", "Cargar reductores"],
                  ["calculadora", "Usar calculadora"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => { setModoCargaReductores(value); setErrRed(""); }}
                    className={`rounded-lg px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                      modoCargaReductores === value
                        ? "bg-white text-[#0054A6] shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {modoCargaReductores === "archivo" ? (
                <DropZone
                  label="reductores.xlsx"
                  onFile={handleReductores}
                  hasFile={!!archivoReductores}
                  fileName={archivoReductores?.name}
                  error={errRed}
                  loading={loadingRed}
                />
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 gap-2">
                    <DropZone label="Deslogueo operativo" sublabel="últimos 3 meses" onFile={handleFuenteReductor("deslogueo")} hasFile={!!fuentesReductores.deslogueo} fileName={fuentesReductores.deslogueo?.file.name} />
                    <DropZone label="Ausentismo sin LP" sublabel="últimos 3 meses" onFile={handleFuenteReductor("ausentismo")} hasFile={!!fuentesReductores.ausentismo} fileName={fuentesReductores.ausentismo?.file.name} />
                    <DropZone label="Rotación" sublabel="últimos 3 meses" onFile={handleFuenteReductor("rotacion")} hasFile={!!fuentesReductores.rotacion} fileName={fuentesReductores.rotacion?.file.name} />
                  </div>
                  {errRed && <p className="text-xs text-red-500 leading-relaxed">{errRed}</p>}
                  <button
                    type="button"
                    onClick={handleCalcularReductores}
                    disabled={calculandoReductores || !fuentesReductores.deslogueo || !fuentesReductores.ausentismo || !fuentesReductores.rotacion}
                    className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-purple-600 text-xs font-semibold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {calculandoReductores ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" />Calculando...</>
                    ) : (
                      <><Calculator className="h-3.5 w-3.5" />Calcular reductores</>
                    )}
                  </button>
                  {reductoresCalculados !== null && (
                    <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                      <p className="text-[11px] font-semibold text-green-700">
                        {reductoresCalculados} servicios calculados
                      </p>
                    </div>
                  )}
                </div>
              )}
              {archivoReductores && (
                <FilePreview nombre={archivoReductores.name} tamanio={archivoReductores.size} />
              )}
              {archivoReductores && reductoresUtilizados.length > 0 && (
                <div className="rounded-xl border border-purple-100 bg-purple-50/60 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
                      Reductores a usar
                    </p>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-purple-600">
                      {reductoresUtilizados.length}
                    </span>
                  </div>
                  <div className="max-h-40 space-y-1.5 overflow-auto pr-1">
                    {reductoresUtilizados.map((r) => {
                      const total = r.deslogueo + r.ausentismo + r.rotacion;
                      return (
                        <div
                          key={`${r.servicioKey}-${r.servicio}`}
                          className="rounded-lg border border-purple-100 bg-white px-2.5 py-2"
                        >
                          <div className="mb-1 flex items-center justify-between gap-2">
                            <p className="truncate text-[11px] font-bold text-slate-700">{r.servicioKey}</p>
                            <span className="text-[11px] font-semibold tabular-nums text-purple-700">
                              {fmtReductorPct(total)}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-500">
                            <span>D {fmtReductorPct(r.deslogueo)}</span>
                            <span>A {fmtReductorPct(r.ausentismo)}</span>
                            <span>R {fmtReductorPct(r.rotacion)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 3 — Nómina */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
            <div className={`absolute top-0 left-0 right-0 h-1 ${nominaLista ? "bg-green-500" : "bg-orange-400"}`} />
            <div className="flex min-h-[300px] flex-col gap-3 p-4">
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2.5">
                  {stepDot(nominaLista, "bg-green-500", 3)}
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Nómina activa</p>
                </div>
                {agentesDesdeApi && (
                  <button onClick={clearAgentesDesdeApi} className="text-gray-300 hover:text-gray-500 transition-colors" title="Quitar y cargar otra">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {agentesDesdeApi ? (
                <div className="flex items-center gap-2.5 rounded-lg bg-green-50 border border-green-200 px-3 py-2.5">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-green-800">Cargada desde el sistema</p>
                    <p className="text-[11px] text-green-600 mt-0.5">
                      {agentesDesdeApi.length} agentes
                      {mesDesdeApi && anioDesdeApi ? ` · ${MESES[mesDesdeApi - 1]} ${anioDesdeApi}` : ""}
                    </p>
                  </div>
                </div>
              ) : serviciosNomina && !useArchivoNomina ? (
                <div className="space-y-2.5">
                  {/* Mes / Año */}
                  <div className="flex gap-2">
                    <select
                      className="h-10 flex-1 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-sm outline-none transition-colors focus:border-[#0054A6]"
                      value={reqMes}
                      onChange={(e) => setReqMes(Number(e.target.value))}
                    >
                      {MESES.map((m, i) => (
                        <option key={i} value={i + 1}>{m}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      className="h-10 w-20 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 shadow-sm outline-none transition-colors focus:border-[#0054A6]"
                      value={reqAnio}
                      onChange={(e) => setReqAnio(Number(e.target.value))}
                      min={2020}
                      max={2099}
                    />
                  </div>

                  {/* Servicio seleccionado o aviso */}
                  {servicioActivo ? (
                    <div className="flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-100 px-3 py-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#0054A6] shrink-0" />
                    <p className="text-[11px] font-semibold text-[#0054A6]">
                      {servicioActivo.nombre}
                      {servicioDemoActivo ? " · demo" : ""}
                    </p>
                    </div>
                  ) : (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700">
                      Seleccioná un servicio arriba primero
                    </p>
                  )}

                  <button
                    onClick={handleSolicitarNomina}
                    disabled={!reqServicioId || servicioDemoActivo || cargandoNomina}
                    className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-[#0054A6] text-xs font-semibold text-white transition-colors hover:bg-[#00449A] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {cargandoNomina ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" />Cargando…</>
                    ) : (
                      <><Database className="h-3.5 w-3.5" />Cargar desde sistema</>
                    )}
                  </button>
                  <button
                    onClick={() => setUseArchivoNomina(true)}
                    className="w-full text-[11px] text-gray-400 hover:text-gray-600 transition-colors text-center"
                  >
                    o subir Excel manualmente
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {serviciosNomina && (
                    <button
                      onClick={() => setUseArchivoNomina(false)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-[#0054A6] transition-colors hover:text-[#00449A]"
                    >
                      ← Cargar desde sistema
                    </button>
                  )}
                  <DropZone
                    label="Nomina_Soporte.xlsx"
                    onFile={handleNomina}
                    hasFile={!!archivoNomina}
                    fileName={archivoNomina?.name}
                    error={errNom}
                    loading={loadingNom}
                  />
                  {archivoNomina && (
                    <div className="space-y-2">
                      <FilePreview nombre={archivoNomina.name} tamanio={archivoNomina.size} hojas={hojasNomina} />
                      {hojasNomina.length > 1 && (
                        <div>
                          <label className="text-[11px] text-gray-500 mb-1 flex items-center gap-1">
                            <ChevronDown className="h-3 w-3" /> Hoja a usar
                          </label>
                          <Select value={hojaNomina ?? ""} onValueChange={setHojaNomina}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Seleccioná una hoja" />
                            </SelectTrigger>
                            <SelectContent>
                              {hojasNomina.map((h) => (
                                <SelectItem key={h} value={h}>{h}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Validation errors */}
        {errores.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg border border-red-200 bg-red-50 p-3.5">
            <div className="flex items-center gap-2 text-red-600 mb-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">Errores de validación</span>
            </div>
            <ul className="space-y-0.5">
              {errores.map((e, i) => <li key={i} className="text-xs text-red-500">· {e}</li>)}
            </ul>
          </motion.div>
        )}

        {/* Agents excluded warning */}
        {agentesExcluidos > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-lg border border-amber-200 bg-amber-50 p-3.5">
            <div className="flex items-start gap-2 text-amber-700">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold">
                  {agentesExcluidos} agente{agentesExcluidos !== 1 ? "s" : ""} excluido{agentesExcluidos !== 1 ? "s" : ""} por segmento no reconocido
                </p>
                {segmentosNoReconocidos.length > 0 && (
                  <p className="text-xs text-amber-600 mt-0.5">
                    Segmentos sin mapeo: {segmentosNoReconocidos.slice(0, 5).join(", ")}
                    {segmentosNoReconocidos.length > 5 && ` y ${segmentosNoReconocidos.length - 5} más`}.
                    Usá el mapeo de segmentos para incluirlos.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Action bar */}
        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg shadow-slate-200/80 backdrop-blur">
          <p className="hidden text-[11px] font-medium text-slate-500 sm:block">
            {[archivoCP && "✓ CP", archivoReductores && "✓ Reductores", nominaLista && "✓ Nómina"]
              .filter(Boolean).join("  ·  ") || "Completá los 3 pasos para continuar"}
          </p>
          <div className="ml-auto flex items-center gap-3">
            {procesandoLocal && pasoActual && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {pasoActual}
              </div>
            )}
            <Button size="lg" onClick={handleProcesar} disabled={!listo} className="min-w-[220px] gap-2 shadow-sm">
              {procesandoLocal ? "Procesando…" : "Procesar y ver resumen"}
              {procesandoLocal ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>

      </motion.div>
    </div>
  );
}
