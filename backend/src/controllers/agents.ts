import { Response } from 'express'
import ExcelJS from 'exceljs'
import prisma from '../prisma'
import { createAuditLog } from '../utils/audit'
import { getUserPermission } from '../utils/permissions'
import { AuthRequest } from '../middleware/auth'

function normalizarDni(v: string): string {
  return v.replace(/[.\-\s]/g, '')
}

export function calcularEdad(fechaNacimiento: Date | null): number | null {
  if (!fechaNacimiento) return null
  const hoy = new Date()
  let edad = hoy.getFullYear() - fechaNacimiento.getFullYear()
  const m = hoy.getMonth() - fechaNacimiento.getMonth()
  if (m < 0 || (m === 0 && hoy.getDate() < fechaNacimiento.getDate())) edad--
  return edad
}

// Construye el WHERE compartido por listAgents y exportAgentes
async function buildAgentsWhere(req: AuthRequest): Promise<{ where: any; error?: { status: number; message: string } }> {
  const {
    servicio_id, search, estado, activo, modalidad, superior,
    servicio_anterior_id, tiene_capacitaciones, tiene_remociones,
    edad_min, edad_max, fecha_ingreso_desde, fecha_ingreso_hasta,
  } = req.query
  const adminUser = req.user?.rol === 'ADMINISTRADOR'
  const isLider = req.user?.rol === 'LIDER'

  const where: any = {}
  if (activo !== undefined) where.activo = activo === 'true'
  if (estado) where.estado = estado
  if (modalidad) where.modalidad = modalidad as string
  if (superior) where.superior = { contains: superior as string, mode: 'insensitive' }

  if (isLider) {
    if (!req.user?.servicioId) return { where, error: { status: 403, message: 'Líder sin servicio asignado' } }
    where.servicio_id = req.user.servicioId
  } else {
    if (servicio_id) where.servicio_id = parseInt(servicio_id as string)
    if (!adminUser && servicio_id) {
      const permiso = await getUserPermission(req.user!.userId, parseInt(servicio_id as string))
      if (!permiso?.puede_ver) return { where, error: { status: 403, message: 'Sin permiso' } }
    }
  }

  if (search) {
    const raw = search as string
    where.OR = [
      { dni: { contains: normalizarDni(raw), mode: 'insensitive' } },
      { usuario: { contains: raw.trim(), mode: 'insensitive' } },
      { nombre: { contains: raw.trim(), mode: 'insensitive' } },
    ]
  }

  if (servicio_anterior_id) {
    where.servicio_historial = {
      some: { servicio_id: parseInt(servicio_anterior_id as string), fecha_hasta: { not: null } },
    }
  }
  if (tiene_capacitaciones === 'true') where.capacitaciones = { some: {} }
  if (tiene_remociones === 'true') where.remociones = { some: {} }

  if (edad_min || edad_max) {
    const hoy = new Date()
    where.fecha_nacimiento = {}
    // edad_min anios -> nacido antes de (hoy - edad_min anios)
    if (edad_min) {
      const maxNacimiento = new Date(hoy)
      maxNacimiento.setFullYear(hoy.getFullYear() - parseInt(edad_min as string))
      where.fecha_nacimiento.lte = maxNacimiento
    }
    if (edad_max) {
      const minNacimiento = new Date(hoy)
      minNacimiento.setFullYear(hoy.getFullYear() - parseInt(edad_max as string) - 1)
      where.fecha_nacimiento.gte = minNacimiento
    }
  }

  if (fecha_ingreso_desde || fecha_ingreso_hasta) {
    where.fecha_creacion = {}
    if (fecha_ingreso_desde) where.fecha_creacion.gte = new Date(fecha_ingreso_desde as string)
    if (fecha_ingreso_hasta) where.fecha_creacion.lte = new Date(fecha_ingreso_hasta as string)
  }

  return { where }
}

// Lista agentes con filtros opcionales y paginacion server-side. El LIDER
// solo ve su propio servicio; el ADMINISTRADOR puede ver todos o filtrar por servicio_id
export const listAgents = async (req: AuthRequest, res: Response) => {
  try {
    const { page = '1', limit = '50' } = req.query
    const { where, error } = await buildAgentsWhere(req)
    if (error) return res.status(error.status).json({ error: error.message })

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string)
    const [total, agentes] = await Promise.all([
      prisma.agente.count({ where }),
      prisma.agente.findMany({
        where,
        include: {
          servicio: true,
          licencias: {
            where: { fecha_hasta: { gte: new Date() } },
            orderBy: { fecha_desde: 'asc' },
            take: 1,
          },
          cambios_temporales: {
            where: { fecha_hasta: { gte: new Date() }, fecha_desde: { lte: new Date() } },
            include: { servicio_temporal: true },
            take: 1,
          },
        },
        orderBy: { nombre: 'asc' },
        skip,
        take: parseInt(limit as string),
      }),
    ])

    const data = agentes.map((a) => ({ ...a, edad: calcularEdad(a.fecha_nacimiento) }))
    return res.json({ total, page: parseInt(page as string), limit: parseInt(limit as string), data })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al listar agentes' })
  }
}

// Exporta el listado de agentes a Excel respetando los mismos filtros que listAgents
export const exportAgentes = async (req: AuthRequest, res: Response) => {
  try {
    const { where, error } = await buildAgentsWhere(req)
    if (error) return res.status(error.status).json({ error: error.message })

    const agentes = await prisma.agente.findMany({
      where,
      include: { servicio: true },
      orderBy: { nombre: 'asc' },
      take: 10000,
    })

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Historial de Agentes')
    ws.columns = [
      { header: 'DNI', key: 'dni', width: 14 },
      { header: 'Nombre', key: 'nombre', width: 30 },
      { header: 'Edad', key: 'edad', width: 8 },
      { header: 'Servicio', key: 'servicio', width: 24 },
      { header: 'Modalidad', key: 'modalidad', width: 14 },
      { header: 'Superior', key: 'superior', width: 24 },
      { header: 'Estado', key: 'estado', width: 14 },
      { header: 'Fecha de ingreso', key: 'fecha_ingreso', width: 16 },
      { header: 'Última actualización', key: 'fecha_actualizacion', width: 18 },
    ]
    for (const a of agentes) {
      ws.addRow({
        dni: a.dni,
        nombre: a.nombre,
        edad: calcularEdad(a.fecha_nacimiento) ?? '',
        servicio: a.servicio?.nombre ?? '',
        modalidad: a.modalidad ?? '',
        superior: a.superior ?? '',
        estado: a.estado ?? '',
        fecha_ingreso: a.fecha_creacion.toISOString().substring(0, 10),
        fecha_actualizacion: a.fecha_actualizacion.toISOString().substring(0, 10),
      })
    }
    ws.getRow(1).font = { bold: true }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="historial_agentes.xlsx"')
    await wb.xlsx.write(res)
    return res.end()
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al exportar agentes' })
  }
}

// Devuelve un agente por ID con su historial completo de licencias, cambios y snapshots
export const getAgent = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const agente = await prisma.agente.findUnique({
      where: { id },
      include: {
        servicio: true,
        licencias: { orderBy: { fecha_desde: 'desc' } },
        cambios_temporales: {
          include: { servicio_temporal: true },
          orderBy: { fecha_desde: 'desc' },
        },
        snapshots: {
          include: { nomina_mensual: { include: { servicio: true } } },
          orderBy: { nomina_mensual: { fecha_carga: 'desc' } },
          take: 12,
        },
        capacitaciones: { orderBy: { fecha_inicio: 'desc' } },
        remociones: { orderBy: { fecha: 'desc' } },
        servicio_historial: { include: { servicio: true }, orderBy: { fecha_desde: 'desc' } },
        modalidad_historial: { orderBy: { fecha_efectiva: 'desc' } },
        superior_historial: { orderBy: { fecha_efectiva: 'desc' } },
      },
    })
    if (!agente) return res.status(404).json({ error: 'Agente no encontrado' })
    return res.json({ ...agente, edad: calcularEdad(agente.fecha_nacimiento) })
  } catch {
    return res.status(500).json({ error: 'Error al obtener agente' })
  }
}

// Historial de servicios del agente (asignaciones permanentes, no ventanas temporales)
export const getAgenteServicios = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const historial = await prisma.agenteServicioHistorial.findMany({
      where: { agente_id: id },
      include: { servicio: { select: { id: true, nombre: true, color: true } }, creador: { select: { id: true, nombre: true } } },
      orderBy: { fecha_desde: 'desc' },
    })
    return res.json(historial)
  } catch {
    return res.status(500).json({ error: 'Error al obtener historial de servicios' })
  }
}

// Auditoria vinculada a un agente (alta, cambios de servicio/modalidad/superior, remociones, etc)
export const getAgenteAudit = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const { page = '1', limit = '50' } = req.query
    const skip = (parseInt(page as string) - 1) * parseInt(limit as string)

    const [total, data] = await Promise.all([
      prisma.auditoria.count({ where: { agente_id: id } }),
      prisma.auditoria.findMany({
        where: { agente_id: id },
        include: { usuario: { select: { id: true, nombre: true } } },
        orderBy: { fecha_hora: 'desc' },
        skip,
        take: parseInt(limit as string),
      }),
    ])

    return res.json({ total, page: parseInt(page as string), limit: parseInt(limit as string), data })
  } catch {
    return res.status(500).json({ error: 'Error al obtener auditoría del agente' })
  }
}

// Crea un nuevo agente; valida duplicados de DNI y usuario antes de insertar
export const createAgent = async (req: AuthRequest, res: Response) => {
  try {
    const adminUser = req.user?.rol === 'ADMINISTRADOR'
    const { servicio_id } = req.body

    if (!adminUser && servicio_id) {
      const permiso = await getUserPermission(req.user!.userId, parseInt(servicio_id))
      if (!permiso?.puede_crear_agente) return res.status(403).json({ error: 'Sin permiso para crear agentes' })
    }

    const { dni, usuario, nombre } = req.body
    if (!dni || !usuario || !nombre) {
      return res.status(400).json({ error: 'DNI, USUARIO y NOMBRE son requeridos' })
    }

    const dupDni = await prisma.agente.findUnique({ where: { dni } })
    if (dupDni) return res.status(409).json({ error: 'Ya existe un agente con ese DNI' })
    const dupUser = await prisma.agente.findUnique({ where: { usuario } })
    if (dupUser) return res.status(409).json({ error: 'Ya existe un agente con ese usuario' })

    const data = {
      ...req.body,
      fecha_nacimiento: req.body.fecha_nacimiento ? new Date(req.body.fecha_nacimiento) : null,
      servicio_id: servicio_id ? parseInt(servicio_id) : null,
    }

    const agente = await prisma.$transaction(async (tx) => {
      const creado = await tx.agente.create({ data })
      if (creado.servicio_id) {
        await tx.agenteServicioHistorial.create({
          data: {
            agente_id: creado.id,
            servicio_id: creado.servicio_id,
            modalidad: creado.modalidad,
            superior: creado.superior,
            jefe: creado.jefe,
            segmento: creado.segmento,
            sitio: creado.sitio,
            contrato: creado.contrato,
            horarios: creado.horarios,
            fecha_desde: creado.fecha_creacion,
            motivo: 'Alta inicial',
            creado_por: req.user!.userId,
          },
        })
      }
      return creado
    })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'CREAR_AGENTE',
      entidad: 'Agente',
      entidad_id: String(agente.id),
      servicio_id: agente.servicio_id ?? undefined,
      agente_id: agente.id,
      valor_nuevo: `${agente.nombre} (${agente.dni})`,
    })

    return res.status(201).json({ ...agente, edad: calcularEdad(agente.fecha_nacimiento) })
  } catch {
    return res.status(500).json({ error: 'Error al crear agente' })
  }
}

// Actualiza los datos de un agente. Si cambia servicio/modalidad/superior,
// cierra el historial vigente correspondiente y abre uno nuevo dentro de
// una transaccion, y audita cada cambio por separado.
export const updateAgent = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const agente = await prisma.agente.findUnique({ where: { id } })
    if (!agente) return res.status(404).json({ error: 'Agente no encontrado' })

    const adminUser = req.user?.rol === 'ADMINISTRADOR'
    const { motivo_cambio, ...body } = req.body
    const nuevoServicioId = body.servicio_id !== undefined
      ? (body.servicio_id ? parseInt(body.servicio_id) : null)
      : agente.servicio_id
    const cambiaServicio = body.servicio_id !== undefined && nuevoServicioId !== agente.servicio_id
    const cambiaModalidad = body.modalidad !== undefined && body.modalidad !== agente.modalidad
    const cambiaSuperior = body.superior !== undefined && body.superior !== agente.superior

    if (!adminUser && cambiaServicio) {
      const servicioParaPermiso = nuevoServicioId ?? agente.servicio_id
      if (servicioParaPermiso) {
        const permiso = await getUserPermission(req.user!.userId, servicioParaPermiso)
        if (!permiso?.puede_registrar_cambio_servicio) {
          return res.status(403).json({ error: 'Sin permiso para cambiar el servicio del agente' })
        }
      }
    }

    const data: any = { ...body }
    if (body.fecha_nacimiento !== undefined) {
      data.fecha_nacimiento = body.fecha_nacimiento ? new Date(body.fecha_nacimiento) : null
    }
    if (body.servicio_id !== undefined) data.servicio_id = nuevoServicioId

    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.agente.update({ where: { id }, data })
      const ahora = new Date()

      if (cambiaServicio) {
        const vigente = await tx.agenteServicioHistorial.findFirst({ where: { agente_id: id, fecha_hasta: null } })
        if (vigente) await tx.agenteServicioHistorial.update({ where: { id: vigente.id }, data: { fecha_hasta: ahora } })
        await tx.agenteServicioHistorial.create({
          data: {
            agente_id: id,
            servicio_id: nuevoServicioId,
            modalidad: result.modalidad,
            superior: result.superior,
            jefe: result.jefe,
            segmento: result.segmento,
            sitio: result.sitio,
            contrato: result.contrato,
            horarios: result.horarios,
            fecha_desde: ahora,
            motivo: motivo_cambio || null,
            creado_por: req.user!.userId,
          },
        })
      }

      if (cambiaModalidad) {
        await tx.agenteModalidadHistorial.create({
          data: {
            agente_id: id,
            modalidad_anterior: agente.modalidad,
            modalidad_nueva: body.modalidad,
            fecha_efectiva: ahora,
            motivo: motivo_cambio || null,
            creado_por: req.user!.userId,
          },
        })
      }

      if (cambiaSuperior) {
        await tx.agenteSuperiorHistorial.create({
          data: {
            agente_id: id,
            servicio_id: result.servicio_id,
            superior_anterior: agente.superior,
            superior_nuevo: body.superior,
            fecha_efectiva: ahora,
            motivo: motivo_cambio || null,
            creado_por: req.user!.userId,
          },
        })
      }

      return result
    })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'EDITAR_AGENTE',
      entidad: 'Agente',
      entidad_id: String(id),
      servicio_id: updated.servicio_id ?? undefined,
      agente_id: id,
    })
    if (cambiaServicio) {
      await createAuditLog({
        usuario_id: req.user!.userId,
        accion: 'CAMBIAR_SERVICIO_AGENTE',
        entidad: 'Agente',
        entidad_id: String(id),
        agente_id: id,
        servicio_id: updated.servicio_id ?? undefined,
        valor_anterior: String(agente.servicio_id ?? ''),
        valor_nuevo: String(updated.servicio_id ?? ''),
      })
    }
    if (cambiaModalidad) {
      await createAuditLog({
        usuario_id: req.user!.userId,
        accion: 'CAMBIAR_MODALIDAD_AGENTE',
        entidad: 'Agente',
        entidad_id: String(id),
        agente_id: id,
        valor_anterior: agente.modalidad ?? undefined,
        valor_nuevo: updated.modalidad ?? undefined,
      })
    }
    if (cambiaSuperior) {
      await createAuditLog({
        usuario_id: req.user!.userId,
        accion: 'CAMBIAR_SUPERIOR_AGENTE',
        entidad: 'Agente',
        entidad_id: String(id),
        agente_id: id,
        valor_anterior: agente.superior ?? undefined,
        valor_nuevo: updated.superior ?? undefined,
      })
    }

    return res.json({ ...updated, edad: calcularEdad(updated.fecha_nacimiento) })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al actualizar agente' })
  }
}

// Activa o desactiva un agente (toggle); requiere permiso puede_desactivar_agente para no-admin
export const toggleAgent = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const agente = await prisma.agente.findUnique({ where: { id } })
    if (!agente) return res.status(404).json({ error: 'Agente no encontrado' })

    const adminUser = req.user?.rol === 'ADMINISTRADOR'
    if (!adminUser && agente.servicio_id) {
      const permiso = await getUserPermission(req.user!.userId, agente.servicio_id)
      if (!permiso?.puede_desactivar_agente) return res.status(403).json({ error: 'Sin permiso' })
    }

    const updated = await prisma.agente.update({
      where: { id },
      data: { activo: !agente.activo },
    })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: updated.activo ? 'ACTIVAR_AGENTE' : 'DESACTIVAR_AGENTE',
      entidad: 'Agente',
      entidad_id: String(id),
      servicio_id: updated.servicio_id ?? undefined,
    })

    return res.json({ activo: updated.activo })
  } catch {
    return res.status(500).json({ error: 'Error al cambiar estado' })
  }
}

// Construye la línea de tiempo de eventos del agente (licencias, cambios, vacaciones, bajas)
// ordenada de más reciente a más antigua
export const getAgenteTimeline = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const agente = await prisma.agente.findUnique({
      where: { id },
      include: {
        licencias: { orderBy: { fecha_desde: 'asc' } },
        cambios_temporales: {
          include: { servicio_temporal: true },
          orderBy: { fecha_desde: 'asc' },
        },
        cambios_contrato: {
          include: { servicio: true },
          orderBy: { fecha_desde: 'asc' },
        },
        cambios_horario: {
          include: { servicio: true },
          orderBy: { fecha_desde: 'asc' },
        },
        capacitaciones: { orderBy: { fecha_inicio: 'asc' } },
        remociones: { include: { servicio_destino: true }, orderBy: { fecha: 'asc' } },
        vacaciones: { orderBy: { fecha_desde: 'asc' } },
        bajas: { orderBy: { fecha: 'asc' } },
        modalidad_historial: { orderBy: { fecha_efectiva: 'asc' } },
        superior_historial: { orderBy: { fecha_efectiva: 'asc' } },
        servicio_historial: { include: { servicio: true }, orderBy: { fecha_desde: 'asc' } },
      },
    })
    if (!agente) return res.status(404).json({ error: 'Agente no encontrado' })

    const now = new Date()
    const fmt = (d: Date) => d.toISOString().substring(0, 10)

    const eventos: any[] = []

    for (const l of agente.licencias) {
      eventos.push({
        tipo: 'LICENCIA',
        fecha_inicio: fmt(l.fecha_desde),
        fecha_fin: fmt(l.fecha_hasta),
        descripcion: l.motivo || 'Licencia',
        detalle: l.observacion ?? null,
      })
    }
    for (const sh of (agente as any).servicio_historial) {
      eventos.push({
        tipo: 'CAMBIO_SERVICIO',
        fecha_inicio: fmt(sh.fecha_desde),
        fecha_fin: sh.fecha_hasta ? fmt(sh.fecha_hasta) : null,
        descripcion: `Ingreso a ${sh.servicio?.nombre || 'servicio'}`,
        detalle: sh.motivo ?? null,
      })
    }
    for (const c of agente.cambios_temporales) {
      eventos.push({
        tipo: 'CAMBIO_TEMPORAL',
        fecha_inicio: fmt(c.fecha_desde),
        fecha_fin: fmt(c.fecha_hasta),
        descripcion: `→ ${c.servicio_temporal?.nombre || 'Servicio temporal'}`,
        detalle: c.motivo ?? null,
      })
    }
    for (const cc of agente.cambios_contrato) {
      eventos.push({
        tipo: 'CAMBIO_CONTRATO',
        fecha_inicio: fmt(cc.fecha_desde),
        fecha_fin: cc.fecha_hasta ? fmt(cc.fecha_hasta) : null,
        descripcion: `${cc.contrato_anterior || '?'} → ${cc.contrato_nuevo}hs (${cc.tipo})`,
        detalle: cc.motivo ?? null,
      })
    }
    for (const cap of agente.capacitaciones) {
      eventos.push({
        tipo: 'CAPACITACION',
        fecha_inicio: fmt(cap.fecha_inicio),
        fecha_fin: fmt(cap.fecha_fin),
        descripcion: cap.observacion || 'Capacitación',
        detalle: cap.dado_de_alta ? 'Dado de alta' : cap.pendiente_alta ? 'Pendiente de alta' : null,
      })
    }
    for (const cambioH of agente.cambios_horario) {
      eventos.push({
        tipo: 'CAMBIO_HORARIO',
        fecha_inicio: fmt(cambioH.fecha_desde),
        fecha_fin: cambioH.fecha_hasta ? fmt(cambioH.fecha_hasta) : null,
        descripcion: `${cambioH.horario_anterior || '?'} → ${cambioH.horario_nuevo} (${cambioH.tipo})`,
        detalle: cambioH.motivo ?? null,
      })
    }
    for (const r of agente.remociones) {
      const destino = (r as any).servicio_destino?.nombre
      eventos.push({
        tipo: 'REMOCION',
        fecha_inicio: fmt(r.fecha),
        fecha_fin: null,
        descripcion: r.motivo || 'Remoción',
        detalle: [r.observacion, destino ? `Reasignado a ${destino}` : null].filter(Boolean).join(' — ') || null,
      })
    }
    for (const m of agente.modalidad_historial) {
      eventos.push({
        tipo: 'CAMBIO_MODALIDAD',
        fecha_inicio: fmt(m.fecha_efectiva),
        fecha_fin: null,
        descripcion: `${m.modalidad_anterior || '?'} → ${m.modalidad_nueva}`,
        detalle: m.motivo ?? null,
      })
    }
    for (const s of agente.superior_historial) {
      eventos.push({
        tipo: 'CAMBIO_SUPERIOR',
        fecha_inicio: fmt(s.fecha_efectiva),
        fecha_fin: null,
        descripcion: `${s.superior_anterior || '?'} → ${s.superior_nuevo || '?'}`,
        detalle: s.motivo ?? null,
      })
    }
    for (const v of agente.vacaciones) {
      eventos.push({
        tipo: 'VACACION',
        fecha_inicio: fmt(v.fecha_desde),
        fecha_fin: fmt(v.fecha_hasta),
        descripcion: 'Vacaciones',
        detalle: v.servicio_wf ?? null,
      })
    }
    for (const b of (agente as any).bajas) {
      eventos.push({
        tipo: 'BAJA',
        fecha_inicio: fmt(b.fecha),
        fecha_fin: null,
        descripcion: b.tipo || 'Baja',
        detalle: b.observacion ?? null,
      })
    }

    eventos.sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio))
    return res.json(eventos)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al obtener timeline' })
  }
}
