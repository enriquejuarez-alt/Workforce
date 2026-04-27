import { Response } from 'express'
import prisma from '../prisma'
import { createAuditLog } from '../utils/audit'
import { AuthRequest } from '../middleware/auth'

function calcularEstado(fechaInicio: Date, fechaFin: Date): string {
  const now = new Date()
  if (fechaInicio > now) return 'PROGRAMADA'
  if (fechaFin < now) return 'FINALIZADA'
  return 'VIGENTE'
}

export const listCapacitaciones = async (req: AuthRequest, res: Response) => {
  try {
    const { servicio_id, segmento, estado_cap } = req.query
    const where: any = {}
    if (servicio_id) where.servicio_id = parseInt(servicio_id as string)
    if (segmento) {
      where.segmento = segmento === 'SIN_DEFINIR' ? null : { equals: segmento as string, mode: 'insensitive' }
    }

    const prismaAny = prisma as any
    const items = await prismaAny.capacitacion.findMany({
      where,
      include: {
        servicio: { select: { id: true, nombre: true, color: true } },
        creador: { select: { id: true, nombre: true } },
      },
      orderBy: { fecha_fin: 'asc' },
    })

    const withStatus = items.map((c: any) => {
      const estado_calculado = calcularEstado(new Date(c.fecha_inicio), new Date(c.fecha_fin))
      return { ...c, estado_calculado }
    })

    const filtered = estado_cap
      ? withStatus.filter((c: any) => c.estado_calculado === estado_cap)
      : withStatus

    return res.json(filtered)
  } catch {
    return res.status(500).json({ error: 'Error al listar capacitaciones' })
  }
}

export const createCapacitacion = async (req: AuthRequest, res: Response) => {
  try {
    const {
      agente_id, agente_dni, agente_nombre, usuario_sistema, superior,
      servicio_id, servicio_nombre, segmento, horarios, estado, contrato,
      sitio, modalidad, jefe, observacion, fecha_inicio, fecha_fin,
    } = req.body

    if (!agente_nombre || !fecha_inicio || !fecha_fin) {
      return res.status(400).json({ error: 'agente_nombre, fecha_inicio y fecha_fin son requeridos' })
    }
    if (new Date(fecha_fin) < new Date(fecha_inicio)) {
      return res.status(400).json({ error: 'fecha_fin debe ser mayor o igual a fecha_inicio' })
    }

    const prismaAny = prisma as any
    const cap = await prismaAny.capacitacion.create({
      data: {
        agente_id: agente_id ? parseInt(agente_id) : null,
        agente_dni: agente_dni || null,
        agente_nombre,
        usuario_sistema: usuario_sistema || null,
        superior: superior || null,
        servicio_id: servicio_id ? parseInt(servicio_id) : null,
        servicio_nombre: servicio_nombre || null,
        segmento: segmento === 'SIN_DEFINIR' ? null : segmento || null,
        horarios: horarios || null,
        estado: estado || null,
        contrato: contrato || null,
        sitio: sitio || null,
        modalidad: modalidad || null,
        jefe: jefe || null,
        observacion: observacion || null,
        fecha_inicio: new Date(fecha_inicio),
        fecha_fin: new Date(fecha_fin),
        creado_por: req.user!.userId,
      },
      include: {
        servicio: { select: { id: true, nombre: true, color: true } },
        creador: { select: { id: true, nombre: true } },
      },
    })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'REGISTRAR_CAPACITACION',
      entidad: 'Capacitacion',
      entidad_id: String(cap.id),
      servicio_id: cap.servicio_id ?? undefined,
      valor_nuevo: `${agente_nombre} — ${fecha_inicio} al ${fecha_fin}`,
    })

    return res.status(201).json({
      ...cap,
      estado_calculado: calcularEstado(new Date(fecha_inicio), new Date(fecha_fin)),
    })
  } catch {
    return res.status(500).json({ error: 'Error al crear capacitación' })
  }
}

export const updateCapacitacion = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const prismaAny = prisma as any

    const existing = await prismaAny.capacitacion.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Capacitación no encontrada' })

    const fields = [
      'agente_nombre', 'usuario_sistema', 'superior', 'servicio_nombre',
      'horarios', 'estado', 'contrato', 'sitio', 'modalidad', 'jefe', 'observacion',
    ]
    const data: any = {}
    for (const f of fields) {
      if (req.body[f] !== undefined) data[f] = req.body[f] || null
    }
    if (req.body.segmento !== undefined) {
      data.segmento = req.body.segmento === 'SIN_DEFINIR' ? null : req.body.segmento || null
    }
    if (req.body.fecha_inicio) data.fecha_inicio = new Date(req.body.fecha_inicio)
    if (req.body.fecha_fin) data.fecha_fin = new Date(req.body.fecha_fin)

    const cap = await prismaAny.capacitacion.update({
      where: { id },
      data,
      include: {
        servicio: { select: { id: true, nombre: true, color: true } },
        creador: { select: { id: true, nombre: true } },
      },
    })

    return res.json({
      ...cap,
      estado_calculado: calcularEstado(new Date(cap.fecha_inicio), new Date(cap.fecha_fin)),
    })
  } catch {
    return res.status(500).json({ error: 'Error al actualizar capacitación' })
  }
}

export const deleteCapacitacion = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    if (req.user?.rol !== 'ADMINISTRADOR') {
      return res.status(403).json({ error: 'Solo administradores pueden eliminar capacitaciones' })
    }

    const prismaAny = prisma as any
    const existing = await prismaAny.capacitacion.findUnique({ where: { id } })
    if (!existing) return res.status(404).json({ error: 'Capacitación no encontrada' })

    await prismaAny.capacitacion.delete({ where: { id } })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'ELIMINAR_CAPACITACION',
      entidad: 'Capacitacion',
      entidad_id: String(id),
      valor_anterior: `${existing.agente_nombre}`,
    })

    return res.json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Error al eliminar capacitación' })
  }
}
