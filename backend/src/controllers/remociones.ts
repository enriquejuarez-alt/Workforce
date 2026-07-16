import { Response } from 'express'
import prisma from '../prisma'
import { createAuditLog } from '../utils/audit'
import { AuthRequest } from '../middleware/auth'

export const MOTIVOS_REMOCION = [
  'BAJA_PERFORMANCE',
  'ALERTA_MATCH',
  'REMOCION_CLIENTE',
  'OTRO',
]

export const TIPOS_REMOCION = [
  'CAMBIO_OPERATIVO',
  'DESEMPENO',
  'SOLICITUD_CLIENTE',
  'REESTRUCTURACION',
  'INCOMPATIBILIDAD_HORARIO',
  'MEDIDA_TEMPORAL',
  'OTRO',
]

export const ESTADOS_REMOCION = [
  'PENDIENTE_REASIGNACION',
  'REASIGNADO',
  'TEMPORAL',
  'FINALIZADO',
  'CANCELADO',
]

export const listRemociones = async (req: AuthRequest, res: Response) => {
  try {
    const { search, servicio_id, agente_id, motivo, fecha_desde, fecha_hasta, page = '1', limit = '50' } = req.query
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string)

    const where: any = {}
    if (servicio_id) where.servicio_id = parseInt(servicio_id as string)
    if (agente_id) where.agente_id = parseInt(agente_id as string)
    if (motivo) where.motivo = motivo as string
    if (search) {
      where.OR = [
        { dni: { contains: search as string, mode: 'insensitive' } },
        { nombre: { contains: search as string, mode: 'insensitive' } },
      ]
    }
    if (fecha_desde || fecha_hasta) {
      where.fecha = {}
      if (fecha_desde) where.fecha.gte = new Date(fecha_desde as string)
      if (fecha_hasta) where.fecha.lte = new Date(fecha_hasta as string)
    }

    const prismaAny = prisma as any
    const [total, data] = await Promise.all([
      prismaAny.remocion.count({ where }),
      prismaAny.remocion.findMany({
        where,
        include: {
          servicio: { select: { id: true, nombre: true, color: true } },
          servicio_destino: { select: { id: true, nombre: true, color: true } },
          creador: { select: { id: true, nombre: true } },
        },
        orderBy: { fecha: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
    ])

    return res.json({ total, page: parseInt(page as string), limit: parseInt(limit as string), data })
  } catch {
    return res.status(500).json({ error: 'Error al listar remociones' })
  }
}

export const createRemocion = async (req: AuthRequest, res: Response) => {
  try {
    const {
      fecha, dni, nombre, usuario_sistema, superior, jefatura,
      servicio_id, servicio_nombre, motivo, segmento, horarios,
      estado, contrato, sitio, modalidad, jefe, observacion, agente_id,
      tipo, servicio_destino_id, fecha_incorporacion_destino,
    } = req.body

    if (!fecha || !dni || !nombre) {
      return res.status(400).json({ error: 'fecha, dni y nombre son requeridos' })
    }
    if (!motivo) {
      return res.status(400).json({ error: 'motivo es requerido para registrar una remoción' })
    }

    const prismaAny = prisma as any
    const agenteIdNum = agente_id ? parseInt(agente_id) : null
    const servicioDestinoIdNum = servicio_destino_id ? parseInt(servicio_destino_id) : null

    const item = await prisma.$transaction(async (tx) => {
      const txAny = tx as any

      const creado = await txAny.remocion.create({
        data: {
          fecha: new Date(fecha),
          dni: dni.trim(),
          nombre: nombre.trim(),
          usuario_sistema: usuario_sistema || null,
          superior: superior || null,
          jefatura: jefatura || null,
          servicio_id: servicio_id ? parseInt(servicio_id) : null,
          servicio_nombre: servicio_nombre || null,
          motivo,
          segmento: segmento || null,
          horarios: horarios || null,
          estado: estado || null,
          contrato: contrato || null,
          sitio: sitio || null,
          modalidad: modalidad || null,
          jefe: jefe || null,
          observacion: observacion || null,
          agente_id: agenteIdNum,
          creado_por: req.user!.userId,
          tipo: tipo || null,
          estado_remocion: servicioDestinoIdNum ? 'REASIGNADO' : 'PENDIENTE_REASIGNACION',
          servicio_destino_id: servicioDestinoIdNum,
          fecha_incorporacion_destino: fecha_incorporacion_destino ? new Date(fecha_incorporacion_destino) : null,
        },
      })

      // Si el agente esta vinculado, cerrar su asignacion vigente y,
      // si hay destino informado, abrir la nueva (reasignacion)
      if (agenteIdNum) {
        const vigente = await txAny.agenteServicioHistorial.findFirst({
          where: { agente_id: agenteIdNum, fecha_hasta: null },
        })
        if (vigente) {
          await txAny.agenteServicioHistorial.update({
            where: { id: vigente.id },
            data: { fecha_hasta: new Date(fecha) },
          })
        }

        if (servicioDestinoIdNum) {
          await txAny.agenteServicioHistorial.create({
            data: {
              agente_id: agenteIdNum,
              servicio_id: servicioDestinoIdNum,
              modalidad: modalidad || null,
              superior: superior || null,
              jefe: jefe || null,
              segmento: segmento || null,
              sitio: sitio || null,
              contrato: contrato || null,
              horarios: horarios || null,
              fecha_desde: fecha_incorporacion_destino ? new Date(fecha_incorporacion_destino) : new Date(fecha),
              motivo: `Reasignación por remoción #${creado.id}`,
              creado_por: req.user!.userId,
            },
          })
          await txAny.agente.update({ where: { id: agenteIdNum }, data: { servicio_id: servicioDestinoIdNum } })
        }
      }

      return txAny.remocion.findUnique({
        where: { id: creado.id },
        include: {
          servicio: { select: { id: true, nombre: true, color: true } },
          servicio_destino: { select: { id: true, nombre: true, color: true } },
          creador: { select: { id: true, nombre: true } },
        },
      })
    })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'REGISTRAR_REMOCION',
      entidad: 'Remocion',
      entidad_id: String(item.id),
      servicio_id: item.servicio_id ?? undefined,
      agente_id: agenteIdNum ?? undefined,
      valor_nuevo: servicioDestinoIdNum
        ? `${nombre} (DNI: ${dni}) reasignado a servicio ${servicioDestinoIdNum}`
        : `${nombre} (DNI: ${dni})`,
    })

    return res.status(201).json(item)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al registrar remoción' })
  }
}

export const updateRemocion = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const prismaAny = prisma as any
    const existing = await prismaAny.remocion.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Remoción no encontrada' })

    const fields = [
      'nombre', 'usuario_sistema', 'superior', 'jefatura', 'servicio_nombre',
      'motivo', 'segmento', 'horarios', 'estado', 'contrato', 'sitio',
      'modalidad', 'jefe', 'observacion', 'tipo', 'estado_remocion',
    ]
    const data: any = {}
    for (const f of fields) {
      if (req.body[f] !== undefined) data[f] = req.body[f] || null
    }
    if (req.body.fecha) data.fecha = new Date(req.body.fecha)
    if (req.body.dni) data.dni = req.body.dni.trim()
    if (req.body.servicio_id !== undefined) {
      data.servicio_id = req.body.servicio_id ? parseInt(req.body.servicio_id) : null
    }
    if (req.body.servicio_destino_id !== undefined) {
      data.servicio_destino_id = req.body.servicio_destino_id ? parseInt(req.body.servicio_destino_id) : null
    }
    if (req.body.fecha_incorporacion_destino !== undefined) {
      data.fecha_incorporacion_destino = req.body.fecha_incorporacion_destino ? new Date(req.body.fecha_incorporacion_destino) : null
    }

    const item = await prismaAny.remocion.update({
      where: { id },
      data,
      include: {
        servicio: { select: { id: true, nombre: true, color: true } },
        servicio_destino: { select: { id: true, nombre: true, color: true } },
        creador: { select: { id: true, nombre: true } },
      },
    })

    return res.json(item)
  } catch {
    return res.status(500).json({ error: 'Error al actualizar remoción' })
  }
}

export const deleteRemocion = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    if (req.user?.rol !== 'ADMINISTRADOR') {
      return res.status(403).json({ error: 'Solo administradores pueden eliminar remociones' })
    }

    const prismaAny = prisma as any
    const existing = await prismaAny.remocion.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Remoción no encontrada' })

    await prismaAny.remocion.delete({ where: { id } })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'ELIMINAR_REMOCION',
      entidad: 'Remocion',
      entidad_id: String(id),
      valor_anterior: `${existing.nombre} (DNI: ${existing.dni})`,
    })

    return res.json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Error al eliminar remoción' })
  }
}
