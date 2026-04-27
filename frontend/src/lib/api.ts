import api from './axios'
import type {
  Usuario, Servicio, UsuarioServicioPermiso, Agente, NominaMensual,
  AgenteNominaMensual, Licencia, CambioServicioTemporal, ImportacionNomina,
  AuditoriaLog, DashboardData, ExcelPreview, HistoricoBaja,
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
  list: (params?: Record<string, any>) => api.get<Licencia[]>('/licencias', { params }),
  create: (data: Partial<Licencia>) => api.post<Licencia>('/licencias', data),
  update: (id: number, data: Partial<Licencia>) => api.put<Licencia>(`/licencias/${id}`, data),
  delete: (id: number) => api.delete(`/licencias/${id}`),
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

// Exportar
export const exportApi = {
  nomina: (nominaId: number) =>
    api.get(`/export/nomina/${nominaId}`, { responseType: 'blob' }),
}
