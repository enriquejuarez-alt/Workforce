import { Response } from 'express'
import * as XLSX from 'xlsx'
import { v4 as uuidv4 } from 'uuid'
import fs from 'fs'
import prisma from '../prisma'
import { createAuditLog } from '../utils/audit'
import { getUserPermission } from '../utils/permissions'
import { AuthRequest } from '../middleware/auth'

const REQUIRED_COLUMNS = ['DNI', 'USUARIO', 'NOMBRE']
const ALLOWED_COLUMNS = ['DNI', 'USUARIO', 'NOMBRE', 'SUPERIOR', 'SEGMENTO', 'HORARIOS',
  'ESTADO', 'CONTRATO', 'SITIO', 'MODALIDAD', 'JEFE']

function normalizeCell(col: string, rawValue: any): string {
  if (rawValue === null || rawValue === undefined) return ''
  // Excel stores time-formatted cells as a fraction of 24h (e.g. 8:00 → 0.3333)
  if (col === 'HORARIOS' && typeof rawValue === 'number') {
    const totalSec = Math.round(rawValue * 86400)
    const h = Math.floor(totalSec / 3600) % 24
    const m = Math.floor((totalSec % 3600) / 60)
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }
  return String(rawValue).trim()
}

interface PreviewStore {
  servicio_id: number
  mes: number
  anio: number
  rows: any[]
  errors: any[]
  stats: any
  filePath: string
  fileName: string
}

const pendingPreviews = new Map<string, PreviewStore>()

export const validateExcel = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se proporcionó archivo' })

    const { servicio_id, mes, anio } = req.body
    if (!servicio_id || !mes || !anio) {
      fs.unlinkSync(req.file.path)
      return res.status(400).json({ error: 'servicio_id, mes y anio son requeridos' })
    }

    const adminUser = req.user?.rol === 'ADMINISTRADOR'
    if (!adminUser) {
      const permiso = await getUserPermission(req.user!.userId, parseInt(servicio_id))
      if (!permiso?.puede_cargar_excel) {
        fs.unlinkSync(req.file.path)
        return res.status(403).json({ error: 'Sin permiso para cargar Excel en este servicio' })
      }
    }

    const workbook = XLSX.readFile(req.file.path)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(worksheet, { defval: '' }) as Record<string, any>[]

    if (data.length === 0) {
      fs.unlinkSync(req.file.path)
      return res.status(400).json({ error: 'El archivo está vacío' })
    }

    const headers = Object.keys(data[0]).map((h) => h.toUpperCase().trim())
    const missingColumns = REQUIRED_COLUMNS.filter((col) => !headers.includes(col))
    if (missingColumns.length > 0) {
      fs.unlinkSync(req.file.path)
      return res.status(400).json({
        error: `Faltan columnas obligatorias: ${missingColumns.join(', ')}`,
      })
    }

    const normalizedRows: any[] = []
    const errors: any[] = []

    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      const normalized: any = {}

      for (const col of ALLOWED_COLUMNS) {
        const key = Object.keys(row).find((k) => k.toUpperCase().trim() === col)
        normalized[col.toLowerCase()] = key ? normalizeCell(col, row[key]) : ''
      }

      const rowErrors: string[] = []
      if (!normalized.dni) rowErrors.push('DNI requerido')
      if (!normalized.usuario) rowErrors.push('USUARIO requerido')
      if (!normalized.nombre) rowErrors.push('NOMBRE requerido')

      if (rowErrors.length > 0) {
        errors.push({ fila: i + 2, datos: normalized, errores: rowErrors })
      } else {
        normalizedRows.push(normalized)
      }
    }

    const dnis = normalizedRows.map((r) => r.dni)
    const users = normalizedRows.map((r) => r.usuario)

    const existingByDni = await prisma.agente.findMany({
      where: { dni: { in: dnis } },
      select: { id: true, dni: true, usuario: true },
    })
    const existingByUser = await prisma.agente.findMany({
      where: { usuario: { in: users } },
      select: { id: true, dni: true, usuario: true },
    })

    const existingDniSet = new Set(existingByDni.map((a) => a.dni))
    const existingUserSet = new Set(existingByUser.map((a) => a.usuario))

    let nuevos = 0
    let actualizados = 0

    const processedRows = normalizedRows.map((row) => {
      const isNew = !existingDniSet.has(row.dni) && !existingUserSet.has(row.usuario)
      if (isNew) nuevos++
      else actualizados++
      return { ...row, _status: isNew ? 'NUEVO' : 'ACTUALIZAR' }
    })

    // No presentes = solo los que ya estaban en esta nómina y no aparecen en el archivo nuevo
    const nominaExistente = await prisma.nominaMensual.findFirst({
      where: { servicio_id: parseInt(servicio_id), mes: parseInt(mes), anio: parseInt(anio) },
    })
    const noPresentes = nominaExistente
      ? await prisma.agenteNominaMensual.findMany({
          where: { nomina_mensual_id: nominaExistente.id, dni: { notIn: dnis }, presente_en_nomina: true },
          select: { agente_id: true, dni: true, nombre: true },
        })
      : []

    const token = uuidv4()
    pendingPreviews.set(token, {
      servicio_id: parseInt(servicio_id),
      mes: parseInt(mes),
      anio: parseInt(anio),
      rows: processedRows,
      errors,
      stats: { total: data.length, nuevos, actualizados, errores: errors.length, no_presentes: noPresentes.length },
      filePath: req.file.path,
      fileName: req.file.originalname,
    })

    setTimeout(() => {
      if (pendingPreviews.has(token)) {
        const preview = pendingPreviews.get(token)!
        if (fs.existsSync(preview.filePath)) fs.unlinkSync(preview.filePath)
        pendingPreviews.delete(token)
      }
    }, 30 * 60 * 1000)

    return res.json({
      token,
      stats: { total: data.length, nuevos, actualizados, errores: errors.length, no_presentes: noPresentes.length },
      rows: processedRows.slice(0, 100),
      total_rows: processedRows.length,
      errors: errors.slice(0, 50),
      no_presentes: noPresentes.slice(0, 50),
    })
  } catch (err) {
    console.error(err)
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
    return res.status(500).json({ error: 'Error al procesar el archivo' })
  }
}

export const confirmExcel = async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.body
    const preview = pendingPreviews.get(token)
    if (!preview) return res.status(404).json({ error: 'Preview expirado o no encontrado' })

    const { servicio_id, mes, anio, rows, stats, fileName } = preview
    pendingPreviews.delete(token)
    if (fs.existsSync(preview.filePath)) fs.unlinkSync(preview.filePath)

    const servicio = await prisma.servicio.findUnique({ where: { id: servicio_id } })
    if (!servicio) return res.status(404).json({ error: 'Servicio no encontrado' })

    let nomina = await prisma.nominaMensual.findFirst({
      where: { servicio_id, mes, anio },
    })
    if (!nomina) {
      nomina = await prisma.nominaMensual.create({
        data: {
          servicio_id, mes, anio, estado: 'ACTIVA',
          archivo_nombre: fileName,
          cargado_por: req.user!.userId,
          fecha_carga: new Date(),
        },
      })
    } else {
      nomina = await prisma.nominaMensual.update({
        where: { id: nomina.id },
        data: {
          archivo_nombre: fileName,
          cargado_por: req.user!.userId,
          fecha_carga: new Date(),
          estado: 'ACTIVA',
        },
      })
    }

    let creados = 0
    let actualizados = 0

    // Pre-cargar todos los agentes relevantes en memoria (1 query en lugar de N)
    const dniList = rows.map((r: any) => r.dni)
    const usuarioList = rows.map((r: any) => r.usuario)
    const agentesExistentes = await prisma.agente.findMany({
      where: { OR: [{ dni: { in: dniList } }, { usuario: { in: usuarioList } }] },
    })
    const agentePorDni = new Map(agentesExistentes.map((a) => [a.dni, a]))
    const agentePorUsuario = new Map(agentesExistentes.map((a) => [a.usuario, a]))

    // Pre-cargar snapshots existentes de esta nómina (1 query en lugar de N)
    const snapshotsExistentes = await prisma.agenteNominaMensual.findMany({
      where: { nomina_mensual_id: nomina.id },
      select: { id: true, agente_id: true },
    })
    const snapshotPorAgenteId = new Map(snapshotsExistentes.map((s) => [s.agente_id, s.id]))

    const updateAgentesPromises: Promise<any>[] = []
    const nuevosAgentesRows: any[] = []
    const newSnapshots: any[] = []
    const updateSnapshotIds: { id: number; data: any }[] = []

    for (const row of rows) {
      const { dni, usuario, nombre, superior, segmento, horarios, estado, contrato, sitio, modalidad, jefe } = row
      const agente = agentePorDni.get(dni) || agentePorUsuario.get(usuario)
      const snapshotFields = { dni, usuario, nombre, superior, segmento, horarios, estado, contrato, sitio, modalidad, jefe, servicio_id, presente_en_nomina: true }

      if (!agente) {
        nuevosAgentesRows.push(row)
        creados++
      } else {
        updateAgentesPromises.push(
          prisma.agente.update({ where: { id: agente.id }, data: { nombre, superior, segmento, horarios, estado, contrato, sitio, modalidad, jefe, servicio_id, presente_ultima_carga: true } })
        )
        actualizados++
        const snapId = snapshotPorAgenteId.get(agente.id)
        if (snapId) updateSnapshotIds.push({ id: snapId, data: snapshotFields })
        else newSnapshots.push({ nomina_mensual_id: nomina.id, agente_id: agente.id, ...snapshotFields })
      }
    }

    // Ejecutar actualizaciones de agentes en paralelo
    await Promise.all(updateAgentesPromises)

    // Crear nuevos agentes secuencialmente (necesitamos el ID para el snapshot)
    for (const row of nuevosAgentesRows) {
      const { dni, usuario, nombre, superior, segmento, horarios, estado, contrato, sitio, modalidad, jefe } = row
      const agente = await prisma.agente.create({
        data: { dni, usuario, nombre, superior, segmento, horarios, estado, contrato, sitio, modalidad, jefe, servicio_id, activo: true, presente_ultima_carga: true },
      })
      newSnapshots.push({ nomina_mensual_id: nomina.id, agente_id: agente.id, dni, usuario, nombre, superior, segmento, horarios, estado, contrato, sitio, modalidad, jefe, servicio_id, presente_en_nomina: true })
    }

    // Batch create snapshots nuevos y actualizar existentes en paralelo
    await Promise.all([
      newSnapshots.length > 0 ? prisma.agenteNominaMensual.createMany({ data: newSnapshots, skipDuplicates: true }) : Promise.resolve(),
      ...updateSnapshotIds.map(({ id, data }) => prisma.agenteNominaMensual.update({ where: { id }, data })),
    ])

    const loadedDnis = new Set(rows.map((r: any) => r.dni))

    // Actualizar presente_ultima_carga en Agente para los que no están en el archivo
    const agentesServicio = await prisma.agente.findMany({
      where: { servicio_id },
      select: { id: true, dni: true },
    })
    const idsFuera = agentesServicio.filter((a) => !loadedDnis.has(a.dni)).map((a) => a.id)
    if (idsFuera.length > 0) {
      await prisma.agente.updateMany({ where: { id: { in: idsFuera } }, data: { presente_ultima_carga: false } })
    }

    // Marcar como no presente SOLO los snapshots que ya estaban en esta nómina
    const snapshotsAMarcar = await prisma.agenteNominaMensual.findMany({
      where: { nomina_mensual_id: nomina.id, dni: { notIn: [...loadedDnis] } },
      select: { id: true },
    })
    if (snapshotsAMarcar.length > 0) {
      await prisma.agenteNominaMensual.updateMany({
        where: { id: { in: snapshotsAMarcar.map((s) => s.id) } },
        data: { presente_en_nomina: false },
      })
    }
    const noPresentes = snapshotsAMarcar

    // Auto-add pending altas for this service/month/year
    const primeroDeMes = new Date(anio, mes - 1, 1)
    const primeroMesSig = new Date(anio, mes, 1)
    const prismaAny = prisma as any
    const pendientes = await prismaAny.capacitacion.findMany({
      where: {
        servicio_id,
        pendiente_alta: true,
        dado_de_alta: false,
        fecha_alta: { gte: primeroDeMes, lt: primeroMesSig },
      },
    })
    for (const cap of pendientes) {
      let agenteId = cap.agente_id
      if (!agenteId) {
        const searchClause: any[] = []
        if (cap.agente_dni) searchClause.push({ dni: cap.agente_dni })
        if (cap.usuario_sistema) searchClause.push({ usuario: cap.usuario_sistema })
        if (searchClause.length > 0) {
          let agente = await prisma.agente.findFirst({ where: { OR: searchClause } })
          if (!agente) {
            agente = await prisma.agente.create({
              data: {
                dni: cap.agente_dni ?? cap.usuario_sistema,
                usuario: cap.usuario_sistema ?? cap.agente_dni,
                nombre: cap.agente_nombre,
                superior: cap.superior, segmento: cap.segmento, horarios: cap.horarios,
                estado: cap.estado, contrato: cap.contrato, sitio: cap.sitio,
                modalidad: cap.modalidad, jefe: cap.jefe,
                servicio_id, activo: true, presente_ultima_carga: false,
              },
            })
          }
          agenteId = agente.id
        }
      }
      if (!agenteId) continue
      const agenteData = await prisma.agente.findUnique({ where: { id: agenteId } })
      await prisma.agenteNominaMensual.upsert({
        where: { nomina_mensual_id_agente_id: { nomina_mensual_id: nomina.id, agente_id: agenteId } },
        update: { nombre: cap.agente_nombre, usuario: agenteData?.usuario ?? '', dni: agenteData?.dni ?? '', segmento: cap.segmento, superior: cap.superior, horarios: cap.horarios, estado: cap.estado, contrato: cap.contrato, sitio: cap.sitio, modalidad: cap.modalidad, jefe: cap.jefe, servicio_id, presente_en_nomina: true },
        create: { nomina_mensual_id: nomina.id, agente_id: agenteId, nombre: cap.agente_nombre, usuario: agenteData?.usuario ?? '', dni: agenteData?.dni ?? '', segmento: cap.segmento, superior: cap.superior, horarios: cap.horarios, estado: cap.estado, contrato: cap.contrato, sitio: cap.sitio, modalidad: cap.modalidad, jefe: cap.jefe, servicio_id, presente_en_nomina: true },
      })
      await prismaAny.capacitacion.update({
        where: { id: cap.id },
        data: { dado_de_alta: true, pendiente_alta: false, agente_id: agenteId },
      })
      creados++
    }

    await prisma.nominaMensual.update({
      where: { id: nomina.id },
      data: {
        total_agentes: rows.length + pendientes.length,
        agentes_creados: creados,
        agentes_actualizados: actualizados,
        agentes_no_presentes: noPresentes.length,
        errores: stats.errores,
      },
    })

    await prisma.importacionNomina.create({
      data: {
        nomina_mensual_id: nomina.id,
        archivo_nombre: fileName,
        usuario_id: req.user!.userId,
        total_filas: rows.length,
        agentes_creados: creados,
        agentes_actualizados: actualizados,
        agentes_no_presentes: noPresentes.length,
        errores: stats.errores,
        estado: 'COMPLETADO',
      },
    })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'CONFIRMAR_CARGA_EXCEL',
      entidad: 'NominaMensual',
      entidad_id: String(nomina.id),
      servicio_id,
      nomina_mensual_id: nomina.id,
      valor_nuevo: `${rows.length} agentes, ${creados} creados, ${actualizados} actualizados`,
    })

    return res.json({
      nomina_id: nomina.id,
      total: rows.length,
      creados,
      actualizados,
      no_presentes: noPresentes.length,
      message: `Se importaron ${rows.length} agentes: ${creados} nuevos, ${actualizados} actualizados.`,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al confirmar importación' })
  }
}

export const listImportaciones = async (req: AuthRequest, res: Response) => {
  try {
    const { servicio_id } = req.query
    const adminUser = req.user?.rol === 'ADMINISTRADOR'
    let where: any = {}

    if (servicio_id) {
      where = { nomina_mensual: { servicio_id: parseInt(servicio_id as string) } }
    } else if (!adminUser) {
      const permisos = await prisma.usuarioServicioPermiso.findMany({
        where: { usuario_id: req.user!.userId },
        select: { servicio_id: true },
      })
      where = { nomina_mensual: { servicio_id: { in: permisos.map((p) => p.servicio_id) } } }
    }

    const importaciones = await prisma.importacionNomina.findMany({
      where,
      include: {
        usuario: { select: { id: true, nombre: true, email: true } },
        nomina_mensual: { include: { servicio: true } },
      },
      orderBy: { fecha_importacion: 'desc' },
      take: 100,
    })

    return res.json(importaciones)
  } catch {
    return res.status(500).json({ error: 'Error al listar importaciones' })
  }
}
