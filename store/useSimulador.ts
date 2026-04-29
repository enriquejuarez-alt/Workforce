"use client";

import { create } from "zustand";
import type { ServicioKey, SimModTipo, SimModificacion } from "@/lib/domain/types";
import { SERVICIOS_KEYS } from "@/lib/domain/types";

function nextModId() {
  return `mod-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Ajustes simples por servicio (modo anterior, para compatibilidad) ──────────

export interface AjusteServicio {
  servicio: ServicioKey;
  hcExtra: number;
  hsSemanalExtra: number;
  deslogueoOverride: number | null;
  ausentismoOverride: number | null;
  rotacionOverride: number | null;
}

function ajustesInicial(): Record<ServicioKey, AjusteServicio> {
  return Object.fromEntries(
    SERVICIOS_KEYS.map((k) => [
      k,
      {
        servicio: k,
        hcExtra: 0,
        hsSemanalExtra: 36,
        deslogueoOverride: null,
        ausentismoOverride: null,
        rotacionOverride: null,
      },
    ])
  ) as Record<ServicioKey, AjusteServicio>;
}

// ─── Store ─────────────────────────────────────────────────────────────────────

interface SimuladorState {
  // Modo simple (sliders por servicio)
  ajustes: Record<ServicioKey, AjusteServicio>;
  setAjuste: (servicio: ServicioKey, patch: Partial<AjusteServicio>) => void;
  resetAjustes: () => void;

  // Punto 5: modificaciones estructuradas (add/remove/move/change_contract/change_reducer)
  modificaciones: SimModificacion[];
  addModificacion: (tipo: SimModTipo, servicio: ServicioKey, params: Partial<Omit<SimModificacion, "id" | "tipo" | "servicio">>) => void;
  removeModificacion: (id: string) => void;
  clearModificaciones: () => void;
}

export const useSimulador = create<SimuladorState>((set) => ({
  ajustes: ajustesInicial(),
  modificaciones: [],

  setAjuste: (servicio, patch) =>
    set((state) => ({
      ajustes: {
        ...state.ajustes,
        [servicio]: { ...state.ajustes[servicio], ...patch },
      },
    })),

  resetAjustes: () =>
    set({ ajustes: ajustesInicial(), modificaciones: [] }),

  addModificacion: (tipo, servicio, params) =>
    set((state) => ({
      modificaciones: [
        ...state.modificaciones,
        { id: nextModId(), tipo, servicio, cantidad: 1, hsSemanal: 36, ...params },
      ],
    })),

  removeModificacion: (id) =>
    set((state) => ({
      modificaciones: state.modificaciones.filter((m) => m.id !== id),
    })),

  clearModificaciones: () => set({ modificaciones: [] }),
}));
