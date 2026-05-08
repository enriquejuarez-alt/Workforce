"use client";

import { create } from "zustand";

export interface ServicioNominaRef {
  id: number;
  nombre: string;
  planiConfig: {
    key: string;
    label?: string;
    hojaCP: string[];
    segmentos: string[];
    reductores: string[];
  } | null;
}

interface PlaniConfigState {
  serviciosNomina: ServicioNominaRef[] | null;
  setServiciosNomina: (servicios: ServicioNominaRef[]) => void;
}

export const usePlaniConfig = create<PlaniConfigState>((set) => ({
  serviciosNomina: null,
  setServiciosNomina: (servicios) => set({ serviciosNomina: servicios }),
}));
