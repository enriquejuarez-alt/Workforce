"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
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

export function PlaniBridge({ children }: { children: React.ReactNode }) {
  const setServiciosNomina = usePlaniConfig((s) => s.setServiciosNomina);
  const setAgentesDesdeApi = useResultados((s) => s.setAgentesDesdeApi);
  const router = useRouter();

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

  return <>{children}</>;
}
