"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, ChevronDown, AlertTriangle, Loader2, CheckCircle2, X, FilePen } from "lucide-react";
import { DropZone } from "@/components/upload/DropZone";
import { FilePreview } from "@/components/upload/FilePreview";
import { Button } from "@/components/ui/button";
import { useUploads } from "@/store/useUploads";
import { useResultados } from "@/store/useResultados";
import { usePlaniConfig } from "@/store/usePlaniConfig";
import { getSheetNames, parseCP, validarHojasCP } from "@/lib/parsers/parseCP";
import {
  getNominasSheetNames,
  parseNomina,
  aplicarDiasAlMes,
} from "@/lib/parsers/parseNomina";
import { parseReductores } from "@/lib/parsers/parseReductores";
import { calcularResultados } from "@/lib/domain/calculos";
import { generarAlertas } from "@/lib/domain/alertEngine";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MESES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

const fade = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

export default function UploadPage() {
  const router = useRouter();
  const {
    archivoCP,
    archivoReductores,
    archivoNomina,
    hojaNomina,
    hojasNomina,
    modoReductor,
    topeFacturacion,
    setArchivoCP,
    setArchivoReductores,
    setArchivoNomina,
    setHojaNomina,
  } = useUploads();

  const {
    mappingOverrides,
    pases,
    setResultado,
    setMatrices,
    setAgentes,
    setReductores,
    setDiasDelMes,
    setAlertas,
    setProcesando,
    setErrores,
    setAgentesExcluidos,
    clearAgentesDesdeApi,
    errores,
    agentesExcluidos,
    segmentosNoReconocidos,
    agentesDesdeApi,
    mesDesdeApi,
    anioDesdeApi,
  } = useResultados();

  const [loadingCP, setLoadingCP] = useState(false);
  const [loadingRed, setLoadingRed] = useState(false);
  const [loadingNom, setLoadingNom] = useState(false);
  const [procesandoLocal, setProcesandoLocal] = useState(false);
  const [pasoActual, setPasoActual] = useState("");

  const [errCP, setErrCP] = useState<string>("");
  const [errRed, setErrRed] = useState<string>("");
  const [errNom, setErrNom] = useState<string>("");

  const [hojasCP, setHojasCP] = useState<string[]>([]);

  const { serviciosNomina } = usePlaniConfig();
  const [reqServicioId, setReqServicioId] = useState<number | null>(null);
  const [reqMes, setReqMes] = useState(new Date().getMonth() + 1);
  const [reqAnio, setReqAnio] = useState(new Date().getFullYear());
  const [cargandoNomina, setCargandoNomina] = useState(false);
  const [useArchivoNomina, setUseArchivoNomina] = useState(false);

  useEffect(() => {
    if (agentesDesdeApi) setCargandoNomina(false);
  }, [agentesDesdeApi]);

  // Si no tenemos la lista de servicios (PLANI_INIT puede haberse perdido),
  // la pedimos activamente al padre.
  useEffect(() => {
    if (!serviciosNomina && typeof window !== "undefined" && window.parent !== window) {
      window.parent.postMessage({ type: "PLANI_REQUEST_CONFIG" }, "*");
    }
  }, [serviciosNomina]);

  const handleCP = useCallback(
    async (file: File, buffer: ArrayBuffer) => {
      setLoadingCP(true);
      setErrCP("");
      try {
        const hojas = getSheetNames(buffer);
        const errValidacion = validarHojasCP(hojas);
        if (errValidacion.length > 0) {
          setErrCP(errValidacion.join(" · "));
          return;
        }
        setHojasCP(hojas);
        setArchivoCP(file);
      } catch (e) {
        setErrCP(`Error al leer el archivo: ${e}`);
      } finally {
        setLoadingCP(false);
      }
    },
    [setArchivoCP]
  );

  const handleReductores = useCallback(
    async (file: File, buffer: ArrayBuffer) => {
      setLoadingRed(true);
      setErrRed("");
      try {
        const { errores: err } = parseReductores(buffer);
        if (err.length > 0) {
          setErrRed(err.join(" · "));
          return;
        }
        setArchivoReductores(file);
      } catch (e) {
        setErrRed(`Error al leer el archivo: ${e}`);
      } finally {
        setLoadingRed(false);
      }
    },
    [setArchivoReductores]
  );

  const handleNomina = useCallback(
    async (file: File, buffer: ArrayBuffer) => {
      setLoadingNom(true);
      setErrNom("");
      try {
        const hojas = getNominasSheetNames(buffer);
        if (hojas.length === 0) {
          setErrNom("El archivo de nómina no tiene hojas");
          return;
        }
        setArchivoNomina(file, hojas);
        clearAgentesDesdeApi();
      } catch (e) {
        setErrNom(`Error al leer el archivo: ${e}`);
      } finally {
        setLoadingNom(false);
      }
    },
    [setArchivoNomina, clearAgentesDesdeApi]
  );

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
      const { matrices, diasDelMes, errores: errCP2 } = parseCP(bufCP);

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
      if (todosErrores.length > 0) {
        setErrores(todosErrores);
        return;
      }

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

      router.push("/planificacion/resumen");
      // Notificar a Walt para que sincronice el nav activo
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
    agentesDesdeApi,
    archivoCP,
    archivoReductores,
    archivoNomina,
    hojaNomina,
    modoReductor,
    topeFacturacion,
    mappingOverrides,
    pases,
    setResultado,
    setMatrices,
    setAgentes,
    setReductores,
    setDiasDelMes,
    setAlertas,
    setProcesando,
    setErrores,
    setAgentesExcluidos,
    router,
  ]);

  const nominaLista = !!agentesDesdeApi || !!(archivoNomina && hojaNomina);
  const listo = !!(archivoCP && archivoReductores && nominaLista) && !procesandoLocal;

  const stepDot = (done: boolean, color: string, n: number) => (
    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors ${done ? `${color} text-white` : "bg-gray-100 text-gray-400"}`}>
      {done ? "✓" : n}
    </div>
  );

  return (
    <div className="px-5 py-5 max-w-5xl mx-auto">
      <motion.div {...fade} className="space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">Carga de archivos</h2>
            <p className="text-xs text-gray-400 mt-0.5">Procesamiento local · los datos no salen del navegador</p>
          </div>
          <Link
            href="/planificacion/contratos"
            className="hidden md:flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-500 transition-colors hover:border-[#0054A6]/30 hover:text-[#0054A6]"
          >
            <FilePen className="h-3.5 w-3.5" />
            Contratos y francos
          </Link>
          {/* Mini stepper */}
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            {stepDot(!!archivoCP, "bg-blue-500", 1)}
            <div className="w-5 h-px bg-gray-200" />
            {stepDot(!!archivoReductores, "bg-purple-500", 2)}
            <div className="w-5 h-px bg-gray-200" />
            {stepDot(nominaLista, "bg-green-500", 3)}
            <div className="w-5 h-px bg-gray-200" />
            <div className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-colors ${listo ? "bg-[#0054A6] text-white" : "bg-gray-100 text-gray-400"}`}>
              <ArrowRight className="h-2.5 w-2.5" /> Procesar
            </div>
          </div>
        </div>

        {/* Step cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

          {/* Card 1 — CP */}
          <div className="relative bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-blue-500" />
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 pt-0.5">
                {stepDot(!!archivoCP, "bg-blue-500", 1)}
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Requerido del cliente</p>
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
          <div className="relative bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-purple-500" />
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 pt-0.5">
                {stepDot(!!archivoReductores, "bg-purple-500", 2)}
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Reductores operativos</p>
              </div>
              <DropZone
                label="reductores.xlsx"
                onFile={handleReductores}
                hasFile={!!archivoReductores}
                fileName={archivoReductores?.name}
                error={errRed}
                loading={loadingRed}
              />
              {archivoReductores && (
                <FilePreview nombre={archivoReductores.name} tamanio={archivoReductores.size} />
              )}
            </div>
          </div>

          {/* Card 3 — Nómina */}
          <div className="relative bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
            <div className={`absolute top-0 left-0 right-0 h-[3px] ${nominaLista ? "bg-green-500" : "bg-orange-400"}`} />
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between pt-0.5">
                <div className="flex items-center gap-2">
                  {stepDot(nominaLista, "bg-green-500", 3)}
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Nómina activa</p>
                </div>
                {agentesDesdeApi && (
                  <button
                    onClick={clearAgentesDesdeApi}
                    className="text-gray-300 hover:text-gray-500 transition-colors"
                    title="Quitar y cargar otra"
                  >
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
                  <div className="flex gap-2">
                    <select
                      className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-700"
                      value={reqMes}
                      onChange={(e) => setReqMes(Number(e.target.value))}
                    >
                      {MESES.map((m, i) => (
                        <option key={i} value={i + 1}>{m}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      className="w-16 text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-700"
                      value={reqAnio}
                      onChange={(e) => setReqAnio(Number(e.target.value))}
                      min={2020}
                      max={2099}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {serviciosNomina.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setReqServicioId(reqServicioId === s.id ? null : s.id)}
                        className={`text-[11px] px-2.5 py-0.5 rounded-full border font-medium transition-all ${
                          reqServicioId === s.id
                            ? "bg-[#0054A6] text-white border-[#0054A6]"
                            : "bg-white text-gray-500 border-gray-200 hover:border-[#0054A6]/50"
                        }`}
                      >
                        {s.nombre}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={handleSolicitarNomina}
                    disabled={!reqServicioId || cargandoNomina}
                    className="w-full text-xs font-semibold bg-[#0054A6] hover:bg-[#00449A] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg py-1.5 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    {cargandoNomina ? (
                      <><Loader2 className="h-3.5 w-3.5 animate-spin" />Cargando…</>
                    ) : (
                      "Cargar desde sistema"
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
                      className="text-[11px] text-[#0054A6] hover:text-[#00449A] flex items-center gap-1 transition-colors"
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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-lg border border-red-200 bg-red-50 p-3.5"
          >
            <div className="flex items-center gap-2 text-red-600 mb-1.5">
              <AlertCircle className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">Errores de validación</span>
            </div>
            <ul className="space-y-0.5">
              {errores.map((e, i) => (
                <li key={i} className="text-xs text-red-500">· {e}</li>
              ))}
            </ul>
          </motion.div>
        )}

        {/* Agents excluded warning */}
        {agentesExcluidos > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-lg border border-amber-200 bg-amber-50 p-3.5"
          >
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
        <div className="flex items-center justify-between pt-1">
          <p className="text-[11px] text-gray-400 hidden sm:block">
            {[archivoCP && "✓ CP", archivoReductores && "✓ Reductores", nominaLista && "✓ Nómina"]
              .filter(Boolean).join("  ·  ") || "Completá los 3 pasos para continuar"}
          </p>
          <div className="flex items-center gap-3 ml-auto">
            {procesandoLocal && pasoActual && (
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {pasoActual}
              </div>
            )}
            <Button size="lg" onClick={handleProcesar} disabled={!listo} className="gap-2">
              {procesandoLocal ? "Procesando…" : "Procesar y ver resumen"}
              {procesandoLocal ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>

      </motion.div>
    </div>
  );
}
