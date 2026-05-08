import { Response } from 'express'
import prisma from '../prisma'
import { createAuditLog } from '../utils/audit'
import { AuthRequest } from '../middleware/auth'

const CONTRATOS_VALIDOS = ['30', '35', '36']

function calcularEstado(tipo: string, fechaDesde: Date, fechaHasta: Date | null): string {
  const now = new Date()
  if (fechaDesde > now) return 'PENDIENTE'
  if (tipo === 'TEMPORAL' && fechaHasta && fechaHasta < now) return 'FINALIZADO'
  return 'VIGENTE'
}

export const listCambiosContrato = async (req: AuthRequest, res: Response) => {
  try {
    const { servicio_id, tipo, contrato_nuevo, agente_id } = req.query
    const where: any = {}
    if (servicio_id) where.servicio_id = parseInt(servicio_id as string)
    if (tipo) where.tipo = tipo
    if (contrato_nuevo) where.contrato_nuevo = contrato_nuevo
    if (agente_id) where.agente_id = parseInt(agente_id as string)

    const prismaAny = prisma as any
    const cambios = await prismaAny.cambioContrato.findMany({
      where,
      include: {
        servicio: { select: { id: true, nombre: true, color: true } },
        creador: { select: { id: true, nombre: true } },
      },
      orderBy: { fecha_creacion: 'desc' },
    })

    const withStatus = cambios.map((c: any) => ({
      ...c,
      estado_calculado: calcularEstado(c.tipo, new Date(c.fecha_desde), c.fecha_hasta ? new Date(c.fecha_hasta) : null),
    }))

    return res.json(withStatus)
  } catch {
    return res.status(500).json({ error: 'Error al listar cambios de contrato' })
  }
}

export const createCambioContrato = async (req: AuthRequest, res: Response) => {
  try {
    const { agente_id, tipo, contrato_nuevo, fecha_desde, fecha_hasta, motivo, observacion } = req.body

    if (!agente_id || !tipo || !contrato_nuevo || !fecha_desde) {
      return res.status(400).json({ error: 'agente_id, tipo, contrato_nuevo y fecha_desde son requeridos' })
    }
    if (!['TEMPORAL', 'DEFINITIVO'].includes(tipo)) {
      return res.status(400).json({ error: 'tipo debe ser TEMPORAL o DEFINITIVO' })
    }
    if (!CONTRATOS_VALIDOS.includes(contrato_nuevo)) {
      return res.status(400).json({ error: 'contrato_nuevo debe ser 30, 35 o 36' })
    }
    if (tipo === 'TEMPORAL' && !fecha_hasta) {
      return res.status(400).json({ error: 'fecha_hasta es requerida para cambios temporales' })
    }
    if (fecha_hasta && new Date(fecha_hasta) < new Date(fecha_desde)) {
      return res.status(400).json({ error: 'fecha_hasta debe ser mayor o igual a fecha_desde' })
    }

    const agente = await prisma.agente.findUnique({ where: { id: agente_id } })
    if (!agente) return res.status(404).json({ error: 'Agente no encontrado' })

    const prismaAny = prisma as any
    const cambio = await prismaAny.cambioContrato.create({
      data: {
        agente_id,
        agente_dni: agente.dni,
        agente_nombre: agente.nombre,
        servicio_id: agente.servicio_id,
        tipo,
        contrato_anterior: agente.contrato,
        contrato_nuevo,
        fecha_desde: new Date(fecha_desde),
        fecha_hasta: fecha_hasta ? new Date(fecha_hasta) : null,
        motivo: motivo || null,
        observacion: observacion || null,
        creado_por: req.user!.userId,
      },
      include: {
        servicio: { select: { id: true, nombre: true, color: true } },
        creador: { select: { id: true, nombre: true } },
      },
    })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'REGISTRAR_CAMBIO_CONTRATO',
      entidad: 'CambioContrato',
      entidad_id: String(cambio.id),
      servicio_id: agente.servicio_id ?? undefined,
      valor_anterior: agente.contrato ?? '',
      valor_nuevo: `${tipo}: ${contrato_nuevo} hs desde ${fecha_desde}`,
    })

    return res.status(201).json({
      ...cambio,
      estado_calculado: calcularEstado(tipo, new Date(fecha_desde), fecha_hasta ? new Date(fecha_hasta) : null),
    })
  } catch {
    return res.status(500).json({ error: 'Error al crear cambio de contrato' })
  }
}

export const updateCambioContrato = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const { tipo, contrato_nuevo, fecha_desde, fecha_hasta, motivo, observacion } = req.body

    const prismaAny = prisma as any
    const existing = await prismaAny.cambioContrato.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Cambio de contrato no encontrado' })

    if (contrato_nuevo && !CONTRATOS_VALIDOS.includes(contrato_nuevo)) {
      return res.status(400).json({ error: 'contrato_nuevo debe ser 30, 35 o 36' })
    }

    const data: any = {}
    if (tipo) data.tipo = tipo
    if (contrato_nuevo) data.contrato_nuevo = contrato_nuevo
    if (fecha_desde) data.fecha_desde = new Date(fecha_desde)
    if (fecha_hasta !== undefined) data.fecha_hasta = fecha_hasta ? new Date(fecha_hasta) : null
    if (motivo !== undefined) data.motivo = motivo || null
    if (observacion !== undefined) data.observacion = observacion || null

    const cambio = await prismaAny.cambioContrato.update({
      where: { id },
      data,
      include: {
        servicio: { select: { id: true, nombre: true, color: true } },
        creador: { select: { id: true, nombre: true } },
      },
    })

    return res.json({
      ...cambio,
      estado_calculado: calcularEstado(cambio.tipo, new Date(cambio.fecha_desde), cambio.fecha_hasta ? new Date(cambio.fecha_hasta) : null),
    })
  } catch {
    return res.status(500).json({ error: 'Error al actualizar cambio de contrato' })
  }
}

export const deleteCambioContrato = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const prismaAny = prisma as any
    const existing = await prismaAny.cambioContrato.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Cambio de contrato no encontrado' })

    await prismaAny.cambioContrato.delete({ where: { id } })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'ELIMINAR_CAMBIO_CONTRATO',
      entidad: 'CambioContrato',
      entidad_id: String(id),
      valor_anterior: `${existing.agente_nombre} ${existing.contrato_anterior} → ${existing.contrato_nuevo} hs`,
    })

    return res.json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Error al eliminar cambio de contrato' })
  }
}
