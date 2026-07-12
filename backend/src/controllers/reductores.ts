import { Response } from 'express'
import prisma from '../prisma'
import { createAuditLog } from '../utils/audit'
import { AuthRequest } from '../middleware/auth'

interface ServicioInput {
  servicio: string
  servicioNorm: string
  deslogueo?: number
  ausentismo?: number
  rotacion?: number
}

export const listReductorImportaciones = async (req: AuthRequest, res: Response) => {
  try {
    const importaciones = await prisma.reductorImportacion.findMany({
      include: {
        importador: { select: { id: true, nombre: true } },
        _count: { select: { servicios: true } },
      },
      orderBy: { fecha_importacion: 'desc' },
    })
    return res.json(importaciones)
  } catch {
    return res.status(500).json({ error: 'Error al listar reductores guardados' })
  }
}

export const getReductorImportacion = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const importacion = await prisma.reductorImportacion.findUnique({
      where: { id },
      include: {
        importador: { select: { id: true, nombre: true } },
        servicios: { orderBy: { servicio: 'asc' } },
      },
    })
    if (!importacion) return res.status(404).json({ error: 'No encontrado' })
    return res.json(importacion)
  } catch {
    return res.status(500).json({ error: 'Error al obtener reductores guardados' })
  }
}

export const createReductorImportacion = async (req: AuthRequest, res: Response) => {
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
      const creada = await tx.reductorImportacion.create({
        data: {
          mes: mesNum,
          anio: anioNum,
          nombre: nombre || null,
          archivo_nombre: archivo_nombre || null,
          importado_por: req.user!.userId,
        },
      })

      await tx.reductorServicio.createMany({
        data: servicios.map((s) => ({
          importacion_id: creada.id,
          servicio: s.servicio,
          servicio_norm: s.servicioNorm,
          deslogueo: s.deslogueo ?? 0,
          ausentismo: s.ausentismo ?? 0,
          rotacion: s.rotacion ?? 0,
        })),
      })

      return tx.reductorImportacion.findUnique({
        where: { id: creada.id },
        include: {
          importador: { select: { id: true, nombre: true } },
          servicios: { orderBy: { servicio: 'asc' } },
        },
      })
    })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'CREAR_REDUCTOR_IMPORTACION',
      entidad: 'ReductorImportacion',
      entidad_id: String(importacion!.id),
      valor_nuevo: `${servicios.length} servicios, ${mesNum}/${anioNum}`,
    })

    return res.status(201).json(importacion)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al guardar reductores' })
  }
}

export const updateReductorServicio = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const servicioId = parseInt(req.params.servicioId)
    const { deslogueo, ausentismo, rotacion } = req.body as {
      deslogueo?: number
      ausentismo?: number
      rotacion?: number
    }

    const servicio = await prisma.reductorServicio.findUnique({ where: { id: servicioId } })
    if (!servicio || servicio.importacion_id !== id) {
      return res.status(404).json({ error: 'No encontrado' })
    }

    const actualizado = await prisma.reductorServicio.update({
      where: { id: servicioId },
      data: {
        ...(deslogueo !== undefined ? { deslogueo } : {}),
        ...(ausentismo !== undefined ? { ausentismo } : {}),
        ...(rotacion !== undefined ? { rotacion } : {}),
      },
    })

    await prisma.reductorImportacion.update({
      where: { id },
      data: { fecha_actualizacion: new Date() },
    })

    return res.json(actualizado)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al actualizar reductor' })
  }
}

export const deleteReductorImportacion = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    await prisma.reductorServicio.deleteMany({ where: { importacion_id: id } })
    await prisma.reductorImportacion.delete({ where: { id } })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'ELIMINAR_REDUCTOR_IMPORTACION',
      entidad: 'ReductorImportacion',
      entidad_id: String(id),
    })

    return res.json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Error al eliminar reductores guardados' })
  }
}
