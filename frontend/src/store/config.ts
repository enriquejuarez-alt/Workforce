import { create } from 'zustand'

export const DEFAULT_ROL_PATHS: Record<string, string[]> = {
  WORKFORCE: [
    '/dashboard', '/nomina', '/licencias', '/calendario', '/cambios',
    '/bajas', '/capacitaciones', '/vacaciones', '/comparacion', '/ausentismo',
    '/historial-agente', '/planificacion', '/programacion', '/distribucion', '/soporte',
  ],
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
  loaded: boolean
  setRolPaths: (paths: Record<string, string[]>) => void
  reset: () => void
}

export const useConfigStore = create<ConfigStore>((set) => ({
  rolPaths: DEFAULT_ROL_PATHS,
  loaded: false,
  setRolPaths: (rolPaths) => set({ rolPaths, loaded: true }),
  reset: () => set({ rolPaths: DEFAULT_ROL_PATHS, loaded: false }),
}))
