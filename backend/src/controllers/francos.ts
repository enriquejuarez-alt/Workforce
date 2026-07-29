import { Response } from 'express'
import prisma from '../prisma'
import { createAuditLog } from '../utils/audit'
import { AuthRequest } from '../middleware/auth'

interface ServicioInput {
  servicio: string
  servicioNorm: string
  dotacion?: number
  ponderadoHoras?: number
  ponderadoDias?: number
  francoLunes?: number
  francoMartes?: number
  francoMiercoles?: number
  francoJueves?: number
  francoViernes?: number
  francoSabado?: number
  francoDomingo?: number
}

export const listFrancoImportaciones = async (req: AuthRequest, res: Response) => {
  try {
    const importaciones = await prisma.francoImportacion.findMany({
      include: {
        importador: { select: { id: true, nombre: true } },
        _count: { select: { servicios: true } },
      },
      orderBy: { fecha_importacion: 'desc' },
    })
    return res.json(importaciones)
  } catch {
    return res.status(500).json({ error: 'Error al listar francos guardados' })
  }
}

export const getFrancoImportacion = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const importacion = await prisma.francoImportacion.findUnique({
      where: { id },
      include: {
        importador: { select: { id: true, nombre: true } },
        servicios: { orderBy: { servicio: 'asc' } },
      },
    })
    if (!importacion) return res.status(404).json({ error: 'No encontrado' })
    return res.json(importacion)
  } catch {
    return res.status(500).json({ error: 'Error al obtener francos guardados' })
  }
}

export const createFrancoImportacion = async (req: AuthRequest, res: Response) => {
  try {
    const { mes, anio, nombre, archivo_nombre, servicios } = req.body as {
      mes: number
      anio: number
      nombre?: string
      archivo_nombre?: string
      servicios: ServicioInput[]
    }

    const mesNum = parseInt(String(mes))
    const anioNum = parseInt(String(anio))
    if (!mesNum || mesNum < 1 || mesNum > 12) {
      return res.status(400).json({ error: 'mes debe estar entre 1 y 12' })
    }
    if (!anioNum || anioNum < 2000) {
      return res.status(400).json({ error: 'anio invalido' })
    }
    if (!Array.isArray(servicios) || servicios.length === 0) {
      return res.status(400).json({ error: 'servicios debe ser un array no vacío' })
    }

    const importacion = await prisma.$transaction(async (tx) => {
      const creada = await tx.francoImportacion.create({
        data: {
          mes: mesNum,
          anio: anioNum,
          nombre: nombre || null,
          archivo_nombre: archivo_nombre || null,
          importado_por: req.user!.userId,
        },
      })

      await tx.francoServicio.createMany({
        data: servicios.map((s) => ({
          importacion_id: creada.id,
          servicio: s.servicio,
          servicio_norm: s.servicioNorm,
          dotacion: s.dotacion ?? 0,
          ponderado_horas: s.ponderadoHoras ?? 0,
          ponderado_dias: s.ponderadoDias ?? 0,
          franco_lunes: s.francoLunes ?? 0,
          franco_martes: s.francoMartes ?? 0,
          franco_miercoles: s.francoMiercoles ?? 0,
          franco_jueves: s.francoJueves ?? 0,
          franco_viernes: s.francoViernes ?? 0,
          franco_sabado: s.francoSabado ?? 0,
          franco_domingo: s.francoDomingo ?? 0,
        })),
      })

      return tx.francoImportacion.findUnique({
        where: { id: creada.id },
        include: {
          importador: { select: { id: true, nombre: true } },
          servicios: { orderBy: { servicio: 'asc' } },
        },
      })
    })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'CREAR_FRANCO_IMPORTACION',
      entidad: 'FrancoImportacion',
      entidad_id: String(importacion!.id),
      valor_nuevo: `${servicios.length} servicios, ${mesNum}/${anioNum}`,
    })

    return res.status(201).json(importacion)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al guardar francos' })
  }
}

export const updateFrancoServicio = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const servicioId = parseInt(req.params.servicioId)
    const data = req.body as Partial<{
      dotacion: number
      ponderado_horas: number
      ponderado_dias: number
      franco_lunes: number
      franco_martes: number
      franco_miercoles: number
      franco_jueves: number
      franco_viernes: number
      franco_sabado: number
      franco_domingo: number
    }>

    const servicio = await prisma.francoServicio.findUnique({ where: { id: servicioId } })
    if (!servicio || servicio.importacion_id !== id) {
      return res.status(404).json({ error: 'No encontrado' })
    }

    const actualizado = await prisma.francoServicio.update({
      where: { id: servicioId },
      data,
    })

    await prisma.francoImportacion.update({
      where: { id },
      data: { fecha_actualizacion: new Date() },
    })

    return res.json(actualizado)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al actualizar franco' })
  }
}

export const deleteFrancoImportacion = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    await prisma.francoServicio.deleteMany({ where: { importacion_id: id } })
    await prisma.francoImportacion.delete({ where: { id } })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'ELIMINAR_FRANCO_IMPORTACION',
      entidad: 'FrancoImportacion',
      entidad_id: String(id),
    })

    return res.json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Error al eliminar francos guardados' })
  }
}
