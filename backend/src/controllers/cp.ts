import { Response } from 'express'
import prisma from '../prisma'
import { createAuditLog } from '../utils/audit'
import { AuthRequest } from '../middleware/auth'

interface ServicioInput {
  servicio: string
  servicioNorm: string
  diasDelMes?: number
  totalMes?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  matriz: any
}

const LISTA_INCLUDE = {
  importador: { select: { id: true, nombre: true } },
  _count: { select: { servicios: true } },
  // Liviano a proposito (sin `matriz`, que es el JSON pesado) — alcanza para
  // que el picker de "CP guardado" en Planificacion pueda filtrar/mostrar
  // que CPs realmente contienen el servicio activo, sin traer las 31x48
  // matrices de cada uno solo para listar.
  servicios: { select: { servicio: true, servicio_norm: true } },
} as const

export const listCpImportaciones = async (req: AuthRequest, res: Response) => {
  try {
    const importaciones = await prisma.cpImportacion.findMany({
      include: LISTA_INCLUDE,
      orderBy: { fecha_importacion: 'desc' },
    })
    return res.json(importaciones)
  } catch {
    return res.status(500).json({ error: 'Error al listar CPs guardados' })
  }
}

export const getCpImportacion = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const importacion = await prisma.cpImportacion.findUnique({
      where: { id },
      include: {
        importador: { select: { id: true, nombre: true } },
        servicios: { orderBy: { servicio: 'asc' } },
      },
    })
    if (!importacion) return res.status(404).json({ error: 'No encontrado' })
    return res.json(importacion)
  } catch {
    return res.status(500).json({ error: 'Error al obtener el CP guardado' })
  }
}

export const createCpImportacion = async (req: AuthRequest, res: Response) => {
  try {
    const { mes, anio, formato, nombre, archivo_nombre, servicios } = req.body as {
      mes: number
      anio: number
      formato: string
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
    if (!formato) {
      return res.status(400).json({ error: 'formato es requerido' })
    }
    if (!Array.isArray(servicios) || servicios.length === 0) {
      return res.status(400).json({ error: 'servicios debe ser un array no vacío' })
    }

    const importacion = await prisma.$transaction(async (tx) => {
      const creada = await tx.cpImportacion.create({
        data: {
          mes: mesNum,
          anio: anioNum,
          formato,
          nombre: nombre || null,
          archivo_nombre: archivo_nombre || null,
          importado_por: req.user!.userId,
        },
      })

      await tx.cpServicio.createMany({
        data: servicios.map((s) => ({
          importacion_id: creada.id,
          servicio: s.servicio,
          servicio_norm: s.servicioNorm,
          dias_del_mes: s.diasDelMes ?? 0,
          total_mes: s.totalMes ?? 0,
          matriz: s.matriz as object,
        })),
      })

      return tx.cpImportacion.findUnique({
        where: { id: creada.id },
        include: {
          importador: { select: { id: true, nombre: true } },
          servicios: { orderBy: { servicio: 'asc' } },
        },
      })
    })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'CREAR_CP_IMPORTACION',
      entidad: 'CpImportacion',
      entidad_id: String(importacion!.id),
      valor_nuevo: `${formato}, ${servicios.length} servicios, ${mesNum}/${anioNum}`,
    })

    return res.status(201).json(importacion)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al guardar el CP' })
  }
}

export const deleteCpImportacion = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    await prisma.cpServicio.deleteMany({ where: { importacion_id: id } })
    await prisma.cpImportacion.delete({ where: { id } })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'ELIMINAR_CP_IMPORTACION',
      entidad: 'CpImportacion',
      entidad_id: String(id),
    })

    return res.json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Error al eliminar el CP guardado' })
  }
}
