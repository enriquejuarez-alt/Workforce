"use client";

import { create } from "zustand";
import type { ModoReductor } from "@/lib/domain/types";

interface UploadsState {
  archivoCP: File | null;
  archivoReductores: File | null;
  archivoNomina: File | null;
  hojaNomina: string | null;
  hojasNomina: string[];
  modoReductor: ModoReductor;
  topeFacturacion: number;

  setArchivoCP: (f: File | null) => void;
  setArchivoReductores: (f: File | null) => void;
  setArchivoNomina: (f: File | null, hojas: string[]) => void;
  setHojaNomina: (h: string) => void;
  setModoReductor: (m: ModoReductor) => void;
  setTopeFacturacion: (v: number) => void;
  reset: () => void;

  todosSubidos: () => boolean;
}

export const useUploads = create<UploadsState>((set, get) => ({
  archivoCP: null,
  archivoReductores: null,
  archivoNomina: null,
  hojaNomina: null,
  hojasNomina: [],
  modoReductor: "multiplicativo",
  topeFacturacion: 103,

  setArchivoCP: (f) => set({ archivoCP: f }),
  setArchivoReductores: (f) => set({ archivoReductores: f }),
  setArchivoNomina: (f, hojas) =>
    set({
      archivoNomina: f,
      hojasNomina: hojas,
      hojaNomina: hojas[0] ?? null,
    }),
  setHojaNomina: (h) => set({ hojaNomina: h }),
  setModoReductor: (m) => set({ modoReductor: m }),
  setTopeFacturacion: (v) => set({ topeFacturacion: v }),

  reset: () =>
    set({
      archivoCP: null,
      archivoReductores: null,
      archivoNomina: null,
      hojaNomina: null,
      hojasNomina: [],
      modoReductor: "multiplicativo",
      topeFacturacion: 103,
    }),

  todosSubidos: () => {
    const { archivoCP, archivoReductores, archivoNomina, hojaNomina } = get();
    return !!(archivoCP && archivoReductores && archivoNomina && hojaNomina);
  },
}));
