"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ServicioKey, SimModTipo, SimModificacion } from "@/lib/domain/types";
import { SERVICIOS_KEYS } from "@/lib/domain/types";

function nextId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export interface AjusteServicio {
  servicio: ServicioKey;
  hcExtra: number;
  hsSemanalExtra: number;
  deslogueoOverride: number | null;
  ausentismoOverride: number | null;
  rotacionOverride: number | null;
}

export interface Escenario {
  id: string;
  nombre: string;
  modificaciones: SimModificacion[];
  timestamp: number;
}

export interface PeriodoReplan {
  dia: number;   // 1-31
  mes: number;   // 1-12
  anio: number;
}

export function createAjusteServicio(servicio: ServicioKey): AjusteServicio {
  return {
    servicio,
    hcExtra: 0,
    hsSemanalExtra: 36,
    deslogueoOverride: null,
    ausentismoOverride: null,
    rotacionOverride: null,
  };
}

function ajustesInicial(): Record<ServicioKey, AjusteServicio> {
  return Object.fromEntries(
    SERVICIOS_KEYS.map((k) => [
      k,
      createAjusteServicio(k),
    ])
  ) as Record<ServicioKey, AjusteServicio>;
}

interface SimuladorState {
  ajustes: Record<ServicioKey, AjusteServicio>;
  modificaciones: SimModificacion[];
  escenarios: Escenario[];
  escenarioComparar: string | null;
  periodoDesde: PeriodoReplan | null;
  periodoHasta: PeriodoReplan | null;

  setAjuste: (servicio: ServicioKey, patch: Partial<AjusteServicio>) => void;
  resetAjustes: () => void;
  addModificacion: (tipo: SimModTipo, servicio: ServicioKey, params: Partial<Omit<SimModificacion, "id" | "tipo" | "servicio">>) => void;
  bulkAddModificaciones: (mods: Omit<SimModificacion, "id">[]) => void;
  removeModificacion: (id: string) => void;
  clearModificaciones: () => void;
  setEscenarioComparar: (id: string | null) => void;
  setPeriodoDesde: (p: PeriodoReplan | null) => void;
  setPeriodoHasta: (p: PeriodoReplan | null) => void;

  saveEscenario: (nombre: string) => void;
  loadEscenario: (id: string) => void;
  deleteEscenario: (id: string) => void;
  exportEscenario: (id: string) => string;
  importEscenario: (json: string) => boolean;
}

export const useSimulador = create<SimuladorState>()(
  persist(
  (set, get) => ({
  ajustes: ajustesInicial(),
  modificaciones: [],
  escenarios: [],
  escenarioComparar: null,
  periodoDesde: null,
  periodoHasta: null,

  setAjuste: (servicio, patch) =>
    set((state) => ({
      ajustes: {
        ...state.ajustes,
        [servicio]: { ...(state.ajustes[servicio] ?? createAjusteServicio(servicio)), ...patch },
      },
    })),

  resetAjustes: () => set({ ajustes: ajustesInicial(), modificaciones: [], escenarioComparar: null, periodoDesde: null, periodoHasta: null }),

  addModificacion: (tipo, servicio, params) =>
    set((state) => ({
      modificaciones: [
        ...state.modificaciones,
        { id: nextId("mod"), tipo, servicio, cantidad: 1, hsSemanal: 36, ...params },
      ],
    })),

  bulkAddModificaciones: (mods) =>
    set((state) => ({
      modificaciones: [
        ...state.modificaciones,
        ...mods.map((m) => ({ id: nextId("mod"), ...m })),
      ],
    })),

  removeModificacion: (id) =>
    set((state) => ({ modificaciones: state.modificaciones.filter((m) => m.id !== id) })),

  clearModificaciones: () => set({ modificaciones: [] }),

  setEscenarioComparar: (id) => set({ escenarioComparar: id }),

  setPeriodoDesde: (p) => set({ periodoDesde: p }),
  setPeriodoHasta: (p) => set({ periodoHasta: p }),

  saveEscenario: (nombre) => {
    const { modificaciones } = get();
    set((state) => ({
      escenarios: [
        ...state.escenarios,
        { id: nextId("esc"), nombre, modificaciones: [...modificaciones], timestamp: Date.now() },
      ],
    }));
  },

  loadEscenario: (id) => {
    const { escenarios } = get();
    const esc = escenarios.find((e) => e.id === id);
    if (esc) set({ modificaciones: [...esc.modificaciones] });
  },

  deleteEscenario: (id) =>
    set((state) => ({ escenarios: state.escenarios.filter((e) => e.id !== id) })),

  exportEscenario: (id) => {
    const esc = get().escenarios.find((e) => e.id === id);
    if (!esc) return "";
    return JSON.stringify({ _type: "plani-escenario", version: 1, ...esc }, null, 2);
  },

  importEscenario: (json) => {
    try {
      const data = JSON.parse(json);
      if (data._type !== "plani-escenario" || !Array.isArray(data.modificaciones)) return false;
      set((state) => ({
        escenarios: [
          ...state.escenarios,
          {
            id: nextId("esc"),
            nombre: `${data.nombre} (importado)`,
            modificaciones: data.modificaciones,
            timestamp: Date.now(),
          },
        ],
      }));
      return true;
    } catch {
      return false;
    }
  },
  }),
  {
    name: "plani-simulador",
    storage: createJSONStorage(() =>
      typeof window !== "undefined" ? sessionStorage : localStorage
    ),
    partialize: (state) => ({
      ajustes: state.ajustes,
      modificaciones: state.modificaciones,
      escenarios: state.escenarios,
      escenarioComparar: state.escenarioComparar,
      periodoDesde: state.periodoDesde,
      periodoHasta: state.periodoHasta,
    }),
  }
));
