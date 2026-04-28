import { Router } from 'express'
import { authenticate, requireAdmin } from '../middleware/auth'
import { uploadExcel } from '../middleware/upload'

import { login, getMe, logout } from '../controllers/auth'
import { listUsers, createUser, updateUser, toggleUser, getUserPermissions, setUserPermission, deleteUserPermission } from '../controllers/users'
import { listServices, createService, updateService, toggleService, deleteService, getServiceMetrics, getServiceSegmentos } from '../controllers/services'
import { listAgents, getAgent, createAgent, updateAgent, toggleAgent } from '../controllers/agents'
import { listNominas, getNomina, updateNominaStatus, deleteNomina, listAgentesNomina, editAgentNomina, deleteAgentNomina, compareNominas, replicarNomina } from '../controllers/nominas'
import { validateExcel, confirmExcel, listImportaciones } from '../controllers/excel'
import { listLicencias, createLicencia, updateLicencia, deleteLicencia, importLicenciasWF, listImportacionesLicencias, deleteImportacionLicencias } from '../controllers/licencias'
import { listCambios, createCambio, updateCambio, deleteCambio } from '../controllers/cambios'
import { getDashboard } from '../controllers/dashboard'
import { listAuditoria } from '../controllers/auditoria'
import { exportNomina } from '../controllers/export'
import { listBajas, createBaja, updateBaja, deleteBaja, importBajas, getTiposBajas, getOpciones } from '../controllers/bajas'
import { listCambiosContrato, createCambioContrato, updateCambioContrato, deleteCambioContrato } from '../controllers/cambiosContrato'
import { listCapacitaciones, createCapacitacion, updateCapacitacion, deleteCapacitacion, darDeAlta } from '../controllers/capacitaciones'
import { listRemociones, createRemocion, updateRemocion, deleteRemocion } from '../controllers/remociones'
import { importVacaciones, listVacaciones, listImportacionesVacaciones, deleteVacacion, deleteImportacionVacaciones } from '../controllers/vacaciones'

const router = Router()

router.post('/auth/login', login)
router.get('/auth/me', authenticate, getMe)
router.post('/auth/logout', authenticate, logout)

router.get('/usuarios', authenticate, requireAdmin, listUsers)
router.post('/usuarios', authenticate, requireAdmin, createUser)
router.put('/usuarios/:id', authenticate, requireAdmin, updateUser)
router.patch('/usuarios/:id/estado', authenticate, requireAdmin, toggleUser)
router.get('/usuarios/:id/permisos', authenticate, requireAdmin, getUserPermissions)
router.put('/usuarios/:id/permisos/:servicioId', authenticate, requireAdmin, setUserPermission)
router.delete('/usuarios/:id/permisos/:servicioId', authenticate, requireAdmin, deleteUserPermission)

router.get('/servicios', authenticate, listServices)
router.post('/servicios', authenticate, requireAdmin, createService)
router.put('/servicios/:id', authenticate, requireAdmin, updateService)
router.patch('/servicios/:id/estado', authenticate, requireAdmin, toggleService)
router.delete('/servicios/:id', authenticate, requireAdmin, deleteService)
router.get('/servicios/:id/metricas', authenticate, getServiceMetrics)
router.get('/servicios/:id/segmentos', authenticate, requireAdmin, getServiceSegmentos)

router.get('/agentes', authenticate, listAgents)
router.post('/agentes', authenticate, createAgent)
router.get('/agentes/:id', authenticate, getAgent)
router.put('/agentes/:id', authenticate, updateAgent)
router.patch('/agentes/:id/estado', authenticate, toggleAgent)

router.get('/nominas/comparar', authenticate, compareNominas)
router.get('/nominas', authenticate, listNominas)
router.get('/nominas/:id', authenticate, getNomina)
router.patch('/nominas/:id/estado', authenticate, requireAdmin, updateNominaStatus)
router.delete('/nominas/:id', authenticate, requireAdmin, deleteNomina)
router.post('/nominas/:id/replicar', authenticate, requireAdmin, replicarNomina)
router.get('/nominas/:nominaId/agentes', authenticate, listAgentesNomina)
router.patch('/nominas/agentes/:snapshotId', authenticate, editAgentNomina)
router.delete('/nominas/agentes/:snapshotId', authenticate, deleteAgentNomina)

router.post('/excel/validar', authenticate, uploadExcel.single('file'), validateExcel)
router.post('/excel/confirmar', authenticate, confirmExcel)
router.get('/importaciones', authenticate, listImportaciones)

router.get('/licencias', authenticate, listLicencias)
router.post('/licencias', authenticate, createLicencia)
router.put('/licencias/:id', authenticate, updateLicencia)
router.delete('/licencias/:id', authenticate, requireAdmin, deleteLicencia)
router.post('/licencias/import-wf', authenticate, requireAdmin, uploadExcel.single('file'), importLicenciasWF)
router.get('/licencias/importaciones', authenticate, requireAdmin, listImportacionesLicencias)
router.delete('/licencias/importaciones/:id', authenticate, requireAdmin, deleteImportacionLicencias)

router.get('/cambios', authenticate, listCambios)
router.post('/cambios', authenticate, createCambio)
router.put('/cambios/:id', authenticate, updateCambio)
router.delete('/cambios/:id', authenticate, requireAdmin, deleteCambio)

router.get('/dashboard', authenticate, getDashboard)
router.get('/auditoria', authenticate, requireAdmin, listAuditoria)
router.get('/export/nomina/:nominaId', authenticate, exportNomina)

router.get('/bajas/tipos', authenticate, getTiposBajas)
router.get('/bajas/opciones', authenticate, getOpciones)
router.post('/bajas/import', authenticate, requireAdmin, uploadExcel.single('file'), importBajas)
router.get('/bajas', authenticate, listBajas)
router.post('/bajas', authenticate, createBaja)
router.put('/bajas/:id', authenticate, updateBaja)
router.delete('/bajas/:id', authenticate, requireAdmin, deleteBaja)

router.get('/cambios-contrato', authenticate, listCambiosContrato)
router.post('/cambios-contrato', authenticate, createCambioContrato)
router.put('/cambios-contrato/:id', authenticate, updateCambioContrato)
router.delete('/cambios-contrato/:id', authenticate, requireAdmin, deleteCambioContrato)

router.get('/capacitaciones', authenticate, listCapacitaciones)
router.post('/capacitaciones', authenticate, createCapacitacion)
router.put('/capacitaciones/:id', authenticate, updateCapacitacion)
router.delete('/capacitaciones/:id', authenticate, requireAdmin, deleteCapacitacion)
router.post('/capacitaciones/:id/dar-de-alta', authenticate, darDeAlta)

router.get('/remociones', authenticate, listRemociones)
router.post('/remociones', authenticate, createRemocion)
router.put('/remociones/:id', authenticate, updateRemocion)
router.delete('/remociones/:id', authenticate, requireAdmin, deleteRemocion)

router.post('/vacaciones/import', authenticate, requireAdmin, uploadExcel.single('file'), importVacaciones)
router.get('/vacaciones', authenticate, listVacaciones)
router.get('/vacaciones/importaciones', authenticate, requireAdmin, listImportacionesVacaciones)
router.delete('/vacaciones/:id', authenticate, requireAdmin, deleteVacacion)
router.delete('/vacaciones/importaciones/:id', authenticate, requireAdmin, deleteImportacionVacaciones)

export default router
