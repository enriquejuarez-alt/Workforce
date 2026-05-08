import { Response } from 'express'
import prisma from '../prisma'
import { createAuditLog } from '../utils/audit'
import { getUserPermission } from '../utils/permissions'
import { AuthRequest } from '../middleware/auth'

export const listCambios = async (req: AuthRequest, res: Response) => {
  try {
    const { agente_id, activo } = req.query
    const now = new Date()

    let where: any = {}
    if (agente_id) where.agente_id = parseInt(agente_id as string)
    if (activo === 'true') {
      where.fecha_desde = { lte: now }
      where.fecha_hasta = { gte: now }
    }

    const cambios = await prisma.cambioServicioTemporal.findMany({
      where,
      include: {
        agente: { include: { servicio: true } },
        servicio_temporal: true,
        creador: { select: { id: true, nombre: true, email: true } },
      },
      orderBy: { fecha_desde: 'desc' },
    })

    const withStatus = cambios.map((c) => ({
      ...c,
      activo: now >= c.fecha_desde && now <= c.fecha_hasta,
    }))

    return res.json(withStatus)
  } catch {
    return res.status(500).json({ error: 'Error al listar cambios temporales' })
  }
}

export const createCambio = async (req: AuthRequest, res: Response) => {
  try {
    const { agente_id, servicio_original_id, servicio_temporal_id, fecha_desde, fecha_hasta, motivo, observacion } = req.body
    if (!agente_id || !fecha_desde || !fecha_hasta) {
      return res.status(400).json({ error: 'agente_id, fecha_desde y fecha_hasta son requeridos' })
    }

    const desde = new Date(fecha_desde)
    const hasta = new Date(fecha_hasta)
    if (hasta < desde) return res.status(400).json({ error: 'fecha_hasta debe ser mayor o igual a fecha_desde' })

    const agente = await prisma.agente.findUnique({ where: { id: agente_id } })
    if (!agente) return res.status(404).json({ error: 'Agente no encontrado' })

    const adminUser = req.user?.rol === 'ADMINISTRADOR'
    if (!adminUser && agente.servicio_id) {
      const permiso = await getUserPermission(req.user!.userId, agente.servicio_id)
      if (!permiso?.puede_registrar_cambio_servicio) {
        return res.status(403).json({ error: 'Sin permiso para registrar cambios de servicio' })
      }
    }

    const cambio = await prisma.cambioServicioTemporal.create({
      data: {
        agente_id,
        servicio_original_id: servicio_original_id || agente.servicio_id,
        servicio_temporal_id,
        fecha_desde: desde,
        fecha_hasta: hasta,
        motivo,
        observacion,
        creado_por: req.user!.userId,
      },
      include: {
        agente: true,
        servicio_temporal: true,
        creador: { select: { id: true, nombre: true } },
      },
    })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'REGISTRAR_CAMBIO_TEMPORAL',
      entidad: 'CambioServicioTemporal',
      entidad_id: String(cambio.id),
      servicio_id: agente.servicio_id ?? undefined,
      valor_nuevo: `Agente ${agente.nombre} → Servicio temporal ID ${servicio_temporal_id}`,
    })

    return res.status(201).json(cambio)
  } catch {
    return res.status(500).json({ error: 'Error al crear cambio temporal' })
  }
}

export const updateCambio = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const { fecha_desde, fecha_hasta, motivo, observacion, servicio_temporal_id } = req.body

    if (fecha_desde && fecha_hasta && new Date(fecha_hasta) < new Date(fecha_desde)) {
      return res.status(400).json({ error: 'fecha_hasta debe ser mayor o igual a fecha_desde' })
    }

    const data: any = {}
    if (fecha_desde) data.fecha_desde = new Date(fecha_desde)
    if (fecha_hasta) data.fecha_hasta = new Date(fecha_hasta)
    if (motivo !== undefined) data.motivo = motivo
    if (observacion !== undefined) data.observacion = observacion
    if (servicio_temporal_id) data.servicio_temporal_id = servicio_temporal_id

    const cambio = await prisma.cambioServicioTemporal.update({
      where: { id },
      data,
      include: { agente: true, servicio_temporal: true },
    })

    return res.json(cambio)
  } catch {
    return res.status(500).json({ error: 'Error al actualizar cambio temporal' })
  }
}

export const deleteCambio = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    await prisma.cambioServicioTemporal.delete({ where: { id } })
    return res.json({ message: 'Cambio temporal eliminado' })
  } catch {
    return res.status(500).json({ error: 'Error al eliminar cambio temporal' })
  }
}
