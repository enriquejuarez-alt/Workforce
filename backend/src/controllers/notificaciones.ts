import { Response } from 'express'
import prisma from '../prisma'
import { AuthRequest } from '../middleware/auth'

export const getNotificaciones = async (req: AuthRequest, res: Response) => {
  try {
    const now = new Date()
    const hoy = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const manana = new Date(hoy.getTime() + 86400000)
    const en5Dias = new Date(hoy.getTime() + 5 * 86400000)
    const hace3Dias = new Date(hoy.getTime() - 3 * 86400000)

    const adminUser = req.user?.rol === 'ADMINISTRADOR'
    let agenteWhere: any = {}

    if (!adminUser) {
      const permisos = await prisma.usuarioServicioPermiso.findMany({
        where: { usuario_id: req.user!.userId, puede_ver: true },
        select: { servicio_id: true },
      })
      agenteWhere = { servicio_id: { in: permisos.map((p) => p.servicio_id) } }
    }

    const licenciaInclude = {
      agente: {
        select: {
          id: true,
          nombre: true,
          servicio: { select: { id: true, nombre: true } },
        },
      },
    }

    const [vencenHoy, vencenProximas, vencieronReciente] = await Promise.all([
      prisma.licencia.findMany({
        where: { fecha_hasta: { gte: hoy, lt: manana }, agente: agenteWhere },
        include: licenciaInclude,
        orderBy: { fecha_hasta: 'asc' },
        take: 30,
      }),
      prisma.licencia.findMany({
        where: {
          fecha_hasta: { gte: manana, lte: en5Dias },
          fecha_desde: { lte: hoy },
          agente: agenteWhere,
        },
        include: licenciaInclude,
        orderBy: { fecha_hasta: 'asc' },
        take: 30,
      }),
      prisma.licencia.findMany({
        where: { fecha_hasta: { gte: hace3Dias, lt: hoy }, agente: agenteWhere },
        include: licenciaInclude,
        orderBy: { fecha_hasta: 'desc' },
        take: 30,
      }),
    ])

    const notifs: any[] = []

    for (const l of vencenHoy) {
      notifs.push({
        id: `hoy-${l.id}`,
        tipo: 'LICENCIA_HOY',
        urgencia: 'alta',
        titulo: 'Licencia vence hoy',
        descripcion: `${l.agente.nombre} — verificá si se reincorporó`,
        servicio: l.agente.servicio?.nombre ?? null,
        agente_id: l.agente.id,
        agente_nombre: l.agente.nombre,
        fecha: l.fecha_hasta,
      })
    }

    for (const l of vencenProximas) {
      const dias = Math.ceil((new Date(l.fecha_hasta).getTime() - hoy.getTime()) / 86400000)
      notifs.push({
        id: `proxima-${l.id}`,
        tipo: 'LICENCIA_PROXIMA',
        urgencia: 'media',
        titulo: `Licencia vence en ${dias} día${dias !== 1 ? 's' : ''}`,
        descripcion: `${l.agente.nombre}`,
        servicio: l.agente.servicio?.nombre ?? null,
        agente_id: l.agente.id,
        agente_nombre: l.agente.nombre,
        fecha: l.fecha_hasta,
      })
    }

    for (const l of vencieronReciente) {
      const dias = Math.ceil((hoy.getTime() - new Date(l.fecha_hasta).getTime()) / 86400000)
      notifs.push({
        id: `vencida-${l.id}`,
        tipo: 'LICENCIA_VENCIDA',
        urgencia: 'baja',
        titulo: `Licencia venció hace ${dias} día${dias !== 1 ? 's' : ''}`,
        descripcion: `${l.agente.nombre} — sin novedad registrada`,
        servicio: l.agente.servicio?.nombre ?? null,
        agente_id: l.agente.id,
        agente_nombre: l.agente.nombre,
        fecha: l.fecha_hasta,
      })
    }

    return res.json(notifs)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al obtener notificaciones' })
  }
}
