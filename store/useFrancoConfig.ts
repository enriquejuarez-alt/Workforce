"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { FRANCO_DEFAULTS, type ReglaFrancoContrato, type FrancoVentana } from "@/lib/config/francoRules";

interface FrancoConfigState {
  reglas: ReglaFrancoContrato[];
  addContrato: (hsSemanal: number) => void;
  updateContrato: (hsSemanal: number, patch: Partial<Pick<ReglaFrancoContrato, "hsSemanal" | "label">>) => void;
  removeContrato: (hsSemanal: number) => void;
  setVentana: (hsSemanal: number, francoIndex: number, ventana: FrancoVentana) => void;
  addFranco: (hsSemanal: number) => void;
  removeFranco: (hsSemanal: number, francoIndex: number) => void;
  resetToDefaults: () => void;
}

function normalizarReglas(reglas: ReglaFrancoContrato[]): ReglaFrancoContrato[] {
  const porContrato = new Map<number, ReglaFrancoContrato>();
  for (const regla of [...FRANCO_DEFAULTS, ...reglas]) {
    const hsSemanal = Number(regla.hsSemanal);
    if (!Number.isFinite(hsSemanal) || hsSemanal <= 0) continue;
    porContrato.set(hsSemanal, {
      hsSemanal,
      label: regla.label?.trim() || `${hsSemanal} hs`,
      francos: regla.francos.length > 0 ? regla.francos : [{ dias: [] }],
    });
  }
  return Array.from(porContrato.values()).sort((a, b) => a.hsSemanal - b.hsSemanal);
}

export const useFrancoConfig = create<FrancoConfigState>()(
  persist(
    (set) => ({
      reglas: FRANCO_DEFAULTS,

      addContrato: (hsSemanal) =>
        set((s) => {
          if (!Number.isFinite(hsSemanal) || hsSemanal <= 0) return s;
          if (s.reglas.some((r) => r.hsSemanal === hsSemanal)) return s;
          return {
            reglas: normalizarReglas([
              ...s.reglas,
              { hsSemanal, label: `${hsSemanal} hs`, francos: [{ dias: [] }] },
            ]),
          };
        }),

      updateContrato: (hsSemanal, patch) =>
        set((s) => ({
          reglas: normalizarReglas(
            s.reglas.map((r) =>
              r.hsSemanal === hsSemanal
                ? {
                    ...r,
                    ...patch,
                    label: patch.label ?? (patch.hsSemanal ? `${patch.hsSemanal} hs` : r.label),
                  }
                : r
            )
          ),
        })),

      removeContrato: (hsSemanal) =>
        set((s) => ({
          reglas: s.reglas.filter((r) => r.hsSemanal !== hsSemanal),
        })),

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
    {
      name: "plani-franco-config",
      merge: (persisted, current) => {
        const state = persisted as Partial<FrancoConfigState> | undefined;
        return {
          ...current,
          ...state,
          reglas: normalizarReglas(state?.reglas ?? current.reglas),
        };
      },
    }
  )
);
