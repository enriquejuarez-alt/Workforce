"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { FRANCO_DEFAULTS, type ReglaFrancoContrato, type FrancoVentana } from "@/lib/config/francoRules";

interface FrancoConfigState {
  reglas: ReglaFrancoContrato[];
  setVentana: (hsSemanal: number, francoIndex: number, ventana: FrancoVentana) => void;
  addFranco: (hsSemanal: number) => void;
  removeFranco: (hsSemanal: number, francoIndex: number) => void;
  resetToDefaults: () => void;
}

export const useFrancoConfig = create<FrancoConfigState>()(
  persist(
    (set) => ({
      reglas: FRANCO_DEFAULTS,

      setVentana: (hsSemanal, francoIndex, ventana) =>
        set((s) => ({
          reglas: s.reglas.map((r) =>
            r.hsSemanal === hsSemanal
              ? {
                  ...r,
                  francos: r.francos.map((f, i) => (i === francoIndex ? ventana : f)),
                }
              : r
          ),
        })),

      addFranco: (hsSemanal) =>
        set((s) => ({
          reglas: s.reglas.map((r) =>
            r.hsSemanal === hsSemanal
              ? { ...r, francos: [...r.francos, { dias: [] }] }
              : r
          ),
        })),

      removeFranco: (hsSemanal, francoIndex) =>
        set((s) => ({
          reglas: s.reglas.map((r) =>
            r.hsSemanal === hsSemanal
              ? { ...r, francos: r.francos.filter((_, i) => i !== francoIndex) }
              : r
          ),
        })),

      resetToDefaults: () => set({ reglas: FRANCO_DEFAULTS }),
    }),
    { name: "plani-franco-config" }
  )
);
