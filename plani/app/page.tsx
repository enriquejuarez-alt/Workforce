"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, ArrowRight, ChevronDown, AlertTriangle, Loader2, CheckCircle2, X } from "lucide-react";
import { DropZone } from "@/components/upload/DropZone";
import { FilePreview } from "@/components/upload/FilePreview";
import { Button } from "@/components/ui/button";
import { useUploads } from "@/store/useUploads";
import { useResultados } from "@/store/useResultados";
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

      router.push("/dashboard");
      // Notificar a Walt para que sincronice el nav activo
      if (window.parent !== window) {
        window.parent.postMessage({ type: "PLANI_PAGE_CHANGE", page: "dashboard" }, "*");
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

  return (
    <div className="px-6 py-6 max-w-5xl mx-auto">
      <motion.div {...fade} className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">Carga de archivos</h2>
          <p className="text-sm text-gray-500">
            Subí los archivos para calcular el cumplimiento del mes. El procesamiento es local, tus datos no salen del navegador.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Requerido del cliente */}
            <div className="space-y-2">
              <DropZone
                label="Requerido del cliente"
                sublabel="CP_Soporte_MM-AAAA.xlsx"
                step={1}
                onFile={handleCP}
                hasFile={!!archivoCP}
                fileName={archivoCP?.name}
                error={errCP}
                loading={loadingCP}
              />
              {archivoCP && (
                <FilePreview
                  nombre={archivoCP.name}
                  tamanio={archivoCP.size}
                  hojas={hojasCP}
                />
              )}
            </div>

            {/* Reductores */}
            <div className="space-y-2">
              <DropZone
                label="Reductores operativos"
                sublabel="reductores.xlsx"
                step={2}
                onFile={handleReductores}
                hasFile={!!archivoReductores}
                fileName={archivoReductores?.name}
                error={errRed}
                loading={loadingRed}
              />
              {archivoReductores && (
                <FilePreview
                  nombre={archivoReductores.name}
                  tamanio={archivoReductores.size}
                />
              )}
            </div>

            {/* Nómina — puede ser Excel o inyectada desde Nómina */}
            <div className="space-y-2">
              {agentesDesdeApi ? (
                <div className="rounded-xl border-2 border-green-200 bg-green-50 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-green-800">Nómina cargada desde el sistema</p>
                        <p className="text-xs text-green-600 mt-0.5">
                          {agentesDesdeApi.length} agentes
                          {mesDesdeApi && anioDesdeApi
                            ? ` · ${MESES[mesDesdeApi - 1]} ${anioDesdeApi}`
                            : ""}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={clearAgentesDesdeApi}
                      className="text-green-400 hover:text-green-700 transition-colors shrink-0"
                      title="Quitar y subir Excel manual"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <DropZone
                    label="Nómina activa"
                    sublabel="Nomina_Soporte.xlsx"
                    step={3}
                    onFile={handleNomina}
                    hasFile={!!archivoNomina}
                    fileName={archivoNomina?.name}
                    error={errNom}
                    loading={loadingNom}
                  />
                  {archivoNomina && (
                    <>
                      <FilePreview
                        nombre={archivoNomina.name}
                        tamanio={archivoNomina.size}
                        hojas={hojasNomina}
                      />
                      {hojasNomina.length > 1 && (
                        <div>
                          <label className="text-xs text-gray-500 mb-1.5 flex items-center gap-1">
                            <ChevronDown className="h-3 w-3" />
                            Hoja a usar
                          </label>
                          <Select
                            value={hojaNomina ?? ""}
                            onValueChange={setHojaNomina}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="Seleccioná una hoja" />
                            </SelectTrigger>
                            <SelectContent>
                              {hojasNomina.map((h) => (
                                <SelectItem key={h} value={h}>
                                  {h}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {errores.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-lg border border-red-200 bg-red-50 p-4"
          >
            <div className="flex items-center gap-2 text-red-600 mb-2">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Errores de validación</span>
            </div>
            <ul className="space-y-1">
              {errores.map((e, i) => (
                <li key={i} className="text-xs text-red-500">
                  · {e}
                </li>
              ))}
            </ul>
          </motion.div>
        )}

        {agentesExcluidos > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-lg border border-amber-200 bg-amber-50 p-4"
          >
            <div className="flex items-start gap-2 text-amber-700">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium">
                  {agentesExcluidos} agente{agentesExcluidos !== 1 ? "s" : ""} excluido{agentesExcluidos !== 1 ? "s" : ""} por segmento no reconocido
                </p>
                {segmentosNoReconocidos.length > 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Segmentos sin mapeo: {segmentosNoReconocidos.slice(0, 5).join(", ")}
                    {segmentosNoReconocidos.length > 5 && ` y ${segmentosNoReconocidos.length - 5} más`}
                    . Usá el mapeo de segmentos para incluirlos.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        <div className="flex items-center justify-end gap-3">
          {procesandoLocal && pasoActual && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {pasoActual}
            </div>
          )}
          <Button
            size="lg"
            onClick={handleProcesar}
            disabled={!listo}
            className="gap-2"
          >
            {procesandoLocal ? "Procesando…" : "Procesar y ver dashboard"}
            {procesandoLocal ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
