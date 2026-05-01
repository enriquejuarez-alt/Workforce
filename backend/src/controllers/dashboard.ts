import { Response } from 'express'
import prisma from '../prisma'
import { AuthRequest } from '../middleware/auth'

export const getDashboard = async (req: AuthRequest, res: Response) => {
  try {
    const adminUser = req.user?.rol === 'ADMINISTRADOR'
    const now = new Date()
    const currentMes = now.getMonth() + 1
    const currentAnio = now.getFullYear()

    let servicioIds: number[] | null = null

    if (!adminUser) {
      const permisos = await prisma.usuarioServicioPermiso.findMany({
        where: { usuario_id: req.user!.userId, puede_ver: true },
        select: { servicio_id: true },
      })
      servicioIds = permisos.map((p) => p.servicio_id)
    }

    const agenteWhere = servicioIds ? { servicio_id: { in: servicioIds } } : {}

    const nominaWhere = {
      mes: currentMes,
      anio: currentAnio,
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
      estadoBreakdown,
      agentesConLicencia,
      agentesConLicenciaRecord,
      porServicio,
      licenciasHoy,
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
          mes: currentMes,
          anio: currentAnio,
          ...(servicioIds ? { servicio_id: { in: servicioIds } } : {}),
        },
      }),
      prisma.nominaMensual.count({
        where: {
          estado: 'CERRADA',
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
      prisma.agenteNominaMensual.groupBy({
        by: ['estado'],
        where: {
          nomina_mensual: nominaWhere,
          presente_en_nomina: true,
        },
        _count: { estado: true },
      }),
      // Total en licencia: LP del Excel O tiene registro Licencia activo hoy
      prisma.agenteNominaMensual.count({
        where: {
          nomina_mensual: nominaWhere,
          presente_en_nomina: true,
          OR: [
            { estado: { equals: 'LP', mode: 'insensitive' } },
            { agente: { licencias: { some: { fecha_desde: { lte: now }, fecha_hasta: { gte: now } } } } },
          ],
        },
      }),
      // Solo registros Licencia (para ajustar el contador ACTIVO del breakdown)
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
    ])

    const countByEstado = (keywords: string[]) =>
      estadoBreakdown
        .filter((e) => e.estado && keywords.some((k) => e.estado!.toLowerCase().includes(k)))
        .reduce((sum, e) => sum + e._count.estado, 0)

    const agentesActivosRaw = countByEstado(['activo', 'activa'])
    // agentesConLicenciaRecord solo resta de ACTIVO (LP ya está excluido del grupo activo)
    const agentesActivos = Math.max(0, agentesActivosRaw - agentesConLicenciaRecord)

    // Ajustar breakdown: quitar grupo LP, restar Licencia-record del ACTIVO, agregar LICENCIA unificado
    const breakdownAjustado = estadoBreakdown
      .filter((e) => e.estado?.toLowerCase().trim() !== 'lp')
      .map((e) => {
        const cantidad = e._count.estado
        const esActivo = e.estado && ['activo', 'activa'].some((k) => e.estado!.toLowerCase().includes(k))
        return {
          estado: e.estado,
          cantidad: esActivo ? Math.max(0, cantidad - agentesConLicenciaRecord) : cantidad,
        }
      })
      .filter((e) => e.cantidad > 0)

    if (agentesConLicencia > 0) {
      breakdownAjustado.push({ estado: 'LICENCIA', cantidad: agentesConLicencia })
    }

    return res.json({
      total_agentes: totalAgentes,
      agentes_activos: agentesActivos,
      agentes_lp: agentesConLicencia,
      agentes_inactivos: agentesInactivos,
      estado_breakdown: breakdownAjustado,
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
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al obtener dashboard' })
  }
}
