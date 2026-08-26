"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertCircle, ArrowRight, ChevronDown, AlertTriangle,
  Loader2, CheckCircle2, X, FilePen, Calculator, Database, RotateCcw,
  Save, Trash2, FolderOpen, UserPlus, Plus, Upload,
  Layers, ClipboardList, SlidersHorizontal, Users2, Settings2,
} from "lucide-react";
import ConfirmDialog from "@/components/hr/ui/ConfirmDialog";
import { DropZone } from "@/components/upload/DropZone";
import { FilePreview } from "@/components/upload/FilePreview";
import { Button } from "@/components/ui/button";
import { useUploads } from "@/store/useUploads";
import { useResultados } from "@/store/useResultados";
import { usePlaniConfig, type ServicioNominaRef } from "@/store/usePlaniConfig";
import { useFrancoConfig } from "@/store/useFrancoConfig";
import {
  getSheetNames,
  parseCP,
  validarHojasCP,
} from "@/lib/parsers/parseCP";
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
  getSheetNamesOnb,
  parseCPOnb,
  validarHojasCPOnb,
} from "@/lib/parsers/parseCPOnb";
import {
  getNominasSheetNames,
  parseNomina,
  aplicarDiasAlMes,
  parsearHorario,
  construirVacacionesPorDni,
  normalizarDni,
} from "@/lib/parsers/parseNomina";
import { parseCPVentas, validarHojasCPVentas } from "@/lib/parsers/parseCPVentas";
import { parseReductores } from "@/lib/parsers/parseReductores";
import { calcularReductoresDesdeArchivos, reductoresAFile } from "@/lib/parsers/calcularReductores";
import { calcularResultados, resolverServiciosDiaADia } from "@/lib/domain/calculos";
import type { Agente, FrancoServicioDatos, MatrizServicio, Reductor, ServicioKey } from "@/lib/domain/types";
import { deserializarMatrices } from "@/lib/domain/serializacion";
import {
  expandirAgentesHipoteticos,
  contarAgentesHipoteticos,
  type AgenteHipoteticoRow,
} from "@/lib/domain/agentesHipoteticos";
import { generarAlertas } from "@/lib/domain/alertEngine";
import {
  getServiciosActivos,
  resolverServicioPorReductorRuntime,
  resolverServicioPorSegmentoRuntime,
} from "@/lib/config/servicesRuntime";
import { normalizar } from "@/lib/config/services";
import { SERVICIOS_RETENCION } from "@/lib/config/servicesRetencion";
import { SERVICIOS_BO } from "@/lib/config/servicesBo";
import { SERVICIOS_TECH } from "@/lib/config/servicesTech";
import { SERVICIOS_INTEGRAL } from "@/lib/config/servicesIntegral";
import { SERVICIOS_APGC } from "@/lib/config/servicesApgc";
import { SERVICIOS_IMPLEMENTACION_TECNICA } from "@/lib/config/servicesImplementacionTecnica";
import { SERVICIOS_MIGRACION_GENERAL } from "@/lib/config/servicesMigracionGeneral";
import { SERVICIOS_VENTAS } from "@/lib/config/servicesVentas";
import { SERVICIOS_SMB } from "@/lib/config/servicesSmb";
import { SERVICIOS_ONB } from "@/lib/config/servicesOnb";
import { SERVICIOS_PPAY } from "@/lib/config/servicesPpay";
import type { ServiceDefinition } from "@/lib/config/services";
import { extraerHorasContrato, archivoEnMemoria } from "@/lib/utils/excel";
import { nominasApi, reductorImportacionesApi, francoImportacionesApi, cpImportacionesApi, vacacionesApi } from "@/lib/api";
import type { NominaMensual, AgenteNominaMensual } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuthStore } from "@/store/auth";
import { isReadOnly } from "@/lib/utils/roles";
import toast from "react-hot-toast";

const MESES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
];

// Sub-servicios que no deben aparecer como opcion de primer nivel
// (son islas dentro de Soporte Tecnico)
const SERVICIOS_OCULTOS = [
  "atencion al cliente",
  "atencion al cliente",
  "backoffice",
  "cobranzas",
  "soporte conectividad",
  "soporte entretenimiento",
  "ventas", // replaced by sub-services below
];

const SERVICIOS_DEMO: ServicioNominaRef[] = [
  { id: -1, nombre: "Personal Pay", planiConfig: null },
  { id: -2, nombre: "SMB", planiConfig: null },
  { id: -3, nombre: "Onboarding", planiConfig: null },
  { id: -4, nombre: "Migracion", planiConfig: null },
  { id: -11, nombre: "Migracion Cobre AMBA", planiConfig: null },
  { id: -12, nombre: "Migracion Cobre Interior", planiConfig: null },
  { id: -5, nombre: "Retencion", planiConfig: null },
  { id: -6, nombre: "Retencion Convergente", planiConfig: null },
  { id: -7, nombre: "BO GC", planiConfig: null },
  { id: -8, nombre: "TECH", planiConfig: null },
  { id: -9, nombre: "Integral Movil AMBA", planiConfig: null },
  { id: -10, nombre: "Integral Movil Interior", planiConfig: null },
  { id: -13, nombre: "Ventas WA", planiConfig: null },
  { id: -14, nombre: "Ventas WA Hogar", planiConfig: null },
  { id: -15, nombre: "Ventas Movil", planiConfig: null },
  { id: -16, nombre: "Soporte Tecnico", planiConfig: null },
  { id: -17, nombre: "Movil", planiConfig: null },
  { id: -18, nombre: "Hogares Convergentes", planiConfig: null },
  { id: -19, nombre: "Hogares No Convergentes", planiConfig: null },
  { id: -20, nombre: "Atención Personalizada Grandes Clientes", planiConfig: null },
  { id: -21, nombre: "Implementación Técnica", planiConfig: null },
  { id: -22, nombre: "Migración (general)", planiConfig: null },
];

const fade = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

type ModoCargaReductores = "archivo" | "manual" | "calculadora" | "guardado";
type ModoCargaCP = "archivo" | "guardado";

interface CpGuardadoData {
  matrices: Map<ServicioKey, MatrizServicio>;
  diasDelMes: number;
  servicioKeys: ServicioKey[];
  label: string;
}

/** Fila de edicion manual: mismos campos que Reductor, pero deslogueo/ausentismo/rotacion
 * se editan como % (0-100) en vez de fraccion (0-1), mas natural para tipear a mano. */
interface FilaReductorManual {
  servicio: string;
  servicioNorm: string;
  deslogueoPct: number;
  ausentismoPct: number;
  rotacionPct: number;
}
type FuenteCalculadora = "deslogueo" | "ausentismo" | "rotacion";

export default function UploadPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const {
    archivoCP, archivoReductores, archivoNomina,
    hojaNomina, hojasNomina, modoReductor, topeFacturacion,
    setArchivoCP, setArchivoReductores, setArchivoNomina, setHojaNomina,
  } = useUploads();

  const {
    mappingOverrides, pases,
    setResultado, setMatrices, setAgentes, setReductores, setFrancosServicio,
    setDiasDelMes, setAlertas, setProcesando, setErrores,
    setAgentesExcluidos, clearAgentesDesdeApi, setAgentesDesdeApi,
    errores, agentesExcluidos, segmentosNoReconocidos,
    agentesDesdeApi, mesDesdeApi, anioDesdeApi, clearFilters,
    setServicioActivo,
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
  const [reductoresManual, setReductoresManual] = useState<FilaReductorManual[]>([]);
  const [reqMes, setReqMes] = useState(new Date().getMonth() + 1);
  const [reqAnio, setReqAnio] = useState(new Date().getFullYear());
  const [cargandoNomina, setCargandoNomina] = useState(false);
  const [useArchivoNomina, setUseArchivoNomina] = useState(false);
  const [cargandoNominaId, setCargandoNominaId] = useState<number | null>(null);
  const [islaFiltro, setIslaFiltro] = useState<string | null>(null);
  const [agentesHipoteticos, setAgentesHipoteticos] = useState<AgenteHipoteticoRow[]>([]);
  const [showFormHipotetico, setShowFormHipotetico] = useState(false);
  const [nuevoHipServicio, setNuevoHipServicio] = useState("");
  const [nuevoHipCantidad, setNuevoHipCantidad] = useState("");
  const [nuevoHipContrato, setNuevoHipContrato] = useState("36");
  const [nuevoHipContratoCustom, setNuevoHipContratoCustom] = useState("");
  const [nuevoHipDesde, setNuevoHipDesde] = useState("");
  const [nuevoHipHasta, setNuevoHipHasta] = useState("");
  const [reductorGuardadoId, setReductorGuardadoId] = useState<number | null>(null);
  const [nombreGuardado, setNombreGuardado] = useState("");
  const [showGuardarInput, setShowGuardarInput] = useState(false);
  const [deleteReductorGuardadoId, setDeleteReductorGuardadoId] = useState<number | null>(null);

  const [modoCP, setModoCP] = useState<ModoCargaCP>("archivo");
  const [cpGuardadoId, setCpGuardadoId] = useState<number | null>(null);
  const [cpGuardadoData, setCpGuardadoData] = useState<CpGuardadoData | null>(null);
  const [cpPeriodoFiltro, setCpPeriodoFiltro] = useState("");

  // Derive numeric service ID from the shared selectedServicioKey
  const reqServicioId = selectedServicioKey ? parseInt(selectedServicioKey) : null;

  // Filtered service list - hide sub-services that belong to Soporte Tecnico
  const serviciosFiltrados = useMemo(() => {
    if (!serviciosNomina) return [];
    const visibles = serviciosNomina.filter(
      (s) => !SERVICIOS_OCULTOS.includes(s.nombre.toLowerCase())
    );
    const nombresVisibles = new Set(visibles.map((s) => normalizar(s.nombre)));
    const demosFaltantes = SERVICIOS_DEMO.filter((s) => !nombresVisibles.has(normalizar(s.nombre)));
    return [...visibles, ...demosFaltantes].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  }, [serviciosNomina]);

  const servicioActivo = serviciosFiltrados.find((s) => s.id === reqServicioId);
  const servicioDemoActivo = !!servicioActivo && servicioActivo.id < 0;

  const { data: nominasDisponibles = [], isLoading: loadingNominas } = useQuery({
    queryKey: ["plani-nominas", servicioActivo?.id, reqMes, reqAnio],
    queryFn: () =>
      nominasApi
        .list({ servicio_id: servicioActivo!.id, mes: reqMes, anio: reqAnio })
        .then((r) => r.data),
    // Se consulta incluso en islas "demo" (sin Servicio real propio): la Nómina
    // General de Planificación es visible desde cualquier isla igual.
    enabled: !!servicioActivo && !!serviciosNomina && !useArchivoNomina,
  });

  const { data: reductoresGuardados = [], isLoading: loadingReductoresGuardados } = useQuery({
    queryKey: ["reductores-guardados"],
    queryFn: () => reductorImportacionesApi.list().then((r) => r.data),
    enabled: modoCargaReductores === "guardado",
  });

  const { data: reductorGuardadoDetalle, isLoading: loadingReductorGuardadoDetalle } = useQuery({
    queryKey: ["reductor-guardado", reductorGuardadoId],
    queryFn: () => reductorImportacionesApi.get(reductorGuardadoId!).then((r) => r.data),
    enabled: reductorGuardadoId !== null,
  });


  const guardarReductoresMut = useMutation({
    mutationFn: (data: { mes: number; anio: number; nombre?: string; archivo_nombre?: string; servicios: Reductor[] }) =>
      reductorImportacionesApi.create(data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reductores-guardados"] });
      toast.success("Reductores guardados");
      setShowGuardarInput(false);
      setNombreGuardado("");
    },
    onError: () => toast.error("No se pudo guardar el set de reductores"),
  });

  const actualizarServicioGuardadoMut = useMutation({
    mutationFn: ({ id, servicioId, data }: { id: number; servicioId: number; data: Partial<Pick<Reductor, "deslogueo" | "ausentismo" | "rotacion">> }) =>
      reductorImportacionesApi.updateServicio(id, servicioId, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reductor-guardado", reductorGuardadoId] });
    },
    onError: () => toast.error("No se pudo actualizar el valor"),
  });

  const eliminarReductorGuardadoMut = useMutation({
    mutationFn: (id: number) => reductorImportacionesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reductores-guardados"] });
      if (reductorGuardadoId === deleteReductorGuardadoId) setReductorGuardadoId(null);
      setDeleteReductorGuardadoId(null);
      toast.success("Set de reductores eliminado");
    },
    onError: () => toast.error("No se pudo eliminar"),
  });

  const esPersonalPay = reqServicioId === -1 ||
    (servicioActivo?.nombre ?? "").toLowerCase().includes("personal pay");
  const esSmb = reqServicioId === -2 ||
    (servicioActivo?.nombre ?? "").toLowerCase().includes("smb");
  const esOnboarding = reqServicioId === -3 ||
    (servicioActivo?.nombre ?? "").toLowerCase().includes("onboarding") ||
    (servicioActivo?.nombre ?? "").toLowerCase().includes("onb");
  const esMigracion = reqServicioId === -4 ||
    (servicioActivo?.nombre ?? "").toLowerCase().includes("migracion") ||
    (servicioActivo?.nombre ?? "").toLowerCase().includes("cobre");
  const esMigracionCobreAmba = reqServicioId === -11 ||
    (normalizar(servicioActivo?.nombre ?? "").includes("migracion") &&
      normalizar(servicioActivo?.nombre ?? "").includes("cobre") &&
      normalizar(servicioActivo?.nombre ?? "").includes("amba"));
  const esMigracionCobreInterior = reqServicioId === -12 ||
    (normalizar(servicioActivo?.nombre ?? "").includes("migracion") &&
      normalizar(servicioActivo?.nombre ?? "").includes("cobre") &&
      normalizar(servicioActivo?.nombre ?? "").includes("interior"));
  const esRetencion = reqServicioId === -5 || reqServicioId === -6 ||
    normalizar(servicioActivo?.nombre ?? "").includes("retencion");
  const esRetencionConvergente = reqServicioId === -6 ||
    normalizar(servicioActivo?.nombre ?? "").includes("retencion convergente");
  const esBoGc = reqServicioId === -7 ||
    normalizar(servicioActivo?.nombre ?? "") === "bo gc" ||
    normalizar(servicioActivo?.nombre ?? "").includes("back office");
  const esTech = reqServicioId === -8 ||
    normalizar(servicioActivo?.nombre ?? "") === "tech" ||
    normalizar(servicioActivo?.nombre ?? "").includes("tech admin");
  const esIntegralMovilAmba = reqServicioId === -9 ||
    (normalizar(servicioActivo?.nombre ?? "").includes("integral movil") &&
      normalizar(servicioActivo?.nombre ?? "").includes("amba"));
  const esIntegralMovilInterior = reqServicioId === -10 ||
    (normalizar(servicioActivo?.nombre ?? "").includes("integral movil") &&
      normalizar(servicioActivo?.nombre ?? "").includes("interior"));
  const esApgc = reqServicioId === -20 ||
    normalizar(servicioActivo?.nombre ?? "") === "apgc" ||
    normalizar(servicioActivo?.nombre ?? "").includes("atencion personalizada grandes clientes");
  const esImplementacionTecnica = reqServicioId === -21 ||
    normalizar(servicioActivo?.nombre ?? "").includes("implementacion tecnica");
  const esMigracionGeneral = reqServicioId === -22 ||
    normalizar(servicioActivo?.nombre ?? "") === "migracion general" ||
    normalizar(servicioActivo?.nombre ?? "") === "migracion (general)";
  const esVentas = reqServicioId === -13 || reqServicioId === -14 || reqServicioId === -15 ||
    (servicioActivo?.nombre ?? "").toLowerCase().startsWith("ventas");

  // Formato de CP activo segun el servicio elegido — mismo criterio que
  // handleProcesar usa para elegir el parser, usado para filtrar los CPs
  // guardados a los que efectivamente pueden matchear en esta corrida.
  const formatoCPActivo = esPersonalPay
    ? "ppay"
    : esSmb
      ? "smb"
      : esOnboarding
        ? "onboarding"
        : esVentas
          ? "ventas"
          : esBoGc
            ? "bo"
            : esApgc
              ? "apgc"
              : esImplementacionTecnica
                ? "implementacion-tecnica"
                : esMigracionGeneral
                  ? "migracion-general"
                  : "soporte";

  const { data: cpsGuardados = [], isLoading: loadingCpsGuardados } = useQuery({
    queryKey: ["cp-guardados"],
    queryFn: () => cpImportacionesApi.list().then((r) => r.data),
    enabled: modoCP === "guardado",
  });

  // No alcanza con filtrar por formato: "General" agrupa Soporte, Retencion,
  // Movil y Hogares Convergentes/No Convergentes — CPs de islas totalmente
  // distintas que comparten el mismo formato. Sin este segundo filtro, el
  // picker mostraba todos esos CPs mezclados como "Agosto 2026 · N
  // servicios" indistinguibles entre si, obligando a abrir uno por uno para
  // encontrar el correcto. Se filtra ademas por si el CP realmente contiene
  // el servicio activo.
  //
  // A diferencia de serviciosDelCP (que necesita el grupo ENTERO de
  // PersonalPay/SMB/Onboarding/Ventas para poder reconocer un archivo
  // recien subido que trae varios sub-servicios juntos en una sola hoja),
  // aca conviene usar solo getServiciosActivos() — el servicio puntual
  // activo. Filtrar por el grupo entero hacia que, con "Ventas WA" activo,
  // el picker mostrara TAMBIEN los CPs guardados de Ventas WA Hogar/Movil/
  // Out Movil (cualquier CP que contenga CUALQUIER key del grupo Ventas).
  // Angostar a getServiciosActivos() no rompe el caso de un CP guardado que
  // sí incluye varios servicios juntos (ej. el "Unificado" de SMB): alcanza
  // con que el activo este entre los suyos para seguir matcheando.
  const cpsGuardadosDelFormato = useMemo(() => {
    const keysActivo = new Set(getServiciosActivos().map((d) => d.key));
    return cpsGuardados
      .filter((cp) => cp.formato === formatoCPActivo)
      .filter((cp) => (cp.servicios ?? []).some((s) => keysActivo.has(s.servicio_norm as ServicioKey)))
      .sort((a, b) => b.anio - a.anio || b.mes - a.mes || +new Date(b.fecha_importacion) - +new Date(a.fecha_importacion));
  }, [cpsGuardados, formatoCPActivo, servicioActivo]);

  // Meses/años realmente disponibles entre los CPs que ya pasaron el filtro
  // de formato+servicio de arriba — para elegir el periodo sin tener que
  // scrollear la lista buscando a ojo.
  const periodosCPDisponibles = useMemo(() => {
    const mapa = new Map<string, { mes: number; anio: number }>();
    for (const cp of cpsGuardadosDelFormato) mapa.set(`${cp.mes}-${cp.anio}`, { mes: cp.mes, anio: cp.anio });
    return [...mapa.entries()].sort(([, a], [, b]) => b.anio - a.anio || b.mes - a.mes);
  }, [cpsGuardadosDelFormato]);

  const cpsGuardadosFiltrados = useMemo(
    () => (cpPeriodoFiltro ? cpsGuardadosDelFormato.filter((cp) => `${cp.mes}-${cp.anio}` === cpPeriodoFiltro) : cpsGuardadosDelFormato),
    [cpsGuardadosDelFormato, cpPeriodoFiltro]
  );

  const handleUsarCpGuardado = useCallback(async (id: number) => {
    setErrCP("");
    setLoadingCP(true);
    setCpGuardadoId(id);
    try {
      const { data: detalle } = await cpImportacionesApi.get(id);
      const servicios = detalle.servicios ?? [];
      if (servicios.length === 0) {
        setErrCP("Este CP guardado no tiene servicios.");
        return;
      }
      const matrices = deserializarMatrices(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        servicios.map((s) => [s.servicio_norm, s.matriz]) as any
      );
      const diasDelMes = Math.max(0, ...servicios.map((s) => s.dias_del_mes));
      setCpGuardadoData({
        matrices,
        diasDelMes,
        servicioKeys: servicios.map((s) => s.servicio_norm as ServicioKey),
        label: detalle.archivo_nombre ?? `CP ${MESES[detalle.mes - 1]} ${detalle.anio}`,
      });
      setArchivoCP(null);
      setHojasCP([]);
      setReductoresManual([]);
      toast.success(`CP cargado: ${servicios.length} servicios`);
    } catch {
      setErrCP("No se pudo cargar este CP guardado.");
      setCpGuardadoId(null);
    } finally {
      setLoadingCP(false);
    }
  }, [setArchivoCP]);

  // Servicios que realmente aparecen en el CP (Requerido) ya subido, para
  // precargar la pestaña "Manual" de reductores con exactamente esos — no un
  // grupo entero de config que puede no coincidir con lo que trae el archivo.
  const serviciosDelCP = useMemo(() => {
    const universo: ServiceDefinition[] = esPersonalPay
      ? SERVICIOS_PPAY
      : esSmb
        ? SERVICIOS_SMB
        : esOnboarding
          ? SERVICIOS_ONB
        : esVentas
          ? SERVICIOS_VENTAS
        : getServiciosActivos();
    // CP guardado: los servicios ya vienen resueltos a ServicioKey exacta al
    // guardarse, no hace falta volver a matchear por alias de hoja.
    if (cpGuardadoData) {
      return universo.filter((def) => cpGuardadoData.servicioKeys.includes(def.key));
    }
    if (hojasCP.length === 0) return [];
    return universo.filter((def) => {
      const aliases = Array.isArray(def.hojaCP) ? def.hojaCP : [def.hojaCP];
      return aliases.some((alias) => hojasCP.some((h) => normalizar(h) === normalizar(alias)));
    });
  }, [hojasCP, cpGuardadoData, esPersonalPay, esSmb, esOnboarding, esVentas]);

  // Islas/segmentos detectados dentro de la nomina cargada para el servicio activo
  // (ej. Soporte Tecnico agrupa varias islas bajo un unico servicio_id en el sistema)
  const islasDisponibles = useMemo(() => {
    if (!agentesDesdeApi || agentesDesdeApi.length === 0) return [];
    const serviciosActivos = getServiciosActivos();
    if (serviciosActivos.length <= 1) return [];

    const conteos = new Map<string, number>();
    for (const a of agentesDesdeApi) {
      const key = a.segmentoNorm || "";
      conteos.set(key, (conteos.get(key) ?? 0) + 1);
    }

    return serviciosActivos
      .map((def) => ({ key: def.key, label: def.label, count: conteos.get(def.key) ?? 0 }))
      .filter((i) => i.count > 0);
  }, [agentesDesdeApi]);

  const agentesFiltradosPorIsla = useMemo(() => {
    if (!agentesDesdeApi) return null;
    if (!islaFiltro) return agentesDesdeApi;
    return agentesDesdeApi.filter((a) => a.segmentoNorm === islaFiltro);
  }, [agentesDesdeApi, islaFiltro]);

  const serviciosParaHipoteticos = useMemo(() => getServiciosActivos(), [reqServicioId]);
  const totalHipoteticos = useMemo(() => contarAgentesHipoteticos(agentesHipoteticos), [agentesHipoteticos]);

  function agregarAgenteHipotetico() {
    const cantidad = parseInt(nuevoHipCantidad, 10);
    const contrato = nuevoHipContrato === "otro" ? nuevoHipContratoCustom.trim() : nuevoHipContrato;
    if (!nuevoHipServicio || !cantidad || cantidad <= 0 || !contrato) {
      toast.error("Completa servicio, cantidad y contrato.");
      return;
    }
    const servicioDef = serviciosParaHipoteticos.find((s) => s.key === nuevoHipServicio);
    setAgentesHipoteticos((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        servicio: nuevoHipServicio,
        servicioLabel: servicioDef?.label ?? nuevoHipServicio,
        cantidad,
        contrato,
        horarioDesde: nuevoHipDesde || undefined,
        horarioHasta: nuevoHipHasta || undefined,
      },
    ]);
    setNuevoHipCantidad("");
    setNuevoHipDesde("");
    setNuevoHipHasta("");
    setNuevoHipContratoCustom("");
    setShowFormHipotetico(false);
  }

  function quitarAgenteHipotetico(id: string) {
    setAgentesHipoteticos((prev) => prev.filter((r) => r.id !== id));
  }

  const reductoresUtilizados = useMemo(() => {
    if (reductoresPreview.length === 0) return [];

    const serviciosActivos = getServiciosActivos();
    const serviciosParaResolver = [
      ...serviciosActivos,
      ...SERVICIOS_RETENCION,
      ...SERVICIOS_BO,
      ...SERVICIOS_TECH,
      ...SERVICIOS_INTEGRAL,
      ...SERVICIOS_APGC,
      ...SERVICIOS_IMPLEMENTACION_TECNICA,
      ...SERVICIOS_MIGRACION_GENERAL,
    ];
    const label = normalizar(servicioActivo?.planiConfig?.label ?? servicioActivo?.nombre ?? "");
    const selectedKey = servicioActivo?.planiConfig?.key ?? null;
    const filtroEstricto =
      esPersonalPay ||
      esSmb ||
      esOnboarding ||
      esMigracion ||
      esMigracionCobreAmba ||
      esMigracionCobreInterior ||
      esRetencion ||
      esBoGc ||
      esTech ||
      esIntegralMovilAmba ||
      esIntegralMovilInterior ||
      esApgc ||
      esImplementacionTecnica ||
      esMigracionGeneral ||
      esVentas ||
      Boolean(selectedKey);

    const keysSeleccionadas = new Set<string>();
    if (label.includes("retencion")) {
      keysSeleccionadas.add(label.includes("convergente") ? "RETENCION-CONVERGENTE" : "RETENCION-MOVIL");
    } else if (label === "bo gc" || label.includes("back office")) {
      keysSeleccionadas.add("BO-GC");
    } else if (label === "tech" || label.includes("tech admin")) {
      keysSeleccionadas.add("TECH");
    } else if (label.includes("integral movil") && label.includes("amba")) {
      keysSeleccionadas.add("INTEGRAL-MOVIL-AMBA");
    } else if (label.includes("integral movil") && label.includes("interior")) {
      keysSeleccionadas.add("INTEGRAL-MOVIL-INTERIOR");
    } else if (label === "apgc" || label.includes("atencion personalizada grandes clientes")) {
      keysSeleccionadas.add("APGC");
    } else if (label.includes("implementacion tecnica")) {
      keysSeleccionadas.add("IMPLEMENTACION-TECNICA");
    } else if (selectedKey) {
      keysSeleccionadas.add(selectedKey);
    } else if (label.includes("personal pay") || label.includes("ppay")) {
      keysSeleccionadas.add("PPAY");
    } else if (label.includes("onboarding") || label.includes("onb")) {
      serviciosActivos
        .filter((s) => s.key.toLowerCase().startsWith("onb"))
        .forEach((s) => keysSeleccionadas.add(s.key));
    } else if (label.includes("smb")) {
      serviciosActivos
        .filter((s) => s.key.toLowerCase().startsWith("smb"))
        .forEach((s) => keysSeleccionadas.add(s.key));
    } else if (label.includes("migracion") || label.includes("cobre")) {
      if (label.includes("amba")) {
        keysSeleccionadas.add("MIGRACION-COBRE-AMBA");
      } else if (label.includes("interior")) {
        keysSeleccionadas.add("MIGRACION-COBRE-INTERIOR");
      } else {
        serviciosActivos
          .filter((s) => s.key.toLowerCase().startsWith("migracion"))
          .forEach((s) => keysSeleccionadas.add(s.key));
      }
    } else if (label.includes("ventas")) {
      serviciosActivos
        .filter((s) => s.key.toLowerCase().startsWith("ventas"))
        .forEach((s) => keysSeleccionadas.add(s.key));
    } else if (label.includes("soporte") || label.includes("tecnico") || label.includes("técnico")) {
      serviciosActivos
        .filter((s) => {
          const key = s.key.toLowerCase();
          return key.startsWith("soporte") || key.startsWith("smb");
        })
        .forEach((s) => keysSeleccionadas.add(s.key));
    }

    const reconocidos = reductoresPreview.map((r) => {
      const servicioKey =
        serviciosParaResolver.find((def) =>
          def.reductorNombres.some((alias) => normalizar(alias) === normalizar(r.servicioNorm))
        )?.key ??
        resolverServicioPorReductorRuntime(r.servicioNorm) ??
        r.servicioNorm;

      return { ...r, servicioKey };
    });

    if (keysSeleccionadas.size === 0) return reconocidos;
    const filtrados = reconocidos.filter((r) => keysSeleccionadas.has(r.servicioKey));
    const visibles = filtroEstricto ? filtrados : (filtrados.length > 0 ? filtrados : reconocidos);
    return Array.from(new Map(visibles.map((r) => [r.servicioKey, r])).values());
  }, [
    reductoresPreview,
    servicioActivo,
    esPersonalPay,
    esSmb,
    esOnboarding,
    esMigracion,
    esMigracionCobreAmba,
    esMigracionCobreInterior,
    esRetencion,
    esBoGc,
    esTech,
    esIntegralMovilAmba,
    esIntegralMovilInterior,
    esApgc,
    esImplementacionTecnica,
    esMigracionGeneral,
    esVentas,
  ]);

  const cpDropzoneLabel = esPersonalPay
    ? "CP_Personal_Pay_MM-AAAA.xlsx"
    : esSmb
      ? "CP_SMB_MM-AAAA.xlsx"
      : esOnboarding
        ? "CP_Onboarding_MM-AAAA.xlsx"
        : esMigracionCobreAmba
          ? "Konecta Migra Cobre AMBA Julio.xlsx"
        : esMigracionCobreInterior
          ? "Konecta Migra Cobre Interior Julio.xlsx"
        : esMigracion
          ? "CP_Migracion_Cobre_MM-AAAA.xlsx"
          : esRetencionConvergente
            ? "CP Retencion Convergente 07-2026.xlsx"
            : esRetencion
              ? "CP Retencion 07-2026.xlsx"
              : esBoGc
                ? "Konecta Back Office Julio.xlsx"
                : esTech
                  ? "Konecta Tech Admin Julio.xlsx"
                  : esIntegralMovilAmba
                    ? "Konecta Integral AMBA Julio.xlsx"
                    : esIntegralMovilInterior
                      ? "Konecta Integral INTERIOR Julio.xlsx"
                      : esApgc
                        ? "Konecta APGC Julio.xlsx"
                        : esImplementacionTecnica
                          ? "Konecta Implementacion Tecnica Julio.xlsx"
                          : esMigracionGeneral
                            ? "Konecta Migracion Julio.xlsx"
                            : reqServicioId === -13
                        ? "CP_VentasWA_MM-AAAA.xls"
                        : reqServicioId === -14
                          ? "CP_VentasWAHogar_MM-AAAA.xls"
                          : reqServicioId === -15
                            ? "CP_VentasMovil_MM-AAAA.xlsx"
                            : esVentas
                              ? "CP_Ventas_MM-AAAA.xlsx"
                              : "CP_Soporte_MM-AAAA.xlsx";

  useEffect(() => {
    if (agentesDesdeApi) setCargandoNomina(false);
  }, [agentesDesdeApi]);

  // Clear CP file/error when the active service changes — the uploaded file
  // may not be valid for the new service, so force re-upload.
  useEffect(() => {
    setArchivoCP(null);
    setHojasCP([]);
    setErrCP("");
    setCpGuardadoData(null);
    setCpGuardadoId(null);
    setCpPeriodoFiltro("");
  }, [selectedServicioKey, setArchivoCP]);

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
      setArchivoCP(null);
      setHojasCP([]);
      setErrCP("");
      setCpGuardadoData(null);
      setCpGuardadoId(null);
      setCpPeriodoFiltro("");
      setReductoresPreview([]);
      setReductoresManual([]);
      // Reset nomina from API when service changes
      clearAgentesDesdeApi();
      setIslaFiltro(null);
    },
    [selectedServicioKey, setSelectedServicioKey, setArchivoCP, clearAgentesDesdeApi]
  );

  const handleCP = useCallback(async (file: File, buffer: ArrayBuffer) => {
    setLoadingCP(true);
    setErrCP("");
    try {
      const hojas = esPersonalPay
        ? getSheetNamesPpay(buffer)
        : esSmb
          ? getSheetNamesSmb(buffer)
          : esOnboarding
            ? getSheetNamesOnb(buffer)
          : getSheetNames(buffer);
      const errValidacion = esPersonalPay
        ? validarHojasCPPpay(hojas)
        : esSmb
          ? validarHojasCPSmb(hojas)
          : esOnboarding
            ? validarHojasCPOnb(hojas)
          : esVentas
            ? validarHojasCPVentas(hojas)
          : validarHojasCP(hojas);
      // Hoja de isla faltante: no bloquea la carga del archivo, se avisa recién
      // al procesar (mismo criterio que en handleProcesar).
      const errValidacionBloqueantes = errValidacion.filter(
        (e) => !e.startsWith("Falta la hoja del servicio")
      );
      if (errValidacionBloqueantes.length > 0) { setErrCP(errValidacionBloqueantes.join(" - ")); return; }
      setHojasCP(hojas);
      setArchivoCP(archivoEnMemoria(file, buffer));
      setCpGuardadoData(null);
      setCpGuardadoId(null);
      // Un CP nuevo puede traer un set de servicios distinto al anterior —
      // no dejar pisadas las filas manuales precargadas para el CP viejo.
      setReductoresManual([]);
    } catch (e) {
      setErrCP(`Error al leer el archivo: ${e}`);
    } finally {
      setLoadingCP(false);
    }
  }, [esPersonalPay, esSmb, esOnboarding, esVentas, setArchivoCP]);

  const handleReductores = useCallback(async (file: File, buffer: ArrayBuffer) => {
    setLoadingRed(true);
    setErrRed("");
    setReductoresCalculados(null);
    setReductoresPreview([]);
    try {
      const { reductores, errores: err } = parseReductores(buffer);
      if (err.length > 0) { setErrRed(err.join(" - ")); return; }
      setReductoresPreview(reductores);
      setArchivoReductores(archivoEnMemoria(file, buffer));
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
      setErrRed("Subi los archivos de deslogueo, ausentismo y rotacion.");
      return;
    }
    setCalculandoReductores(true);
    setErrRed("");
    setReductoresPreview([]);
    try {
      const result = await calcularReductoresDesdeArchivos({ deslogueo, ausentismo, rotacion });
      if (result.errores.length > 0) { setErrRed(result.errores.join(" - ")); return; }
      setArchivoReductores(result.file);
      setReductoresPreview(result.reductores);
      setReductoresCalculados(result.reductores.length);
    } catch (e) {
      setErrRed(`Error al calcular reductores: ${String(e)}`);
    } finally {
      setCalculandoReductores(false);
    }
  }, [fuentesReductores, setArchivoReductores]);

  const handleUsarReductorGuardado = useCallback(() => {
    if (!reductorGuardadoDetalle?.servicios) return;
    const reductores: Reductor[] = reductorGuardadoDetalle.servicios.map((s) => ({
      servicio: s.servicio,
      servicioNorm: s.servicio_norm,
      deslogueo: s.deslogueo,
      ausentismo: s.ausentismo,
      rotacion: s.rotacion,
    }));
    const nombreArchivo = reductorGuardadoDetalle.archivo_nombre || `reductores-${reductorGuardadoDetalle.mes}-${reductorGuardadoDetalle.anio}.xlsx`;
    const file = reductoresAFile(reductores, nombreArchivo);
    setArchivoReductores(file);
    setReductoresPreview(reductores);
    toast.success("Reductores guardados listos para usar");
  }, [reductorGuardadoDetalle, setArchivoReductores]);

  const handleAbrirReductoresManual = useCallback(() => {
    setModoCargaReductores("manual");
    setErrRed("");
  }, []);

  // Mantiene las filas de "Manual" sincronizadas con los servicios que
  // realmente aparecen en el CP (Requerido) ya subido — no un grupo entero de
  // config que puede no coincidir con lo que trae el archivo. Corre cada vez
  // que cambia el CP (nuevo archivo, distinto formato), no solo la primera
  // vez que se abre la pestaña, así no queda una lista vieja pegada si el CP
  // se sube despues de haber entrado a Manual. Conserva los valores ya
  // tipeados para los servicios que siguen coincidiendo.
  useEffect(() => {
    if (serviciosDelCP.length === 0) return;
    setReductoresManual((prev) => {
      const prevPorNorm = new Map(prev.map((f) => [f.servicioNorm, f]));
      return serviciosDelCP.map((def) => {
        const nombre = def.reductorNombres[0] ?? def.label;
        const norm = normalizar(nombre);
        return (
          prevPorNorm.get(norm) ?? {
            servicio: nombre,
            servicioNorm: norm,
            deslogueoPct: 0,
            ausentismoPct: 0,
            rotacionPct: 0,
          }
        );
      });
    });
  }, [serviciosDelCP]);

  const handleAgregarFilaManual = useCallback(() => {
    setReductoresManual((prev) => [
      ...prev,
      { servicio: "", servicioNorm: "", deslogueoPct: 0, ausentismoPct: 0, rotacionPct: 0 },
    ]);
  }, []);

  const handleQuitarFilaManual = useCallback((idx: number) => {
    setReductoresManual((prev) => prev.filter((_, i) => i !== idx));
  }, []);

  const handleEditarFilaManual = useCallback(
    (idx: number, campo: keyof FilaReductorManual, valor: string) => {
      setReductoresManual((prev) =>
        prev.map((fila, i) => {
          if (i !== idx) return fila;
          if (campo === "servicio") return { ...fila, servicio: valor, servicioNorm: normalizar(valor) };
          // parseFloat("1,2") da 1 (corta en la coma) sin avisar — acepta coma
          // o punto como separador decimal antes de parsear.
          const num = parseFloat(valor.replace(",", "."));
          return { ...fila, [campo]: isNaN(num) ? 0 : num };
        })
      );
    },
    []
  );

  const handleUsarReductoresManual = useCallback(() => {
    const filasValidas = reductoresManual.filter((f) => f.servicio.trim());
    if (filasValidas.length === 0) {
      setErrRed("Agregá al menos un servicio con nombre antes de usar estos reductores.");
      return;
    }
    const reductores: Reductor[] = filasValidas.map((f) => ({
      servicio: f.servicio.trim(),
      servicioNorm: normalizar(f.servicio),
      deslogueo: f.deslogueoPct / 100,
      ausentismo: f.ausentismoPct / 100,
      rotacion: f.rotacionPct / 100,
    }));
    const file = reductoresAFile(reductores, `reductores-manual-${reqMes}-${reqAnio}.xlsx`);
    setArchivoReductores(file);
    setReductoresPreview(reductores);
    setErrRed("");
    toast.success("Reductores manuales listos para usar");
  }, [reductoresManual, reqMes, reqAnio, setArchivoReductores]);

  const handleGuardarReductoresActuales = useCallback(() => {
    if (reductoresPreview.length === 0) return;
    guardarReductoresMut.mutate({
      mes: reqMes,
      anio: reqAnio,
      nombre: nombreGuardado.trim() || undefined,
      archivo_nombre: archivoReductores?.name,
      servicios: reductoresPreview,
    });
  }, [reductoresPreview, reqMes, reqAnio, nombreGuardado, archivoReductores, guardarReductoresMut]);

  const handleNomina = useCallback(async (file: File, buffer: ArrayBuffer) => {
    setLoadingNom(true);
    setErrNom("");
    try {
      const hojas = getNominasSheetNames(buffer);
      if (hojas.length === 0) { setErrNom("El archivo de nomina no tiene hojas"); return; }
      setArchivoNomina(archivoEnMemoria(file, buffer), hojas);
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

  const handleCargarNominaDesdeApi = useCallback(async (nomina: NominaMensual) => {
    setCargandoNominaId(nomina.id);
    try {
      const { data: raw } = await nominasApi.agentes(nomina.id);
      const agentes: Agente[] = (raw as AgenteNominaMensual[]).map((a) => {
        const hsSemanal = extraerHorasContrato(a.contrato ?? "");
        const { entry, exit } = parsearHorario(a.horarios ?? "");
        const segmentoNorm =
          resolverServicioPorSegmentoRuntime(a.segmento ?? "") ?? (a.segmento ?? "");
        return {
          dni: a.dni,
          nombre: a.nombre,
          usuario: a.usuario,
          segmento: a.segmento ?? "",
          segmentoNorm,
          estado: a.estado ?? "ACTIVO",
          hsSemanal,
          hsMensualBrutas: 0,
          entryTime: entry,
          exitTime: exit,
          sitio: a.sitio ?? "",
          modalidad: a.modalidad ?? "",
          jefe: a.jefe ?? "",
          superior: a.superior ?? "",
          fechaInicioAtencion: null,
          esCapa: false,
        };
      });
      setAgentesDesdeApi(agentes, nomina.mes, nomina.anio);
      setIslaFiltro(null);
    } catch {
      toast.error("No se pudo cargar la nómina");
    } finally {
      setCargandoNominaId(null);
    }
  }, [setAgentesDesdeApi]);

  const handleProcesar = useCallback(async () => {
    if (!servicioActivo) {
      toast.error("Selecciona un servicio antes de procesar.", { duration: 3500 });
      return;
    }
    const nominaDesdeApi = !!agentesDesdeApi;
    const nominaDesdeArchivo = !!(archivoNomina && hojaNomina);
    if ((!archivoCP && !cpGuardadoData) || !archivoReductores || (!nominaDesdeApi && !nominaDesdeArchivo)) return;

    setProcesandoLocal(true);
    setProcesando(true);
    setErrores([]);
    setPasoActual("Leyendo archivos...");

    try {
      const otrosBuffers = nominaDesdeApi
        ? await Promise.all([archivoReductores.arrayBuffer()])
        : await Promise.all([archivoReductores.arrayBuffer(), archivoNomina!.arrayBuffer()]);
      const bufCP = archivoCP ? await archivoCP.arrayBuffer() : null;
      const [bufRed, bufNomina] = otrosBuffers;

      setPasoActual("Procesando requerido del cliente...");
      const { matrices, diasDelMes, errores: errCP2 } = cpGuardadoData
        ? { matrices: cpGuardadoData.matrices, diasDelMes: cpGuardadoData.diasDelMes, errores: [] as string[] }
        : esPersonalPay
          ? parseCPPpay(bufCP!)
          : esSmb
            ? parseCPSmb(bufCP!)
            : esOnboarding
              ? parseCPOnb(bufCP!)
            : esVentas
              ? parseCPVentas(bufCP!)
            : parseCP(bufCP!);

      setPasoActual("Procesando reductores y nomina...");
      const { reductores, errores: errRed2 } = parseReductores(bufRed);

      let agentesRaw = agentesFiltradosPorIsla ?? [];
      let excl = 0;
      let segs: string[] = [];
      const errNom2: string[] = [];

      if (!nominaDesdeApi) {
        const result = parseNomina(bufNomina!, hojaNomina!, mappingOverrides);
        agentesRaw = result.agentes;
        excl = result.agentesExcluidos;
        segs = result.segmentosNoReconocidos;
        errNom2.push(...result.errores);
      }

      // Hoja de isla faltante en el CP: no bloquea el procesamiento, esa isla
      // queda con 0 hs requeridas y se avisa por toast (a diferencia de otros
      // errores del CP, que sí indican un archivo mal formado).
      const avisosCPIslaFaltante = errCP2.filter((e) => e.startsWith("Falta la hoja del servicio"));
      const errCP2Bloqueantes = errCP2.filter((e) => !e.startsWith("Falta la hoja del servicio"));

      const todosErrores = [...errCP2Bloqueantes, ...errRed2, ...errNom2];
      if (todosErrores.length > 0) { setErrores(todosErrores); return; }

      setPasoActual("Descontando vacaciones...");
      let vacacionesRaw: Awaited<ReturnType<typeof vacacionesApi.list>>["data"] = [];
      const primeraMatriz = matrices.values().next().value;
      const primerDia = primeraMatriz?.dias[0]?.fecha;
      const ultimoDia = primeraMatriz?.dias[primeraMatriz.dias.length - 1]?.fecha;
      if (primerDia && ultimoDia) {
        try {
          const { data } = await vacacionesApi.list({
            desde: primerDia.toISOString().slice(0, 10),
            hasta: ultimoDia.toISOString().slice(0, 10),
          });
          vacacionesRaw = data;
        } catch {
          // No bloqueante: si falla la consulta, se procesa sin descuento de vacaciones.
        }
      }

      setPasoActual("Buscando francos reales...");
      let francosServicio: FrancoServicioDatos[] = [];
      if (primerDia) {
        try {
          // primerDia viene de serialToDate() en UTC medianoche; con getMonth()/
          // getFullYear() locales el dia 1 se corre a fin del mes anterior en
          // timezones detras de UTC (Argentina, UTC-3), y el match de mes/anio
          // contra los Francos importados fallaba siempre en el dia 1.
          const mesReal = primerDia.getUTCMonth() + 1;
          const anioReal = primerDia.getUTCFullYear();
          const { data: importacionesFrancos } = await francoImportacionesApi.list();
          const match = importacionesFrancos
            .filter((f) => f.mes === mesReal && f.anio === anioReal)
            .sort((a, b) => new Date(b.fecha_importacion).getTime() - new Date(a.fecha_importacion).getTime())[0];
          if (match) {
            const { data: detalleFrancos } = await francoImportacionesApi.get(match.id);
            francosServicio = (detalleFrancos.servicios ?? []).map((s) => ({
              servicio: s.servicio,
              servicioNorm: s.servicio_norm,
              dotacion: s.dotacion,
              ponderadoHoras: s.ponderado_horas,
              ponderadoDias: s.ponderado_dias,
              francoLunes: s.franco_lunes,
              francoMartes: s.franco_martes,
              francoMiercoles: s.franco_miercoles,
              francoJueves: s.franco_jueves,
              francoViernes: s.franco_viernes,
              francoSabado: s.franco_sabado,
              francoDomingo: s.franco_domingo,
            }));
          }
        } catch (err) {
          console.error("Error al buscar francos reales, se usa el calculo plano:", err);
        }
      }

      setPasoActual("Calculando cumplimiento...");
      const paseMap = new Map(pases.map((p) => [p.dni.trim().toLowerCase(), p.servicioDestino]));
      const agentesConPases = agentesRaw.map((a) => {
        const dest = paseMap.get(a.dni.trim().toLowerCase());
        return dest ? { ...a, segmentoNorm: dest } : a;
      });
      const hipoteticos = expandirAgentesHipoteticos(agentesHipoteticos);
      const agentesPreVacaciones = [...agentesConPases, ...hipoteticos];

      // Servicios con Franco real (dia a dia): la vacacion puntual se aplica
      // exacta esos dias (mas abajo, via calcularResultados), no prorrateada
      // en todo el mes — se excluyen aca para no descontarla dos veces.
      const serviciosDiaADia = resolverServiciosDiaADia(francosServicio);
      const dnisDiaADia = new Set(
        agentesPreVacaciones
          .filter((a) => serviciosDiaADia.has(a.segmentoNorm as ServicioKey))
          .map((a) => normalizarDni(a.dni))
      );
      const vacacionesParaProrrateo = vacacionesRaw.filter((v) => !dnisDiaADia.has(normalizarDni(v.agente_dni)));
      const vacacionesParaDiaADia = vacacionesRaw.filter((v) => dnisDiaADia.has(normalizarDni(v.agente_dni)));
      const vacacionesPorDni = primerDia && ultimoDia
        ? construirVacacionesPorDni(vacacionesParaProrrateo, primerDia, ultimoDia)
        : undefined;

      const agentes = aplicarDiasAlMes(agentesPreVacaciones, diasDelMes, vacacionesPorDni);
      const resultado = calcularResultados(agentes, matrices, reductores, diasDelMes, modoReductor, topeFacturacion, francosServicio, vacacionesParaDiaADia);

      setPasoActual("Generando alertas...");
      const alertas = generarAlertas(resultado);

      setMatrices(matrices);
      setAgentes(agentes);
      setReductores(reductores);
      setFrancosServicio(francosServicio);
      setDiasDelMes(diasDelMes);
      setResultado(resultado);
      setAlertas(alertas);
      setAgentesExcluidos(excl, segs);
      setServicioActivo(selectedServicioKey, servicioActivo.nombre);
      clearFilters();

      const nIslas = resultado.resultados.filter((r) => r.hcActivos > 0).length;
      toast.success(
        `${agentes.length} agentes - ${nIslas} isla${nIslas !== 1 ? "s" : ""} - ${resultado.cumplimientoTotal.toFixed(1)}% cumpl.`,
        { duration: 4000 }
      );
      if (segs.length > 0) {
        toast(`${segs.length} segmento${segs.length > 1 ? "s" : ""} sin mapear - revisa el mapeo`, {
          icon: "!",
          duration: 6000,
        });
      }
      if (avisosCPIslaFaltante.length > 0) {
        const islas = avisosCPIslaFaltante.map((e) => e.match(/servicio '([^']+)'/)?.[1] ?? e);
        toast(`Sin requerido este mes para: ${islas.join(", ")} (se procesó igual, con 0 hs requeridas)`, {
          icon: "!",
          duration: 8000,
        });
      }

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
    agentesDesdeApi, agentesFiltradosPorIsla, archivoCP, cpGuardadoData, archivoReductores, archivoNomina,
    hojaNomina, modoReductor, topeFacturacion, mappingOverrides, pases, agentesHipoteticos,
    setResultado, setMatrices, setAgentes, setReductores, setFrancosServicio, setDiasDelMes,
    setAlertas, setProcesando, setErrores, setAgentesExcluidos, clearFilters, router,
    esPersonalPay, esSmb, esOnboarding, esVentas, servicioActivo,
    setServicioActivo, selectedServicioKey,
  ]);
  const currentUser = useAuthStore((s) => s.user);
  const readOnly = isReadOnly(currentUser?.rol);

  const nominaLista = !!agentesDesdeApi || !!(archivoNomina && hojaNomina);
  const cpListo = !!archivoCP || !!cpGuardadoData;
  const listo = !!(cpListo && archivoReductores && nominaLista) && !procesandoLocal && !readOnly;

  const stepDot = (done: boolean, color: string, n: number) => (
    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ring-4 ring-white transition-colors ${done ? `${color} text-white shadow-sm` : "bg-slate-100 text-slate-400"}`}>
      {done ? "OK" : n}
    </div>
  );

  const cardHeader = (
    icon: React.ReactNode,
    title: string,
    done: boolean,
    n: number,
    iconBg: string,
    dotColor: string
  ) => (
    <div className="flex items-center justify-between gap-2 pt-1">
      <div className="flex items-center gap-2.5">
        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
          {icon}
        </div>
        <p className="text-sm font-bold text-slate-800 leading-tight">{title}</p>
      </div>
      {stepDot(done, dotColor, n)}
    </div>
  );

  const fmtReductorPct = (value: number) => `${(value * 100).toFixed(1)}%`;

  return (
    <div className="min-h-full bg-slate-50 px-4 py-5 sm:px-6">
      <motion.div {...fade} className="mx-auto max-w-6xl space-y-5">

        {/* Header */}
        <div className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white/95 px-5 py-4 shadow-sm shadow-slate-200/60 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0054A6]/10">
              <Layers className="h-5 w-5 text-[#0054A6]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 leading-tight">Carga de archivos</h2>
              <p className="text-xs text-slate-400 mt-0.5">Procesamiento local · los datos no salen del navegador</p>
            </div>
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
            {/* Mini stepper */}
            <div className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 sm:flex">
              {stepDot(cpListo, "bg-blue-500", 1)}
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
        </div>

        {/* Selector de servicio */}
        {serviciosNomina && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-sm shadow-slate-200/60">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200 shadow-sm">
                  <Settings2 className="h-4 w-4 text-slate-500" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Servicio</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {servicioActivo
                      ? `Editando: ${servicioActivo.nombre}`
                      : "Selecciona el servicio antes de cargar los archivos"}
                  </p>
                </div>
              </div>
              {servicioActivo && (
                <button
                  onClick={() => setSelectedServicioKey(null)}
                  className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-white hover:text-slate-700"
                >
                  <RotateCcw className="h-3 w-3" />
                  Limpiar
                </button>
              )}
            </div>
            <div className="p-4">
              <Select
                value={reqServicioId !== null ? String(reqServicioId) : ""}
                onValueChange={(v) => handleServicioSelect(Number(v))}
              >
                <SelectTrigger className="h-10 w-full text-xs font-semibold sm:w-80">
                  <SelectValue placeholder="Selecciona un servicio..." />
                </SelectTrigger>
                <SelectContent>
                  {serviciosFiltrados.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* Read-only notice */}
        {readOnly && (
          <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-xs font-medium text-amber-700">
              Tu perfil es <strong>Visualizador</strong> - podes ver los resultados de la planificacion
              pero no cargar archivos ni ejecutar calculos.
            </p>
          </div>
        )}

        {/* Step cards */}
        <div className={`grid grid-cols-1 gap-4 md:grid-cols-3 ${readOnly ? "pointer-events-none opacity-50 select-none" : ""}`}>

          {/* Card 1 - CP */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-sm shadow-slate-200/70">
            <div className="absolute top-0 left-0 right-0 h-1 bg-blue-500" />
            <div className="flex min-h-[300px] flex-col gap-3.5 p-4">
              {cardHeader(
                <ClipboardList className="h-4 w-4 text-blue-600" />,
                "Requerido del cliente",
                cpListo,
                1,
                "bg-blue-50",
                "bg-blue-500"
              )}
              <div className="flex gap-1 rounded-lg bg-slate-100 p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setModoCP("archivo")}
                  className={`flex-1 rounded-md py-1.5 transition-colors ${modoCP === "archivo" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                >
                  Subir archivo
                </button>
                <button
                  type="button"
                  onClick={() => setModoCP("guardado")}
                  className={`flex-1 rounded-md py-1.5 transition-colors ${modoCP === "guardado" ? "bg-white text-slate-800 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                >
                  CP guardado
                </button>
              </div>

              {modoCP === "archivo" ? (
                <>
                  <DropZone
                    label={cpDropzoneLabel}
                    onFile={handleCP}
                    hasFile={!!archivoCP}
                    fileName={archivoCP?.name}
                    error={errCP}
                    loading={loadingCP}
                    accepted=".xlsx,.xls"
                    disabled={!servicioActivo}
                    disabledMessage="Elegí un servicio arriba primero"
                  />
                  {archivoCP && (
                    <FilePreview nombre={archivoCP.name} tamanio={archivoCP.size} hojas={hojasCP} />
                  )}
                </>
              ) : (
                <div className="flex flex-1 flex-col gap-2">
                  {periodosCPDisponibles.length > 1 && (
                    <Select value={cpPeriodoFiltro || "__todos"} onValueChange={(v) => setCpPeriodoFiltro(v === "__todos" ? "" : v)}>
                      <SelectTrigger className="h-8 w-full text-xs"><SelectValue placeholder="Mes" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__todos">Todos los meses</SelectItem>
                        {periodosCPDisponibles.map(([key, { mes, anio }]) => (
                          <SelectItem key={key} value={key}>{MESES[mes - 1]} {anio}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {loadingCpsGuardados ? (
                    <div className="flex flex-1 items-center justify-center py-6">
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    </div>
                  ) : cpsGuardadosDelFormato.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-200 py-6 text-center">
                      <p className="text-xs text-slate-400">No hay CPs guardados que contengan este servicio</p>
                      <Link href="/planificacion/cp" className="text-[11px] font-semibold text-[#0054A6] hover:underline">
                        Cargar uno →
                      </Link>
                    </div>
                  ) : cpsGuardadosFiltrados.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-200 py-6 text-center">
                      <p className="text-xs text-slate-400">Ningún CP para ese mes</p>
                    </div>
                  ) : (
                    <div className="flex max-h-48 flex-col gap-1.5 overflow-y-auto">
                      {cpsGuardadosFiltrados.map((cp) => {
                        const nombresServicios = (cp.servicios ?? []).map((s) => s.servicio).join(", ");
                        return (
                          <button
                            key={cp.id}
                            type="button"
                            onClick={() => handleUsarCpGuardado(cp.id)}
                            disabled={loadingCP}
                            className={`flex flex-col gap-0.5 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${
                              cpGuardadoId === cp.id
                                ? "border-[#0054A6] bg-[#0054A6]/5"
                                : "border-slate-200 hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="min-w-0 truncate font-semibold text-slate-700">
                                {MESES[cp.mes - 1]} {cp.anio}
                              </span>
                              <span className="shrink-0 text-[11px] text-slate-400">{cp._count?.servicios ?? 0} servicios</span>
                            </div>
                            {nombresServicios && (
                              <span className="truncate text-[11px] text-[#0054A6]">{nombresServicios}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {errCP && <p className="text-[11px] text-red-500 leading-relaxed">{errCP}</p>}
                  {cpGuardadoData && (
                    <p className="text-[11px] text-emerald-600 font-medium">
                      Usando: {cpGuardadoData.label} ({cpGuardadoData.servicioKeys.length} servicios)
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* Card 2 - Reductores */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-sm shadow-slate-200/70">
            <div className="absolute top-0 left-0 right-0 h-1 bg-purple-500" />
            <div className="flex min-h-[300px] flex-col gap-3.5 p-4">
              {cardHeader(
                <SlidersHorizontal className="h-4 w-4 text-purple-600" />,
                "Reductores operativos",
                !!archivoReductores,
                2,
                "bg-purple-50",
                "bg-purple-500"
              )}

              <div className="grid grid-cols-4 gap-1 rounded-xl border border-slate-200 bg-slate-100/80 p-1">
                {([
                  ["archivo", "Cargar"],
                  ["manual", "Manual"],
                  ["calculadora", "Calculadora"],
                  ["guardado", "Guardados"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      if (value === "manual") { handleAbrirReductoresManual(); return; }
                      setModoCargaReductores(value);
                      setErrRed("");
                    }}
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
              ) : modoCargaReductores === "manual" ? (
                <div className="space-y-2">
                  <div className="max-h-48 space-y-1.5 overflow-auto pr-1">
                    {reductoresManual.length === 0 ? (
                      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                        {hojasCP.length === 0
                          ? "Subí primero el Requerido del cliente (CP) para precargar los servicios que trae, o agregá uno manualmente."
                          : "El CP subido no matcheó ningún servicio conocido. Agregá una fila manualmente."}
                      </p>
                    ) : (
                      reductoresManual.map((fila, idx) => (
                        <div key={idx} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                          <div className="mb-1.5 flex items-center gap-1.5">
                            <input
                              type="text"
                              placeholder="Nombre del servicio"
                              value={fila.servicio}
                              onChange={(e) => handleEditarFilaManual(idx, "servicio", e.target.value)}
                              className="h-7 flex-1 min-w-0 rounded border border-slate-200 px-1.5 text-[11px] font-bold text-slate-700 outline-none focus:border-[#0054A6]"
                            />
                            <button
                              type="button"
                              onClick={() => handleQuitarFilaManual(idx)}
                              className="shrink-0 text-slate-300 transition-colors hover:text-red-500"
                              title="Quitar fila"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="grid grid-cols-3 gap-1.5">
                            {([
                              ["deslogueoPct", "Desl. %"],
                              ["ausentismoPct", "Aus. %"],
                              ["rotacionPct", "Rot. %"],
                            ] as const).map(([campo, label]) => (
                              <label key={campo} className="flex flex-col gap-0.5">
                                <span className="text-[9px] uppercase text-slate-400">{label}</span>
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  value={fila[campo]}
                                  onChange={(e) => handleEditarFilaManual(idx, campo, e.target.value)}
                                  className="h-7 rounded border border-slate-200 px-1.5 text-[11px] outline-none focus:border-[#0054A6]"
                                />
                              </label>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleAgregarFilaManual}
                    className="flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 text-[11px] font-semibold text-slate-500 transition-colors hover:border-[#0054A6]/50 hover:text-[#0054A6]"
                  >
                    <Plus className="h-3.5 w-3.5" />Agregar servicio
                  </button>
                  {errRed && <p className="text-xs text-red-500 leading-relaxed">{errRed}</p>}
                  <button
                    type="button"
                    onClick={handleUsarReductoresManual}
                    disabled={reductoresManual.every((f) => !f.servicio.trim())}
                    className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-purple-600 text-xs font-semibold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />Usar estos reductores
                  </button>
                </div>
              ) : modoCargaReductores === "calculadora" ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-1 gap-2">
                    <DropZone label="Deslogueo operativo" sublabel="ultimos 3 meses" onFile={handleFuenteReductor("deslogueo")} hasFile={!!fuentesReductores.deslogueo} fileName={fuentesReductores.deslogueo?.file.name} />
                    <DropZone label="Ausentismo sin LP" sublabel="ultimos 3 meses" onFile={handleFuenteReductor("ausentismo")} hasFile={!!fuentesReductores.ausentismo} fileName={fuentesReductores.ausentismo?.file.name} />
                    <DropZone label="Rotacion" sublabel="ultimos 3 meses" onFile={handleFuenteReductor("rotacion")} hasFile={!!fuentesReductores.rotacion} fileName={fuentesReductores.rotacion?.file.name} />
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
              ) : (
                <div className="space-y-2.5">
                  {loadingReductoresGuardados ? (
                    <div className="flex items-center justify-center py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    </div>
                  ) : reductoresGuardados.length === 0 ? (
                    <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
                      Todavía no guardaste ningún set de reductores.
                    </p>
                  ) : (
                    <div className="max-h-48 space-y-1.5 overflow-auto pr-1">
                      {reductoresGuardados.map((rg) => {
                        const isActive = reductorGuardadoId === rg.id;
                        return (
                          <div
                            key={rg.id}
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                              isActive ? "border-[#0054A6]/50 bg-blue-50/40" : "border-slate-200 bg-white hover:border-[#0054A6]/30"
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => setReductorGuardadoId(rg.id)}
                              className="flex flex-1 items-center gap-2.5 text-left min-w-0"
                            >
                              <FolderOpen className="h-3.5 w-3.5 shrink-0 text-[#0054A6]" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-700 truncate">
                                  {rg.nombre || `${MESES[rg.mes - 1]} ${rg.anio}`}
                                </p>
                                <p className="text-[10px] text-slate-400 truncate">
                                  {MESES[rg.mes - 1]} {rg.anio} · {rg._count?.servicios ?? 0} servicios
                                  {rg.archivo_nombre ? ` · ${rg.archivo_nombre}` : ""}
                                </p>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteReductorGuardadoId(rg.id)}
                              className="shrink-0 text-slate-300 transition-colors hover:text-red-500"
                              title="Eliminar"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {reductorGuardadoId !== null && (() => {
                    const impId = reductorGuardadoId;
                    return (
                      <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                        {loadingReductorGuardadoDetalle ? (
                          <div className="flex items-center justify-center py-3">
                            <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                          </div>
                        ) : reductorGuardadoDetalle?.servicios ? (
                          <>
                            <div className="max-h-48 space-y-1.5 overflow-auto pr-1">
                              {reductorGuardadoDetalle.servicios.map((s) => (
                                <div key={s.id} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                                  <p className="mb-1 truncate text-[11px] font-bold text-slate-700">{s.servicio}</p>
                                  <div className="grid grid-cols-3 gap-1.5">
                                    {(["deslogueo", "ausentismo", "rotacion"] as const).map((campo) => (
                                      <label key={campo} className="flex flex-col gap-0.5">
                                        <span className="text-[9px] uppercase text-slate-400">{campo.slice(0, 4)}</span>
                                        <input
                                          type="number"
                                          step="0.1"
                                          defaultValue={s[campo]}
                                          onBlur={(e) => {
                                            const val = parseFloat(e.target.value);
                                            if (!isNaN(val) && val !== s[campo]) {
                                              actualizarServicioGuardadoMut.mutate({ id: impId, servicioId: s.id, data: { [campo]: val } });
                                            }
                                          }}
                                          className="h-7 rounded border border-slate-200 px-1.5 text-[11px] outline-none focus:border-[#0054A6]"
                                        />
                                      </label>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                            <button
                              type="button"
                              onClick={handleUsarReductorGuardado}
                              className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-purple-600 text-xs font-semibold text-white transition-colors hover:bg-purple-700"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />Usar estos reductores
                            </button>
                          </>
                        ) : null}
                      </div>
                    );
                  })()}
                </div>
              )}
              {modoCargaReductores !== "guardado" && reductoresPreview.length > 0 && (
                <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5">
                  {showGuardarInput ? (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Nombre (opcional)"
                        value={nombreGuardado}
                        onChange={(e) => setNombreGuardado(e.target.value)}
                        className="h-8 flex-1 rounded-lg border border-slate-200 px-2.5 text-[11px] outline-none focus:border-[#0054A6]"
                      />
                      <button
                        type="button"
                        onClick={handleGuardarReductoresActuales}
                        disabled={guardarReductoresMut.isPending}
                        className="flex h-8 items-center gap-1.5 rounded-lg bg-[#0054A6] px-3 text-[11px] font-semibold text-white transition-colors hover:bg-[#00449A] disabled:opacity-50"
                      >
                        {guardarReductoresMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                        Guardar
                      </button>
                      <button type="button" onClick={() => setShowGuardarInput(false)} className="text-slate-400 hover:text-slate-600">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowGuardarInput(true)}
                      className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 text-[11px] font-semibold text-slate-500 transition-colors hover:border-[#0054A6]/50 hover:text-[#0054A6]"
                    >
                      <Save className="h-3.5 w-3.5" />Guardar para reutilizar
                    </button>
                  )}
                </div>
              )}
              {archivoReductores && (
                <FilePreview nombre={archivoReductores.name} tamanio={archivoReductores.size} />
              )}
              {archivoReductores && reductoresUtilizados.length > 0 && (
                <div
                  key={`reductores-${selectedServicioKey ?? "none"}-${reductoresUtilizados.map((r) => r.servicioKey).join("-")}`}
                  className="rounded-xl border border-purple-100 bg-purple-50/60 p-3"
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-purple-700">
                      Reductores a usar
                    </p>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-purple-600">
                      {reductoresUtilizados.length}
                    </span>
                  </div>
                  <div className="max-h-40 space-y-1.5 overflow-auto pr-1">
                    {reductoresUtilizados.map((r, i) => {
                      const total = r.deslogueo + r.ausentismo + r.rotacion;
                      return (
                        <div
                          key={`${r.servicioKey}-${r.servicio}-${i}`}
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

          {/* Card 3 - Nomina */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white/95 shadow-sm shadow-slate-200/70">
            <div className={`absolute top-0 left-0 right-0 h-1 ${nominaLista ? "bg-green-500" : "bg-orange-400"}`} />
            <div className="flex min-h-[300px] flex-col gap-3.5 p-4">
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-50">
                    <Users2 className="h-4 w-4 text-green-600" />
                  </div>
                  <p className="text-sm font-bold text-slate-800 leading-tight">Nómina activa</p>
                </div>
                <div className="flex items-center gap-2">
                  {agentesDesdeApi && (
                    <button onClick={() => { clearAgentesDesdeApi(); setIslaFiltro(null); }} className="text-gray-300 hover:text-gray-500 transition-colors" title="Quitar y cargar otra">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {stepDot(nominaLista, "bg-green-500", 3)}
                </div>
              </div>

              {agentesDesdeApi ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2.5 rounded-lg bg-green-50 border border-green-200 px-3 py-2.5">
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    <div>
                      <p className="text-xs font-semibold text-green-800">Cargada desde el sistema</p>
                      <p className="text-[11px] text-green-600 mt-0.5">
                        {agentesFiltradosPorIsla?.length ?? agentesDesdeApi.length} agentes
                        {islaFiltro ? " (isla filtrada)" : ""}
                        {mesDesdeApi && anioDesdeApi ? ` - ${MESES[mesDesdeApi - 1]} ${anioDesdeApi}` : ""}
                      </p>
                    </div>
                  </div>

                  {islasDisponibles.length > 0 && (
                    <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        Elegir isla (opcional)
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          onClick={() => setIslaFiltro(null)}
                          className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
                            !islaFiltro
                              ? "bg-[#0054A6] text-white border-[#0054A6]"
                              : "bg-white text-slate-600 border-slate-200 hover:border-[#0054A6]/50"
                          }`}
                        >
                          Todas ({agentesDesdeApi.length})
                        </button>
                        {islasDisponibles.map((isla) => (
                          <button
                            key={isla.key}
                            onClick={() => setIslaFiltro(isla.key)}
                            className={`rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors ${
                              islaFiltro === isla.key
                                ? "bg-[#0054A6] text-white border-[#0054A6]"
                                : "bg-white text-slate-600 border-slate-200 hover:border-[#0054A6]/50"
                            }`}
                          >
                            {isla.label} ({isla.count})
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : serviciosNomina && !useArchivoNomina ? (
                <div className="space-y-2.5">
                  {/* Mes / Anio */}
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
                      {servicioDemoActivo ? " - demo" : ""}
                    </p>
                    </div>
                  ) : (
                    <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700">
                      Selecciona un servicio arriba primero
                    </p>
                  )}

                  {loadingNominas ? (
                    <div className="flex items-center justify-center py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                    </div>
                  ) : nominasDisponibles.length > 0 ? (
                    <div className="space-y-1.5">
                      {nominasDisponibles.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => handleCargarNominaDesdeApi(n)}
                          disabled={cargandoNominaId !== null}
                          className="flex w-full items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:border-[#0054A6]/40 hover:bg-blue-50/40 disabled:opacity-50"
                        >
                          {cargandoNominaId === n.id ? (
                            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#0054A6]" />
                          ) : (
                            <Database className="h-3.5 w-3.5 shrink-0 text-[#0054A6]" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-700 truncate">{n.archivo_nombre ?? n.tipo}</p>
                            <p className="text-[10px] text-slate-400">{n.total_agentes} agentes</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : servicioActivo && !servicioDemoActivo ? (
                    <button
                      onClick={handleSolicitarNomina}
                      disabled={cargandoNomina}
                      className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-[#0054A6] text-xs font-semibold text-white transition-colors hover:bg-[#00449A] disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {cargandoNomina ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" />Cargando…</>
                      ) : (
                        <><Database className="h-3.5 w-3.5" />Cargar desde sistema</>
                      )}
                    </button>
                  ) : null}
                  <button
                    onClick={() => setUseArchivoNomina(true)}
                    className="w-full text-[11px] text-gray-400 hover:text-gray-600 transition-colors text-center"
                  >
                    o subir Excel manualmente
                  </button>

                  <Link
                    href="/planificacion/nomina-general"
                    className="flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 text-[11px] font-semibold text-slate-500 transition-colors hover:border-[#0054A6]/50 hover:text-[#0054A6]"
                    title="Precargar y administrar la nómina de todos los servicios (Nómina General)"
                  >
                    <Upload className="h-3.5 w-3.5" />Precargar nómina de todos los servicios
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {serviciosNomina && (
                    <button
                      onClick={() => setUseArchivoNomina(false)}
                      className="flex items-center gap-1 text-[11px] font-semibold text-[#0054A6] transition-colors hover:text-[#00449A]"
                    >
                      &lt;- Cargar desde sistema
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
                              <SelectValue placeholder="Selecciona una hoja" />
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

              {nominaLista && (
                <div className="mt-1 space-y-2 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-2.5">
                  <div className="flex items-center gap-1.5">
                    <UserPlus className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Agentes hipoteticos (opcional)
                    </p>
                  </div>
                  <p className="text-[10.5px] text-slate-400 leading-snug">
                    Para simular gente que todavia no tiene datos reales (contrataciones, traslados). Cuentan en todo el calculo: curvas, francos y exportaciones.
                  </p>

                  {agentesHipoteticos.length > 0 && (
                    <ul className="space-y-1">
                      {agentesHipoteticos.map((row) => (
                        <li
                          key={row.id}
                          className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-1.5"
                        >
                          <span className="text-[11px] font-medium text-slate-600 truncate">
                            {row.servicioLabel} · {row.cantidad} × {row.contrato}hs
                            {row.horarioDesde && row.horarioHasta ? ` · ${row.horarioDesde}-${row.horarioHasta}` : ""}
                          </span>
                          <button
                            onClick={() => quitarAgenteHipotetico(row.id)}
                            className="text-gray-300 hover:text-red-500 transition-colors shrink-0"
                            title="Quitar"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {showFormHipotetico ? (
                    <div className="space-y-2 rounded-md border border-slate-200 bg-white p-2.5">
                      <Select value={nuevoHipServicio} onValueChange={setNuevoHipServicio}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Servicio" />
                        </SelectTrigger>
                        <SelectContent>
                          {serviciosParaHipoteticos.map((s) => (
                            <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <div className="flex gap-2">
                        <input
                          type="number"
                          min={1}
                          placeholder="Cantidad"
                          value={nuevoHipCantidad}
                          onChange={(e) => setNuevoHipCantidad(e.target.value)}
                          className="h-8 flex-1 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-[#0054A6]"
                        />
                        <Select value={nuevoHipContrato} onValueChange={setNuevoHipContrato}>
                          <SelectTrigger className="h-8 w-24 text-xs">
                            <SelectValue placeholder="Hs" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="30">30hs</SelectItem>
                            <SelectItem value="35">35hs</SelectItem>
                            <SelectItem value="36">36hs</SelectItem>
                            <SelectItem value="40">40hs</SelectItem>
                            <SelectItem value="otro">Otro</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {nuevoHipContrato === "otro" && (
                        <input
                          type="number"
                          min={1}
                          placeholder="Hs semanales"
                          value={nuevoHipContratoCustom}
                          onChange={(e) => setNuevoHipContratoCustom(e.target.value)}
                          className="h-8 w-full rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-[#0054A6]"
                        />
                      )}

                      <div className="flex gap-2">
                        <input
                          type="time"
                          value={nuevoHipDesde}
                          onChange={(e) => setNuevoHipDesde(e.target.value)}
                          className="h-8 flex-1 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-[#0054A6]"
                          title="Horario desde (opcional)"
                        />
                        <input
                          type="time"
                          value={nuevoHipHasta}
                          onChange={(e) => setNuevoHipHasta(e.target.value)}
                          className="h-8 flex-1 rounded-md border border-slate-200 px-2 text-xs outline-none focus:border-[#0054A6]"
                          title="Horario hasta (opcional)"
                        />
                      </div>

                      <div className="flex gap-2 pt-0.5">
                        <button
                          onClick={agregarAgenteHipotetico}
                          className="h-8 flex-1 rounded-md bg-[#0054A6] text-[11px] font-semibold text-white transition-colors hover:bg-[#00449A]"
                        >
                          Agregar
                        </button>
                        <button
                          onClick={() => setShowFormHipotetico(false)}
                          className="h-8 rounded-md border border-slate-200 px-3 text-[11px] font-semibold text-slate-500 transition-colors hover:bg-slate-50"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowFormHipotetico(true)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-slate-300 py-1.5 text-[11px] font-semibold text-slate-500 transition-colors hover:border-[#0054A6]/50 hover:text-[#0054A6]"
                    >
                      <Plus className="h-3.5 w-3.5" /> Agregar agentes hipoteticos
                    </button>
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
              <span className="text-xs font-semibold">Errores de validacion</span>
            </div>
            <ul className="space-y-0.5">
              {errores.map((e, i) => <li key={i} className="text-xs text-red-500">- {e}</li>)}
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
                    {segmentosNoReconocidos.length > 5 && ` y ${segmentosNoReconocidos.length - 5} mas`}.
                    Usa el mapeo de segmentos para incluirlos.
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Action bar */}
        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white/95 px-4 py-3 shadow-lg shadow-slate-200/80 backdrop-blur">
          <div className="hidden flex-col gap-1 sm:flex">
            {servicioActivo && (
              <span className="text-[11px] font-bold text-[#0054A6]">{servicioActivo.nombre}</span>
            )}
            {servicioActivo ? (
              <div className="flex items-center gap-3 text-[11px] font-medium">
                <span className={`flex items-center gap-1.5 ${cpListo ? "text-blue-600" : "text-slate-300"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${cpListo ? "bg-blue-500" : "bg-slate-300"}`} />CP
                </span>
                <span className={`flex items-center gap-1.5 ${archivoReductores ? "text-purple-600" : "text-slate-300"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${archivoReductores ? "bg-purple-500" : "bg-slate-300"}`} />Reductores
                </span>
                <span className={`flex items-center gap-1.5 ${nominaLista ? "text-green-600" : "text-slate-300"}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${nominaLista ? "bg-green-500" : "bg-slate-300"}`} />Nómina
                </span>
              </div>
            ) : (
              <p className="text-[11px] font-medium text-slate-400">Selecciona un servicio para empezar</p>
            )}
          </div>
          <div className="ml-auto flex items-center gap-3">
            {totalHipoteticos > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-blue-50 border border-blue-100 px-2.5 py-1 text-[11px] font-semibold text-[#0054A6]">
                <UserPlus className="h-3 w-3" /> +{totalHipoteticos} agente{totalHipoteticos !== 1 ? "s" : ""} hipotetico{totalHipoteticos !== 1 ? "s" : ""} incluido{totalHipoteticos !== 1 ? "s" : ""}
              </span>
            )}
            {procesandoLocal && pasoActual && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {pasoActual}
              </div>
            )}
            <Button size="lg" onClick={handleProcesar} disabled={!listo} className="min-w-[220px] gap-2 shadow-sm">
              {procesandoLocal ? "Procesando..." : "Procesar y ver resumen"}
              {procesandoLocal ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>

      </motion.div>

      <ConfirmDialog
        isOpen={deleteReductorGuardadoId !== null}
        onClose={() => setDeleteReductorGuardadoId(null)}
        onConfirm={() => deleteReductorGuardadoId && eliminarReductorGuardadoMut.mutate(deleteReductorGuardadoId)}
        title="Eliminar reductores guardados"
        message="¿Seguro querés eliminar este set de reductores? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        loading={eliminarReductorGuardadoMut.isPending}
      />
    </div>
  );
}
