"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  FRANCO_DEFAULTS,
  type ReglaFrancoContrato,
  type FrancoVentana,
  type DistribucionJornada,
} from "@/lib/config/francoRules";

interface FrancoConfigState {
  reglas: ReglaFrancoContrato[];
  reglasByServicio: Record<string, ReglaFrancoContrato[]>;
  selectedServicioKey: string | null;

  setSelectedServicioKey: (key: string | null) => void;

  addContrato: (hsSemanal: number) => void;
  updateContrato: (hsSemanal: number, patch: Partial<Pick<ReglaFrancoContrato, "hsSemanal" | "label" | "distribucion">>) => void;
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
      distribucion: normalizarDistribucion(regla.distribucion),
      francos: regla.francos.length > 0 ? regla.francos : [{ dias: [] }],
    });
  }
  return Array.from(porContrato.values()).sort((a, b) => a.hsSemanal - b.hsSemanal);
}

function normalizarDistribucion(distribucion?: DistribucionJornada): DistribucionJornada | undefined {
  if (!distribucion || distribucion.tipo === "uniforme") {
    return distribucion?.tipo === "uniforme" ? { tipo: "uniforme" } : undefined;
  }

  const hsBaseDia = Number(distribucion.hsBaseDia ?? 0);
  const hsExtraDia = Number(distribucion.hsExtraDia ?? 0);

  return {
    tipo: "base_extra_diario",
    diasLaborables: distribucion.diasLaborables ?? [],
    hsBaseDia: Number.isFinite(hsBaseDia) ? hsBaseDia : 0,
    hsExtraDia: Number.isFinite(hsExtraDia) ? hsExtraDia : 0,
    diasExtra: distribucion.diasExtra ?? [],
  };
}

// Devuelve las reglas a mutar según el servicio activo seleccionado
function getBaseReglas(
  s: Pick<FrancoConfigState, "selectedServicioKey" | "reglasByServicio" | "reglas">
): ReglaFrancoContrato[] {
  if (s.selectedServicioKey) {
    return s.reglasByServicio[s.selectedServicioKey] ?? s.reglas;
  }
  return s.reglas;
}

// Aplica una actualización al servicio activo o a las reglas globales
function applyToActive(
  s: FrancoConfigState,
  updater: (reglas: ReglaFrancoContrato[]) => ReglaFrancoContrato[]
): Partial<FrancoConfigState> {
  const key = s.selectedServicioKey;
  const current = getBaseReglas(s);
  const updated = updater(current);
  if (key) {
    return { reglasByServicio: { ...s.reglasByServicio, [key]: updated } };
  }
  return { reglas: updated };
}

export const useFrancoConfig = create<FrancoConfigState>()(
  persist(
    (set) => ({
      reglas: FRANCO_DEFAULTS,
      reglasByServicio: {},
      selectedServicioKey: null,

      setSelectedServicioKey: (key) => set({ selectedServicioKey: key }),

      addContrato: (hsSemanal) =>
        set((s) => {
          if (!Number.isFinite(hsSemanal) || hsSemanal <= 0) return s;
          const base = getBaseReglas(s);
          if (base.some((r) => r.hsSemanal === hsSemanal)) return s;
          return applyToActive(s, (reglas) =>
            normalizarReglas([...reglas, { hsSemanal, label: `${hsSemanal} hs`, francos: [{ dias: [] }] }])
          );
        }),

      updateContrato: (hsSemanal, patch) =>
        set((s) =>
          applyToActive(s, (reglas) =>
            normalizarReglas(
              reglas.map((r) =>
                r.hsSemanal === hsSemanal
                  ? {
                      ...r,
                      ...patch,
                      label: patch.label ?? (patch.hsSemanal ? `${patch.hsSemanal} hs` : r.label),
                    }
                  : r
              )
            )
          )
        ),

      removeContrato: (hsSemanal) =>
        set((s) =>
          applyToActive(s, (reglas) => reglas.filter((r) => r.hsSemanal !== hsSemanal))
        ),

      setVentana: (hsSemanal, francoIndex, ventana) =>
        set((s) =>
          applyToActive(s, (reglas) =>
            reglas.map((r) =>
              r.hsSemanal === hsSemanal
                ? { ...r, francos: r.francos.map((f, i) => (i === francoIndex ? ventana : f)) }
                : r
            )
          )
        ),

      addFranco: (hsSemanal) =>
        set((s) =>
          applyToActive(s, (reglas) =>
            reglas.map((r) =>
              r.hsSemanal === hsSemanal ? { ...r, francos: [...r.francos, { dias: [] }] } : r
            )
          )
        ),

      removeFranco: (hsSemanal, francoIndex) =>
        set((s) =>
          applyToActive(s, (reglas) =>
            reglas.map((r) =>
              r.hsSemanal === hsSemanal
                ? { ...r, francos: r.francos.filter((_, i) => i !== francoIndex) }
                : r
            )
          )
        ),

      resetToDefaults: () =>
        set((s) => {
          const key = s.selectedServicioKey;
          if (key) {
            const rest = { ...s.reglasByServicio };
            delete rest[key];
            return { reglasByServicio: rest };
          }
          return { reglas: FRANCO_DEFAULTS };
        }),
    }),
    {
      name: "plani-franco-config",
      merge: (persisted, current) => {
        const state = persisted as Partial<FrancoConfigState> | undefined;
        return {
          ...current,
          ...state,
          reglas: normalizarReglas(state?.reglas ?? current.reglas),
          reglasByServicio: state?.reglasByServicio ?? {},
          selectedServicioKey: null, // never persist the active selection
        };
      },
    }
  )
);
