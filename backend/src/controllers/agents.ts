import { Response } from 'express'
import prisma from '../prisma'
import { createAuditLog } from '../utils/audit'
import { getUserPermission } from '../utils/permissions'
import { AuthRequest } from '../middleware/auth'

export const listAgents = async (req: AuthRequest, res: Response) => {
  try {
    const { servicio_id, search, estado, activo } = req.query
    const adminUser = req.user?.rol === 'ADMINISTRADOR'

    let where: any = {}
    if (activo !== undefined) where.activo = activo === 'true'
    if (servicio_id) where.servicio_id = parseInt(servicio_id as string)
    if (estado) where.estado = estado
    if (search) {
      where.OR = [
        { dni: { contains: search as string, mode: 'insensitive' } },
        { usuario: { contains: search as string, mode: 'insensitive' } },
        { nombre: { contains: search as string, mode: 'insensitive' } },
      ]
    }

    if (!adminUser && servicio_id) {
      const permiso = await getUserPermission(req.user!.userId, parseInt(servicio_id as string))
      if (!permiso?.puede_ver) return res.status(403).json({ error: 'Sin permiso' })
    }

    const agentes = await prisma.agente.findMany({
      where,
      include: {
        servicio: true,
        licencias: {
          where: { fecha_hasta: { gte: new Date() } },
          orderBy: { fecha_desde: 'asc' },
          take: 1,
        },
        cambios_temporales: {
          where: { fecha_hasta: { gte: new Date() }, fecha_desde: { lte: new Date() } },
          include: { servicio_temporal: true },
          take: 1,
        },
      },
      orderBy: { nombre: 'asc' },
      take: 500,
    })

    return res.json(agentes)
  } catch {
    return res.status(500).json({ error: 'Error al listar agentes' })
  }
}

export const getAgent = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const agente = await prisma.agente.findUnique({
      where: { id },
      include: {
        servicio: true,
        licencias: { orderBy: { fecha_desde: 'desc' } },
        cambios_temporales: {
          include: { servicio_temporal: true },
          orderBy: { fecha_desde: 'desc' },
        },
        snapshots: {
          include: { nomina_mensual: { include: { servicio: true } } },
          orderBy: { nomina_mensual: { fecha_carga: 'desc' } },
          take: 12,
        },
      },
    })
    if (!agente) return res.status(404).json({ error: 'Agente no encontrado' })
    return res.json(agente)
  } catch {
    return res.status(500).json({ error: 'Error al obtener agente' })
  }
}

export const createAgent = async (req: AuthRequest, res: Response) => {
  try {
    const adminUser = req.user?.rol === 'ADMINISTRADOR'
    const { servicio_id } = req.body

    if (!adminUser && servicio_id) {
      const permiso = await getUserPermission(req.user!.userId, parseInt(servicio_id))
      if (!permiso?.puede_crear_agente) return res.status(403).json({ error: 'Sin permiso para crear agentes' })
    }

    const { dni, usuario, nombre } = req.body
    if (!dni || !usuario || !nombre) {
      return res.status(400).json({ error: 'DNI, USUARIO y NOMBRE son requeridos' })
    }

    const dupDni = await prisma.agente.findUnique({ where: { dni } })
    if (dupDni) return res.status(409).json({ error: 'Ya existe un agente con ese DNI' })
    const dupUser = await prisma.agente.findUnique({ where: { usuario } })
    if (dupUser) return res.status(409).json({ error: 'Ya existe un agente con ese usuario' })

    const agente = await prisma.agente.create({ data: req.body })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'CREAR_AGENTE',
      entidad: 'Agente',
      entidad_id: String(agente.id),
      servicio_id: agente.servicio_id ?? undefined,
      valor_nuevo: `${agente.nombre} (${agente.dni})`,
    })

    return res.status(201).json(agente)
  } catch {
    return res.status(500).json({ error: 'Error al crear agente' })
  }
}

export const updateAgent = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const agente = await prisma.agente.findUnique({ where: { id } })
    if (!agente) return res.status(404).json({ error: 'Agente no encontrado' })

    const updated = await prisma.agente.update({ where: { id }, data: req.body })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'EDITAR_AGENTE',
      entidad: 'Agente',
      entidad_id: String(id),
      servicio_id: updated.servicio_id ?? undefined,
    })

    return res.json(updated)
  } catch {
    return res.status(500).json({ error: 'Error al actualizar agente' })
  }
}

export const toggleAgent = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const agente = await prisma.agente.findUnique({ where: { id } })
    if (!agente) return res.status(404).json({ error: 'Agente no encontrado' })

    const adminUser = req.user?.rol === 'ADMINISTRADOR'
    if (!adminUser && agente.servicio_id) {
      const permiso = await getUserPermission(req.user!.userId, agente.servicio_id)
      if (!permiso?.puede_desactivar_agente) return res.status(403).json({ error: 'Sin permiso' })
    }

    const updated = await prisma.agente.update({
      where: { id },
      data: { activo: !agente.activo },
    })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: updated.activo ? 'ACTIVAR_AGENTE' : 'DESACTIVAR_AGENTE',
      entidad: 'Agente',
      entidad_id: String(id),
      servicio_id: updated.servicio_id ?? undefined,
    })

    return res.json({ activo: updated.activo })
  } catch {
    return res.status(500).json({ error: 'Error al cambiar estado' })
  }
}
