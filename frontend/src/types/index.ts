export type Rol = 'ADMINISTRADOR' | 'USUARIO'
export type EstadoNomina = 'BORRADOR' | 'ACTIVA' | 'CERRADA' | 'ARCHIVADA'
export type EstadoLicencia = 'VIGENTE' | 'PROGRAMADA' | 'FINALIZADA'

export interface Usuario {
  id: number
  nombre: string
  email: string
  rol: Rol
  activo: boolean
  fecha_creacion: string
  ultimo_acceso: string | null
  permisos?: UsuarioServicioPermiso[]
}

export interface Servicio {
  id: number
  nombre: string
  descripcion: string | null
  color: string
  activo: boolean
  fecha_creacion: string
  _count?: { agentes: number; nominas: number }
}

export interface UsuarioServicioPermiso {
  id: number
  usuario_id: number
  servicio_id: number
  servicio?: Servicio
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
  campos_editables: string[]
  segmentos_permitidos: string[]
}

export interface Agente {
  id: number
  dni: string
  usuario: string
  nombre: string
  superior: string | null
  segmento: string | null
  horarios: string | null
  estado: string | null
  contrato: string | null
  sitio: string | null
  modalidad: string | null
  jefe: string | null
  servicio_id: number | null
  servicio?: Servicio
  activo: boolean
  presente_ultima_carga: boolean
  observaciones: string | null
  fecha_creacion: string
  fecha_actualizacion: string
  licencias?: Licencia[]
  cambios_temporales?: CambioServicioTemporal[]
  snapshots?: AgenteNominaMensual[]
}

export interface NominaMensual {
  id: number
  servicio_id: number
  servicio?: Servicio
  mes: number
  anio: number
  estado: EstadoNomina
  archivo_nombre: string | null
  cargado_por: number | null
  fecha_carga: string | null
  total_agentes: number
  agentes_creados: number
  agentes_actualizados: number
  agentes_no_presentes: number
  errores: number
  observaciones: string | null
  fecha_creacion: string
}

export interface AgenteNominaMensual {
  id: number
  nomina_mensual_id: number
  nomina_mensual?: NominaMensual
  agente_id: number
  agente?: Agente
  dni: string
  usuario: string
  nombre: string
  superior: string | null
  segmento: string | null
  horarios: string | null
  estado: string | null
  contrato: string | null
  sitio: string | null
  modalidad: string | null
  jefe: string | null
  servicio_id: number | null
  servicio?: Servicio
  presente_en_nomina: boolean
  observaciones: string | null
}

export interface LicenciaImportacion {
  id: number
  archivo_nombre: string
  importado_por: number
  importador?: Pick<Usuario, 'id' | 'nombre'>
  fecha_importacion: string
  total_dias: number
  total_periodos: number
  agentes_encontrados: number
  agentes_no_encontrados: number
  _count?: { licencias: number }
}

export interface Licencia {
  id: number
  agente_id: number
  agente?: Agente
  fecha_desde: string
  fecha_hasta: string
  motivo: string | null
  observacion: string | null
  creado_por: number
  importacion_id: number | null
  importacion?: Pick<LicenciaImportacion, 'id' | 'archivo_nombre' | 'fecha_importacion'>
  creador?: Pick<Usuario, 'id' | 'nombre' | 'email'>
  fecha_creacion: string
  estado_calculado?: EstadoLicencia
}

export interface CalendarioEvento {
  fecha: string
  tipo: 'VENCIMIENTO' | 'INICIO'
  agente_id: number
  agente_nombre: string
  servicio_nombre: string | null
  servicio_id: number | null
  motivo: string | null
}

export interface CambioServicioTemporal {
  id: number
  agente_id: number
  agente?: Agente
  servicio_original_id: number | null
  servicio_temporal_id: number | null
  servicio_temporal?: Servicio
  fecha_desde: string
  fecha_hasta: string
  motivo: string | null
  observacion: string | null
  creado_por: number
  creador?: Pick<Usuario, 'id' | 'nombre' | 'email'>
  fecha_creacion: string
  activo?: boolean
}

export interface ImportacionNomina {
  id: number
  nomina_mensual_id: number
  nomina_mensual?: NominaMensual
  archivo_nombre: string
  usuario_id: number
  usuario?: Pick<Usuario, 'id' | 'nombre' | 'email'>
  fecha_importacion: string
  total_filas: number
  agentes_creados: number
  agentes_actualizados: number
  agentes_no_presentes: number
  errores: number
  estado: string
}

export interface HistoricoBaja {
  id: number
  fecha: string
  dni: string
  nombre: string
  usuario_sistema: string | null
  superior: string | null
  jefatura: string | null
  servicio_id: number | null
  servicio?: Pick<Servicio, 'id' | 'nombre' | 'color'>
  servicio_nombre: string | null
  tipo: string | null
  segmento: string | null
  horarios: string | null
  estado: string | null
  contrato: string | null
  sitio: string | null
  modalidad: string | null
  jefe: string | null
  observacion: string | null
  agente_id: number | null
  creado_por: number
  creador?: Pick<Usuario, 'id' | 'nombre'>
  fecha_creacion: string
}

export interface Capacitacion {
  id: number
  agente_id: number | null
  agente_dni: string | null
  agente_nombre: string
  usuario_sistema: string | null
  superior: string | null
  servicio_id: number | null
  servicio?: Pick<Servicio, 'id' | 'nombre' | 'color'>
  servicio_nombre: string | null
  segmento: string | null
  horarios: string | null
  estado: string | null
  contrato: string | null
  sitio: string | null
  modalidad: string | null
  jefe: string | null
  observacion: string | null
  fecha_inicio: string
  fecha_fin: string
  dado_de_alta: boolean
  pendiente_alta: boolean
  fecha_alta: string | null
  creado_por: number
  creador?: Pick<Usuario, 'id' | 'nombre'>
  fecha_creacion: string
  estado_calculado?: 'VIGENTE' | 'PROGRAMADA' | 'FINALIZADA'
}

export interface Remocion {
  id: number
  fecha: string
  dni: string
  nombre: string
  usuario_sistema: string | null
  superior: string | null
  jefatura: string | null
  servicio_id: number | null
  servicio?: Pick<Servicio, 'id' | 'nombre' | 'color'>
  servicio_nombre: string | null
  motivo: string | null
  segmento: string | null
  horarios: string | null
  estado: string | null
  contrato: string | null
  sitio: string | null
  modalidad: string | null
  jefe: string | null
  observacion: string | null
  agente_id: number | null
  creado_por: number
  creador?: Pick<Usuario, 'id' | 'nombre'>
  fecha_creacion: string
}

export interface CambioContrato {
  id: number
  agente_id: number
  agente_dni: string
  agente_nombre: string
  servicio_id: number | null
  servicio?: Pick<Servicio, 'id' | 'nombre' | 'color'>
  tipo: 'TEMPORAL' | 'DEFINITIVO'
  contrato_anterior: string | null
  contrato_nuevo: string
  fecha_desde: string
  fecha_hasta: string | null
  motivo: string | null
  observacion: string | null
  creado_por: number
  creador?: Pick<Usuario, 'id' | 'nombre'>
  fecha_creacion: string
  estado_calculado?: 'PENDIENTE' | 'VIGENTE' | 'FINALIZADO'
}

export interface VacacionImportacion {
  id: number
  archivo_nombre: string
  importado_por: number
  importador?: Pick<Usuario, 'id' | 'nombre'>
  fecha_importacion: string
  total_dias: number
  total_periodos: number
  agentes_encontrados: number
  agentes_no_encontrados: number
  _count?: { vacaciones: number }
}

export interface Vacacion {
  id: number
  agente_id: number | null
  agente_dni: string
  agente_nombre: string
  agente?: Agente | null
  fecha_desde: string
  fecha_hasta: string
  site: string | null
  servicio_wf: string | null
  importacion_id: number
  importacion?: Pick<VacacionImportacion, 'id' | 'archivo_nombre' | 'fecha_importacion'>
  fecha_creacion: string
  estado_calculado?: 'VIGENTE' | 'PROGRAMADA' | 'FINALIZADA'
}

export interface AuditoriaLog {
  id: number
  usuario_id: number | null
  usuario?: Pick<Usuario, 'id' | 'nombre' | 'email'> | null
  accion: string
  entidad: string | null
  entidad_id: string | null
  servicio_id: number | null
  servicio?: Pick<Servicio, 'id' | 'nombre' | 'color'> | null
  nomina_mensual_id: number | null
  campo_modificado: string | null
  valor_anterior: string | null
  valor_nuevo: string | null
  fecha_hora: string
  ip: string | null
}

export interface DashboardData {
  total_agentes: number
  agentes_activos: number
  agentes_lp: number
  agentes_inactivos: number
  estado_breakdown: Array<{ estado: string | null; cantidad: number }>
  licencias_vigentes: number
  licencias_programadas: number
  cambios_activos: number
  agentes_no_presentes: number
  nominas_activas: number
  nominas_cerradas: number
  usuarios_activos: number | null
  ultima_carga: ImportacionNomina | null
  por_servicio: Array<{ id: number; nombre: string; color: string; total_agentes: number }>
  licencias_hoy: Array<{
    agente_id: number
    agente_nombre: string
    servicio_nombre: string | null
    servicio_color: string | null
    fecha_hasta: string
    motivo: string | null
  }>
}

export interface TimelineEvento {
  tipo: 'LICENCIA' | 'CAMBIO_TEMPORAL' | 'CAMBIO_CONTRATO' | 'CAPACITACION' | 'REMOCION' | 'VACACION'
  fecha_inicio: string
  fecha_fin: string | null
  descripcion: string
  detalle: string | null
}

export interface ExcelPreview {
  token: string
  stats: {
    total: number
    nuevos: number
    actualizados: number
    errores: number
    no_presentes: number
  }
  rows: any[]
  total_rows: number
  errors: any[]
  no_presentes: any[]
}

export const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export const CAMPOS_NOMINA = [
  'DNI', 'USUARIO', 'NOMBRE', 'SUPERIOR', 'SEGMENTO',
  'HORARIOS', 'ESTADO', 'CONTRATO', 'SITIO', 'MODALIDAD', 'JEFE',
]

export const ESTADO_NOMINA_LABELS: Record<EstadoNomina, string> = {
  BORRADOR: 'Borrador',
  ACTIVA: 'Activa',
  CERRADA: 'Cerrada',
  ARCHIVADA: 'Archivada',
}

export const ESTADO_NOMINA_COLORS: Record<EstadoNomina, string> = {
  BORRADOR: 'bg-yellow-100 text-yellow-800',
  ACTIVA: 'bg-green-100 text-green-800',
  CERRADA: 'bg-gray-100 text-gray-700',
  ARCHIVADA: 'bg-slate-100 text-slate-600',
}
