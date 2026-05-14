import { Response } from 'express'
import prisma from '../prisma'
import { AuthRequest } from '../middleware/auth'
import ExcelJS from 'exceljs'

const MESES_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86400000) + 1
}

function clampDays(itemStart: Date, itemEnd: Date, rangeStart: Date, rangeEnd: Date): number {
  const from = itemStart < rangeStart ? rangeStart : itemStart
  const to = itemEnd > rangeEnd ? rangeEnd : itemEnd
  return to < from ? 0 : daysBetween(from, to)
}

function getMonthsInRange(desde: Date, hasta: Date) {
  const months: { start: Date; end: Date; label: string; key: string }[] = []
  const cur = new Date(desde.getFullYear(), desde.getMonth(), 1)
  const limit = new Date(hasta.getFullYear(), hasta.getMonth(), 1)
  while (cur <= limit) {
    const start = new Date(cur)
    const end = new Date(cur.getFullYear(), cur.getMonth() + 1, 0, 23, 59, 59, 999)
    months.push({
      start,
      end,
      label: `${MESES_ES[cur.getMonth()]} ${String(cur.getFullYear()).slice(2)}`,
      key: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`,
    })
    cur.setMonth(cur.getMonth() + 1)
  }
  return months
}

async function fetchAusentismoData(desde: Date, hasta: Date, servicioId?: number) {
  const prismaAny = prisma as any
  const agenteWhere = servicioId ? { servicio_id: servicioId } : {}

  const [licencias, vacaciones, bajas, totalAgentes] = await Promise.all([
    prisma.licencia.findMany({
      where: {
        fecha_desde: { lte: hasta },
        fecha_hasta: { gte: desde },
        agente: agenteWhere,
      },
      include: {
        agente: { select: { id: true, nombre: true, servicio: { select: { id: true, nombre: true, color: true } } } },
      },
    }),
    prismaAny.vacacion.findMany({
      where: {
        fecha_desde: { lte: hasta },
        fecha_hasta: { gte: desde },
        ...(servicioId ? { agente: { servicio_id: servicioId } } : {}),
      },
      include: {
        agente: { select: { id: true, nombre: true, servicio: { select: { id: true, nombre: true, color: true } } } },
      },
    }),
    prismaAny.historicoBaja.findMany({
      where: {
        fecha: { gte: desde, lte: hasta },
        ...(servicioId ? { servicio_id: servicioId } : {}),
      },
      include: { servicio: { select: { id: true, nombre: true, color: true } } },
    }),
    prisma.agente.count({ where: { activo: true, ...agenteWhere } }),
  ])

  return { licencias, vacaciones, bajas, totalAgentes }
}

export const getReporteAusentismo = async (req: AuthRequest, res: Response) => {
  try {
    const { fecha_desde, fecha_hasta, servicio_id } = req.query

    const desde = fecha_desde
      ? new Date(`${fecha_desde}T00:00:00`)
      : new Date(new Date().getFullYear(), 0, 1)
    const hasta = fecha_hasta
      ? new Date(`${fecha_hasta}T23:59:59`)
      : new Date()
    const servicioId = servicio_id ? parseInt(servicio_id as string) : undefined

    const { licencias, vacaciones, bajas, totalAgentes } = await fetchAusentismoData(desde, hasta, servicioId)

    const diasLicencia = (licencias as any[]).reduce((sum, l) =>
      sum + clampDays(new Date(l.fecha_desde), new Date(l.fecha_hasta), desde, hasta), 0)
    const diasVacacion = (vacaciones as any[]).reduce((sum, v) =>
      sum + clampDays(new Date(v.fecha_desde), new Date(v.fecha_hasta), desde, hasta), 0)
    const agentesLicencia = new Set((licencias as any[]).map(l => l.agente_id)).size
    const agentesVacacion = new Set((vacaciones as any[]).filter(v => v.agente_id).map(v => v.agente_id)).size

    // Aggregation por servicio
    type ServicioEntry = {
      nombre: string; color: string
      licencias: number; vacaciones: number; bajas: number
      dias_licencia: number; dias_vacacion: number
    }
    const servicioMap = new Map<number, ServicioEntry>()

    const getOrCreate = (id: number, nombre: string, color: string): ServicioEntry => {
      if (!servicioMap.has(id)) {
        servicioMap.set(id, { nombre, color, licencias: 0, vacaciones: 0, bajas: 0, dias_licencia: 0, dias_vacacion: 0 })
      }
      return servicioMap.get(id)!
    }

    for (const l of licencias as any[]) {
      if (!l.agente?.servicio) continue
      const entry = getOrCreate(l.agente.servicio.id, l.agente.servicio.nombre, l.agente.servicio.color)
      entry.licencias++
      entry.dias_licencia += clampDays(new Date(l.fecha_desde), new Date(l.fecha_hasta), desde, hasta)
    }
    for (const v of vacaciones as any[]) {
      if (!v.agente?.servicio) continue
      const entry = getOrCreate(v.agente.servicio.id, v.agente.servicio.nombre, v.agente.servicio.color)
      entry.vacaciones++
      entry.dias_vacacion += clampDays(new Date(v.fecha_desde), new Date(v.fecha_hasta), desde, hasta)
    }
    for (const b of bajas as any[]) {
      if (!b.servicio) continue
      const entry = getOrCreate(b.servicio.id, b.servicio.nombre, b.servicio.color)
      entry.bajas++
    }

    const porServicio = Array.from(servicioMap.entries())
      .map(([id, data]) => ({ servicio_id: id, ...data }))
      .sort((a, b) => (b.licencias + b.vacaciones + b.bajas) - (a.licencias + a.vacaciones + a.bajas))

    // Breakdown por mes
    const meses = getMonthsInRange(desde, hasta)
    const porMes = meses.map(({ start, end, label, key }) => ({
      mes: key,
      label,
      licencias: (licencias as any[]).filter(l =>
        new Date(l.fecha_desde) <= end && new Date(l.fecha_hasta) >= start).length,
      vacaciones: (vacaciones as any[]).filter(v =>
        new Date(v.fecha_desde) <= end && new Date(v.fecha_hasta) >= start).length,
      bajas: (bajas as any[]).filter(b => {
        const f = new Date(b.fecha)
        return f >= start && f <= end
      }).length,
    }))

    return res.json({
      resumen: {
        licencias: { cantidad: licencias.length, agentes_unicos: agentesLicencia, dias_total: diasLicencia },
        vacaciones: { cantidad: vacaciones.length, agentes_unicos: agentesVacacion, dias_total: diasVacacion },
        bajas: { cantidad: bajas.length },
        total_agentes: totalAgentes,
        dias_total: diasLicencia + diasVacacion,
      },
      por_servicio: porServicio,
      por_mes: porMes,
      periodo: {
        desde: desde.toISOString().split('T')[0],
        hasta: hasta.toISOString().split('T')[0],
      },
    })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'Error al generar reporte de ausentismo' })
  }
}

export const exportReporteAusentismo = async (req: AuthRequest, res: Response) => {
  try {
    const { fecha_desde, fecha_hasta, servicio_id } = req.query

    const desde = fecha_desde
      ? new Date(`${fecha_desde}T00:00:00`)
      : new Date(new Date().getFullYear(), 0, 1)
    const hasta = fecha_hasta
      ? new Date(`${fecha_hasta}T23:59:59`)
      : new Date()
    const servicioId = servicio_id ? parseInt(servicio_id as string) : undefined

    const { licencias, vacaciones, bajas } = await fetchAusentismoData(desde, hasta, servicioId)

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Konecta Nómina'

    const headerStyle: Partial<ExcelJS.Style> = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } },
    }

    function styleHeaders(sheet: ExcelJS.Worksheet) {
      sheet.getRow(1).eachCell(cell => { cell.style = headerStyle })
    }

    // Licencias
    const sheetLic = wb.addWorksheet('Licencias')
    sheetLic.columns = [
      { header: 'Agente', key: 'nombre', width: 32 },
      { header: 'Servicio', key: 'servicio', width: 22 },
      { header: 'Desde', key: 'desde', width: 14 },
      { header: 'Hasta', key: 'hasta', width: 14 },
      { header: 'Días en período', key: 'dias', width: 16 },
      { header: 'Motivo', key: 'motivo', width: 34 },
    ]
    for (const l of licencias as any[]) {
      sheetLic.addRow({
        nombre: l.agente?.nombre ?? '',
        servicio: l.agente?.servicio?.nombre ?? '',
        desde: new Date(l.fecha_desde).toLocaleDateString('es-AR'),
        hasta: new Date(l.fecha_hasta).toLocaleDateString('es-AR'),
        dias: clampDays(new Date(l.fecha_desde), new Date(l.fecha_hasta), desde, hasta),
        motivo: l.motivo ?? '',
      })
    }
    styleHeaders(sheetLic)

    // Vacaciones
    const sheetVac = wb.addWorksheet('Vacaciones')
    sheetVac.columns = [
      { header: 'Agente', key: 'nombre', width: 32 },
      { header: 'DNI', key: 'dni', width: 14 },
      { header: 'Servicio', key: 'servicio', width: 22 },
      { header: 'Desde', key: 'desde', width: 14 },
      { header: 'Hasta', key: 'hasta', width: 14 },
      { header: 'Días en período', key: 'dias', width: 16 },
    ]
    for (const v of vacaciones as any[]) {
      sheetVac.addRow({
        nombre: v.agente_nombre ?? v.agente?.nombre ?? '',
        dni: v.agente_dni ?? '',
        servicio: v.agente?.servicio?.nombre ?? '',
        desde: new Date(v.fecha_desde).toLocaleDateString('es-AR'),
        hasta: new Date(v.fecha_hasta).toLocaleDateString('es-AR'),
        dias: clampDays(new Date(v.fecha_desde), new Date(v.fecha_hasta), desde, hasta),
      })
    }
    styleHeaders(sheetVac)

    // Bajas
    const sheetBajas = wb.addWorksheet('Bajas')
    sheetBajas.columns = [
      { header: 'Agente', key: 'nombre', width: 32 },
      { header: 'DNI', key: 'dni', width: 14 },
      { header: 'Servicio', key: 'servicio', width: 22 },
      { header: 'Fecha', key: 'fecha', width: 14 },
      { header: 'Tipo', key: 'tipo', width: 22 },
      { header: 'Observación', key: 'observacion', width: 34 },
    ]
    for (const b of bajas as any[]) {
      sheetBajas.addRow({
        nombre: b.nombre ?? '',
        dni: b.dni ?? '',
        servicio: b.servicio?.nombre ?? b.servicio_nombre ?? '',
        fecha: new Date(b.fecha).toLocaleDateString('es-AR'),
        tipo: b.tipo ?? '',
        observacion: b.observacion ?? '',
      })
    }
    styleHeaders(sheetBajas)

    const label = `${desde.toISOString().split('T')[0]}_${hasta.toISOString().split('T')[0]}`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="ausentismo_${label}.xlsx"`)
    await wb.xlsx.write(res)
    res.end()
  } catch (e) {
    console.error(e)
    return res.status(500).json({ error: 'Error al exportar reporte de ausentismo' })
  }
}
