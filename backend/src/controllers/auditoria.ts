import { Response } from 'express'
import prisma from '../prisma'
import { AuthRequest } from '../middleware/auth'

export const listAuditoria = async (req: AuthRequest, res: Response) => {
  try {
    const { usuario_id, accion, servicio_id, entidad, desde, hasta, page = '1', limit = '50' } = req.query

    const where: any = {}
    if (usuario_id) where.usuario_id = parseInt(usuario_id as string)
    if (accion) where.accion = { contains: accion as string, mode: 'insensitive' }
    if (servicio_id) where.servicio_id = parseInt(servicio_id as string)
    if (entidad) where.entidad = entidad
    if (desde || hasta) {
      where.fecha_hora = {}
      if (desde) where.fecha_hora.gte = new Date(desde as string)
      if (hasta) where.fecha_hora.lte = new Date(hasta as string)
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string)
    const take = parseInt(limit as string)

    const [total, logs] = await Promise.all([
      prisma.auditoria.count({ where }),
      prisma.auditoria.findMany({
        where,
        include: {
          usuario: { select: { id: true, nombre: true, email: true } },
          servicio: { select: { id: true, nombre: true, color: true } },
        },
        orderBy: { fecha_hora: 'desc' },
        skip,
        take,
      }),
    ])

    return res.json({ total, page: parseInt(page as string), limit: take, data: logs })
  } catch {
    return res.status(500).json({ error: 'Error al listar auditoría' })
  }
}
