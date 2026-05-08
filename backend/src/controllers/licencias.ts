import { Response } from 'express'
import prisma from '../prisma'
import { createAuditLog } from '../utils/audit'
import { getUserPermission } from '../utils/permissions'
import { AuthRequest } from '../middleware/auth'
import * as XLSX from 'xlsx'
import fs from 'fs'

function normalizeDni(val: any): string {
  return String(val || '').replace(/\D/g, '').trim()
}

function parseWfDate(val: any): Date | null {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number') {
    return new Date(Math.floor(val - 25569) * 86400 * 1000)
  }
  const str = String(val).trim()
  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (match) return new Date(`${match[3]}-${match[2]}-${match[1]}T00:00:00.000Z`)
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d
}

function mergeRanges(ranges: Array<{ desde: Date; hasta: Date }>): Array<{ desde: Date; hasta: Date }> {
  if (ranges.length === 0) return []
  const sorted = [...ranges].sort((a, b) => a.desde.getTime() - b.desde.getTime())
  const merged = [{ desde: sorted[0].desde, hasta: sorted[0].hasta }]
  for (let i = 1; i < sorted.length; i++) {
    const cur = merged[merged.length - 1]
    const gap = (sorted[i].desde.getTime() - cur.hasta.getTime()) / 86400000
    if (gap <= 3) cur.hasta = new Date(Math.max(cur.hasta.getTime(), sorted[i].hasta.getTime()))
    else merged.push({ desde: sorted[i].desde, hasta: sorted[i].hasta })
  }
  return merged
}

function startOfToday(): Date {
  const d = new Date()
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

async function buildCalendarioAgenteWhere(req: AuthRequest, servicioIdParam: number | null): Promise<any> {
  const adminUser = req.user?.rol === 'ADMINISTRADOR'
  if (!adminUser) {
    const permisos = await prisma.usuarioServicioPermiso.findMany({
      where: { usuario_id: req.user!.userId, puede_ver: true },
      select: { servicio_id: true },
    })
    const allowedIds = permisos.map((p) => p.servicio_id)
    return servicioIdParam
      ? { servicio_id: allowedIds.includes(servicioIdParam) ? servicioIdParam : -1 }
      : { servicio_id: { in: allowedIds } }
  }
  return servicioIdParam ? { servicio_id: servicioIdParam } : {}
}

export async function syncAgenteActivo(agenteId: number) {
  const hoy = startOfToday()
  const vigente = await prisma.licencia.findFirst({
    where: { agente_id: agenteId, fecha_desde: { lte: hoy }, fecha_hasta: { gte: hoy } },
  })
  const baja = await prisma.historicoBaja.findFirst({ where: { agente_id: agenteId } })
  if (!baja) {
    await prisma.agente.update({ where: { id: agenteId }, data: { activo: !vigente } })
  }
}

export const getCalendarioLicencias = async (req: AuthRequest, res: Response) => {
  try {
    const mes = parseInt(req.query.mes as string) || new Date().getMonth() + 1
    const anio = parseInt(req.query.anio as string) || new Date().getFullYear()
    const servicioIdParam = req.query.servicio_id ? parseInt(req.query.servicio_id as string) : null

    const inicioMes = new Date(Date.UTC(anio, mes - 1, 1))
    const finMes = new Date(Date.UTC(anio, mes, 0, 23, 59, 59))
    const agenteWhere = await buildCalendarioAgenteWhere(req, servicioIdParam)

    const include = {
      agente: { select: { id: true, nombre: true, segmento: true, servicio: { select: { id: true, nombre: true } } } },
    }

    const [vencimientos, inicios] = await Promise.all([
      prisma.licencia.findMany({
        where: { fecha_hasta: { gte: inicioMes, lte: finMes }, agente: agenteWhere },
        include,
        orderBy: { fecha_hasta: 'asc' },
      }),
      prisma.licencia.findMany({
        where: { fecha_desde: { gte: inicioMes, lte: finMes }, agente: agenteWhere },
        include,
        orderBy: { fecha_desde: 'asc' },
      }),
    ])

    const eventos: any[] = []
    for (const l of vencimientos) {
      eventos.push({
        fecha: l.fecha_hasta.toISOString().substring(0, 10),
        tipo: 'VENCIMIENTO',
        agente_id: l.agente.id,
        agente_nombre: l.agente.nombre,
        segmento: l.agente.segmento ?? null,
        servicio_nombre: l.agente.servicio?.nombre ?? null,
        servicio_id: l.agente.servicio?.id ?? null,
        motivo: l.motivo,
      })
    }
    for (const l of inicios) {
      eventos.push({
        fecha: l.fecha_desde.toISOString().substring(0, 10),
        tipo: 'INICIO',
        agente_id: l.agente.id,
        agente_nombre: l.agente.nombre,
        segmento: l.agente.segmento ?? null,
        servicio_nombre: l.agente.servicio?.nombre ?? null,
        servicio_id: l.agente.servicio?.id ?? null,
        motivo: l.motivo,
      })
    }
    return res.json(eventos)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al obtener calendario' })
  }
}

export const listLicencias = async (req: AuthRequest, res: Response) => {
  try {
    const { agente_id, servicio_id, estado } = req.query
    const hoy = startOfToday()
    const where: any = {}

    if (agente_id) where.agente_id = parseInt(agente_id as string)

    if (estado) {
      const e = (estado as string).toUpperCase()
      if (e === 'VIGENTE') {
        where.fecha_desde = { lte: hoy }
        where.fecha_hasta = { gte: hoy }
      } else if (e === 'PROGRAMADA') {
        where.fecha_desde = { gt: hoy }
      } else if (e === 'FINALIZADA') {
        where.fecha_hasta = { lt: hoy }
      }
    }

    const licencias = await prisma.licencia.findMany({
      where,
      include: {
        agente: { include: { servicio: true } },
        creador: { select: { id: true, nombre: true, email: true } },
      },
      orderBy: { fecha_desde: 'desc' },
      take: 1000,
    })

    const withStatus = licencias.map((l) => {
      let estadoCalc: string
      if (hoy < l.fecha_desde) estadoCalc = 'PROGRAMADA'
      else if (hoy > l.fecha_hasta) estadoCalc = 'FINALIZADA'
      else estadoCalc = 'VIGENTE'
      return { ...l, estado_calculado: estadoCalc }
    })

    return res.json(withStatus)
  } catch {
    return res.status(500).json({ error: 'Error al listar licencias' })
  }
}

export const createLicencia = async (req: AuthRequest, res: Response) => {
  try {
    const { agente_id, fecha_desde, fecha_hasta, motivo, observacion } = req.body
    if (!agente_id || !fecha_desde || !fecha_hasta) {
      return res.status(400).json({ error: 'agente_id, fecha_desde y fecha_hasta son requeridos' })
    }

    const desde = new Date(fecha_desde)
    const hasta = new Date(fecha_hasta)
    if (hasta < desde) return res.status(400).json({ error: 'fecha_hasta debe ser mayor o igual a fecha_desde' })

    const agente = await prisma.agente.findUnique({ where: { id: agente_id } })
    if (!agente) return res.status(404).json({ error: 'Agente no encontrado' })

    const adminUser = req.user?.rol === 'ADMINISTRADOR'
    if (!adminUser && agente.servicio_id) {
      const permiso = await getUserPermission(req.user!.userId, agente.servicio_id)
      if (!permiso?.puede_registrar_licencia) return res.status(403).json({ error: 'Sin permiso para registrar licencias' })
    }

    const licencia = await prisma.licencia.create({
      data: { agente_id, fecha_desde: desde, fecha_hasta: hasta, motivo, observacion, creado_por: req.user!.userId },
      include: { agente: true, creador: { select: { id: true, nombre: true } } },
    })

    await syncAgenteActivo(agente_id)

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'REGISTRAR_LICENCIA',
      entidad: 'Licencia',
      entidad_id: String(licencia.id),
      servicio_id: agente.servicio_id ?? undefined,
      valor_nuevo: `${agente.nombre}: ${fecha_desde} - ${fecha_hasta}`,
    })

    return res.status(201).json(licencia)
  } catch {
    return res.status(500).json({ error: 'Error al crear licencia' })
  }
}

export const updateLicencia = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const { fecha_desde, fecha_hasta, motivo, observacion } = req.body

    if (fecha_desde && fecha_hasta && new Date(fecha_hasta) < new Date(fecha_desde)) {
      return res.status(400).json({ error: 'fecha_hasta debe ser mayor o igual a fecha_desde' })
    }

    const data: any = {}
    if (fecha_desde) data.fecha_desde = new Date(fecha_desde)
    if (fecha_hasta) data.fecha_hasta = new Date(fecha_hasta)
    if (motivo !== undefined) data.motivo = motivo
    if (observacion !== undefined) data.observacion = observacion

    const licencia = await prisma.licencia.update({ where: { id }, data })
    return res.json(licencia)
  } catch {
    return res.status(500).json({ error: 'Error al actualizar licencia' })
  }
}

export const deleteLicencia = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const licencia = await prisma.licencia.findUnique({ where: { id } })
    await prisma.licencia.delete({ where: { id } })
    if (licencia) await syncAgenteActivo(licencia.agente_id)
    return res.json({ message: 'Licencia eliminada' })
  } catch {
    return res.status(500).json({ error: 'Error al eliminar licencia' })
  }
}

export const importLicenciasWF = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' })

    const wb = XLSX.readFile(req.file.path)
    fs.unlinkSync(req.file.path)

    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })
    const dataRows = rows.slice(1).filter((r) => r && r.length > 11)

    // Agrupar por DNI+Motivo, excluyendo VACACIONES
    const byKey = new Map<string, {
      dni: string
      nombre: string
      motivo: string
      segmento: string
      ranges: Array<{ desde: Date; hasta: Date }>
    }>()

    let totalDias = 0

    for (const row of dataRows) {
      const motivo = String(row[5] || '').trim().toUpperCase()
      if (!motivo || motivo === 'VACACIONES') continue

      const dni = normalizeDni(row[4])
      if (!dni) continue

      const desde = parseWfDate(row[10])
      const hasta = parseWfDate(row[11])
      if (!desde || !hasta) continue

      totalDias++
      const key = `${dni}__${motivo}`
      if (!byKey.has(key)) {
        const segmento = String(row[14] || '').trim()
        byKey.set(key, { dni, nombre: String(row[3] || '').trim(), motivo, segmento, ranges: [] })
      }
      byKey.get(key)!.ranges.push({ desde, hasta })
    }

    // Mapa normalizado de todos los agentes para el cruce
    const todosAgentes = await prisma.agente.findMany({ select: { id: true, dni: true, segmento: true } })
    const agenteByDni = new Map(todosAgentes.map((a) => [normalizeDni(a.dni), a]))

    const importacion = await prisma.licenciaImportacion.create({
      data: {
        archivo_nombre: req.file.originalname,
        importado_por: req.user!.userId,
        total_dias: totalDias,
        total_periodos: 0,
        agentes_encontrados: 0,
        agentes_no_encontrados: 0,
      },
    })

    let totalPeriodos = 0
    let encontrados = 0
    let noEncontrados = 0
    let saltados14 = 0

    for (const info of byKey.values()) {
      const merged = mergeRanges(info.ranges)
      const agente = agenteByDni.get(info.dni) ?? null

      if (agente) {
        await prisma.licencia.deleteMany({ where: { agente_id: agente.id, importacion_id: { not: null } } })
        // Sincronizar segmento del agente si viene del archivo WF y está vacío
        if (info.segmento && !agente.segmento) {
          await prisma.agente.update({ where: { id: agente.id }, data: { segmento: info.segmento } })
        }
      }

      for (const { desde, hasta } of merged) {
        const dias = Math.round((hasta.getTime() - desde.getTime()) / 86400000) + 1
        if (dias <= 14) { saltados14++; continue }

        if (!agente) { noEncontrados++; continue }

        encontrados++
        await prisma.licencia.create({
          data: {
            agente_id: agente.id,
            fecha_desde: desde,
            fecha_hasta: hasta,
            motivo: info.motivo,
            importacion_id: importacion.id,
            creado_por: req.user!.userId,
          },
        })
        totalPeriodos++
      }

      if (agente) await syncAgenteActivo(agente.id)
    }

    await prisma.licenciaImportacion.update({
      where: { id: importacion.id },
      data: { total_periodos: totalPeriodos, agentes_encontrados: encontrados, agentes_no_encontrados: noEncontrados },
    })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'IMPORTAR_LICENCIAS_WF',
      entidad: 'LicenciaImportacion',
      entidad_id: String(importacion.id),
      valor_nuevo: `${totalPeriodos} licencias, ${saltados14} saltadas (<14 días), ${noEncontrados} sin match`,
    })

    return res.json({
      ok: true,
      total_dias: totalDias,
      total_periodos: totalPeriodos,
      agentes_encontrados: encontrados,
      agentes_no_encontrados: noEncontrados,
      saltados_menos_14: saltados14,
      importacion_id: importacion.id,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al importar licencias' })
  }
}

export const listImportacionesLicencias = async (req: AuthRequest, res: Response) => {
  try {
    const importaciones = await prisma.licenciaImportacion.findMany({
      include: {
        importador: { select: { id: true, nombre: true } },
        _count: { select: { licencias: true } },
      },
      orderBy: { fecha_importacion: 'desc' },
    })
    return res.json(importaciones)
  } catch {
    return res.status(500).json({ error: 'Error al listar importaciones' })
  }
}

export const deleteImportacionLicencias = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    await prisma.licencia.deleteMany({ where: { importacion_id: id } })
    await prisma.licenciaImportacion.delete({ where: { id } })
    return res.json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Error al eliminar importación' })
  }
}

export const exportCalendarioLicencias = async (req: AuthRequest, res: Response) => {
  try {
    const mes = parseInt(req.query.mes as string) || new Date().getMonth() + 1
    const anio = parseInt(req.query.anio as string) || new Date().getFullYear()
    const servicioIdParam = req.query.servicio_id ? parseInt(req.query.servicio_id as string) : null

    const inicioMes = new Date(Date.UTC(anio, mes - 1, 1))
    const finMes = new Date(Date.UTC(anio, mes, 0, 23, 59, 59))
    const agenteWhere = await buildCalendarioAgenteWhere(req, servicioIdParam)

    const include = {
      agente: { select: { id: true, nombre: true, segmento: true, servicio: { select: { id: true, nombre: true } } } },
    }

    const [vencimientos, inicios] = await Promise.all([
      prisma.licencia.findMany({
        where: { fecha_hasta: { gte: inicioMes, lte: finMes }, agente: agenteWhere },
        include,
        orderBy: { fecha_hasta: 'asc' },
      }),
      prisma.licencia.findMany({
        where: { fecha_desde: { gte: inicioMes, lte: finMes }, agente: agenteWhere },
        include,
        orderBy: { fecha_desde: 'asc' },
      }),
    ])

    const rows: any[] = []
    for (const l of vencimientos) {
      rows.push({
        Fecha: l.fecha_hasta.toISOString().substring(0, 10),
        Tipo: 'VENCIMIENTO',
        Agente: l.agente.nombre,
        Servicio: l.agente.servicio?.nombre ?? '',
        'Micro-Servicio': l.agente.segmento ?? '',
        Motivo: l.motivo ?? '',
      })
    }
    for (const l of inicios) {
      rows.push({
        Fecha: l.fecha_desde.toISOString().substring(0, 10),
        Tipo: 'INICIO',
        Agente: l.agente.nombre,
        Servicio: l.agente.servicio?.nombre ?? '',
        'Micro-Servicio': l.agente.segmento ?? '',
        Motivo: l.motivo ?? '',
      })
    }
    rows.sort((a, b) => a.Fecha.localeCompare(b.Fecha))

    const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Licencias')
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    const fileName = `Licencias_${MESES_ES[mes - 1]}_${anio}.xlsx`
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    return res.send(buf)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al exportar calendario' })
  }
}
