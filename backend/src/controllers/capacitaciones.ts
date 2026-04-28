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
    const now = new Date()
    const where: any = {}
    if (servicio_id) where.servicio_id = parseInt(servicio_id as string)
    if (segmento) {
      where.segmento = segmento === 'SIN_DEFINIR' ? null : { equals: segmento as string, mode: 'insensitive' }
    }

    if (estado_cap) {
      const e = (estado_cap as string).toUpperCase()
      if (e === 'VIGENTE') {
        where.fecha_inicio = { lte: now }
        where.fecha_fin = { gte: now }
      } else if (e === 'PROGRAMADA') {
        where.fecha_inicio = { gt: now }
      } else if (e === 'FINALIZADA') {
        where.fecha_fin = { lt: now }
      }
    }

    const prismaAny = prisma as any
    const items = await prismaAny.capacitacion.findMany({
      where,
      include: {
        servicio: { select: { id: true, nombre: true, color: true } },
        creador: { select: { id: true, nombre: true } },
      },
      orderBy: { fecha_fin: 'asc' },
      take: 1000,
    })

    const withStatus = items.map((c: any) => {
      const estado_calculado = calcularEstado(new Date(c.fecha_inicio), new Date(c.fecha_fin))
      return { ...c, estado_calculado }
    })

    return res.json(withStatus)
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

export const darDeAlta = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const { fecha_alta, segmento, superior, horarios, estado, contrato, sitio, modalidad, jefe } = req.body

    if (!fecha_alta) {
      return res.status(400).json({ error: 'fecha_alta es requerida' })
    }

    const prismaAny = prisma as any
    const cap = await prismaAny.capacitacion.findUnique({ where: { id } })
    if (!cap) return res.status(404).json({ error: 'Capacitación no encontrada' })
    if (cap.dado_de_alta) return res.status(400).json({ error: 'Este agente ya fue dado de alta' })

    const fechaAltaDate = new Date(fecha_alta)
    const mes = fechaAltaDate.getMonth() + 1
    const anio = fechaAltaDate.getFullYear()

    const mergedData = {
      segmento: segmento !== undefined ? (segmento === 'SIN_DEFINIR' ? null : segmento || null) : cap.segmento,
      superior: superior !== undefined ? superior || null : cap.superior,
      horarios: horarios !== undefined ? horarios || null : cap.horarios,
      estado: estado !== undefined ? estado || null : cap.estado,
      contrato: contrato !== undefined ? contrato || null : cap.contrato,
      sitio: sitio !== undefined ? sitio || null : cap.sitio,
      modalidad: modalidad !== undefined ? modalidad || null : cap.modalidad,
      jefe: jefe !== undefined ? jefe || null : cap.jefe,
    }

    let agenteId: number = cap.agente_id

    if (!agenteId) {
      const dniOrUser = cap.agente_dni || cap.usuario_sistema
      if (!dniOrUser) {
        return res.status(400).json({ error: 'El agente nuevo requiere al menos un DNI o usuario de sistema para ser creado' })
      }

      const searchClause: any[] = []
      if (cap.agente_dni) searchClause.push({ dni: cap.agente_dni })
      if (cap.usuario_sistema) searchClause.push({ usuario: cap.usuario_sistema })

      let agente = await prisma.agente.findFirst({ where: { OR: searchClause } })
      if (!agente) {
        agente = await prisma.agente.create({
          data: {
            dni: cap.agente_dni ?? cap.usuario_sistema,
            usuario: cap.usuario_sistema ?? cap.agente_dni,
            nombre: cap.agente_nombre,
            superior: mergedData.superior,
            segmento: mergedData.segmento,
            horarios: mergedData.horarios,
            estado: mergedData.estado,
            contrato: mergedData.contrato,
            sitio: mergedData.sitio,
            modalidad: mergedData.modalidad,
            jefe: mergedData.jefe,
            servicio_id: cap.servicio_id,
            activo: true,
            presente_ultima_carga: false,
          },
        })
      }
      agenteId = agente.id
    }

    const nomina = await prisma.nominaMensual.findFirst({
      where: { servicio_id: cap.servicio_id, mes, anio },
    })

    let pendienteAlta = false
    if (nomina) {
      const agenteData = await prisma.agente.findUnique({ where: { id: agenteId } })
      await prisma.agenteNominaMensual.upsert({
        where: { nomina_mensual_id_agente_id: { nomina_mensual_id: nomina.id, agente_id: agenteId } },
        update: {
          nombre: cap.agente_nombre,
          usuario: agenteData?.usuario ?? cap.usuario_sistema ?? '',
          dni: agenteData?.dni ?? cap.agente_dni ?? '',
          ...mergedData,
          servicio_id: cap.servicio_id,
          presente_en_nomina: true,
        },
        create: {
          nomina_mensual_id: nomina.id,
          agente_id: agenteId,
          nombre: cap.agente_nombre,
          usuario: agenteData?.usuario ?? cap.usuario_sistema ?? '',
          dni: agenteData?.dni ?? cap.agente_dni ?? '',
          ...mergedData,
          servicio_id: cap.servicio_id,
          presente_en_nomina: true,
        },
      })

      await createAuditLog({
        usuario_id: req.user!.userId,
        accion: 'DAR_DE_ALTA_CAPACITACION',
        entidad: 'Capacitacion',
        entidad_id: String(id),
        servicio_id: cap.servicio_id ?? undefined,
        nomina_mensual_id: nomina.id,
        valor_nuevo: `${cap.agente_nombre} → Nómina ${mes}/${anio}`,
      })
    } else {
      pendienteAlta = true
    }

    const updated = await prismaAny.capacitacion.update({
      where: { id },
      data: {
        agente_id: agenteId,
        dado_de_alta: !pendienteAlta,
        pendiente_alta: pendienteAlta,
        fecha_alta: fechaAltaDate,
        ...mergedData,
      },
      include: {
        servicio: { select: { id: true, nombre: true, color: true } },
        creador: { select: { id: true, nombre: true } },
      },
    })

    return res.json({
      ...updated,
      estado_calculado: calcularEstado(new Date(updated.fecha_inicio), new Date(updated.fecha_fin)),
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al dar de alta' })
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
