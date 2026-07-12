import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { authenticate, requireAdmin, blockRole, requireRole } from '../middleware/auth'
import { uploadExcel, uploadImagen } from '../middleware/upload'

import { login, getMe, logout } from '../controllers/auth'
import { googleAuth, googleCallback, exchangeCode } from '../controllers/authGoogle'

const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos. Esperá 15 minutos.' },
  // En dev todos los requests vienen de 127.0.0.1 (proxy Next.js) → skip para no bloquear.
  // En producción trust proxy: 1 resuelve la IP real desde X-Forwarded-For.
  skip: () => process.env.NODE_ENV !== 'production',
})
import { listUsers, createUser, updateUser, toggleUser, getUserPermissions, setUserPermission, deleteUserPermission, getUserSecciones, setUserSecciones, deleteUserSecciones } from '../controllers/users'
import { listServices, createService, updateService, toggleService, deleteService, getServiceMetrics, getServiceSegmentos } from '../controllers/services'
import { listAgents, getAgent, createAgent, updateAgent, toggleAgent, getAgenteTimeline } from '../controllers/agents'
import { listNominas, getNomina, updateNominaStatus, deleteNomina, listAgentesNomina, editAgentNomina, deleteAgentNomina, compareNominas, replicarNomina } from '../controllers/nominas'
import { validateExcel, confirmExcel, listImportaciones } from '../controllers/excel'
import { listLicencias, createLicencia, updateLicencia, deleteLicencia, importLicenciasWF, listImportacionesLicencias, deleteImportacionLicencias, getCalendarioLicencias, exportCalendarioLicencias } from '../controllers/licencias'
import { listCambios, createCambio, updateCambio, deleteCambio } from '../controllers/cambios'
import { getDashboard } from '../controllers/dashboard'
import { listAuditoria } from '../controllers/auditoria'
import { exportNomina } from '../controllers/export'
import { listBajas, createBaja, updateBaja, deleteBaja, importBajas, getTiposBajas, getOpciones } from '../controllers/bajas'
import { listCambiosContrato, createCambioContrato, updateCambioContrato, deleteCambioContrato, bulkCreateCambiosContrato } from '../controllers/cambiosContrato'
import { listCambiosHorario, createCambioHorario, updateCambioHorario, deleteCambioHorario } from '../controllers/cambiosHorario'
import { listCapacitaciones, createCapacitacion, updateCapacitacion, deleteCapacitacion, darDeAlta } from '../controllers/capacitaciones'
import { listRemociones, createRemocion, updateRemocion, deleteRemocion } from '../controllers/remociones'
import { importVacaciones, listVacaciones, listImportacionesVacaciones, deleteVacacion, deleteImportacionVacaciones } from '../controllers/vacaciones'
import { enviarReporte } from '../controllers/soporte'
import { getNotificaciones } from '../controllers/notificaciones'
import { getPlaniConfig, getPlaniNomina, updatePlaniConfig } from '../controllers/plani'
import {
  listReductorImportaciones,
  getReductorImportacion,
  createReductorImportacion,
  updateReductorServicio,
  deleteReductorImportacion,
} from '../controllers/reductores'
import { getReporteAusentismo, exportReporteAusentismo } from '../controllers/reportes'
import { getRolConfig, updateRolConfig, resetRolConfig } from '../controllers/configuracion'
import { listProgramaciones, createProgramacion, getProgramacion, deleteProgramacion, upsertRequeridos, previewRequeridos, uploadRequeridos, upsertFactor, simularProgramacion, exportProgramacion, exportFrancos, exportConversor, getCronograma, setNomina } from '../controllers/programacion'
import { analizarNomina, procesarDistribucion, descargarDistribucion, cruzarNominas } from '../controllers/distribucion'

const router = Router()

router.post('/auth/login', loginLimiter, login)
router.get('/auth/me', authenticate, getMe)
router.post('/auth/logout', authenticate, logout)
router.post('/auth/exchange', exchangeCode)
router.get('/auth/google', googleAuth)
router.get('/auth/google/callback', googleCallback)

router.get('/usuarios', authenticate, requireAdmin, listUsers)
router.post('/usuarios', authenticate, requireAdmin, createUser)
router.put('/usuarios/:id', authenticate, requireAdmin, updateUser)
router.patch('/usuarios/:id/estado', authenticate, requireAdmin, toggleUser)
router.get('/usuarios/:id/permisos', authenticate, requireAdmin, getUserPermissions)
router.put('/usuarios/:id/permisos/:servicioId', authenticate, requireAdmin, setUserPermission)
router.delete('/usuarios/:id/permisos/:servicioId', authenticate, requireAdmin, deleteUserPermission)
router.get('/usuarios/:id/secciones', authenticate, requireAdmin, getUserSecciones)
router.put('/usuarios/:id/secciones', authenticate, requireAdmin, setUserSecciones)
router.delete('/usuarios/:id/secciones', authenticate, requireAdmin, deleteUserSecciones)

router.get('/servicios', authenticate, listServices)
router.post('/servicios', authenticate, requireAdmin, createService)
router.put('/servicios/:id', authenticate, requireAdmin, updateService)
router.patch('/servicios/:id/estado', authenticate, requireAdmin, toggleService)
router.delete('/servicios/:id', authenticate, requireAdmin, deleteService)
router.get('/servicios/:id/metricas', authenticate, getServiceMetrics)
router.get('/servicios/:id/segmentos', authenticate, requireAdmin, getServiceSegmentos)

router.get('/agentes', authenticate, blockRole('CAPACITADOR'), listAgents)
router.post('/agentes', authenticate, requireRole('ADMINISTRADOR', 'WORKFORCE', 'USUARIO'), createAgent)
router.get('/agentes/:id', authenticate, blockRole('CAPACITADOR'), getAgent)
router.put('/agentes/:id', authenticate, requireRole('ADMINISTRADOR', 'WORKFORCE', 'USUARIO'), updateAgent)
router.patch('/agentes/:id/estado', authenticate, requireRole('ADMINISTRADOR', 'WORKFORCE', 'USUARIO'), toggleAgent)
router.get('/agentes/:id/timeline', authenticate, blockRole('CAPACITADOR'), getAgenteTimeline)

router.get('/nominas/comparar', authenticate, blockRole('CAPACITADOR', 'LIDER'), compareNominas)
router.get('/nominas', authenticate, blockRole('CAPACITADOR'), listNominas)
router.get('/nominas/:id', authenticate, blockRole('CAPACITADOR'), getNomina)
router.patch('/nominas/:id/estado', authenticate, requireAdmin, updateNominaStatus)
router.delete('/nominas/:id', authenticate, requireAdmin, deleteNomina)
router.post('/nominas/:id/replicar', authenticate, requireAdmin, replicarNomina)
router.get('/nominas/:nominaId/agentes', authenticate, listAgentesNomina)
router.patch('/nominas/agentes/:snapshotId', authenticate, editAgentNomina)
router.delete('/nominas/agentes/:snapshotId', authenticate, deleteAgentNomina)

router.post('/excel/validar', authenticate, uploadExcel.single('file'), validateExcel)
router.post('/excel/confirmar', authenticate, confirmExcel)
router.get('/importaciones', authenticate, listImportaciones)

router.get('/licencias/calendario/export', authenticate, blockRole('CAPACITADOR'), exportCalendarioLicencias)
router.get('/licencias/calendario', authenticate, blockRole('CAPACITADOR'), getCalendarioLicencias)
router.get('/licencias', authenticate, blockRole('CAPACITADOR'), listLicencias)
router.post('/licencias', authenticate, blockRole('CAPACITADOR'), createLicencia)
router.put('/licencias/:id', authenticate, updateLicencia)
router.delete('/licencias/:id', authenticate, requireAdmin, deleteLicencia)
router.post('/licencias/import-wf', authenticate, requireAdmin, uploadExcel.single('file'), importLicenciasWF)
router.get('/licencias/importaciones', authenticate, requireAdmin, listImportacionesLicencias)
router.delete('/licencias/importaciones/:id', authenticate, requireAdmin, deleteImportacionLicencias)

router.get('/cambios', authenticate, listCambios)
router.post('/cambios', authenticate, createCambio)
router.put('/cambios/:id', authenticate, updateCambio)
router.delete('/cambios/:id', authenticate, requireAdmin, deleteCambio)

router.get('/dashboard', authenticate, blockRole('CAPACITADOR'), getDashboard)
router.get('/notificaciones', authenticate, getNotificaciones)
router.get('/auditoria', authenticate, requireAdmin, listAuditoria)
router.get('/export/nomina/:nominaId', authenticate, exportNomina)

router.get('/bajas/tipos', authenticate, blockRole('CAPACITADOR'), getTiposBajas)
router.get('/bajas/opciones', authenticate, blockRole('CAPACITADOR'), getOpciones)
router.post('/bajas/import', authenticate, requireAdmin, uploadExcel.single('file'), importBajas)
router.get('/bajas', authenticate, blockRole('CAPACITADOR'), listBajas)
router.post('/bajas', authenticate, blockRole('CAPACITADOR'), createBaja)
router.put('/bajas/:id', authenticate, requireRole('ADMINISTRADOR', 'WORKFORCE', 'USUARIO'), updateBaja)
router.delete('/bajas/:id', authenticate, requireAdmin, deleteBaja)

router.get('/cambios-contrato', authenticate, listCambiosContrato)
router.post('/cambios-contrato/bulk', authenticate, bulkCreateCambiosContrato)
router.post('/cambios-contrato', authenticate, createCambioContrato)
router.put('/cambios-contrato/:id', authenticate, updateCambioContrato)
router.delete('/cambios-contrato/:id', authenticate, requireAdmin, deleteCambioContrato)

router.get('/cambios-horario', authenticate, listCambiosHorario)
router.post('/cambios-horario', authenticate, createCambioHorario)
router.put('/cambios-horario/:id', authenticate, updateCambioHorario)
router.delete('/cambios-horario/:id', authenticate, requireAdmin, deleteCambioHorario)

router.get('/capacitaciones', authenticate, listCapacitaciones)
router.post('/capacitaciones', authenticate, createCapacitacion)
router.put('/capacitaciones/:id', authenticate, updateCapacitacion)
router.delete('/capacitaciones/:id', authenticate, requireAdmin, deleteCapacitacion)
router.post('/capacitaciones/:id/dar-de-alta', authenticate, darDeAlta)

router.get('/remociones', authenticate, listRemociones)
router.post('/remociones', authenticate, createRemocion)
router.put('/remociones/:id', authenticate, updateRemocion)
router.delete('/remociones/:id', authenticate, requireAdmin, deleteRemocion)

router.post('/soporte/reporte', authenticate, uploadImagen.single('captura'), enviarReporte)

router.get('/programacion/:id/export', authenticate, blockRole('CAPACITADOR', 'LIDER'), exportProgramacion)
router.get('/programacion/:id/francos', authenticate, blockRole('CAPACITADOR', 'LIDER'), exportFrancos)
router.get('/programacion/:id/conversor', authenticate, blockRole('CAPACITADOR', 'LIDER'), exportConversor)
router.get('/programacion/:id/cronograma', authenticate, blockRole('CAPACITADOR', 'LIDER'), getCronograma)
router.patch('/programacion/:id/nomina', authenticate, blockRole('CAPACITADOR', 'LIDER'), setNomina)
router.get('/programacion/:id/simular', authenticate, blockRole('CAPACITADOR', 'LIDER'), simularProgramacion)
router.post('/programacion/:id/preview-requeridos', authenticate, blockRole('CAPACITADOR', 'LIDER'), uploadExcel.single('file'), previewRequeridos)
router.post('/programacion/:id/upload-requeridos', authenticate, blockRole('CAPACITADOR', 'LIDER'), uploadExcel.single('file'), uploadRequeridos)
router.get('/programacion/:id', authenticate, blockRole('CAPACITADOR', 'LIDER'), getProgramacion)
router.delete('/programacion/:id', authenticate, requireAdmin, deleteProgramacion)
router.put('/programacion/:id/requeridos', authenticate, blockRole('CAPACITADOR', 'LIDER'), upsertRequeridos)
router.put('/programacion/:id/factor', authenticate, blockRole('CAPACITADOR', 'LIDER'), upsertFactor)
router.get('/programacion', authenticate, blockRole('CAPACITADOR', 'LIDER'), listProgramaciones)
router.post('/programacion', authenticate, blockRole('CAPACITADOR', 'LIDER'), createProgramacion)

router.post('/vacaciones/import', authenticate, requireAdmin, uploadExcel.single('file'), importVacaciones)
router.get('/vacaciones', authenticate, listVacaciones)
router.get('/vacaciones/importaciones', authenticate, requireAdmin, listImportacionesVacaciones)
router.delete('/vacaciones/:id', authenticate, requireAdmin, deleteVacacion)
router.delete('/vacaciones/importaciones/:id', authenticate, requireAdmin, deleteImportacionVacaciones)

router.get('/reductores', authenticate, listReductorImportaciones)
router.get('/reductores/:id', authenticate, getReductorImportacion)
router.post('/reductores', authenticate, createReductorImportacion)
router.patch('/reductores/:id/servicios/:servicioId', authenticate, updateReductorServicio)
router.delete('/reductores/:id', authenticate, deleteReductorImportacion)

router.get('/reportes/ausentismo/export', authenticate, blockRole('CAPACITADOR'), exportReporteAusentismo)
router.get('/reportes/ausentismo', authenticate, blockRole('CAPACITADOR'), getReporteAusentismo)

router.get('/plani/config', authenticate, getPlaniConfig)
router.get('/plani/nomina', authenticate, getPlaniNomina)
router.put('/servicios/:id/plani-config', authenticate, requireAdmin, updatePlaniConfig)

router.post('/distribucion/analizar', authenticate, uploadExcel.single('file'), analizarNomina)
router.post('/distribucion/procesar', authenticate, procesarDistribucion)
router.post('/distribucion/descargar', authenticate, descargarDistribucion)
router.post('/distribucion/cruzar', authenticate, uploadExcel.array('files', 2), cruzarNominas)

router.get('/configuracion/roles', authenticate, getRolConfig)
router.put('/configuracion/roles', authenticate, requireAdmin, updateRolConfig)
router.delete('/configuracion/roles/:rol', authenticate, requireAdmin, resetRolConfig)

export default router
