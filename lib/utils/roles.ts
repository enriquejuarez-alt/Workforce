import type { Rol } from '@/types'

// Etiquetas para mostrar en UI
export const ROL_LABELS: Record<Rol, string> = {
  ADMINISTRADOR: 'Administrador',
  WORKFORCE:     'Workforce',
  CAPACITADOR:   'Capacitador',
  LIDER:         'Líder',
  USUARIO:       'Supervisor',
}

export const ROL_BADGE_VARIANT: Record<Rol, string> = {
  ADMINISTRADOR: 'orange',
  WORKFORCE:     'blue',
  CAPACITADOR:   'green',
  LIDER:         'purple',
  USUARIO:       'purple',
}

// Paths de navegación a los que cada rol tiene acceso.
// El path se compara con startsWith, así que '/nomina' cubre '/nomina/agente/:id'.
// ADMINISTRADOR usa '*' → acceso total.
const ROL_PATHS: Record<Rol, string[] | '*'> = {
  ADMINISTRADOR: '*',

  WORKFORCE: [
    '/dashboard',
    '/nomina',
    '/licencias',
    '/calendario',
    '/cambios',
    '/bajas',
    '/capacitaciones',
    '/vacaciones',
    '/comparacion',
    '/ausentismo',
    '/historial-agente',
    '/planificacion',
    '/programacion',
    '/distribucion',
    '/soporte',
  ],

  LIDER: [
    '/dashboard',
    '/nomina',
    '/licencias',
    '/calendario',
    '/bajas',
    '/ausentismo',
    '/soporte',
  ],

  CAPACITADOR: [
    '/capacitaciones',
    '/soporte',
  ],

  // USUARIO es el rol legacy — mismo acceso que WORKFORCE
  USUARIO: [
    '/dashboard',
    '/nomina',
    '/licencias',
    '/calendario',
    '/cambios',
    '/bajas',
    '/capacitaciones',
    '/vacaciones',
    '/comparacion',
    '/ausentismo',
    '/historial-agente',
    '/planificacion',
    '/programacion',
    '/distribucion',
    '/soporte',
  ],
}

/**
 * Retorna true si el rol puede acceder al path dado.
 * Usá este helper en RoleRoute y en el Sidebar.
 */
export function canAccess(rol: Rol | undefined, path: string): boolean {
  if (!rol) return false
  const allowed = ROL_PATHS[rol]
  if (allowed === '*') return true
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
