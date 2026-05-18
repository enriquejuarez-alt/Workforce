import { Response } from 'express'
import prisma from '../prisma'
import { createAuditLog } from '../utils/audit'
import { getUserPermission } from '../utils/permissions'
import { AuthRequest } from '../middleware/auth'

export const listAgents = async (req: AuthRequest, res: Response) => {
  try {
    const { servicio_id, search, estado, activo } = req.query
    const adminUser = req.user?.rol === 'ADMINISTRADOR'
    const isLider = req.user?.rol === 'LIDER'

    let where: any = {}
    if (activo !== undefined) where.activo = activo === 'true'
    if (estado) where.estado = estado

    // LIDER: forzar filtro por su servicio, ignorar servicio_id del query
    if (isLider) {
      if (!req.user?.servicioId) return res.status(403).json({ error: 'Líder sin servicio asignado' })
      where.servicio_id = req.user.servicioId
    } else {
      if (servicio_id) where.servicio_id = parseInt(servicio_id as string)
      if (!adminUser && servicio_id) {
        const permiso = await getUserPermission(req.user!.userId, parseInt(servicio_id as string))
        if (!permiso?.puede_ver) return res.status(403).json({ error: 'Sin permiso' })
      }
    }

    if (search) {
      where.OR = [
        { dni: { contains: search as string, mode: 'insensitive' } },
        { usuario: { contains: search as string, mode: 'insensitive' } },
        { nombre: { contains: search as string, mode: 'insensitive' } },
      ]
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

export const getAgenteTimeline = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const agente = await prisma.agente.findUnique({
      where: { id },
      include: {
        licencias: { orderBy: { fecha_desde: 'asc' } },
        cambios_temporales: {
          include: { servicio_temporal: true },
          orderBy: { fecha_desde: 'asc' },
        },
        cambios_contrato: {
          include: { servicio: true },
          orderBy: { fecha_desde: 'asc' },
        },
        capacitaciones: { orderBy: { fecha_inicio: 'asc' } },
        remociones: { orderBy: { fecha: 'asc' } },
        vacaciones: { orderBy: { fecha_desde: 'asc' } },
        bajas: { orderBy: { fecha: 'asc' } },
      },
    })
    if (!agente) return res.status(404).json({ error: 'Agente no encontrado' })

    const now = new Date()
    const fmt = (d: Date) => d.toISOString().substring(0, 10)

    const eventos: any[] = []

    for (const l of agente.licencias) {
      eventos.push({
        tipo: 'LICENCIA',
        fecha_inicio: fmt(l.fecha_desde),
        fecha_fin: fmt(l.fecha_hasta),
        descripcion: l.motivo || 'Licencia',
        detalle: l.observacion ?? null,
      })
    }
    for (const c of agente.cambios_temporales) {
      eventos.push({
        tipo: 'CAMBIO_TEMPORAL',
        fecha_inicio: fmt(c.fecha_desde),
        fecha_fin: fmt(c.fecha_hasta),
        descripcion: `→ ${c.servicio_temporal?.nombre || 'Servicio temporal'}`,
        detalle: c.motivo ?? null,
      })
    }
    for (const cc of agente.cambios_contrato) {
      eventos.push({
        tipo: 'CAMBIO_CONTRATO',
        fecha_inicio: fmt(cc.fecha_desde),
        fecha_fin: cc.fecha_hasta ? fmt(cc.fecha_hasta) : null,
        descripcion: `${cc.contrato_anterior || '?'} → ${cc.contrato_nuevo}hs (${cc.tipo})`,
        detalle: cc.motivo ?? null,
      })
    }
    for (const cap of agente.capacitaciones) {
      eventos.push({
        tipo: 'CAPACITACION',
        fecha_inicio: fmt(cap.fecha_inicio),
        fecha_fin: fmt(cap.fecha_fin),
        descripcion: cap.observacion || 'Capacitación',
        detalle: cap.dado_de_alta ? 'Dado de alta' : cap.pendiente_alta ? 'Pendiente de alta' : null,
      })
    }
    for (const r of agente.remociones) {
      eventos.push({
        tipo: 'REMOCION',
        fecha_inicio: fmt(r.fecha),
        fecha_fin: null,
        descripcion: r.motivo || 'Remoción',
        detalle: r.observacion ?? null,
      })
    }
    for (const v of agente.vacaciones) {
      eventos.push({
        tipo: 'VACACION',
        fecha_inicio: fmt(v.fecha_desde),
        fecha_fin: fmt(v.fecha_hasta),
        descripcion: 'Vacaciones',
        detalle: v.servicio_wf ?? null,
      })
    }
    for (const b of (agente as any).bajas) {
      eventos.push({
        tipo: 'BAJA',
        fecha_inicio: fmt(b.fecha),
        fecha_fin: null,
        descripcion: b.tipo || 'Baja',
        detalle: b.observacion ?? null,
      })
    }

    eventos.sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio))
    return res.json(eventos)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al obtener timeline' })
  }
}
