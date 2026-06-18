"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ActiveFilters,
  Agente,
  Alerta,
  MatrizServicio,
  MappingOverride,
  ResultadoGeneral,
  ServicioKey,
} from "@/lib/domain/types";
import { FILTROS_VACIOS } from "@/lib/domain/types";
import type { Reductor } from "@/lib/domain/types";

interface ResultadosPpayState {
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
  reset: () => void;
}

const STORAGE_VERSION = 1;

const sessionStorageWithMap = {
  getItem: (name: string): string | null => {
    if (typeof window === "undefined") return null;
    try {
      const str = sessionStorage.getItem(name);
      if (!str) return null;
      const parsed = JSON.parse(str);
      if (parsed?._v !== STORAGE_VERSION) {
        sessionStorage.removeItem(name);
        return null;
      }
      if (Array.isArray(parsed?.state?.matrices)) {
        parsed.state.matrices = new Map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          parsed.state.matrices.map(([k, v]: [string, any]) => [
            k,
            {
              ...v,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              dias: Array.isArray(v.dias)
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                ? v.dias.map((d: any) => ({ ...d, fecha: new Date(d.fecha) }))
                : v.dias,
            },
          ])
        );
      }
      return JSON.stringify(parsed);
    } catch {
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
      // skip corrupt data
    }
  },
  removeItem: (name: string): void => {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem(name);
  },
};

const INITIAL_STATE = {
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
};

export const useResultadosPpay = create<ResultadosPpayState>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,

      setResultado: (r) => set({ resultado: r }),
      setMatrices: (m) => set({ matrices: m }),
      setAgentes: (a) => set({ agentes: a }),
      setReductores: (r) => set({ reductores: r }),
      setDiasDelMes: (d) => set({ diasDelMes: d }),
      setProcesando: (v) => set({ procesando: v }),
      setErrores: (e) => set({ errores: e }),
      setAgentesExcluidos: (n, segs) =>
        set({ agentesExcluidos: n, segmentosNoReconocidos: segs }),
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
      reset: () => set({ ...INITIAL_STATE }),
    }),
    {
      name: "ppay-resultados",
      storage: sessionStorageWithMap as never,
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
        activeFilters: state.activeFilters,
      }),
    }
  )
);
