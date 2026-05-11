import { Response } from 'express'
import prisma from '../prisma'
import { AuthRequest } from '../middleware/auth'

export interface PlaniServicioConfig {
  key: string
  label?: string
  hojaCP: string[]
  segmentos: string[]
  reductores: string[]
}

export const getPlaniConfig = async (req: AuthRequest, res: Response) => {
  try {
    const servicios = await prisma.servicio.findMany({
      where: { activo: true },
      select: { id: true, nombre: true, plani_config: true },
      orderBy: { nombre: 'asc' },
    })

    return res.json({
      servicios: servicios.map((s) => ({
        id: s.id,
        nombre: s.nombre,
        planiConfig: s.plani_config as PlaniServicioConfig | null,
      })),
    })
  } catch {
    return res.status(500).json({ error: 'Error al obtener configuración Plani' })
  }
}

export const updatePlaniConfig = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const config: PlaniServicioConfig = req.body

    await prisma.servicio.update({
      where: { id },
      data: { plani_config: config as any },
    })

    return res.json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Error al actualizar configuración Plani' })
  }
}

export const getPlaniNomina = async (req: AuthRequest, res: Response) => {
  try {
    const mes = parseInt(req.query.mes as string)
    const anio = parseInt(req.query.anio as string)
    const servicioId = req.query.servicio_id ? parseInt(req.query.servicio_id as string) : undefined

    if (!mes || !anio || mes < 1 || mes > 12 || anio < 2000) {
      return res.status(400).json({ error: 'Parámetros mes y anio requeridos' })
    }

    const snapshots = await prisma.agenteNominaMensual.findMany({
      where: {
        presente_en_nomina: true,
        nomina_mensual: {
          mes,
          anio,
          estado: { in: ['ACTIVA', 'CERRADA', 'BORRADOR'] },
          ...(servicioId ? { servicio_id: servicioId } : {}),
        },
      },
      select: {
        dni: true,
        usuario: true,
        nombre: true,
        superior: true,
        segmento: true,
        horarios: true,
        estado: true,
        contrato: true,
        sitio: true,
        modalidad: true,
        jefe: true,
        agente_id: true,
      },
    })

    // Pull active capacitaciones for these agents
    const agenteIds = [...new Set(snapshots.map((s) => s.agente_id))]
    const hoy = new Date()
    const capas = await prisma.capacitacion.findMany({
      where: {
        agente_id: { in: agenteIds },
        fecha_inicio: { lte: hoy },
        fecha_fin: { gte: hoy },
        dado_de_alta: false,
      },
      select: { agente_id: true, fecha_fin: true },
    })

    const capaMap = new Map<number, string>()
    for (const c of capas) {
      if (c.agente_id === null) continue
      const iso = c.fecha_fin.toISOString().slice(0, 10)
      capaMap.set(c.agente_id, iso)
    }

    const agentes = snapshots.map((s) => ({
      dni: s.dni,
      usuario: s.usuario,
      nombre: s.nombre,
      superior: s.superior ?? null,
      segmento: s.segmento ?? null,
      horarios: s.horarios ?? null,
      estado: s.estado ?? null,
      contrato: s.contrato ?? null,
      sitio: s.sitio ?? null,
      modalidad: s.modalidad ?? null,
      jefe: s.jefe ?? null,
      fechaInicioAtencion: capaMap.get(s.agente_id) ?? null,
    }))

    return res.json({ mes, anio, agentes })
  } catch {
    return res.status(500).json({ error: 'Error al exportar nómina para Plani' })
  }
}
