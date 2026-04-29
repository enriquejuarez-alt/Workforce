"use client";

import { create } from "zustand";
import type {
  ActiveFilters,
  Agente,
  Alerta,
  MatrizServicio,
  MappingOverride,
  Pase,
  ResultadoGeneral,
  ServicioCoverage,
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

  // Punto 2/3: coverage y alertas
  coverages: Map<ServicioKey, ServicioCoverage>;
  alertas: Alerta[];

  // Punto 4: filtros activos
  activeFilters: ActiveFilters;

  // Punto 6: mapeo configurable de segmentos
  mappingOverrides: MappingOverride[];

  // Pases entre servicios
  pases: Pase[];

  setResultado: (r: ResultadoGeneral) => void;
  setMatrices: (m: Map<ServicioKey, MatrizServicio>) => void;
  setAgentes: (a: Agente[]) => void;
  setReductores: (r: Reductor[]) => void;
  setDiasDelMes: (d: number) => void;
  setProcesando: (v: boolean) => void;
  setErrores: (e: string[]) => void;
  setAgentesExcluidos: (n: number, segs: string[]) => void;
  setCoverages: (c: Map<ServicioKey, ServicioCoverage>) => void;
  setAlertas: (a: Alerta[]) => void;
  setFilter: (campo: keyof ActiveFilters, valor: string) => void;
  clearFilters: () => void;
  addMappingOverride: (override: MappingOverride) => void;
  removeMappingOverride: (segmentoRaw: string) => void;
  setPases: (p: Pase[]) => void;
  addPase: (p: Pase) => void;
  removePase: (id: string) => void;
  reset: () => void;
}

export const useResultados = create<ResultadosState>((set) => ({
  resultado: null,
  matrices: new Map(),
  agentes: [],
  reductores: [],
  diasDelMes: 31,
  procesando: false,
  errores: [],
  agentesExcluidos: 0,
  segmentosNoReconocidos: [],
  coverages: new Map(),
  alertas: [],
  activeFilters: { ...FILTROS_VACIOS },
  mappingOverrides: [],
  pases: [],

  setResultado: (r) => set({ resultado: r }),
  setMatrices: (m) => set({ matrices: m }),
  setAgentes: (a) => set({ agentes: a }),
  setReductores: (r) => set({ reductores: r }),
  setDiasDelMes: (d) => set({ diasDelMes: d }),
  setProcesando: (v) => set({ procesando: v }),
  setErrores: (e) => set({ errores: e }),
  setAgentesExcluidos: (n, segs) => set({ agentesExcluidos: n, segmentosNoReconocidos: segs }),
  setCoverages: (c) => set({ coverages: c }),
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
  reset: () =>
    set({
      resultado: null,
      matrices: new Map(),
      agentes: [],
      reductores: [],
      diasDelMes: 31,
      procesando: false,
      errores: [],
      coverages: new Map(),
      alertas: [],
      activeFilters: { ...FILTROS_VACIOS },
      agentesExcluidos: 0,
      segmentosNoReconocidos: [],
      pases: [],
    }),
}));
