import { Response } from 'express'
import prisma from '../prisma'
import { createAuditLog } from '../utils/audit'
import { getUserPermission } from '../utils/permissions'
import { AuthRequest } from '../middleware/auth'

export const listLicencias = async (req: AuthRequest, res: Response) => {
  try {
    const { agente_id, servicio_id, estado } = req.query
    const now = new Date()
    let where: any = {}

    if (agente_id) where.agente_id = parseInt(agente_id as string)

    const licencias = await prisma.licencia.findMany({
      where,
      include: {
        agente: { include: { servicio: true } },
        creador: { select: { id: true, nombre: true, email: true } },
      },
      orderBy: { fecha_desde: 'desc' },
    })

    const withStatus = licencias.map((l) => {
      let estadoCalc: string
      if (now < l.fecha_desde) estadoCalc = 'PROGRAMADA'
      else if (now > l.fecha_hasta) estadoCalc = 'FINALIZADA'
      else estadoCalc = 'VIGENTE'
      return { ...l, estado_calculado: estadoCalc }
    })

    const filtered = estado
      ? withStatus.filter((l) => l.estado_calculado === (estado as string).toUpperCase())
      : withStatus

    return res.json(filtered)
  } catch {
    return res.status(500).json({ error: 'Error al listar licencias' })
  }
}

export const createLicencia = async (req: AuthRequest, res: Response) => {
  try {
    const { agente_id, fecha_desde, fecha_hasta, motivo, observacion } = req.body
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
      if (!permiso?.puede_registrar_licencia) return res.status(403).json({ error: 'Sin permiso para registrar licencias' })
    }

    const licencia = await prisma.licencia.create({
      data: { agente_id, fecha_desde: desde, fecha_hasta: hasta, motivo, observacion, creado_por: req.user!.userId },
      include: { agente: true, creador: { select: { id: true, nombre: true } } },
    })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'REGISTRAR_LICENCIA',
      entidad: 'Licencia',
      entidad_id: String(licencia.id),
      servicio_id: agente.servicio_id ?? undefined,
      valor_nuevo: `${agente.nombre}: ${fecha_desde} - ${fecha_hasta}`,
    })

    return res.status(201).json(licencia)
  } catch {
    return res.status(500).json({ error: 'Error al crear licencia' })
  }
}

export const updateLicencia = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const { fecha_desde, fecha_hasta, motivo, observacion } = req.body

    if (fecha_desde && fecha_hasta && new Date(fecha_hasta) < new Date(fecha_desde)) {
      return res.status(400).json({ error: 'fecha_hasta debe ser mayor o igual a fecha_desde' })
    }

    const data: any = {}
    if (fecha_desde) data.fecha_desde = new Date(fecha_desde)
    if (fecha_hasta) data.fecha_hasta = new Date(fecha_hasta)
    if (motivo !== undefined) data.motivo = motivo
    if (observacion !== undefined) data.observacion = observacion

    const licencia = await prisma.licencia.update({ where: { id }, data })
    return res.json(licencia)
  } catch {
    return res.status(500).json({ error: 'Error al actualizar licencia' })
  }
}

export const deleteLicencia = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    await prisma.licencia.delete({ where: { id } })
    return res.json({ message: 'Licencia eliminada' })
  } catch {
    return res.status(500).json({ error: 'Error al eliminar licencia' })
  }
}
