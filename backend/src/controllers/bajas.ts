import { Response } from 'express'
import prisma from '../prisma'
import { createAuditLog } from '../utils/audit'
import { AuthRequest } from '../middleware/auth'
import * as XLSX from 'xlsx'
import fs from 'fs'

function excelDateToISO(serial: number): Date {
  // Excel date serial to JS Date (handles both 1900 and 1904 systems)
  const utc_days = Math.floor(serial - 25569)
  const utc_value = utc_days * 86400
  return new Date(utc_value * 1000)
}

function normalizeStr(val: any): string {
  if (val === null || val === undefined) return ''
  return String(val).trim()
}

export const listBajas = async (req: AuthRequest, res: Response) => {
  try {
    const { servicio_id, search, tipo, fecha_desde, fecha_hasta, page = '1', limit = '50' } = req.query
    const adminUser = req.user?.rol === 'ADMINISTRADOR'
    const isLider = req.user?.rol === 'LIDER'
    const pageNum = Math.max(1, parseInt(page as string))
    const limitNum = Math.min(200, Math.max(1, parseInt(limit as string)))

    const where: any = {}

    if (isLider) {
      // LIDER: forzar filtro por su servicio
      if (!req.user?.servicioId) return res.status(403).json({ error: 'Líder sin servicio asignado' })
      where.servicio_id = req.user.servicioId
    } else if (!adminUser) {
      // USUARIO/WORKFORCE: filtrar por permisos de servicio
      const permisos = await prisma.usuarioServicioPermiso.findMany({
        where: { usuario_id: req.user!.userId, puede_ver: true },
        select: { servicio_id: true },
      })
      const serviciosPermitidos = permisos.map((p) => p.servicio_id)
      if (servicio_id) {
        where.servicio_id = parseInt(servicio_id as string)
      } else {
        where.servicio_id = { in: serviciosPermitidos }
      }
    } else {
      if (servicio_id) where.servicio_id = parseInt(servicio_id as string)
    }
    if (tipo) where.tipo = { equals: tipo as string, mode: 'insensitive' }
    if (fecha_desde) where.fecha = { ...where.fecha, gte: new Date(fecha_desde as string) }
    if (fecha_hasta) where.fecha = { ...where.fecha, lte: new Date(fecha_hasta as string) }
    if (search) {
      where.OR = [
        { dni: { contains: search as string, mode: 'insensitive' } },
        { nombre: { contains: search as string, mode: 'insensitive' } },
      ]
    }

    const [total, data] = await Promise.all([
      prisma.historicoBaja.count({ where }),
      prisma.historicoBaja.findMany({
        where,
        include: {
          servicio: { select: { id: true, nombre: true, color: true } },
          creador: { select: { id: true, nombre: true } },
        },
        orderBy: { fecha: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
    ])

    return res.json({ total, page: pageNum, limit: limitNum, data })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al listar bajas' })
  }
}

export const createBaja = async (req: AuthRequest, res: Response) => {
  try {
    const adminUser = req.user?.rol === 'ADMINISTRADOR'
    const isLider = req.user?.rol === 'LIDER'
    const {
      fecha, dni, nombre, usuario_sistema, superior, jefatura,
      servicio_id, servicio_nombre, tipo,
      segmento, horarios, estado, contrato, sitio, modalidad, jefe, observacion,
    } = req.body

    if (!fecha || !dni || !nombre) {
      return res.status(400).json({ error: 'Fecha, DNI y nombre son obligatorios' })
    }

    if (isLider) {
      // LIDER: solo puede dar de baja agentes de su propio servicio
      if (!req.user?.servicioId) return res.status(403).json({ error: 'Líder sin servicio asignado' })
      const agentePorDni = await prisma.agente.findFirst({ where: { dni: String(dni).trim() } })
      if (agentePorDni && agentePorDni.servicio_id !== req.user.servicioId) {
        return res.status(403).json({ error: 'Solo podés cargar bajas de agentes de tu propio servicio' })
      }
      // También validar que el servicio_id enviado coincida
      if (servicio_id && parseInt(servicio_id) !== req.user.servicioId) {
        return res.status(403).json({ error: 'Solo podés cargar bajas de tu propio servicio' })
      }
    } else if (!adminUser && servicio_id) {
      const permiso = await prisma.usuarioServicioPermiso.findFirst({
        where: { usuario_id: req.user!.userId, servicio_id: parseInt(servicio_id), puede_ver: true },
      })
      if (!permiso) return res.status(403).json({ error: 'Sin permiso para este servicio' })
    }

    // Check if agent exists and deactivate
    const agente = await prisma.agente.findFirst({ where: { dni: String(dni).trim() } })

    const baja = await prisma.historicoBaja.create({
      data: {
        fecha: new Date(fecha),
        dni: String(dni).trim(),
        nombre: String(nombre).trim(),
        usuario_sistema: usuario_sistema ? String(usuario_sistema).trim() : null,
        superior: superior || null,
        jefatura: jefatura || null,
        servicio_id: servicio_id ? parseInt(servicio_id) : null,
        servicio_nombre: servicio_nombre || null,
        tipo: tipo || null,
        segmento: segmento || null,
        horarios: horarios || null,
        estado: estado || null,
        contrato: contrato || null,
        sitio: sitio || null,
        modalidad: modalidad || null,
        jefe: jefe || null,
        observacion: observacion || null,
        agente_id: agente?.id ?? null,
        creado_por: req.user!.userId,
      },
      include: {
        servicio: { select: { id: true, nombre: true, color: true } },
        creador: { select: { id: true, nombre: true } },
      },
    })

    if (agente) {
      await prisma.agente.update({ where: { id: agente.id }, data: { activo: false } })
    }

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'CREAR_BAJA',
      entidad: 'HistoricoBaja',
      entidad_id: String(baja.id),
      servicio_id: baja.servicio_id ?? undefined,
      valor_nuevo: `${baja.nombre} (DNI: ${baja.dni}) - ${baja.tipo}`,
    })

    return res.status(201).json(baja)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al crear baja' })
  }
}

export const updateBaja = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const adminUser = req.user?.rol === 'ADMINISTRADOR'

    const existing = await prisma.historicoBaja.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Baja no encontrada' })

    if (!adminUser) {
      if (existing.servicio_id) {
        const permiso = await prisma.usuarioServicioPermiso.findFirst({
          where: { usuario_id: req.user!.userId, servicio_id: existing.servicio_id, puede_ver: true },
        })
        if (!permiso) return res.status(403).json({ error: 'Sin permiso para este servicio' })
      }
    }

    const {
      fecha, dni, nombre, usuario_sistema, superior, jefatura,
      servicio_id, servicio_nombre, tipo,
      segmento, horarios, estado, contrato, sitio, modalidad, jefe, observacion,
    } = req.body

    const updated = await prisma.historicoBaja.update({
      where: { id },
      data: {
        ...(fecha && { fecha: new Date(fecha) }),
        ...(dni && { dni: String(dni).trim() }),
        ...(nombre && { nombre: String(nombre).trim() }),
        usuario_sistema: usuario_sistema !== undefined ? (usuario_sistema || null) : undefined,
        superior: superior !== undefined ? (superior || null) : undefined,
        jefatura: jefatura !== undefined ? (jefatura || null) : undefined,
        ...(servicio_id !== undefined && { servicio_id: servicio_id ? parseInt(servicio_id) : null }),
        servicio_nombre: servicio_nombre !== undefined ? (servicio_nombre || null) : undefined,
        tipo: tipo !== undefined ? (tipo || null) : undefined,
        segmento: segmento !== undefined ? (segmento || null) : undefined,
        horarios: horarios !== undefined ? (horarios || null) : undefined,
        estado: estado !== undefined ? (estado || null) : undefined,
        contrato: contrato !== undefined ? (contrato || null) : undefined,
        sitio: sitio !== undefined ? (sitio || null) : undefined,
        modalidad: modalidad !== undefined ? (modalidad || null) : undefined,
        jefe: jefe !== undefined ? (jefe || null) : undefined,
        observacion: observacion !== undefined ? (observacion || null) : undefined,
      },
      include: {
        servicio: { select: { id: true, nombre: true, color: true } },
        creador: { select: { id: true, nombre: true } },
      },
    })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'EDITAR_BAJA',
      entidad: 'HistoricoBaja',
      entidad_id: String(id),
      servicio_id: updated.servicio_id ?? undefined,
    })

    return res.json(updated)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al actualizar baja' })
  }
}

export const deleteBaja = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const existing = await prisma.historicoBaja.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Baja no encontrada' })

    await prisma.historicoBaja.delete({ where: { id } })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'ELIMINAR_BAJA',
      entidad: 'HistoricoBaja',
      entidad_id: String(id),
      servicio_id: existing.servicio_id ?? undefined,
      valor_anterior: `${existing.nombre} (DNI: ${existing.dni})`,
    })

    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al eliminar baja' })
  }
}

export const importBajas = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' })

    const { servicio_id } = req.body
    if (!servicio_id) {
      fs.unlinkSync(req.file.path)
      return res.status(400).json({ error: 'Debe seleccionar un servicio' })
    }

    const servicioIdNum = parseInt(servicio_id)
    const servicio = await prisma.servicio.findUnique({ where: { id: servicioIdNum } })
    if (!servicio) {
      fs.unlinkSync(req.file.path)
      return res.status(404).json({ error: 'Servicio no encontrado' })
    }

    const wb = XLSX.readFile(req.file.path)
    fs.unlinkSync(req.file.path)

    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

    // Headers in row 5 (index 5): Fecha, DNI Asesor, Asesor, Líder, Jefatura, null, Servicio, Observacion
    // Data starts at row 6 (index 6)
    const dataRows = rows.slice(6).filter((r) => r && r[1] && r[2])

    let created = 0
    let updated = 0
    let errors = 0
    const errorDetails: string[] = []

    for (const row of dataRows) {
      try {
        const rawFecha = row[0]
        const rawDni = row[1]
        const rawNombre = row[2]
        const rawSuperior = row[3]
        const rawJefatura = row[4]
        const rawServicioNombre = row[6]
        const rawTipo = row[7]

        if (!rawFecha || !rawDni) continue

        let fecha: Date
        if (typeof rawFecha === 'number') {
          fecha = excelDateToISO(rawFecha)
        } else {
          fecha = new Date(rawFecha)
        }

        const dni = normalizeStr(rawDni)
        const nombre = normalizeStr(rawNombre)

        const agente = await prisma.agente.findFirst({ where: { dni } })

        const existingBaja = await prisma.historicoBaja.findFirst({
          where: { dni, servicio_id: servicioIdNum },
        })

        const bajaData = {
          fecha,
          nombre,
          superior: normalizeStr(rawSuperior) || null,
          jefatura: normalizeStr(rawJefatura) || null,
          servicio_id: servicioIdNum,
          servicio_nombre: normalizeStr(rawServicioNombre) || null,
          tipo: normalizeStr(rawTipo) || null,
          agente_id: agente?.id ?? null,
          creado_por: req.user!.userId,
        }

        if (existingBaja) {
          await prisma.historicoBaja.update({ where: { id: existingBaja.id }, data: bajaData })
          updated++
        } else {
          await prisma.historicoBaja.create({ data: { ...bajaData, dni } })
          created++
        }

        if (agente) {
          await prisma.agente.update({ where: { id: agente.id }, data: { activo: false } })
        }
      } catch (rowErr) {
        errors++
        errorDetails.push(`Fila con DNI ${row[1]}: ${rowErr}`)
      }
    }

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'IMPORTAR_BAJAS',
      entidad: 'HistoricoBaja',
      servicio_id: servicioIdNum,
      valor_nuevo: `${created} creados, ${updated} actualizados, ${errors} errores`,
    })

    return res.json({
      ok: true,
      created,
      updated,
      errors,
      errorDetails: errorDetails.slice(0, 10),
      servicio: servicio.nombre,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al importar bajas' })
  }
}

export const getOpciones = async (req: AuthRequest, res: Response) => {
  try {
    const servicioId = req.query.servicio_id ? parseInt(req.query.servicio_id as string) : undefined

    const where: any = { presente_en_nomina: true }
    if (servicioId) where.nomina_mensual = { servicio_id: servicioId }

    // Get latest nomina for this service as source of options
    const campos = ['segmento', 'estado', 'sitio', 'superior', 'jefe'] as const
    const results = await Promise.all(
      campos.map((campo) =>
        prisma.agenteNominaMensual.findMany({
          where: { ...where, [campo]: { not: null } },
          select: { [campo]: true },
          distinct: [campo],
          orderBy: { [campo]: 'asc' },
        })
      )
    )

    return res.json({
      segmentos: results[0].map((r: any) => r.segmento).filter(Boolean),
      estados: results[1].map((r: any) => r.estado).filter(Boolean),
      sitios: results[2].map((r: any) => r.sitio).filter(Boolean),
      superiores: results[3].map((r: any) => r.superior).filter(Boolean),
      jefes: results[4].map((r: any) => r.jefe).filter(Boolean),
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al obtener opciones' })
  }
}

export const getTiposBajas = async (_req: AuthRequest, res: Response) => {
  try {
    const tipos = await prisma.historicoBaja.findMany({
      where: { tipo: { not: null } },
      select: { tipo: true },
      distinct: ['tipo'],
      orderBy: { tipo: 'asc' },
    })
    return res.json(tipos.map((t) => t.tipo).filter(Boolean))
  } catch {
    return res.status(500).json({ error: 'Error al obtener tipos' })
  }
}
