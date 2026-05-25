"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ActiveFilters,
  Agente,
  Alerta,
  MatrizServicio,
  MappingOverride,
  Pase,
  ResultadoGeneral,
  ServicioKey,
} from "@/lib/domain/types";
import { FILTROS_VACIOS } from "@/lib/domain/types";
import type { Reductor } from "@/lib/domain/types";

interface ResultadosState {
  resultado: ResultadoGeneral | null;
  matrices: Map<ServicioKey, MatrizServicio>;
  agentes: Agente[];
  reductores: Reductor[];
  diasDelMes: number;
  procesando: boolean;
  errores: string[];
  agentesExcluidos: number;
  segmentosNoReconocidos: string[];
  alertas: Alerta[];
  activeFilters: ActiveFilters;
  mappingOverrides: MappingOverride[];
  pases: Pase[];
  agentesDesdeApi: Agente[] | null;
  mesDesdeApi: number | null;
  anioDesdeApi: number | null;

  setResultado: (r: ResultadoGeneral) => void;
  setMatrices: (m: Map<ServicioKey, MatrizServicio>) => void;
  setAgentes: (a: Agente[]) => void;
  setReductores: (r: Reductor[]) => void;
  setDiasDelMes: (d: number) => void;
  setProcesando: (v: boolean) => void;
  setErrores: (e: string[]) => void;
  setAgentesExcluidos: (n: number, segs: string[]) => void;
  setAlertas: (a: Alerta[]) => void;
  setFilter: (campo: keyof ActiveFilters, valor: string) => void;
  clearFilters: () => void;
  addMappingOverride: (override: MappingOverride) => void;
  removeMappingOverride: (segmentoRaw: string) => void;
  setPases: (p: Pase[]) => void;
  addPase: (p: Pase) => void;
  removePase: (id: string) => void;
  setAgentesDesdeApi: (agentes: Agente[], mes: number, anio: number) => void;
  clearAgentesDesdeApi: () => void;
  reset: () => void;
}

const STORAGE_VERSION = 2;

// Storage personalizado que maneja la serialización del Map y objetos Date
const sessionStorageWithMap = {
  getItem: (name: string): string | null => {
    if (typeof window === "undefined") return null;
    try {
      const str = sessionStorage.getItem(name);
      if (!str) return null;
      const parsed = JSON.parse(str);
      // Descartar datos de versiones anteriores
      if (parsed?._v !== STORAGE_VERSION) {
        sessionStorage.removeItem(name);
        return null;
      }
      if (Array.isArray(parsed?.state?.matrices)) {
        parsed.state.matrices = new Map(
          parsed.state.matrices.map(([k, v]: [string, any]) => [
            k,
            {
              ...v,
              dias: Array.isArray(v.dias)
                ? v.dias.map((d: any) => ({ ...d, fecha: new Date(d.fecha) }))
                : v.dias,
            },
          ])
        );
      }
      return JSON.stringify(parsed);
    } catch {
      // Datos corruptos — limpiar y arrancar desde cero
      sessionStorage.removeItem(name);
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    if (typeof window === "undefined") return;
    try {
      const parsed = JSON.parse(value);
      if (parsed?.state?.matrices instanceof Map) {
        parsed.state.matrices = Array.from(parsed.state.matrices.entries());
      }
      parsed._v = STORAGE_VERSION;
      sessionStorage.setItem(name, JSON.stringify(parsed));
    } catch {
      // Si falla la serialización, no guardar datos corruptos
    }
  },
  removeItem: (name: string): void => {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem(name);
  },
};

export const useResultados = create<ResultadosState>()(
  persist(
    (set) => ({
      resultado: null,
      matrices: new Map(),
      agentes: [],
      reductores: [],
      diasDelMes: 31,
      procesando: false,
      errores: [],
      agentesExcluidos: 0,
      segmentosNoReconocidos: [],
      alertas: [],
      activeFilters: { ...FILTROS_VACIOS },
      mappingOverrides: [],
      pases: [],
      agentesDesdeApi: null,
      mesDesdeApi: null,
      anioDesdeApi: null,

      setResultado: (r) => set({ resultado: r }),
      setMatrices: (m) => set({ matrices: m }),
      setAgentes: (a) => set({ agentes: a }),
      setReductores: (r) => set({ reductores: r }),
      setDiasDelMes: (d) => set({ diasDelMes: d }),
      setProcesando: (v) => set({ procesando: v }),
      setErrores: (e) => set({ errores: e }),
      setAgentesExcluidos: (n, segs) => set({ agentesExcluidos: n, segmentosNoReconocidos: segs }),
      setAlertas: (a) => set({ alertas: a }),
      setFilter: (campo, valor) =>
        set((state) => ({
          activeFilters: { ...state.activeFilters, [campo]: valor },
        })),
      clearFilters: () => set({ activeFilters: { ...FILTROS_VACIOS } }),
      addMappingOverride: (override) =>
        set((state) => ({
          mappingOverrides: [
            ...state.mappingOverrides.filter(
              (o) => o.segmentoRaw !== override.segmentoRaw
            ),
            override,
          ],
        })),
      removeMappingOverride: (segmentoRaw) =>
        set((state) => ({
          mappingOverrides: state.mappingOverrides.filter(
            (o) => o.segmentoRaw !== segmentoRaw
          ),
        })),
      setPases: (p) => set({ pases: p }),
      addPase: (p) => set((state) => ({ pases: [...state.pases, p] })),
      removePase: (id) => set((state) => ({ pases: state.pases.filter((p) => p.id !== id) })),
      setAgentesDesdeApi: (agentes, mes, anio) =>
        set({ agentesDesdeApi: agentes, mesDesdeApi: mes, anioDesdeApi: anio }),
      clearAgentesDesdeApi: () =>
        set({ agentesDesdeApi: null, mesDesdeApi: null, anioDesdeApi: null }),
      reset: () =>
        set({
          resultado: null,
          matrices: new Map(),
          agentes: [],
          reductores: [],
          diasDelMes: 31,
          procesando: false,
          errores: [],
          alertas: [],
          activeFilters: { ...FILTROS_VACIOS },
          agentesExcluidos: 0,
          segmentosNoReconocidos: [],
          mappingOverrides: [],
          pases: [],
          agentesDesdeApi: null,
          mesDesdeApi: null,
          anioDesdeApi: null,
        }),
    }),
    {
      name: "plani-resultados",
      storage: sessionStorageWithMap as never,
      // No persistir estado transitorio
      partialize: (state) => ({
        resultado: state.resultado,
        matrices: state.matrices,
        agentes: state.agentes,
        reductores: state.reductores,
        diasDelMes: state.diasDelMes,
        alertas: state.alertas,
        agentesExcluidos: state.agentesExcluidos,
        segmentosNoReconocidos: state.segmentosNoReconocidos,
        mappingOverrides: state.mappingOverrides,
        pases: state.pases,
        activeFilters: state.activeFilters,
        agentesDesdeApi: state.agentesDesdeApi,
        mesDesdeApi: state.mesDesdeApi,
        anioDesdeApi: state.anioDesdeApi,
      }),
    }
  )
);
