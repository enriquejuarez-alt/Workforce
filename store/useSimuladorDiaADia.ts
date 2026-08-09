"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ServicioKey } from "@/lib/domain/types";

function nextId() {
  return `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export type TipoEventoDotacion = "alta" | "baja" | "cambio_servicio";

export interface EventoDotacion {
  id: string;
  servicio: ServicioKey;
  /** Dia del mes cargado (1-based) en que el evento impacta. */
  dia: number;
  tipo: TipoEventoDotacion;
  cantidad: number;
  /** Solo para cambio_servicio: a donde se van los agentes ese mismo dia. */
  servicioDestino?: ServicioKey;
  nota?: string;
}

interface SimuladorDiaADiaState {
  eventos: EventoDotacion[];
  servicioActivo: ServicioKey | null;

  setServicioActivo: (servicio: ServicioKey | null) => void;
  addEvento: (evento: Omit<EventoDotacion, "id">) => void;
  removeEvento: (id: string) => void;
  clearEventos: (servicio?: ServicioKey) => void;
}

export const useSimuladorDiaADia = create<SimuladorDiaADiaState>()(
  persist(
    (set) => ({
      eventos: [],
      servicioActivo: null,

      setServicioActivo: (servicio) => set({ servicioActivo: servicio }),

      addEvento: (evento) =>
        set((state) => ({
          eventos: [...state.eventos, { id: nextId(), ...evento }],
        })),

      removeEvento: (id) =>
        set((state) => ({ eventos: state.eventos.filter((e) => e.id !== id) })),

      clearEventos: (servicio) =>
        set((state) => ({
          eventos: servicio ? state.eventos.filter((e) => e.servicio !== servicio) : [],
        })),
    }),
    {
      name: "plani-simulador-dia-a-dia",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? sessionStorage : localStorage
      ),
      partialize: (state) => ({
        eventos: state.eventos,
        servicioActivo: state.servicioActivo,
      }),
    }
  )
);

/**
 * Traduce los eventos cargados de un servicio a los mapas de deltas por dia que
 * necesita `calcularHsLogueoDiaADia` (eventosPorDia). Un `cambio_servicio` resta
 * en el servicio origen y suma en el destino, el mismo dia.
 */
export function eventosADeltasPorDia(
  eventos: EventoDotacion[],
  servicio: ServicioKey
): Map<number, number> {
  const deltas = new Map<number, number>();
  const sumar = (dia: number, delta: number) =>
    deltas.set(dia, (deltas.get(dia) ?? 0) + delta);

  for (const ev of eventos) {
    if (ev.servicio === servicio) {
      if (ev.tipo === "alta") sumar(ev.dia, ev.cantidad);
      if (ev.tipo === "baja") sumar(ev.dia, -ev.cantidad);
      if (ev.tipo === "cambio_servicio") sumar(ev.dia, -ev.cantidad);
    }
    if (ev.tipo === "cambio_servicio" && ev.servicioDestino === servicio) {
      sumar(ev.dia, ev.cantidad);
    }
  }
  return deltas;
}
