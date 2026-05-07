import { Response } from 'express'
import prisma from '../prisma'
import { AuthRequest } from '../middleware/auth'

export const getDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const adminUser = req.user?.rol === 'ADMINISTRADOR'
    const now = new Date()
    const currentMes = now.getMonth() + 1
    const currentAnio = now.getFullYear()
    const inicioPeriodo = new Date(currentAnio, currentMes - 1, 1)
    const finPeriodo = new Date(currentAnio, currentMes, 0, 23, 59, 59)
    const prismaAny = prisma as any

    const servicioIdParam = req.query.servicio_id ? parseInt(req.query.servicio_id as string) : null

    let servicioIds: number[] | null = null

    if (!adminUser) {
      const permisos = await prisma.usuarioServicioPermiso.findMany({
        where: { usuario_id: req.user!.userId, puede_ver: true },
        select: { servicio_id: true },
      })
      servicioIds = permisos.map((p) => p.servicio_id)
    }

    // Si se selecciona un servicio específico, filtrar por él (respetando permisos)
    if (servicioIdParam) {
      if (!adminUser && servicioIds && !servicioIds.includes(servicioIdParam)) {
        return res.status(403).json({ error: 'Sin permiso para este servicio' })
      }
      servicioIds = [servicioIdParam]
    }

    const agenteWhere = servicioIds ? { servicio_id: { in: servicioIds } } : {}

    const nominaWhere = {
      mes: currentMes,
      anio: currentAnio,
      tipo: 'OPERACION',
      ...(servicioIds ? { servicio_id: { in: servicioIds } } : {}),
    }

    const [
      totalAgentes,
      agentesInactivos,
      licenciasVigentes,
      licenciasProgramadas,
      cambiosActivos,
      agentesNoPresentes,
      nominasActivas,
      nominasCerradas,
      totalUsuarios,
      ultimaCarga,
      totalEnNomina,
      agentesConLicencia,
      porServicio,
      licenciasHoy,
      vacacionesMes,
    ] = await Promise.all([
      prisma.agente.count({ where: agenteWhere }),
      prisma.agente.count({ where: { ...agenteWhere, activo: false } }),
      prisma.licencia.count({
        where: {
          fecha_desde: { lte: now },
          fecha_hasta: { gte: now },
          agente: agenteWhere,
        },
      }),
      prisma.licencia.count({
        where: {
          fecha_desde: { gt: now },
          agente: agenteWhere,
        },
      }),
      prisma.cambioServicioTemporal.count({
        where: {
          fecha_desde: { lte: now },
          fecha_hasta: { gte: now },
          agente: agenteWhere,
        },
      }),
      prisma.agente.count({ where: { ...agenteWhere, presente_ultima_carga: false } }),
      prisma.nominaMensual.count({
        where: {
          estado: 'ACTIVA',
          tipo: 'OPERACION',
          mes: currentMes,
          anio: currentAnio,
          ...(servicioIds ? { servicio_id: { in: servicioIds } } : {}),
        },
      }),
      prisma.nominaMensual.count({
        where: {
          estado: 'CERRADA',
          tipo: 'OPERACION',
          ...(servicioIds ? { servicio_id: { in: servicioIds } } : {}),
        },
      }),
      adminUser ? prisma.usuario.count({ where: { activo: true } }) : Promise.resolve(0),
      prisma.importacionNomina.findFirst({
        where: servicioIds
          ? { nomina_mensual: { servicio_id: { in: servicioIds } } }
          : {},
        orderBy: { fecha_importacion: 'desc' },
        include: {
          nomina_mensual: { include: { servicio: true } },
          usuario: { select: { nombre: true } },
        },
      }),
      // Total agentes presentes en nómina OPERACION del mes
      prisma.agenteNominaMensual.count({
        where: { nomina_mensual: nominaWhere, presente_en_nomina: true },
      }),
      // Agentes con licencia activa hoy (usamos tabla licencias, no el campo estado del snapshot)
      prisma.agenteNominaMensual.count({
        where: {
          nomina_mensual: nominaWhere,
          presente_en_nomina: true,
          agente: { licencias: { some: { fecha_desde: { lte: now }, fecha_hasta: { gte: now } } } },
        },
      }),
      prisma.servicio.findMany({
        where: {
          activo: true,
          ...(servicioIds ? { id: { in: servicioIds } } : {}),
        },
        include: { _count: { select: { agentes: true } } },
        orderBy: { nombre: 'asc' },
      }),
      prisma.licencia.findMany({
        where: {
          fecha_desde: { lte: now },
          fecha_hasta: { gte: now },
          agente: agenteWhere,
        },
        include: {
          agente: {
            select: {
              id: true,
              nombre: true,
              servicio: { select: { nombre: true, color: true } },
            },
          },
        },
        orderBy: { agente: { nombre: 'asc' } },
        take: 30,
      }),
      prismaAny.vacacion.findMany({
        where: {
          fecha_desde: { lte: finPeriodo },
          fecha_hasta: { gte: inicioPeriodo },
          ...(servicioIds ? { agente: { servicio_id: { in: servicioIds } } } : {}),
        },
        include: {
          agente: {
            select: {
              id: true,
              nombre: true,
              servicio: { select: { nombre: true, color: true } },
            },
          },
        },
        orderBy: { fecha_desde: 'asc' },
        take: 50,
      }),
    ])

    const agentesActivos = Math.max(0, totalEnNomina - agentesConLicencia)

    return res.json({
      total_agentes: totalEnNomina,
      agentes_activos: agentesActivos,
      agentes_lp: agentesConLicencia,
      agentes_inactivos: agentesInactivos,
      estado_breakdown: [],
      licencias_vigentes: licenciasVigentes,
      licencias_programadas: licenciasProgramadas,
      cambios_activos: cambiosActivos,
      agentes_no_presentes: agentesNoPresentes,
      nominas_activas: nominasActivas,
      nominas_cerradas: nominasCerradas,
      usuarios_activos: adminUser ? totalUsuarios : null,
      ultima_carga: ultimaCarga,
      por_servicio: porServicio.map((s) => ({
        id: s.id,
        nombre: s.nombre,
        color: s.color,
        total_agentes: s._count.agentes,
      })),
      licencias_hoy: licenciasHoy.map((l) => ({
        agente_id: l.agente.id,
        agente_nombre: l.agente.nombre,
        servicio_nombre: l.agente.servicio?.nombre ?? null,
        servicio_color: l.agente.servicio?.color ?? null,
        fecha_hasta: l.fecha_hasta.toISOString().substring(0, 10),
        motivo: l.motivo,
      })),
      vacaciones_mes: (vacacionesMes as any[]).map((v) => ({
        agente_id: v.agente?.id ?? null,
        agente_nombre: v.agente?.nombre ?? v.agente_nombre,
        agente_dni: v.agente_dni,
        servicio_nombre: v.agente?.servicio?.nombre ?? null,
        servicio_color: v.agente?.servicio?.color ?? null,
        fecha_desde: v.fecha_desde.toISOString().substring(0, 10),
        fecha_hasta: v.fecha_hasta.toISOString().substring(0, 10),
      })),
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al obtener dashboard' })
  }
}
