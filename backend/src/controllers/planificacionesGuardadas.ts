import { Response } from 'express'
import prisma from '../prisma'
import { createAuditLog } from '../utils/audit'
import { AuthRequest } from '../middleware/auth'

const LISTA_SELECT = {
  id: true,
  servicio_key: true,
  servicio_nombre: true,
  mes: true,
  anio: true,
  nombre: true,
  cumplimiento_total: true,
  personas_activas: true,
  hs_requeridas: true,
  fecha_guardado: true,
  guardador: { select: { id: true, nombre: true } },
} as const

export const listPlanificacionesGuardadas = async (req: AuthRequest, res: Response) => {
  try {
    const planificaciones = await prisma.planificacionGuardada.findMany({
      select: LISTA_SELECT,
      orderBy: { fecha_guardado: 'desc' },
    })
    return res.json(planificaciones)
  } catch {
    return res.status(500).json({ error: 'Error al listar planificaciones guardadas' })
  }
}

export const getPlanificacionGuardada = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const planificacion = await prisma.planificacionGuardada.findUnique({
      where: { id },
      include: { guardador: { select: { id: true, nombre: true } } },
    })
    if (!planificacion) return res.status(404).json({ error: 'No encontrado' })
    return res.json(planificacion)
  } catch {
    return res.status(500).json({ error: 'Error al obtener la planificación guardada' })
  }
}

export const createPlanificacionGuardada = async (req: AuthRequest, res: Response) => {
  try {
    const {
      servicio_key,
      servicio_nombre,
      mes,
      anio,
      nombre,
      dias_del_mes,
      tope_facturacion,
      modo_reductor,
      resultado,
      matrices,
      agentes,
      reductores,
      alertas,
      francos_servicio,
    } = req.body as {
      servicio_key: string
      servicio_nombre: string
      mes: number
      anio: number
      nombre?: string
      dias_del_mes: number
      tope_facturacion?: number
      modo_reductor?: string
      resultado: { cumplimientoTotal: number; totalHCActivos: number; totalHsRequeridas: number }
      matrices: unknown
      agentes: unknown
      reductores: unknown
      alertas: unknown
      francos_servicio?: unknown
    }

    const mesNum = parseInt(String(mes))
    const anioNum = parseInt(String(anio))
    if (!mesNum || mesNum < 1 || mesNum > 12) {
      return res.status(400).json({ error: 'mes debe estar entre 1 y 12' })
    }
    if (!anioNum || anioNum < 2000) {
      return res.status(400).json({ error: 'anio invalido' })
    }
    if (!servicio_key || !servicio_nombre) {
      return res.status(400).json({ error: 'servicio_key y servicio_nombre son requeridos' })
    }
    if (!resultado) {
      return res.status(400).json({ error: 'resultado es requerido' })
    }

    const creada = await prisma.planificacionGuardada.create({
      data: {
        servicio_key,
        servicio_nombre,
        mes: mesNum,
        anio: anioNum,
        nombre: nombre || null,
        dias_del_mes,
        tope_facturacion: tope_facturacion ?? 103,
        modo_reductor: modo_reductor ?? 'multiplicativo',
        cumplimiento_total: resultado.cumplimientoTotal,
        personas_activas: resultado.totalHCActivos,
        hs_requeridas: resultado.totalHsRequeridas,
        resultado: resultado as object,
        matrices: matrices as object,
        agentes: agentes as object,
        reductores: reductores as object,
        alertas: alertas as object,
        francos_servicio: francos_servicio ? (francos_servicio as object) : undefined,
        guardado_por: req.user!.userId,
      },
      include: { guardador: { select: { id: true, nombre: true } } },
    })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'CREAR_PLANIFICACION_GUARDADA',
      entidad: 'PlanificacionGuardada',
      entidad_id: String(creada.id),
      valor_nuevo: `${servicio_nombre} ${mesNum}/${anioNum} - ${resultado.cumplimientoTotal.toFixed(1)}% cumpl.`,
    })

    return res.status(201).json(creada)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al guardar la planificación' })
  }
}

export const deletePlanificacionGuardada = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    await prisma.planificacionGuardada.delete({ where: { id } })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'ELIMINAR_PLANIFICACION_GUARDADA',
      entidad: 'PlanificacionGuardada',
      entidad_id: String(id),
    })

    return res.json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Error al eliminar la planificación guardada' })
  }
}
