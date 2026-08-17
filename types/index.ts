export type Rol = 'ADMINISTRADOR' | 'USUARIO' | 'WORKFORCE' | 'CAPACITADOR' | 'LIDER' | 'VISUALIZADOR'
export type EstadoNomina = 'BORRADOR' | 'ACTIVA' | 'CERRADA' | 'ARCHIVADA'
export type EstadoLicencia = 'VIGENTE' | 'PROGRAMADA' | 'FINALIZADA'

export interface Usuario {
  id: number
  nombre: string
  email: string
  rol: Rol
  servicio_id: number | null
  activo: boolean
  fecha_creacion: string
  ultimo_acceso: string | null
  permisos?: UsuarioServicioPermiso[]
  servicio?: Servicio
}

export interface Servicio {
  id: number
  nombre: string
  descripcion: string | null
  color: string
  activo: boolean
  fecha_creacion: string
  plani_config?: {
    key: string
    label?: string
    hojaCP: string[]
    segmentos: string[]
    reductores: string[]
  } | null
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
  fecha_nacimiento: string | null
  edad?: number | null
  fecha_creacion: string
  fecha_actualizacion: string
  licencias?: Licencia[]
  cambios_temporales?: CambioServicioTemporal[]
  cambios_horario?: CambioHorario[]
  capacitaciones?: Capacitacion[]
  remociones?: Remocion[]
  vacaciones?: Pick<Vacacion, 'id' | 'fecha_desde' | 'fecha_hasta'>[]
  snapshots?: AgenteNominaMensual[]
  servicio_historial?: AgenteServicioHistorial[]
  modalidad_historial?: AgenteModalidadHistorial[]
  superior_historial?: AgenteSuperiorHistorial[]
}

export interface AgenteServicioHistorial {
  id: number
  agente_id: number
  servicio_id: number | null
  servicio?: Pick<Servicio, 'id' | 'nombre' | 'color'>
  modalidad: string | null
  superior: string | null
  jefe: string | null
  segmento: string | null
  sitio: string | null
  contrato: string | null
  horarios: string | null
  fecha_desde: string
  fecha_hasta: string | null
  motivo: string | null
  observaciones: string | null
  creado_por: number
  creador?: Pick<Usuario, 'id' | 'nombre'>
  fecha_creacion: string
}

export interface AgenteModalidadHistorial {
  id: number
  agente_id: number
  modalidad_anterior: string | null
  modalidad_nueva: string
  fecha_efectiva: string
  motivo: string | null
  observaciones: string | null
  creado_por: number
  fecha_creacion: string
}

export interface AgenteSuperiorHistorial {
  id: number
  agente_id: number
  servicio_id: number | null
  superior_anterior: string | null
  superior_nuevo: string | null
  fecha_efectiva: string
  motivo: string | null
  observaciones: string | null
  creado_por: number
  fecha_creacion: string
}

export interface NominaMensual {
  id: number
  servicio_id: number
  servicio?: Servicio
  mes: number
  anio: number
  tipo: string
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
  /** Horas por dia trabajado, parseadas de la columna "Contratos" (ej. "6 X 5" -> 6). */
  horas_por_dia: number | null
  /** Dias trabajados por semana, parseados de la columna "Contratos" (ej. "6 X 5" -> 5). */
  dias_trabajados_semana: number | null
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

export interface HistorialServicioImportacion {
  id: number
  archivo_nombre: string
  fecha_desde_archivo: string
  fecha_hasta_archivo: string
  importado_por: number
  importador?: Pick<Usuario, 'id' | 'nombre'>
  fecha_importacion: string
  agentes_en_archivo: number
  agentes_creados: number
  agentes_no_encontrados: number
  transiciones_servicio_creadas: number
  transiciones_superior_creadas: number
  areas_sin_mapeo: string[]
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
  tipo_formacion: 'OJT' | 'TRAINING' | null
  fecha_inicio: string
  fecha_fin: string
  dado_de_alta: boolean
  pendiente_alta: boolean
  fecha_alta: string | null
  creado_por: number
  creador?: Pick<Usuario, 'id' | 'nombre'>
  fecha_creacion: string
  estado_calculado?: 'VIGENTE' | 'PROGRAMADA' | 'FINALIZADA'
  resultado: 'INSCRIPTO' | 'EN_CURSO' | 'APROBADO' | 'DESAPROBADO' | 'AUSENTE' | 'CANCELADO' | null
  calificacion: string | null
  capacitador_id: number | null
  capacitador?: Pick<Usuario, 'id' | 'nombre'>
  certificado_url: string | null
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
  tipo: string | null
  estado_remocion: 'PENDIENTE_REASIGNACION' | 'REASIGNADO' | 'TEMPORAL' | 'FINALIZADO' | 'CANCELADO' | null
  servicio_destino_id: number | null
  servicio_destino?: Pick<Servicio, 'id' | 'nombre' | 'color'>
  fecha_incorporacion_destino: string | null
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

export interface CambioHorario {
  id: number
  agente_id: number
  agente_dni: string
  agente_nombre: string
  servicio_id: number | null
  servicio?: Pick<Servicio, 'id' | 'nombre' | 'color'>
  tipo: 'TEMPORAL' | 'DEFINITIVO'
  horario_anterior: string | null
  horario_nuevo: string
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

export interface ReductorImportacion {
  id: number
  mes: number
  anio: number
  nombre: string | null
  archivo_nombre: string | null
  importado_por: number
  importador?: Pick<Usuario, 'id' | 'nombre'>
  fecha_importacion: string
  fecha_actualizacion: string
  servicios?: ReductorServicioRow[]
  _count?: { servicios: number }
}

export interface ReductorServicioRow {
  id: number
  importacion_id: number
  servicio: string
  servicio_norm: string
  deslogueo: number
  ausentismo: number
  rotacion: number
}

export interface FrancoImportacion {
  id: number
  mes: number
  anio: number
  nombre: string | null
  archivo_nombre: string | null
  importado_por: number
  importador?: Pick<Usuario, 'id' | 'nombre'>
  fecha_importacion: string
  fecha_actualizacion: string
  servicios?: FrancoServicioRow[]
  _count?: { servicios: number }
}

export interface FrancoServicioRow {
  id: number
  importacion_id: number
  servicio: string
  servicio_norm: string
  dotacion: number
  ponderado_horas: number
  ponderado_dias: number
  franco_lunes: number
  franco_martes: number
  franco_miercoles: number
  franco_jueves: number
  franco_viernes: number
  franco_sabado: number
  franco_domingo: number
}

export interface CpImportacion {
  id: number
  mes: number
  anio: number
  formato: string
  nombre: string | null
  archivo_nombre: string | null
  importado_por: number
  importador?: Pick<Usuario, 'id' | 'nombre'>
  fecha_importacion: string
  fecha_actualizacion: string
  servicios?: CpServicioRow[]
  _count?: { servicios: number }
}

export interface CpServicioRow {
  id: number
  importacion_id: number
  servicio: string
  servicio_norm: string
  dias_del_mes: number
  total_mes: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  matriz: any
}

export interface PlanificacionGuardadaListItem {
  id: number
  servicio_key: string
  servicio_nombre: string
  mes: number
  anio: number
  nombre: string | null
  cumplimiento_total: number
  personas_activas: number
  hs_requeridas: number
  fecha_guardado: string
  guardador?: Pick<Usuario, 'id' | 'nombre'>
}

export interface PlanificacionGuardadaDetalle extends PlanificacionGuardadaListItem {
  dias_del_mes: number
  tope_facturacion: number
  modo_reductor: string
  fecha_actualizacion: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resultado: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  matrices: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  agentes: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reductores: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  alertas: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  francos_servicio: any
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
  vacaciones_mes: Array<{
    agente_id: number | null
    agente_nombre: string
    agente_dni: string
    servicio_nombre: string | null
    servicio_color: string | null
    fecha_desde: string
    fecha_hasta: string
  }>
}

export interface TimelineEvento {
  tipo: 'LICENCIA' | 'CAMBIO_SERVICIO' | 'CAMBIO_TEMPORAL' | 'CAMBIO_CONTRATO' | 'CAMBIO_HORARIO' | 'CAMBIO_MODALIDAD' | 'CAMBIO_SUPERIOR' | 'CAPACITACION' | 'REMOCION' | 'VACACION' | 'BAJA'
  fecha_inicio: string
  fecha_fin: string | null
  descripcion: string
  detalle: string | null
}

export interface ProgramacionMensual {
  id: number
  servicio_id: number
  mes: number
  anio: number
  semana: number  // 0 = mes completo, 1-4 = semana específica
  nomina_id: number | null
  estado: string
  creado_por: number
  fecha_creacion: string
  servicio: Pick<Servicio, 'id' | 'nombre' | 'color'>
  nomina?: Pick<NominaMensual, 'id' | 'mes' | 'anio' | 'estado' | 'total_agentes'> | null
  requeridos?: RequeridoHorario[]
  factor?: FactorReduccion | null
  _count?: { requeridos: number }
}

export interface RequeridoHorario {
  id: number
  programacion_id: number
  fecha: string
  intervalo: string
  requeridos: number
  es_feriado: boolean
}

export interface FactorReduccion {
  id: number
  programacion_id: number
  deslogueo: number
  ausentismo: number
  rotacion: number
}

export interface SimulacionResultado {
  fecha: string
  dia_semana: string
  dia_num: number
  intervalo: string
  requeridos: number
  asignados: number
  estado: 'UNDER' | 'LIMITE' | 'OK' | 'OVER'
  agentes: string[]
}

export interface MovimientoSugerido {
  nombre: string
  de: string
  hacia: string
  agente_id: number
}

export interface CupoFeriado {
  intervalo: string
  isla: string
  asignados: number
  cupo: number
}

export interface SimulacionResponse {
  programacion: ProgramacionMensual
  nomina: SimulacionResultado[]
  simulacion: SimulacionResultado[]
  movimientos: MovimientoSugerido[]
  cupos_feriado: CupoFeriado[]
  intervalos: string[]
  fechas: { fecha: string; dia_num: number; dia_semana: string }[]
  total_agentes: number
  agentes_sin_ingreso: number
  presencia_por_fecha: Record<string, { presentes: number; francos: number }>
  stats: {
    nomina_under: number
    nomina_ok: number
    nomina_over: number
    sim_under: number
    sim_ok: number
    sim_over: number
  }
}

export interface CronogramaAgent {
  id: number
  nombre: string
  contrato: string | null
  contratoNorm: string
  segmento: string | null
  ingreso: string | null
  hora_break: string | null
  francos: string[]
  dias: Record<string, string>
}

export interface CronogramaResponse {
  agents: CronogramaAgent[]
  dates: { fecha: string; dia_num: number; dia_semana: string; dow: number }[]
  total: number
  requeridos_pico: Record<string, number>
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
