import type { Rol } from '@/types'
import { useConfigStore } from '@/store/config'

// Etiquetas para mostrar en UI
export const ROL_LABELS: Record<Rol, string> = {
  ADMINISTRADOR: 'Administrador',
  WORKFORCE:     'Workforce',
  CAPACITADOR:   'Capacitador',
  LIDER:         'Líder',
  USUARIO:       'Workforce', // legacy — se muestra como Workforce
  VISUALIZADOR:  'Visualizador',
}

export const ROL_BADGE_VARIANT: Record<Rol, string> = {
  ADMINISTRADOR: 'orange',
  WORKFORCE:     'blue',
  CAPACITADOR:   'green',
  LIDER:         'purple',
  USUARIO:       'purple',
  VISUALIZADOR:  'gray',
}

/**
 * canAccess lee del store dinámico.
 * ADMINISTRADOR siempre tiene acceso total.
 * Si el usuario tiene override personal (currentUserOverride), tiene prioridad sobre el rol.
 */
export function canAccess(rol: Rol | undefined, path: string): boolean {
  if (!rol) return false
  if (rol === 'ADMINISTRADOR') return true
  const { currentUserOverride, rolPaths } = useConfigStore.getState()
  const allowed = currentUserOverride ?? rolPaths[rol] ?? []
  return allowed.some((p) => path === p || path.startsWith(p + '/'))
}

/**
 * Path inicial al que redirigir según el rol del usuario.
 */
export function getDefaultPath(rol: Rol | undefined): string {
  if (!rol) return '/login'
  if (rol === 'CAPACITADOR') return '/capacitaciones'
  return '/dashboard'
}

/**
 * Retorna true si el rol puede ver el módulo de administración
 * (Carga de Nómina, Importaciones, Usuarios, Servicios, Auditoría).
 */
export function isAdminRole(rol: Rol | undefined): boolean {
  return rol === 'ADMINISTRADOR'
}

/**
 * Retorna true si el rol es solo visualización — puede ver planificación
 * pero no cargar archivos ni ejecutar cálculos.
 */
export function isReadOnly(rol: Rol | undefined): boolean {
  return rol === 'VISUALIZADOR'
}
