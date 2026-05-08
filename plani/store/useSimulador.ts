"use client";

import { create } from "zustand";
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

function ajustesInicial(): Record<ServicioKey, AjusteServicio> {
  return Object.fromEntries(
    SERVICIOS_KEYS.map((k) => [
      k,
      { servicio: k, hcExtra: 0, hsSemanalExtra: 36, deslogueoOverride: null, ausentismoOverride: null, rotacionOverride: null },
    ])
  ) as Record<ServicioKey, AjusteServicio>;
}

interface SimuladorState {
  ajustes: Record<ServicioKey, AjusteServicio>;
  modificaciones: SimModificacion[];
  escenarios: Escenario[];

  setAjuste: (servicio: ServicioKey, patch: Partial<AjusteServicio>) => void;
  resetAjustes: () => void;
  addModificacion: (tipo: SimModTipo, servicio: ServicioKey, params: Partial<Omit<SimModificacion, "id" | "tipo" | "servicio">>) => void;
  bulkAddModificaciones: (mods: Omit<SimModificacion, "id">[]) => void;
  removeModificacion: (id: string) => void;
  clearModificaciones: () => void;

  saveEscenario: (nombre: string) => void;
  loadEscenario: (id: string) => void;
  deleteEscenario: (id: string) => void;
}

export const useSimulador = create<SimuladorState>((set, get) => ({
  ajustes: ajustesInicial(),
  modificaciones: [],
  escenarios: [],

  setAjuste: (servicio, patch) =>
    set((state) => ({ ajustes: { ...state.ajustes, [servicio]: { ...state.ajustes[servicio], ...patch } } })),

  resetAjustes: () => set({ ajustes: ajustesInicial(), modificaciones: [] }),

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
        ...mods.map((m) => ({ id: nextId("mod"), cantidad: 1, hsSemanal: 36, ...m })),
      ],
    })),

  removeModificacion: (id) =>
    set((state) => ({ modificaciones: state.modificaciones.filter((m) => m.id !== id) })),

  clearModificaciones: () => set({ modificaciones: [] }),

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
}));
