"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Header } from "@/components/Header";
import { usePlaniConfig } from "@/store/usePlaniConfig";
import { useResultados } from "@/store/useResultados";
import { parsearHorario } from "@/lib/parsers/parseNomina";
import { extraerHorasContrato } from "@/lib/utils/excel";
import { resolverServicioPorSegmentoRuntime } from "@/lib/config/servicesRuntime";
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

export function AppShell({ children }: { children: React.ReactNode }) {
  const [embedded, setEmbedded] = useState<boolean | null>(null);
  const setServiciosNomina = usePlaniConfig((s) => s.setServiciosNomina);
  const setAgentesDesdeApi = useResultados((s) => s.setAgentesDesdeApi);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get("embedded") === "1";
    if (fromParam) sessionStorage.setItem("plani_embedded", "1");
    const fromSession = sessionStorage.getItem("plani_embedded") === "1";
    let fromIframe = false;
    try { fromIframe = window.self !== window.top; } catch { fromIframe = true; }
    setEmbedded(fromParam || fromSession || fromIframe);
  }, []);

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
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [setServiciosNomina, setAgentesDesdeApi]);

  if (embedded === null) {
    return <div style={{ visibility: "hidden" }}>{children}</div>;
  }

  if (embedded) {
    return <main className="min-h-screen bg-[#F8F9FA]">{children}</main>;
  }

  return (
    <>
      <Sidebar />
      <Header />
      <main className="ml-56 pt-14 min-h-screen">{children}</main>
    </>
  );
}
