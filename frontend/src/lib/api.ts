import api from './axios'
import type {
  Usuario, Servicio, UsuarioServicioPermiso, Agente, NominaMensual,
  AgenteNominaMensual, Licencia, LicenciaImportacion, CambioServicioTemporal, ImportacionNomina,
  AuditoriaLog, DashboardData, ExcelPreview, HistoricoBaja, CambioContrato, Capacitacion, Remocion,
  Vacacion, VacacionImportacion, CalendarioEvento, TimelineEvento,
} from '../types'

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ token: string; user: Usuario }>('/auth/login', { email, password }),
  me: () => api.get<Usuario>('/auth/me'),
  logout: () => api.post('/auth/logout'),
}

// Usuarios
export const usersApi = {
  list: () => api.get<Usuario[]>('/usuarios'),
  create: (data: Partial<Usuario> & { password: string }) => api.post<Usuario>('/usuarios', data),
  update: (id: number, data: Partial<Usuario> & { password?: string }) => api.put<Usuario>(`/usuarios/${id}`, data),
  toggle: (id: number) => api.patch<{ activo: boolean }>(`/usuarios/${id}/estado`),
  getPermissions: (id: number) => api.get<UsuarioServicioPermiso[]>(`/usuarios/${id}/permisos`),
  setPermission: (id: number, servicioId: number, data: Partial<UsuarioServicioPermiso>) =>
    api.put<UsuarioServicioPermiso>(`/usuarios/${id}/permisos/${servicioId}`, data),
  deletePermission: (id: number, servicioId: number) =>
    api.delete(`/usuarios/${id}/permisos/${servicioId}`),
}

// Servicios
export const serviciosApi = {
  list: () => api.get<Servicio[]>('/servicios'),
  create: (data: Partial<Servicio>) => api.post<Servicio>('/servicios', data),
  update: (id: number, data: Partial<Servicio>) => api.put<Servicio>(`/servicios/${id}`, data),
  toggle: (id: number) => api.patch<{ activo: boolean }>(`/servicios/${id}/estado`),
  delete: (id: number) => api.delete(`/servicios/${id}`),
  metricas: (id: number) => api.get(`/servicios/${id}/metricas`),
  segmentos: (id: number) => api.get<string[]>(`/servicios/${id}/segmentos`),
}

// Agentes
export const agentesApi = {
  list: (params?: Record<string, any>) => api.get<Agente[]>('/agentes', { params }),
  get: (id: number) => api.get<Agente>(`/agentes/${id}`),
  create: (data: Partial<Agente>) => api.post<Agente>('/agentes', data),
  update: (id: number, data: Partial<Agente>) => api.put<Agente>(`/agentes/${id}`, data),
  toggle: (id: number) => api.patch<{ activo: boolean }>(`/agentes/${id}/estado`),
  timeline: (id: number) => api.get<TimelineEvento[]>(`/agentes/${id}/timeline`),
}

// Nóminas
export const nominasApi = {
  list: (params?: Record<string, any>) => api.get<NominaMensual[]>('/nominas', { params }),
  get: (id: number) => api.get<NominaMensual>(`/nominas/${id}`),
  updateStatus: (id: number, estado: string) => api.patch(`/nominas/${id}/estado`, { estado }),
  agentes: (nominaId: number, params?: Record<string, any>) =>
    api.get<AgenteNominaMensual[]>(`/nominas/${nominaId}/agentes`, { params }),
  editAgente: (snapshotId: number, data: Partial<AgenteNominaMensual>) =>
    api.patch<AgenteNominaMensual>(`/nominas/agentes/${snapshotId}`, data),
  comparar: (params: { servicioId: number; mes1: number; anio1: number; mes2: number; anio2: number }) =>
    api.get('/nominas/comparar', { params }),
  replicar: (id: number) =>
    api.post<{ message: string; nomina: NominaMensual }>(`/nominas/${id}/replicar`),
  delete: (id: number) => api.delete(`/nominas/${id}`),
  deleteAgente: (snapshotId: number) =>
    api.delete(`/nominas/agentes/${snapshotId}`),
}

// Excel
export const excelApi = {
  validar: (formData: FormData) =>
    api.post<ExcelPreview>('/excel/validar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  confirmar: (token: string) => api.post('/excel/confirmar', { token }),
  importaciones: (params?: Record<string, any>) =>
    api.get<ImportacionNomina[]>('/importaciones', { params }),
}

// Licencias
export const licenciasApi = {
  calendario: (mes: number, anio: number, servicioId?: number | null) =>
    api.get<CalendarioEvento[]>('/licencias/calendario', { params: { mes, anio, ...(servicioId ? { servicio_id: servicioId } : {}) } }),
  exportCalendario: (mes: number, anio: number, servicioId?: number | null) =>
    api.get('/licencias/calendario/export', { params: { mes, anio, ...(servicioId ? { servicio_id: servicioId } : {}) }, responseType: 'blob' }),
  list: (params?: Record<string, any>) => api.get<Licencia[]>('/licencias', { params }),
  create: (data: Partial<Licencia>) => api.post<Licencia>('/licencias', data),
  update: (id: number, data: Partial<Licencia>) => api.put<Licencia>(`/licencias/${id}`, data),
  delete: (id: number) => api.delete(`/licencias/${id}`),
  importWF: (formData: FormData) =>
    api.post<{ ok: boolean; total_dias: number; total_periodos: number; agentes_encontrados: number; agentes_no_encontrados: number; saltados_menos_14: number }>(
      '/licencias/import-wf',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ),
  importaciones: () => api.get<LicenciaImportacion[]>('/licencias/importaciones'),
  deleteImportacion: (id: number) => api.delete(`/licencias/importaciones/${id}`),
}

// Cambios temporales
export const cambiosApi = {
  list: (params?: Record<string, any>) => api.get<CambioServicioTemporal[]>('/cambios', { params }),
  create: (data: Partial<CambioServicioTemporal>) =>
    api.post<CambioServicioTemporal>('/cambios', data),
  update: (id: number, data: Partial<CambioServicioTemporal>) =>
    api.put<CambioServicioTemporal>(`/cambios/${id}`, data),
  delete: (id: number) => api.delete(`/cambios/${id}`),
}

// Dashboard
export const dashboardApi = {
  get: () => api.get<DashboardData>('/dashboard'),
}

// Auditoría
export const auditoriaApi = {
  list: (params?: Record<string, any>) =>
    api.get<{ total: number; page: number; limit: number; data: AuditoriaLog[] }>('/auditoria', { params }),
}

// Bajas
export const bajasApi = {
  list: (params?: Record<string, any>) =>
    api.get<{ total: number; page: number; limit: number; data: HistoricoBaja[] }>('/bajas', { params }),
  create: (data: Partial<HistoricoBaja>) => api.post<HistoricoBaja>('/bajas', data),
  update: (id: number, data: Partial<HistoricoBaja>) => api.put<HistoricoBaja>(`/bajas/${id}`, data),
  delete: (id: number) => api.delete(`/bajas/${id}`),
  tipos: () => api.get<string[]>('/bajas/tipos'),
  opciones: (servicioId?: number) =>
    api.get<{ segmentos: string[]; estados: string[]; sitios: string[]; superiores: string[]; jefes: string[] }>(
      '/bajas/opciones',
      { params: servicioId ? { servicio_id: servicioId } : {} },
    ),
  import: (formData: FormData) =>
    api.post<{ ok: boolean; created: number; updated: number; errors: number; servicio: string }>(
      '/bajas/import',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ),
}

// Capacitaciones
export const capacitacionesApi = {
  list: (params?: Record<string, any>) => api.get<Capacitacion[]>('/capacitaciones', { params }),
  create: (data: any) => api.post<Capacitacion>('/capacitaciones', data),
  update: (id: number, data: any) => api.put<Capacitacion>(`/capacitaciones/${id}`, data),
  delete: (id: number) => api.delete(`/capacitaciones/${id}`),
  darDeAlta: (id: number, data: any) => api.post<Capacitacion>(`/capacitaciones/${id}/dar-de-alta`, data),
}

// Remociones
export const remocionesApi = {
  list: (params?: Record<string, any>) =>
    api.get<{ total: number; page: number; limit: number; data: Remocion[] }>('/remociones', { params }),
  create: (data: Partial<Remocion>) => api.post<Remocion>('/remociones', data),
  update: (id: number, data: Partial<Remocion>) => api.put<Remocion>(`/remociones/${id}`, data),
  delete: (id: number) => api.delete(`/remociones/${id}`),
}

// Cambios de contrato
export const cambiosContratoApi = {
  list: (params?: Record<string, any>) => api.get<CambioContrato[]>('/cambios-contrato', { params }),
  create: (data: any) => api.post<CambioContrato>('/cambios-contrato', data),
  update: (id: number, data: any) => api.put<CambioContrato>(`/cambios-contrato/${id}`, data),
  delete: (id: number) => api.delete(`/cambios-contrato/${id}`),
}

// Exportar
export const exportApi = {
  nomina: (nominaId: number) =>
    api.get(`/export/nomina/${nominaId}`, { responseType: 'blob' }),
}

// Notificaciones
export const notificacionesApi = {
  get: () => api.get('/notificaciones'),
}

// Soporte
export const soporteApi = {
  enviarReporte: (formData: FormData) =>
    api.post<{ ok: boolean; message: string }>(
      '/soporte/reporte',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ),
}

// Vacaciones WF
export const vacacionesApi = {
  list: (params?: Record<string, any>) => api.get<Vacacion[]>('/vacaciones', { params }),
  import: (formData: FormData) =>
    api.post<{ ok: boolean; total_dias: number; total_periodos: number; agentes_encontrados: number; agentes_no_encontrados: number }>(
      '/vacaciones/import',
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    ),
  importaciones: () => api.get<VacacionImportacion[]>('/vacaciones/importaciones'),
  delete: (id: number) => api.delete(`/vacaciones/${id}`),
  deleteImportacion: (id: number) => api.delete(`/vacaciones/importaciones/${id}`),
}
