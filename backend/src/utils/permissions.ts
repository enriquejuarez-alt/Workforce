import prisma from '../prisma'

export interface PermisoCompleto {
  puede_ver: boolean
  puede_usar_filtros: boolean
  puede_editar_nomina_mes_corriente: boolean
  puede_ver_nominas_historicas: boolean
  puede_editar_nominas_historicas: boolean
  puede_cargar_excel: boolean
  puede_exportar: boolean
  puede_exportar_nominas_historicas: boolean
  puede_registrar_licencia: boolean
  puede_registrar_cambio_servicio: boolean
  puede_crear_agente: boolean
  puede_desactivar_agente: boolean
  puede_comparar_nominas_mensuales: boolean
  puede_ver_historial_agente: boolean
  puede_editar_historial_agente: boolean
  puede_ver_motivos_sensibles: boolean
  puede_registrar_remocion: boolean
  puede_corregir_historial: boolean
  campos_editables: string[] | null
  segmentos_permitidos: string[]
}

const ADMIN_PERMISSIONS: PermisoCompleto = {
  puede_ver: true,
  puede_usar_filtros: true,
  puede_editar_nomina_mes_corriente: true,
  puede_ver_nominas_historicas: true,
  puede_editar_nominas_historicas: true,
  puede_cargar_excel: true,
  puede_exportar: true,
  puede_exportar_nominas_historicas: true,
  puede_registrar_licencia: true,
  puede_registrar_cambio_servicio: true,
  puede_crear_agente: true,
  puede_desactivar_agente: true,
  puede_comparar_nominas_mensuales: true,
  puede_ver_historial_agente: true,
  puede_editar_historial_agente: true,
  puede_ver_motivos_sensibles: true,
  puede_registrar_remocion: true,
  puede_corregir_historial: true,
  campos_editables: null,
  segmentos_permitidos: [],
}

export async function getUserPermission(
  userId: number,
  servicioId: number
): Promise<PermisoCompleto | null> {
  const user = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { rol: true },
  })

  if (!user) return null
  if (user.rol === 'ADMINISTRADOR') return ADMIN_PERMISSIONS

  const permiso = await prisma.usuarioServicioPermiso.findUnique({
    where: { usuario_id_servicio_id: { usuario_id: userId, servicio_id: servicioId } },
  })

  if (!permiso) return null

  return {
    ...permiso,
    campos_editables: permiso.campos_editables.length > 0 ? permiso.campos_editables : [],
    segmentos_permitidos: permiso.segmentos_permitidos ?? [],
  }
}

export function isCurrentMonth(mes: number, anio: number): boolean {
  const now = new Date()
  return now.getMonth() + 1 === mes && now.getFullYear() === anio
}

export async function isAdmin(userId: number): Promise<boolean> {
  const user = await prisma.usuario.findUnique({
    where: { id: userId },
    select: { rol: true },
  })
  return user?.rol === 'ADMINISTRADOR'
}
