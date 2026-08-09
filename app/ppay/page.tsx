"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { DropZone } from "@/components/upload/DropZone";
import { FilePreview } from "@/components/upload/FilePreview";
import { Button } from "@/components/ui/button";
import { useUploadsPpay } from "@/store/useUploadsPpay";
import { useResultadosPpay } from "@/store/useResultadosPpay";
import {
  getSheetNamesPpay,
  parseCPPpay,
  validarHojasCPPpay,
} from "@/lib/parsers/parseCPPpay";
import {
  getNominasSheetNames,
  parseNomina,
  aplicarDiasAlMes,
} from "@/lib/parsers/parseNomina";
import { parseReductores } from "@/lib/parsers/parseReductores";
import { calcularResultados } from "@/lib/domain/calculos";
import { generarAlertas } from "@/lib/domain/alertEngine";
import { resolverServicioPpayPorSegmento } from "@/lib/config/servicesPpay";
import { archivoEnMemoria } from "@/lib/utils/excel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const fade = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

export default function PpayUploadPage() {
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
  } = useUploadsPpay();

  const {
    mappingOverrides,
    setResultado,
    setMatrices,
    setAgentes,
    setReductores,
    setDiasDelMes,
    setAlertas,
    setProcesando,
    setErrores,
    setAgentesExcluidos,
    errores,
    agentesExcluidos,
    segmentosNoReconocidos,
  } = useResultadosPpay();

  const [loadingCP, setLoadingCP] = useState(false);
  const [loadingRed, setLoadingRed] = useState(false);
  const [loadingNom, setLoadingNom] = useState(false);
  const [procesandoLocal, setProcesandoLocal] = useState(false);
  const [pasoActual, setPasoActual] = useState("");

  const [errCP, setErrCP] = useState("");
  const [errRed, setErrRed] = useState("");
  const [errNom, setErrNom] = useState("");
  const [hojasCP, setHojasCP] = useState<string[]>([]);

  const handleCP = useCallback(
    async (file: File, buffer: ArrayBuffer) => {
      setLoadingCP(true);
      setErrCP("");
      try {
        const hojas = getSheetNamesPpay(buffer);
        const errs = validarHojasCPPpay(hojas);
        if (errs.length > 0) {
          setErrCP(errs.join(" · "));
          return;
        }
        setHojasCP(hojas);
        setArchivoCP(archivoEnMemoria(file, buffer));
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
        setArchivoReductores(archivoEnMemoria(file, buffer));
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
        setArchivoNomina(archivoEnMemoria(file, buffer), hojas);
      } catch (e) {
        setErrNom(`Error al leer el archivo: ${e}`);
      } finally {
        setLoadingNom(false);
      }
    },
    [setArchivoNomina]
  );

  const handleProcesar = useCallback(async () => {
    if (!archivoCP || !archivoNomina || !hojaNomina) return;

    setProcesandoLocal(true);
    setProcesando(true);
    setErrores([]);
    setPasoActual("Leyendo archivos…");

    try {
      const buffers = await Promise.all([
        archivoCP.arrayBuffer(),
        archivoNomina.arrayBuffer(),
        ...(archivoReductores ? [archivoReductores.arrayBuffer()] : []),
      ]);

      const [bufCP, bufNom, bufRed] = buffers;

      setPasoActual("Procesando requerido del cliente…");
      const { matrices, diasDelMes, errores: errCP2 } = parseCPPpay(bufCP);

      setPasoActual("Procesando nómina…");
      const result = parseNomina(
        bufNom,
        hojaNomina,
        mappingOverrides,
        resolverServicioPpayPorSegmento
      );

      const reductores = bufRed
        ? parseReductores(bufRed).reductores
        : [];
      const errRed2 = bufRed ? parseReductores(bufRed).errores : [];

      const todosErrores = [...errCP2, ...result.errores, ...errRed2];
      if (todosErrores.length > 0) {
        setErrores(todosErrores);
        return;
      }

      setPasoActual("Calculando cumplimiento…");
      const agentes = aplicarDiasAlMes(result.agentes, diasDelMes);
      const resultado = calcularResultados(
        agentes,
        matrices,
        reductores,
        diasDelMes,
        modoReductor,
        topeFacturacion
      );

      setPasoActual("Generando alertas…");
      const alertas = generarAlertas(resultado);

      setMatrices(matrices);
      setAgentes(agentes);
      setReductores(reductores);
      setDiasDelMes(diasDelMes);
      setResultado(resultado);
      setAlertas(alertas);
      setAgentesExcluidos(result.agentesExcluidos, result.segmentosNoReconocidos);

      router.push("/ppay/resumen");
    } catch (e) {
      setErrores([`Error inesperado al procesar: ${String(e)}`]);
    } finally {
      setProcesandoLocal(false);
      setProcesando(false);
      setPasoActual("");
    }
  }, [
    archivoCP,
    archivoNomina,
    hojaNomina,
    archivoReductores,
    modoReductor,
    topeFacturacion,
    mappingOverrides,
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

  const nominaLista = !!(archivoNomina && hojaNomina);
  const listo = !!(archivoCP && nominaLista) && !procesandoLocal;

  return (
    <div className="px-6 py-6 max-w-5xl mx-auto">
      <motion.div {...fade} className="space-y-5">
        <div>
          <h2 className="text-xl font-bold text-gray-900 mb-0.5">
            Personal Pay — Carga de archivos
          </h2>
          <p className="text-sm text-gray-500">
            Subí el requerido y la nómina para calcular el cumplimiento de Personal Pay.
            El procesamiento es local, tus datos no salen del navegador.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* CP */}
            <div className="space-y-2">
              <DropZone
                label="Requerido del cliente"
                sublabel="CP Personal Pay MM-AAAA.xlsx"
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

            {/* Reductores (opcional) */}
            <div className="space-y-2">
              <DropZone
                label="Reductores operativos"
                sublabel="Opcional — reductores.xlsx"
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

            {/* Nómina */}
            <div className="space-y-2">
              <DropZone
                label="Nómina activa"
                sublabel="Nomina_PersonalPay.xlsx"
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
                <li key={i} className="text-xs text-red-500">· {e}</li>
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
            {procesandoLocal ? "Procesando…" : "Procesar y ver resumen"}
            {procesandoLocal ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
