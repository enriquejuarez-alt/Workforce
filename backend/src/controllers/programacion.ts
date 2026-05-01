import { Response } from 'express'
import prisma from '../prisma'
import { AuthRequest } from '../middleware/auth'
import * as XLSX from 'xlsx'

const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DIAS_ES = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
const DIAS_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

function parseIngreso(horarios: string | null): number | null {
  if (!horarios) return null
  const match = horarios.match(/\b(\d{1,2}):(\d{2})\b/)
  if (!match) return null
  const h = parseInt(match[1])
  const m = parseInt(match[2])
  if (h > 23 || m > 59) return null
  return h * 60 + m
}

function getHorasPorDia(contrato: string | null): number {
  const c = (contrato || '').toUpperCase().replace(/\s+/g, '')
  if (c.startsWith('24')) return 6
  if (c.startsWith('30')) return 6
  if (c.startsWith('35')) return 7
  if (c.startsWith('36')) return 6
  return 8
}

function parseIntervalo(intervalo: string): number {
  const [h, m] = intervalo.split(':').map(Number)
  return h * 60 + (m || 0)
}

function getDatesForPeriod(mes: number, anio: number, semana: number): Date[] {
  const dates: Date[] = []
  const daysInMonth = new Date(anio, mes, 0).getDate()
  let start = 1
  let end = daysInMonth

  if (semana > 0) {
    start = (semana - 1) * 7 + 1
    end = Math.min(semana * 7, daysInMonth)
  }

  for (let d = start; d <= end; d++) {
    dates.push(new Date(anio, mes - 1, d))
  }
  return dates
}

function runSimulation(
  agentes: { id: number; nombre: string; horarios: string | null; contrato: string | null }[],
  requeridos: { intervalo: string; requeridos: number; tipo_dia: string }[],
  dates: Date[],
  totalReduccion: number
) {
  const reqsMap = new Map<string, number>()
  for (const r of requeridos) {
    reqsMap.set(`${r.tipo_dia}:${r.intervalo}`, r.requeridos)
  }

  const intervaloSet = new Set(requeridos.map(r => r.intervalo))
  const intervalos = [...intervaloSet].sort()

  const results: any[] = []

  for (const date of dates) {
    const dow = date.getDay()
    const tipoDia = dow === 0 ? 'DOMINGO' : dow === 6 ? 'SABADO' : 'SEMANA'

    for (const intervalo of intervalos) {
      const key = `${tipoDia}:${intervalo}`
      const req = reqsMap.get(key) ?? 0
      if (req === 0) continue

      const intervalMinutes = parseIntervalo(intervalo)

      const presentes = agentes.filter(a => {
        const ingreso = parseIngreso(a.horarios)
        if (ingreso === null) return false
        const horas = getHorasPorDia(a.contrato)
        return ingreso <= intervalMinutes && intervalMinutes < ingreso + horas * 60
      })

      const rawCount = presentes.length
      const reduccion = Math.floor(rawCount * totalReduccion)
      const asignados = Math.max(0, rawCount - reduccion)

      let estado: string
      if (asignados < req) estado = 'UNDER'
      else if (asignados <= Math.ceil(req * 1.1)) estado = 'OK'
      else estado = 'OVER'

      results.push({
        fecha: date.toISOString().substring(0, 10),
        dia_semana: DIAS_SHORT[dow],
        dia_num: date.getDate(),
        intervalo,
        requeridos: req,
        asignados,
        estado,
        agentes: presentes.map(a => a.nombre),
      })
    }
  }

  return { results, intervalos }
}

export const listProgramaciones = async (req: AuthRequest, res: Response) => {
  try {
    const adminUser = req.user?.rol === 'ADMINISTRADOR'
    let servicioIds: number[] | null = null

    if (!adminUser) {
      const permisos = await prisma.usuarioServicioPermiso.findMany({
        where: { usuario_id: req.user!.userId, puede_ver: true },
        select: { servicio_id: true },
      })
      servicioIds = permisos.map(p => p.servicio_id)
    }

    const where: any = {}
    if (servicioIds) where.servicio_id = { in: servicioIds }
    if (req.query.servicioId) where.servicio_id = parseInt(req.query.servicioId as string)
    if (req.query.anio) where.anio = parseInt(req.query.anio as string)

    const programaciones = await prisma.programacionMensual.findMany({
      where,
      include: {
        servicio: { select: { id: true, nombre: true, color: true } },
        factor: true,
        _count: { select: { requeridos: true } },
      },
      orderBy: [{ anio: 'desc' }, { mes: 'desc' }, { semana: 'asc' }],
    })

    return res.json(programaciones)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al listar programaciones' })
  }
}

export const createProgramacion = async (req: AuthRequest, res: Response) => {
  try {
    const { servicio_id, mes, anio, semana = 0 } = req.body

    if (!servicio_id || !mes || !anio) {
      return res.status(400).json({ error: 'servicio_id, mes y anio son requeridos' })
    }

    const existing = await prisma.programacionMensual.findUnique({
      where: { servicio_id_mes_anio_semana: { servicio_id, mes, anio, semana } },
    })

    if (existing) {
      return res.status(409).json({ error: 'Ya existe una programación para ese servicio y período' })
    }

    const prog = await prisma.programacionMensual.create({
      data: { servicio_id, mes, anio, semana, creado_por: req.user!.userId },
      include: { servicio: { select: { id: true, nombre: true, color: true } } },
    })

    return res.status(201).json(prog)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al crear programación' })
  }
}

export const getProgramacion = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)

    const prog = await prisma.programacionMensual.findUnique({
      where: { id },
      include: {
        servicio: { select: { id: true, nombre: true, color: true } },
        requeridos: { orderBy: [{ tipo_dia: 'asc' }, { intervalo: 'asc' }] },
        factor: true,
      },
    })

    if (!prog) return res.status(404).json({ error: 'Programación no encontrada' })

    return res.json(prog)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al obtener programación' })
  }
}

export const deleteProgramacion = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    await prisma.programacionMensual.delete({ where: { id } })
    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al eliminar programación' })
  }
}

export const upsertRequeridos = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const { requeridos } = req.body as {
      requeridos: { intervalo: string; requeridos: number; tipo_dia: string }[]
    }

    await prisma.requeridoHorario.deleteMany({ where: { programacion_id: id } })

    if (requeridos?.length) {
      await prisma.requeridoHorario.createMany({
        data: requeridos.map(r => ({
          programacion_id: id,
          intervalo: r.intervalo,
          requeridos: r.requeridos,
          tipo_dia: r.tipo_dia,
        })),
      })
    }

    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al guardar requeridos' })
  }
}

export const upsertFactor = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const { deslogueo, ausentismo, rotacion } = req.body

    await prisma.factorReduccion.upsert({
      where: { programacion_id: id },
      update: { deslogueo, ausentismo, rotacion },
      create: { programacion_id: id, deslogueo, ausentismo, rotacion },
    })

    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al guardar factor de reducción' })
  }
}

export const simularProgramacion = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)

    const prog = await prisma.programacionMensual.findUnique({
      where: { id },
      include: { requeridos: true, factor: true, servicio: { select: { id: true, nombre: true } } },
    })

    if (!prog) return res.status(404).json({ error: 'Programación no encontrada' })

    if (!prog.requeridos.length) {
      return res.status(400).json({ error: 'Configure los requeridos antes de simular' })
    }

    const agentes = await prisma.agente.findMany({
      where: { servicio_id: prog.servicio_id, activo: true },
      select: { id: true, nombre: true, horarios: true, contrato: true },
    })

    const dates = getDatesForPeriod(prog.mes, prog.anio, prog.semana)
    const totalReduccion = prog.factor
      ? prog.factor.deslogueo + prog.factor.ausentismo + prog.factor.rotacion
      : 0

    const { results, intervalos } = runSimulation(agentes, prog.requeridos, dates, totalReduccion)

    const agentes_sin_ingreso = agentes.filter(a => parseIngreso(a.horarios) === null).length

    return res.json({
      programacion: prog,
      resultados: results,
      intervalos,
      fechas: dates.map(d => ({
        fecha: d.toISOString().substring(0, 10),
        dia_num: d.getDate(),
        dia_semana: DIAS_SHORT[d.getDay()],
      })),
      total_agentes: agentes.length,
      agentes_sin_ingreso,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al simular programación' })
  }
}

export const exportProgramacion = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)

    const prog = await prisma.programacionMensual.findUnique({
      where: { id },
      include: { requeridos: true, factor: true, servicio: { select: { id: true, nombre: true } } },
    })

    if (!prog) return res.status(404).json({ error: 'Programación no encontrada' })

    const agentes = await prisma.agente.findMany({
      where: { servicio_id: prog.servicio_id, activo: true },
      select: { id: true, nombre: true, horarios: true, contrato: true },
    })

    const dates = getDatesForPeriod(prog.mes, prog.anio, prog.semana)
    const totalReduccion = prog.factor
      ? prog.factor.deslogueo + prog.factor.ausentismo + prog.factor.rotacion
      : 0

    const { results } = runSimulation(agentes, prog.requeridos, dates, totalReduccion)

    const rows = results.map(r => ({
      Fecha: r.fecha,
      Día: DIAS_ES[DIAS_SHORT.indexOf(r.dia_semana)] ?? r.dia_semana,
      Intervalo: r.intervalo,
      Requeridos: r.requeridos,
      Asignados: r.asignados,
      Faltante: Math.max(0, r.requeridos - r.asignados),
      Sobrante: Math.max(0, r.asignados - r.requeridos),
      Estado: r.estado,
      'Agentes Presentes': r.agentes.join('; '),
    }))

    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(wb, ws, 'Programación')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const mes = prog.mes.toString().padStart(2, '0')
    const semStr = prog.semana > 0 ? `_sem${prog.semana}` : ''
    const filename = `programacion_${prog.servicio.nombre}_${mes}_${prog.anio}${semStr}.xlsx`

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    return res.send(buf)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al exportar programación' })
  }
}
