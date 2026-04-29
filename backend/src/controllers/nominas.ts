import { Response } from 'express'
import prisma from '../prisma'
import { createAuditLog } from '../utils/audit'
import { getUserPermission, isCurrentMonth, isAdmin } from '../utils/permissions'
import { AuthRequest } from '../middleware/auth'

export const listNominas = async (req: AuthRequest, res: Response) => {
  try {
    const { servicio_id, mes, anio, estado } = req.query
    const adminUser = req.user?.rol === 'ADMINISTRADOR'

    let where: any = {}
    if (servicio_id) where.servicio_id = parseInt(servicio_id as string)
    if (mes) where.mes = parseInt(mes as string)
    if (anio) where.anio = parseInt(anio as string)
    if (estado) where.estado = estado

    if (!adminUser) {
      const permisos = await prisma.usuarioServicioPermiso.findMany({
        where: { usuario_id: req.user!.userId, puede_ver: true },
        select: { servicio_id: true },
      })
      const serviciosPermitidos = permisos.map((p) => p.servicio_id)
      where.servicio_id = servicio_id
        ? { in: serviciosPermitidos.filter((s) => s === parseInt(servicio_id as string)) }
        : { in: serviciosPermitidos }
    }

    const nominas = await prisma.nominaMensual.findMany({
      where,
      include: { servicio: true },
      orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
    })

    return res.json(nominas)
  } catch {
    return res.status(500).json({ error: 'Error al listar nóminas' })
  }
}

export const getNomina = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const nomina = await prisma.nominaMensual.findUnique({
      where: { id },
      include: { servicio: true },
    })
    if (!nomina) return res.status(404).json({ error: 'Nómina no encontrada' })

    const adminUser = req.user?.rol === 'ADMINISTRADOR'
    if (!adminUser) {
      const permiso = await getUserPermission(req.user!.userId, nomina.servicio_id)
      if (!permiso?.puede_ver) return res.status(403).json({ error: 'Sin permiso para ver esta nómina' })
    }

    return res.json(nomina)
  } catch {
    return res.status(500).json({ error: 'Error al obtener nómina' })
  }
}

export const deleteNomina = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const nomina = await prisma.nominaMensual.findUnique({ where: { id }, include: { servicio: true } })
    if (!nomina) return res.status(404).json({ error: 'Nómina no encontrada' })

    await prisma.agenteNominaMensual.deleteMany({ where: { nomina_mensual_id: id } })
    await prisma.importacionNomina.deleteMany({ where: { nomina_mensual_id: id } })
    await prisma.auditoria.updateMany({ where: { nomina_mensual_id: id }, data: { nomina_mensual_id: null } })
    await prisma.nominaMensual.delete({ where: { id } })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'ELIMINAR_NOMINA',
      entidad: 'NominaMensual',
      entidad_id: String(id),
      servicio_id: nomina.servicio_id,
      valor_anterior: `${nomina.servicio?.nombre} - ${nomina.mes}/${nomina.anio}`,
    })

    return res.json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Error al eliminar nómina' })
  }
}

export const updateNominaStatus = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const { estado } = req.body
    const validStates = ['BORRADOR', 'ACTIVA', 'CERRADA', 'ARCHIVADA']
    if (!validStates.includes(estado)) return res.status(400).json({ error: 'Estado inválido' })

    const nomina = await prisma.nominaMensual.update({
      where: { id },
      data: { estado },
    })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: `CAMBIO_ESTADO_NOMINA_${estado}`,
      entidad: 'NominaMensual',
      entidad_id: String(id),
      servicio_id: nomina.servicio_id,
      nomina_mensual_id: id,
      valor_anterior: nomina.estado,
      valor_nuevo: estado,
    })

    return res.json(nomina)
  } catch {
    return res.status(500).json({ error: 'Error al actualizar estado' })
  }
}

export const listAgentesNomina = async (req: AuthRequest, res: Response) => {
  try {
    const nominaId = parseInt(req.params.nominaId)
    const { search, superior, segmento, horarios, estado, contrato, sitio,
      modalidad, jefe, servicio_id, con_licencia, con_cambio, no_presente } = req.query

    const nomina = await prisma.nominaMensual.findUnique({ where: { id: nominaId } })
    if (!nomina) return res.status(404).json({ error: 'Nómina no encontrada' })

    const adminUser = req.user?.rol === 'ADMINISTRADOR'
    let permiso: any = null
    if (!adminUser) {
      permiso = await getUserPermission(req.user!.userId, nomina.servicio_id)
      if (!permiso?.puede_ver) return res.status(403).json({ error: 'Sin permiso' })
    }

    // Exclude agents with baja or remocion registered for this service up to the nomina's month end
    const endOfMonth = new Date(nomina.anio, nomina.mes, 0, 23, 59, 59)
    const prismaAny = prisma as any

    const [bajasEnServicio, remocionesEnServicio] = await Promise.all([
      prisma.historicoBaja.findMany({
        where: { servicio_id: nomina.servicio_id, fecha: { lte: endOfMonth } },
        select: { dni: true },
      }),
      prismaAny.remocion.findMany({
        where: { servicio_id: nomina.servicio_id, fecha: { lte: endOfMonth } },
        select: { dni: true },
      }),
    ])

    const dnisExcluidos = [
      ...new Set([
        ...bajasEnServicio.map((b: any) => b.dni),
        ...remocionesEnServicio.map((r: any) => r.dni),
      ]),
    ]

    let where: any = { nomina_mensual_id: nominaId }
    if (dnisExcluidos.length > 0) {
      where.dni = { notIn: dnisExcluidos }
    }

    // Allowed segments from permission (non-admin)
    const allowedSegmentos: string[] | null =
      !adminUser && permiso?.segmentos_permitidos?.length > 0
        ? permiso.segmentos_permitidos
        : null

    if (allowedSegmentos) {
      where.segmento = { in: allowedSegmentos }
    }

    if (search) {
      where.OR = [
        { dni: { contains: search as string, mode: 'insensitive' } },
        { usuario: { contains: search as string, mode: 'insensitive' } },
        { nombre: { contains: search as string, mode: 'insensitive' } },
      ]
    }
    if (superior) where.superior = { contains: superior as string, mode: 'insensitive' }
    if (segmento) {
      const seg = segmento as string
      if (allowedSegmentos) {
        // Intersect: apply user filter only within allowed segments
        const match = allowedSegmentos.find((s) => s.toLowerCase() === seg.toLowerCase())
        where.segmento = match ? { equals: match } : { in: [] }
      } else {
        where.segmento = { equals: seg, mode: 'insensitive' }
      }
    }
    if (horarios) where.horarios = { contains: horarios as string, mode: 'insensitive' }
    if (estado) where.estado = { equals: estado as string, mode: 'insensitive' }
    if (contrato) where.contrato = { equals: contrato as string, mode: 'insensitive' }
    if (sitio) where.sitio = { equals: sitio as string, mode: 'insensitive' }
    if (modalidad) where.modalidad = { equals: modalidad as string, mode: 'insensitive' }
    if (jefe) where.jefe = { contains: jefe as string, mode: 'insensitive' }
    if (no_presente === 'true') where.presente_en_nomina = false

    const snapshots = await prisma.agenteNominaMensual.findMany({
      where,
      orderBy: { nombre: 'asc' },
    })

    const agenteIds = snapshots.map((a) => a.agente_id)
    const now = new Date()

    const [licenciasVigentes, cambiosActivos] = await Promise.all([
      prisma.licencia.findMany({
        where: { agente_id: { in: agenteIds }, fecha_hasta: { gte: now } },
        orderBy: { fecha_desde: 'asc' },
        select: { agente_id: true, id: true, fecha_desde: true, fecha_hasta: true, motivo: true },
      }),
      prisma.cambioServicioTemporal.findMany({
        where: { agente_id: { in: agenteIds }, fecha_desde: { lte: now }, fecha_hasta: { gte: now } },
        include: { servicio_temporal: { select: { id: true, nombre: true } } },
      }),
    ])

    const licenciaMap = new Map<number, (typeof licenciasVigentes)[0]>()
    for (const l of licenciasVigentes) {
      if (!licenciaMap.has(l.agente_id)) licenciaMap.set(l.agente_id, l)
    }
    const cambioMap = new Map<number, (typeof cambiosActivos)[0]>()
    for (const c of cambiosActivos) {
      if (!cambioMap.has(c.agente_id)) cambioMap.set(c.agente_id, c)
    }

    let result: any[] = snapshots.map((a) => ({
      ...a,
      agente: {
        licencias: licenciaMap.has(a.agente_id) ? [licenciaMap.get(a.agente_id)] : [],
        cambios_temporales: cambioMap.has(a.agente_id) ? [cambioMap.get(a.agente_id)] : [],
      },
    }))

    if (con_licencia === 'true') {
      result = result.filter((a) => a.agente.licencias.length > 0)
    }
    if (con_cambio === 'true') {
      result = result.filter((a) => a.agente.cambios_temporales.length > 0)
    }

    // Apply active contract overrides for this nomina period
    const firstOfMonth = new Date(nomina.anio, nomina.mes - 1, 1)
    const lastOfMonth = new Date(nomina.anio, nomina.mes, 0, 23, 59, 59)
    const cambiosContrato = await prismaAny.cambioContrato.findMany({
      where: {
        servicio_id: nomina.servicio_id,
        OR: [
          { tipo: 'DEFINITIVO', fecha_desde: { lte: lastOfMonth } },
          { tipo: 'TEMPORAL', fecha_desde: { lte: lastOfMonth }, fecha_hasta: { gte: firstOfMonth } },
        ],
      },
      orderBy: { fecha_desde: 'desc' },
    })
    const contratoMap = new Map<number, string>()
    for (const c of cambiosContrato) {
      if (!contratoMap.has(c.agente_id)) contratoMap.set(c.agente_id, c.contrato_nuevo)
    }

    const finalResult: any[] = contratoMap.size > 0
      ? result.map((a) => ({ ...a, contrato: contratoMap.get(a.agente_id) ?? a.contrato }))
      : result

    return res.json(finalResult)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al listar agentes de nómina' })
  }
}

export const editAgentNomina = async (req: AuthRequest, res: Response) => {
  try {
    const snapshotId = parseInt(req.params.snapshotId)
    const snapshot = await prisma.agenteNominaMensual.findUnique({
      where: { id: snapshotId },
      include: { nomina_mensual: true },
    })
    if (!snapshot) return res.status(404).json({ error: 'Agente no encontrado en esta nómina' })

    const { mes, anio, servicio_id: servicioId } = snapshot.nomina_mensual
    const adminUser = req.user?.rol === 'ADMINISTRADOR'
    const currentMonth = isCurrentMonth(mes, anio)

    if (!adminUser) {
      const permiso = await getUserPermission(req.user!.userId, servicioId)
      if (!permiso?.puede_ver) return res.status(403).json({ error: 'Sin permiso para este servicio' })

      if (!currentMonth && !permiso.puede_editar_nominas_historicas) {
        return res.status(403).json({
          error: 'Esta nómina corresponde a un mes cerrado. Solo el administrador puede modificarla.',
        })
      }
      if (currentMonth && !permiso.puede_editar_nomina_mes_corriente) {
        return res.status(403).json({ error: 'No tenés permisos para editar esta nómina' })
      }

      const allowed = permiso.campos_editables
      const body = req.body
      for (const key of Object.keys(body)) {
        const fieldName = key.toUpperCase()
        if (allowed && allowed.length > 0 && !allowed.includes(fieldName)) {
          return res.status(403).json({ error: `No tenés permiso para editar el campo ${fieldName}` })
        }
      }
    }

    const allowedFields = ['superior', 'segmento', 'horarios', 'estado', 'contrato',
      'sitio', 'modalidad', 'jefe', 'observaciones', 'dni', 'usuario', 'nombre']
    const updateData: any = {}
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field]
    }

    const prev = { ...snapshot }
    const updated = await prisma.agenteNominaMensual.update({
      where: { id: snapshotId },
      data: updateData,
    })

    if (currentMonth || adminUser) {
      const masterFields: any = {}
      for (const field of allowedFields) {
        if (updateData[field] !== undefined) masterFields[field] = updateData[field]
      }
      if (Object.keys(masterFields).length > 0) {
        await prisma.agente.update({
          where: { id: snapshot.agente_id },
          data: masterFields,
        })
      }
    }

    for (const [field, newVal] of Object.entries(updateData)) {
      const prevVal = (prev as any)[field]
      if (prevVal !== newVal) {
        await createAuditLog({
          usuario_id: req.user!.userId,
          accion: 'EDITAR_AGENTE_NOMINA',
          entidad: 'AgenteNominaMensual',
          entidad_id: String(snapshotId),
          servicio_id: servicioId,
          nomina_mensual_id: snapshot.nomina_mensual_id,
          campo_modificado: field,
          valor_anterior: String(prevVal ?? ''),
          valor_nuevo: String(newVal ?? ''),
        })
      }
    }

    return res.json(updated)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al editar agente' })
  }
}

export const replicarNomina = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    if (req.user?.rol !== 'ADMINISTRADOR') {
      return res.status(403).json({ error: 'Solo administradores pueden replicar nóminas' })
    }

    const nomina = await prisma.nominaMensual.findUnique({ where: { id } })
    if (!nomina) return res.status(404).json({ error: 'Nómina no encontrada' })

    const nextMes = nomina.mes === 12 ? 1 : nomina.mes + 1
    const nextAnio = nomina.mes === 12 ? nomina.anio + 1 : nomina.anio

    const exists = await prisma.nominaMensual.findFirst({
      where: { servicio_id: nomina.servicio_id, mes: nextMes, anio: nextAnio },
    })
    if (exists) {
      return res.status(409).json({
        error: `Ya existe una nómina para ese período (${nextMes}/${nextAnio})`,
      })
    }

    const nueva = await prisma.nominaMensual.create({
      data: {
        servicio_id: nomina.servicio_id,
        mes: nextMes,
        anio: nextAnio,
        estado: 'BORRADOR',
        cargado_por: req.user!.userId,
        fecha_carga: new Date(),
      },
      include: { servicio: true },
    })

    const fuente = await prisma.agenteNominaMensual.findMany({
      where: { nomina_mensual_id: id },
    })

    if (fuente.length > 0) {
      await prisma.agenteNominaMensual.createMany({
        data: fuente.map(({ id: _id, nomina_mensual_id: _nm, ...rest }) => ({
          ...rest,
          nomina_mensual_id: nueva.id,
          presente_en_nomina: true,
        })),
      })
    }

    // Auto-add pending altas for this service/month/year
    const primeroDeMes = new Date(nextAnio, nextMes - 1, 1)
    const primeroMesSig = new Date(nextAnio, nextMes, 1)
    const prismaAnyR = prisma as any
    const pendientes = await prismaAnyR.capacitacion.findMany({
      where: {
        servicio_id: nomina.servicio_id,
        pendiente_alta: true,
        dado_de_alta: false,
        fecha_alta: { gte: primeroDeMes, lt: primeroMesSig },
      },
    })
    for (const cap of pendientes) {
      let agenteId = cap.agente_id
      if (!agenteId) {
        const searchClause: any[] = []
        if (cap.agente_dni) searchClause.push({ dni: cap.agente_dni })
        if (cap.usuario_sistema) searchClause.push({ usuario: cap.usuario_sistema })
        if (searchClause.length > 0) {
          let agente = await prisma.agente.findFirst({ where: { OR: searchClause } })
          if (!agente) {
            agente = await prisma.agente.create({
              data: {
                dni: cap.agente_dni ?? cap.usuario_sistema,
                usuario: cap.usuario_sistema ?? cap.agente_dni,
                nombre: cap.agente_nombre,
                superior: cap.superior, segmento: cap.segmento, horarios: cap.horarios,
                estado: cap.estado, contrato: cap.contrato, sitio: cap.sitio,
                modalidad: cap.modalidad, jefe: cap.jefe,
                servicio_id: cap.servicio_id, activo: true, presente_ultima_carga: false,
              },
            })
          }
          agenteId = agente.id
        }
      }
      if (!agenteId) continue
      const agenteData = await prisma.agente.findUnique({ where: { id: agenteId } })
      await prisma.agenteNominaMensual.upsert({
        where: { nomina_mensual_id_agente_id: { nomina_mensual_id: nueva.id, agente_id: agenteId } },
        update: { nombre: cap.agente_nombre, usuario: agenteData?.usuario ?? '', dni: agenteData?.dni ?? '', segmento: cap.segmento, superior: cap.superior, horarios: cap.horarios, estado: cap.estado, contrato: cap.contrato, sitio: cap.sitio, modalidad: cap.modalidad, jefe: cap.jefe, servicio_id: cap.servicio_id, presente_en_nomina: true },
        create: { nomina_mensual_id: nueva.id, agente_id: agenteId, nombre: cap.agente_nombre, usuario: agenteData?.usuario ?? '', dni: agenteData?.dni ?? '', segmento: cap.segmento, superior: cap.superior, horarios: cap.horarios, estado: cap.estado, contrato: cap.contrato, sitio: cap.sitio, modalidad: cap.modalidad, jefe: cap.jefe, servicio_id: cap.servicio_id, presente_en_nomina: true },
      })
      await prismaAnyR.capacitacion.update({
        where: { id: cap.id },
        data: { dado_de_alta: true, pendiente_alta: false, agente_id: agenteId },
      })
    }

    await prisma.nominaMensual.update({
      where: { id: nueva.id },
      data: { total_agentes: fuente.length + pendientes.length },
    })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'REPLICAR_NOMINA',
      entidad: 'NominaMensual',
      entidad_id: String(nueva.id),
      servicio_id: nomina.servicio_id,
      nomina_mensual_id: nueva.id,
      valor_anterior: String(id),
      valor_nuevo: String(nueva.id),
    })

    return res.json({
      message: `Nómina replicada: ${fuente.length} agentes copiados a ${nextMes}/${nextAnio}`,
      nomina: { ...nueva, total_agentes: fuente.length },
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al replicar nómina' })
  }
}

export const deleteAgentNomina = async (req: AuthRequest, res: Response) => {
  try {
    const snapshotId = parseInt(req.params.snapshotId)
    const snapshot = await prisma.agenteNominaMensual.findUnique({
      where: { id: snapshotId },
      include: { nomina_mensual: true },
    })
    if (!snapshot) return res.status(404).json({ error: 'Agente no encontrado en esta nómina' })

    const { mes, anio, servicio_id: servicioId } = snapshot.nomina_mensual
    const adminUser = req.user?.rol === 'ADMINISTRADOR'
    const esActual = isCurrentMonth(mes, anio)

    if (!adminUser) {
      const permiso = await getUserPermission(req.user!.userId, servicioId)
      if (!permiso?.puede_ver) return res.status(403).json({ error: 'Sin permiso para este servicio' })
      if (!esActual) return res.status(403).json({ error: 'Solo el administrador puede eliminar agentes de nóminas históricas' })
      if (!permiso.puede_editar_nomina_mes_corriente) return res.status(403).json({ error: 'Sin permiso para editar esta nómina' })
    }

    await prisma.agenteNominaMensual.delete({ where: { id: snapshotId } })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'ELIMINAR_AGENTE_NOMINA',
      entidad: 'AgenteNominaMensual',
      entidad_id: String(snapshotId),
      servicio_id: servicioId,
      nomina_mensual_id: snapshot.nomina_mensual_id,
      valor_anterior: `${snapshot.nombre} (DNI: ${snapshot.dni})`,
    })

    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al eliminar agente de nómina' })
  }
}

export const compareNominas = async (req: AuthRequest, res: Response) => {
  try {
    const { servicioId, mes1, anio1, mes2, anio2 } = req.query

    const adminUser = req.user?.rol === 'ADMINISTRADOR'
    if (!adminUser) {
      const permiso = await getUserPermission(req.user!.userId, parseInt(servicioId as string))
      if (!permiso?.puede_comparar_nominas_mensuales) {
        return res.status(403).json({ error: 'Sin permiso para comparar nóminas' })
      }
    }

    const [nomina1, nomina2] = await Promise.all([
      prisma.nominaMensual.findFirst({
        where: {
          servicio_id: parseInt(servicioId as string),
          mes: parseInt(mes1 as string),
          anio: parseInt(anio1 as string),
        },
      }),
      prisma.nominaMensual.findFirst({
        where: {
          servicio_id: parseInt(servicioId as string),
          mes: parseInt(mes2 as string),
          anio: parseInt(anio2 as string),
        },
      }),
    ])

    if (!nomina1 || !nomina2) {
      return res.status(404).json({ error: 'Una o ambas nóminas no existen' })
    }

    const [snapshots1, snapshots2] = await Promise.all([
      prisma.agenteNominaMensual.findMany({ where: { nomina_mensual_id: nomina1.id } }),
      prisma.agenteNominaMensual.findMany({ where: { nomina_mensual_id: nomina2.id } }),
    ])

    const map1 = new Map(snapshots1.map((s) => [s.agente_id, s]))
    const map2 = new Map(snapshots2.map((s) => [s.agente_id, s]))

    const agentesNuevos = snapshots2.filter((s) => !map1.has(s.agente_id))
    const agentesNoPresentes = snapshots1.filter((s) => !map2.has(s.agente_id))
    const cambios: any[] = []

    const fields = ['estado', 'servicio_id', 'superior', 'horarios', 'contrato', 'modalidad']
    for (const [agenteId, s2] of map2) {
      const s1 = map1.get(agenteId)
      if (!s1) continue
      const diffs: any = {}
      for (const f of fields) {
        if ((s1 as any)[f] !== (s2 as any)[f]) {
          diffs[f] = { antes: (s1 as any)[f], despues: (s2 as any)[f] }
        }
      }
      if (Object.keys(diffs).length > 0) {
        cambios.push({ agente_id: agenteId, nombre: s2.nombre, cambios: diffs })
      }
    }

    return res.json({
      nomina1: { mes: nomina1.mes, anio: nomina1.anio, total: snapshots1.length },
      nomina2: { mes: nomina2.mes, anio: nomina2.anio, total: snapshots2.length },
      agentes_nuevos: agentesNuevos.map((a) => ({ id: a.agente_id, nombre: a.nombre })),
      agentes_no_presentes: agentesNoPresentes.map((a) => ({ id: a.agente_id, nombre: a.nombre })),
      cambios,
      resumen: {
        nuevos: agentesNuevos.length,
        no_presentes: agentesNoPresentes.length,
        con_cambios: cambios.length,
        cambios_estado: cambios.filter((c) => c.cambios.estado).length,
        cambios_horario: cambios.filter((c) => c.cambios.horarios).length,
        cambios_superior: cambios.filter((c) => c.cambios.superior).length,
        cambios_contrato: cambios.filter((c) => c.cambios.contrato).length,
        cambios_modalidad: cambios.filter((c) => c.cambios.modalidad).length,
      },
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al comparar nóminas' })
  }
}
