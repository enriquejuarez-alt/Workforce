import { useAuthStore } from '@/store/auth'
import type { UsuarioServicioPermiso } from '@/types'

export function usePermissions() {
  const user = useAuthStore((s) => s.user)
  const isAdmin = user?.rol === 'ADMINISTRADOR'

  const getPermission = (servicioId: number): UsuarioServicioPermiso | null => {
    if (!user) return null
    if (isAdmin) return getAdminPermissions(servicioId, user.id)
    return user.permisos?.find((p) => p.servicio_id === servicioId) ?? null
  }

  const canView = (servicioId: number) => {
    if (isAdmin) return true
    return getPermission(servicioId)?.puede_ver ?? false
  }

  const canEdit = (servicioId: number, isCurrentMonth: boolean) => {
    if (isAdmin) return true
    const p = getPermission(servicioId)
    if (!p) return false
    if (isCurrentMonth) return p.puede_editar_nomina_mes_corriente
    return p.puede_editar_nominas_historicas
  }

  const canExport = (servicioId: number, isHistorical = false) => {
    if (isAdmin) return true
    const p = getPermission(servicioId)
    if (!p) return false
    if (isHistorical) return p.puede_exportar_nominas_historicas
    return p.puede_exportar
  }

  const canLoadExcel = (servicioId: number) => {
    if (isAdmin) return true
    return getPermission(servicioId)?.puede_cargar_excel ?? false
  }

  const canRegisterLicencia = (servicioId: number) => {
    if (isAdmin) return true
    return getPermission(servicioId)?.puede_registrar_licencia ?? false
  }

  const canRegisterCambio = (servicioId: number) => {
    if (isAdmin) return true
    return getPermission(servicioId)?.puede_registrar_cambio_servicio ?? false
  }

  const canCreateAgent = (servicioId: number) => {
    if (isAdmin) return true
    return getPermission(servicioId)?.puede_crear_agente ?? false
  }

  const canDeactivateAgent = (servicioId: number) => {
    if (isAdmin) return true
    return getPermission(servicioId)?.puede_desactivar_agente ?? false
  }

  const canCompare = (servicioId: number) => {
    if (isAdmin) return true
    return getPermission(servicioId)?.puede_comparar_nominas_mensuales ?? false
  }

  const getEditableFields = (servicioId: number): string[] | null => {
    if (isAdmin) return null
    return getPermission(servicioId)?.campos_editables ?? []
  }

  const isFieldEditable = (servicioId: number, field: string): boolean => {
    if (isAdmin) return true
    const fields = getEditableFields(servicioId)
    if (!fields) return true
    if (fields.length === 0) return true
    return fields.includes(field.toUpperCase())
  }

  const getAuthorizedServices = () => {
    if (isAdmin) return null
    return user?.permisos?.filter((p) => p.puede_ver).map((p) => p.servicio_id) ?? []
  }

  return {
    isAdmin,
    getPermission,
    canView,
    canEdit,
    canExport,
    canLoadExcel,
    canRegisterLicencia,
    canRegisterCambio,
    canCreateAgent,
    canDeactivateAgent,
    canCompare,
    getEditableFields,
    isFieldEditable,
    getAuthorizedServices,
  }
}

function getAdminPermissions(servicioId: number, userId: number): UsuarioServicioPermiso {
  return {
    id: 0, usuario_id: userId, servicio_id: servicioId,
    puede_ver: true, puede_usar_filtros: true,
    puede_editar_nomina_mes_corriente: true, puede_ver_nominas_historicas: true,
    puede_editar_nominas_historicas: true, puede_cargar_excel: true,
    puede_exportar: true, puede_exportar_nominas_historicas: true,
    puede_registrar_licencia: true, puede_registrar_cambio_servicio: true,
    puede_crear_agente: true, puede_desactivar_agente: true,
    puede_comparar_nominas_mensuales: true, campos_editables: [], segmentos_permitidos: [],
  }
}
