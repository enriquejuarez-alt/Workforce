"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePlaniConfig } from "@/store/usePlaniConfig";
import { useResultados } from "@/store/useResultados";
import { useAuthStore } from "@/store/auth";
import { useSidebarStore } from "@/store/sidebar";
import HrSidebar from "@/components/hr/Sidebar";
import { parsearHorario } from "@/lib/parsers/parseNomina";
import { extraerHorasContrato } from "@/lib/utils/excel";
import { resolverServicioPorSegmentoRuntime } from "@/lib/config/servicesRuntime";
import { PageLoading } from "@/components/hr/ui/LoadingSpinner";
import { planiApi } from "@/lib/api";
import type { Agente } from "@/lib/domain/types";

interface RawAgentePlani {
  dni: string;
  usuario: string;
  nombre: string;
  superior: string | null;
  segmento: string | null;
  horarios: string | null;
  estado: string | null;
  contrato: string | null;
  sitio: string | null;
  modalidad: string | null;
  jefe: string | null;
  fechaInicioAtencion: string | null;
}

function rawToAgente(raw: RawAgentePlani): Agente {
  const { entry, exit } = parsearHorario(raw.horarios ?? "");
  const segmento = raw.segmento ?? "";
  return {
    dni: raw.dni,
    nombre: raw.nombre,
    usuario: raw.usuario,
    superior: raw.superior ?? "",
    segmento,
    segmentoNorm: resolverServicioPorSegmentoRuntime(segmento) ?? segmento,
    estado: raw.estado ?? "",
    hsSemanal: extraerHorasContrato(raw.contrato ?? ""),
    hsMensualBrutas: 0,
    entryTime: entry,
    exitTime: exit,
    sitio: raw.sitio ?? "",
    modalidad: raw.modalidad ?? "",
    jefe: raw.jefe ?? "",
    fechaInicioAtencion: raw.fechaInicioAtencion,
    esCapa: !!raw.fechaInicioAtencion,
  };
}

export default function PlanificacionLayout({ children }: { children: React.ReactNode }) {
  const [embedded, setEmbedded] = useState(false);
  const [embeddedChecked, setEmbeddedChecked] = useState(false);
  const setServiciosNomina = usePlaniConfig((s) => s.setServiciosNomina);
  const setAgentesDesdeApi = useResultados((s) => s.setAgentesDesdeApi);
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authHydrated = useAuthStore((s) => s.hydrated);
  const hydrateAuth = useAuthStore((s) => s.hydrate);
  const { collapsed } = useSidebarStore();

  useEffect(() => {
    hydrateAuth();
  }, [hydrateAuth]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get("embedded") === "1";
    if (fromParam) sessionStorage.setItem("plani_embedded", "1");
    const fromSession = sessionStorage.getItem("plani_embedded") === "1";
    let fromIframe = false;
    try { fromIframe = window.self !== window.top; } catch { fromIframe = true; }
    if (fromParam || fromSession || fromIframe) setEmbedded(true);
    setEmbeddedChecked(true);
  }, []);

  useEffect(() => {
    if (embeddedChecked && !embedded && authHydrated && !isAuthenticated) {
      router.replace("/login");
    }
  }, [embeddedChecked, embedded, authHydrated, isAuthenticated, router]);

  // En standalone autenticado, cargar servicios desde la API si no llegaron por postMessage
  useEffect(() => {
    if (!embeddedChecked || embedded || !isAuthenticated) return;
    planiApi.getConfig()
      .then((r) => setServiciosNomina(r.data.servicios))
      .catch(() => {});
  }, [embeddedChecked, embedded, isAuthenticated, setServiciosNomina]);

  useEffect(() => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: "PLANI_READY" }, "*");
    }

    function handleMessage(event: MessageEvent) {
      if (event.source !== window.parent) return;
      const data = event.data;
      if (!data || typeof data.type !== "string") return;

      if (data.type === "PLANI_INIT" && Array.isArray(data.servicios)) {
        setServiciosNomina(data.servicios);
      }
      if (data.type === "PLANI_NOMINA" && Array.isArray(data.agentes)) {
        const agentes: Agente[] = (data.agentes as RawAgentePlani[]).map(rawToAgente);
        setAgentesDesdeApi(agentes, data.mes as number, data.anio as number);
      }
      if (data.type === "PLANI_NAVIGATE" && typeof data.path === "string") {
        router.push(data.path);
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [setServiciosNomina, setAgentesDesdeApi, router]);

  // Embedded (iframe): sin sidebar, igual que antes
  if (!embeddedChecked || embedded) {
    return <main className="min-h-screen bg-[#F8F9FA]">{children}</main>;
  }

  if (!authHydrated || !isAuthenticated) return <PageLoading />;

  // Standalone: mismo layout que el resto de la app
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <HrSidebar />
      <div className={`flex-1 flex flex-col overflow-hidden transition-all duration-200 ${collapsed ? 'ml-16' : 'ml-64'}`}>
        <main className="flex-1 overflow-hidden flex flex-col overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
