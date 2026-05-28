"use client";
import { create } from 'zustand'

export const DEFAULT_ROL_PATHS: Record<string, string[]> = {
  WORKFORCE: [
    '/dashboard', '/nomina', '/licencias', '/calendario', '/cambios',
    '/bajas', '/capacitaciones', '/vacaciones', '/comparacion', '/ausentismo',
    '/historial-agente', '/planificacion', '/programacion', '/distribucion', '/soporte',
  ],
  // USUARIO kept for backwards-compat with existing DB records — same as WORKFORCE
  USUARIO: [
    '/dashboard', '/nomina', '/licencias', '/calendario', '/cambios',
    '/bajas', '/capacitaciones', '/vacaciones', '/comparacion', '/ausentismo',
    '/historial-agente', '/planificacion', '/programacion', '/distribucion', '/soporte',
  ],
  LIDER: [
    '/dashboard', '/nomina', '/licencias', '/calendario', '/bajas', '/ausentismo', '/soporte',
  ],
  CAPACITADOR: [
    '/capacitaciones', '/soporte',
  ],
}

interface ConfigStore {
  rolPaths: Record<string, string[]>
  currentUserOverride: string[] | null // null = usar config de rol; array = restricción personal
  loaded: boolean
  setRolPaths: (paths: Record<string, string[]>) => void
  setCurrentUserOverride: (paths: string[] | null) => void
  reset: () => void
}

export const useConfigStore = create<ConfigStore>((set) => ({
  rolPaths: DEFAULT_ROL_PATHS,
  currentUserOverride: null,
  loaded: false,
  setRolPaths: (rolPaths) => set({ rolPaths, loaded: true }),
  setCurrentUserOverride: (currentUserOverride) => set({ currentUserOverride }),
  reset: () => set({ rolPaths: DEFAULT_ROL_PATHS, currentUserOverride: null, loaded: false }),
}))
