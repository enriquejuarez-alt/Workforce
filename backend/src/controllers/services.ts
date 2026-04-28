import { Response } from 'express'
import prisma from '../prisma'
import { createAuditLog } from '../utils/audit'
import { AuthRequest } from '../middleware/auth'

export const listServices = async (req: AuthRequest, res: Response) => {
  try {
    const isAdmin = req.user?.rol === 'ADMINISTRADOR'
    let whereClause: any = {}

    if (!isAdmin) {
      whereClause = {
        activo: true,
        permisos: {
          some: { usuario_id: req.user!.userId, puede_ver: true },
        },
      }
    }

    const servicios = await prisma.servicio.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { agentes: true, nominas: true },
        },
      },
      orderBy: { nombre: 'asc' },
    })

    return res.json(servicios)
  } catch {
    return res.status(500).json({ error: 'Error al listar servicios' })
  }
}

export const createService = async (req: AuthRequest, res: Response) => {
  try {
    const { nombre, descripcion, color } = req.body
    if (!nombre) return res.status(400).json({ error: 'El nombre es requerido' })

    const existing = await prisma.servicio.findFirst({ where: { nombre, activo: true } })
    if (existing) return res.status(409).json({ error: 'Ya existe un servicio activo con ese nombre' })

    const servicio = await prisma.servicio.create({
      data: { nombre, descripcion, color: color || '#6366f1' },
    })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'CREAR_SERVICIO',
      entidad: 'Servicio',
      entidad_id: String(servicio.id),
      servicio_id: servicio.id,
      valor_nuevo: nombre,
    })

    return res.status(201).json(servicio)
  } catch {
    return res.status(500).json({ error: 'Error al crear servicio' })
  }
}

export const updateService = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const { nombre, descripcion, color } = req.body

    const servicio = await prisma.servicio.update({
      where: { id },
      data: { nombre, descripcion, color },
    })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'EDITAR_SERVICIO',
      entidad: 'Servicio',
      entidad_id: String(id),
      servicio_id: id,
    })

    return res.json(servicio)
  } catch {
    return res.status(500).json({ error: 'Error al actualizar servicio' })
  }
}

export const toggleService = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const servicio = await prisma.servicio.findUnique({ where: { id } })
    if (!servicio) return res.status(404).json({ error: 'Servicio no encontrado' })

    const updated = await prisma.servicio.update({
      where: { id },
      data: { activo: !servicio.activo },
    })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: updated.activo ? 'ACTIVAR_SERVICIO' : 'DESACTIVAR_SERVICIO',
      entidad: 'Servicio',
      entidad_id: String(id),
      servicio_id: id,
    })

    return res.json({ activo: updated.activo })
  } catch {
    return res.status(500).json({ error: 'Error al cambiar estado' })
  }
}

export const deleteService = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const servicio = await prisma.servicio.findUnique({
      where: { id },
      include: { _count: { select: { agentes: true, nominas: true } } },
    })
    if (!servicio) return res.status(404).json({ error: 'Servicio no encontrado' })
    if (servicio._count.agentes > 0) return res.status(409).json({ error: `No se puede eliminar: tiene ${servicio._count.agentes} agente(s) asociado(s)` })
    if (servicio._count.nominas > 0) return res.status(409).json({ error: `No se puede eliminar: tiene ${servicio._count.nominas} nómina(s) asociada(s)` })

    await prisma.servicio.delete({ where: { id } })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'ELIMINAR_SERVICIO',
      entidad: 'Servicio',
      entidad_id: String(id),
      valor_anterior: servicio.nombre,
    })

    return res.json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Error al eliminar servicio' })
  }
}

export const getServiceSegmentos = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const rows = await prisma.agenteNominaMensual.findMany({
      where: { nomina_mensual: { servicio_id: id }, segmento: { not: null }, presente_en_nomina: true },
      select: { segmento: true },
      distinct: ['segmento'],
      orderBy: { segmento: 'asc' },
    })
    return res.json(rows.map((r) => r.segmento).filter(Boolean))
  } catch {
    return res.status(500).json({ error: 'Error al obtener segmentos' })
  }
}

export const getServiceMetrics = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const [totalAgentes, agentesActivos, nominas] = await Promise.all([
      prisma.agente.count({ where: { servicio_id: id } }),
      prisma.agente.count({ where: { servicio_id: id, activo: true } }),
      prisma.nominaMensual.count({ where: { servicio_id: id } }),
    ])
    return res.json({ totalAgentes, agentesActivos, totalNominas: nominas })
  } catch {
    return res.status(500).json({ error: 'Error al obtener métricas' })
  }
}
