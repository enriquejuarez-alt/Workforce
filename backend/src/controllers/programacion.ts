import { Response } from 'express'
import prisma from '../prisma'
import { AuthRequest } from '../middleware/auth'
import * as XLSX from 'xlsx'
import * as fs from 'fs'

// ─── Constants ────────────────────────────────────────────────────────────────

const DIAS_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const DIAS_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const HOLIDAY_HOURS = new Set(['06:00','08:00','09:00','14:00','15:00','17:00','18:00','19:00'])

// ─── Helpers ──────────────────────────────────────────────────────────────────

function normalizeContrato(c: string | null): string {
  const s = (c || '').toUpperCase().replace(/\s+/g, '')
  if (s.includes('24')) return '24HS'
  if (s.includes('30')) return '30HS'
  if (s.includes('35')) return '35HS'
  if (s.includes('36')) return '36HS'
  return 'UNKNOWN'
}

function getHorasPorDia(c: string | null): number {
  const n = normalizeContrato(c)
  if (n === '35HS') return 7
  if (n === '24HS' || n === '30HS' || n === '36HS') return 6
  return 8
}

function parseIngreso(horarios: string | null): number | null {
  if (!horarios) return null
  const m = horarios.match(/\b(\d{1,2}):(\d{2})\b/)
  if (!m) return null
  const h = parseInt(m[1]), min = parseInt(m[2])
  if (h > 23 || min > 59) return null
  return h * 60 + min
}

function parseIntervalo(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return h * 60 + (m || 0)
}

function minutesToHHMM(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

function dateStr(d: Date): string {
  return d.toISOString().substring(0, 10)
}

function getDatesForPeriod(mes: number, anio: number, semana: number): Date[] {
  const daysInMonth = new Date(anio, mes, 0).getDate()
  const start = semana > 0 ? (semana - 1) * 7 + 1 : 1
  const end = semana > 0 ? Math.min(semana * 7, daysInMonth) : daysInMonth
  const out: Date[] = []
  for (let d = start; d <= end; d++) out.push(new Date(anio, mes - 1, d))
  return out
}

// ─── Off-day rotation (exact port of Python assign_off_days) ──────────────────
// Python weekday: Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6
// JS getDay():   Sun=0, Mon=1, Tue=2, Wed=3, Thu=4, Fri=5, Sat=6
// Conversion: pyDay → jsDay: (pyDay + 1) % 7

function assignOffDows(agents: { nombre: string; contrato: string | null }[]): number[][] {
  const sorted = [...agents].sort((a, b) => a.nombre.localeCompare(b.nombre))

  // Pre-compute indices of 30/35HS agents in the full sorted list
  const thirtyIdxs: number[] = []
  sorted.forEach((a, i) => {
    const c = normalizeContrato(a.contrato)
    if (c === '30HS' || c === '35HS') thirtyIdxs.push(i)
  })
  const half = Math.floor(thirtyIdxs.length / 2)

  return sorted.map((a, i) => {
    const c = normalizeContrato(a.contrato)

    if (c === '24HS') {
      // Python: [(i+k)%7 for k in range(3)] → convert to JS getDay()
      return [0, 1, 2].map(k => ((i + k) % 7 + 1) % 7)
    }

    if (c === '30HS' || c === '35HS') {
      const pyWd = i % 5                                    // 0..4 = Mon..Fri
      const posIn30 = thirtyIdxs.indexOf(i)
      const pyWe = posIn30 < half ? 5 : 6                  // 5=Sat, 6=Sun
      return [(pyWd + 1) % 7, pyWe === 5 ? 6 : 0]         // JS: Mon=1..Fri=5, Sat=6, Sun=0
    }

    if (c === '36HS') {
      return [i % 2 === 0 ? 6 : 0]                        // JS: Sat=6, Sun=0
    }

    return []
  })
}

// ─── Simulation types ─────────────────────────────────────────────────────────

interface AgentInfo {
  id: number
  nombre: string
  segmento: string | null
  ingresoMin: number | null      // INGRESO in minutes
  egresoMin: number | null       // INGRESO + contrato hours
  contratoNorm: string
  offDows: number[]              // JS getDay() values
}

interface SimRow {
  fecha: string
  dia_semana: string
  dia_num: number
  intervalo: string
  requeridos: number
  limite_inferior: number
  limite_superior: number
  asignados: number
  faltante: number
  sobrante: number
  estado: 'UNDER' | 'LIMITE' | 'OK' | 'OVER'
  agentes: string[]
  es_feriado: boolean
}

interface Movement {
  nombre: string
  de: string
  hacia: string
  agente_id: number
}

// ─── Core simulation ──────────────────────────────────────────────────────────

function runSim(
  agentInfos: AgentInfo[],
  reqsMap: Map<string, Map<string, { requeridos: number; es_feriado: boolean }>>,
  dates: Date[],
  totalReduccion: number,
  overrideIngreso?: Map<number, number>
): SimRow[] {
  const rows: SimRow[] = []

  for (const date of dates) {
    const ds = dateStr(date)
    const dow = date.getDay()
    const dayReqs = reqsMap.get(ds)
    if (!dayReqs || dayReqs.size === 0) continue

    const intervals = [...dayReqs.keys()].sort()

    for (const intervalo of intervals) {
      const { requeridos: req, es_feriado } = dayReqs.get(intervalo)!
      if (req === 0) continue

      const intMin = parseIntervalo(intervalo)

      const presentes = agentInfos.filter(a => {
        if (a.offDows.includes(dow)) return false
        const ing = overrideIngreso?.has(a.id) ? overrideIngreso.get(a.id)! : a.ingresoMin
        if (ing === null) return false
        return ing <= intMin && intMin < ing + getHorasPorDia(a.contratoNorm) * 60
      })

      const raw = presentes.length
      const reduccion = Math.floor(raw * totalReduccion)
      const asignados = Math.max(0, raw - reduccion)

      // Tolerance bands: li = req, up = ceil(req * 1.1)
      const li = req
      const up = Math.ceil(req * 1.1)

      let estado: SimRow['estado']
      if (asignados < li) estado = 'UNDER'
      else if (asignados === li) estado = 'LIMITE'
      else if (asignados <= up) estado = 'OK'
      else estado = 'OVER'

      rows.push({
        fecha: ds,
        dia_semana: DIAS_SHORT[dow],
        dia_num: date.getDate(),
        intervalo,
        requeridos: req,
        limite_inferior: li,
        limite_superior: up,
        asignados,
        faltante: Math.max(0, li - asignados),
        sobrante: Math.max(0, asignados - up),
        estado,
        agentes: presentes.map(a => a.nombre),
        es_feriado,
      })
    }
  }

  return rows
}

// ─── Movement proposals ───────────────────────────────────────────────────────

function proposeMovements(
  baseline: SimRow[],
  agentInfos: AgentInfo[],
  dates: Date[],
  totalReduccion: number,
  reqsMap: Map<string, Map<string, { requeridos: number; es_feriado: boolean }>>
): { movements: Movement[]; simulation: SimRow[] } {
  // Aggregate by interval: total deficit/surplus across all dates
  const aggMap = new Map<string, { deficit: number; surplus: number; underDays: number }>()
  for (const r of baseline) {
    if (!aggMap.has(r.intervalo)) aggMap.set(r.intervalo, { deficit: 0, surplus: 0, underDays: 0 })
    const agg = aggMap.get(r.intervalo)!
    agg.deficit += r.faltante
    agg.surplus += r.sobrante
    if (r.faltante > 0) agg.underDays++
  }

  // Net surplus hours (surplus > deficit)
  const surplusNet = new Map<string, number>()
  for (const [intv, agg] of aggMap) {
    const net = agg.surplus - agg.deficit
    if (net > 0) surplusNet.set(intv, net)
  }

  // UNDER hours sorted by severity (worst first), restricted to 06:00-19:00
  const underHours = [...aggMap.entries()]
    .filter(([intv, agg]) => {
      const min = parseIntervalo(intv)
      return agg.deficit > agg.surplus && min >= 6 * 60 && min <= 19 * 60
    })
    .sort(([, a], [, b]) => (b.deficit - b.surplus) - (a.deficit - a.surplus))

  const movedIds = new Set<number>()
  const movements: Movement[] = []

  for (const [underIntv, underAgg] of underHours) {
    const needed = Math.ceil((underAgg.deficit - underAgg.surplus) / Math.max(underAgg.underDays, 1))
    if (needed <= 0) continue

    let moved = 0

    for (const delta of [1, -1, 2, -2]) {
      if (moved >= needed) break

      const srcMin = parseIntervalo(underIntv) + delta * 60
      if (srcMin < 0 || srcMin >= 24 * 60) continue
      const srcIntv = minutesToHHMM(srcMin)
      if (!surplusNet.has(srcIntv)) continue

      // Find agents starting at srcIntv that haven't been moved
      const candidates = agentInfos.filter(a =>
        !movedIds.has(a.id) && a.ingresoMin === srcMin
      )

      for (const agent of candidates) {
        if (moved >= needed) break
        // Avoid contradictory pair: don't move if there's already a move from underIntv to srcIntv
        const conflict = movements.some(m =>
          m.de === underIntv && m.hacia === srcIntv
        )
        if (conflict) continue
        movements.push({ nombre: agent.nombre, de: srcIntv, hacia: underIntv, agente_id: agent.id })
        movedIds.add(agent.id)
        moved++
      }
    }
  }

  // Apply movements and re-simulate
  const overrideIngreso = new Map<number, number>()
  for (const mv of movements) {
    overrideIngreso.set(mv.agente_id, parseIntervalo(mv.hacia))
  }

  const simAfter = runSim(agentInfos, reqsMap, dates, totalReduccion, overrideIngreso)

  // Verify: if UNDER count worsens, discard movements
  const underBefore = baseline.filter(r => r.estado === 'UNDER').length
  const underAfter = simAfter.filter(r => r.estado === 'UNDER').length
  if (underAfter > underBefore) {
    return { movements: [], simulation: baseline }
  }

  return { movements, simulation: simAfter }
}

// ─── Holiday quotas ───────────────────────────────────────────────────────────

interface CupoFeriado {
  intervalo: string
  isla: string
  asignados: number
  cupo: number
}

function calcHolidayQuotas(simRows: SimRow[], agentInfos: AgentInfo[]): CupoFeriado[] {
  const agentSegment = new Map<string, string>()
  agentInfos.forEach(a => { if (a.segmento) agentSegment.set(a.nombre, a.segmento) })

  const result: CupoFeriado[] = []
  for (const row of simRows) {
    if (!HOLIDAY_HOURS.has(row.intervalo)) continue
    const islaCount = new Map<string, number>()
    for (const nombre of row.agentes) {
      const isla = agentSegment.get(nombre)
      if (isla) islaCount.set(isla, (islaCount.get(isla) ?? 0) + 1)
    }
    for (const [isla, count] of islaCount) {
      const cupo = count - row.limite_inferior
      if (cupo >= 2) {
        result.push({ intervalo: row.intervalo, isla, asignados: count, cupo: Math.max(cupo, 0) })
      }
    }
  }
  return result
}

// ─── Build reqsMap from DB records ────────────────────────────────────────────

function buildReqsMap(
  reqs: { fecha: Date; intervalo: string; requeridos: number; es_feriado: boolean }[]
): Map<string, Map<string, { requeridos: number; es_feriado: boolean }>> {
  const map = new Map<string, Map<string, { requeridos: number; es_feriado: boolean }>>()
  for (const r of reqs) {
    const ds = dateStr(r.fecha)
    if (!map.has(ds)) map.set(ds, new Map())
    map.get(ds)!.set(r.intervalo, { requeridos: r.requeridos, es_feriado: r.es_feriado })
  }
  return map
}

// ─── Prepare agent infos ──────────────────────────────────────────────────────

function prepareAgentInfos(
  rawAgents: { id: number; nombre: string; segmento: string | null; horarios: string | null; contrato: string | null }[]
): AgentInfo[] {
  const sorted = [...rawAgents].sort((a, b) => a.nombre.localeCompare(b.nombre))
  const offDowsPerAgent = assignOffDows(sorted)

  return sorted.map((a, idx) => {
    const ing = parseIngreso(a.horarios)
    const contratoNorm = normalizeContrato(a.contrato)
    return {
      id: a.id,
      nombre: a.nombre,
      segmento: a.segmento,
      ingresoMin: ing,
      egresoMin: ing !== null ? ing + getHorasPorDia(contratoNorm) * 60 : null,
      contratoNorm,
      offDows: offDowsPerAgent[idx],
    }
  })
}

// ─── Excel parser for requeridos.xlsx ─────────────────────────────────────────

function excelSerialToDateStr(serial: number): string {
  const d = XLSX.SSF.parse_date_code(serial)
  return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`
}

function parseRequeridosExcel(
  filePath: string
): { fecha: string; intervalo: string; requeridos: number; es_feriado: boolean }[] {
  const wb = XLSX.readFile(filePath, { cellDates: false })

  // Accumulator: sum requeridos across sheets for same (fecha, intervalo)
  const acc = new Map<string, { requeridos: number; es_feriado: boolean }>()
  const addRow = (fecha: string, intervalo: string, requeridos: number, es_feriado: boolean) => {
    const key = `${fecha}|${intervalo}`
    const existing = acc.get(key)
    if (existing) existing.requeridos += requeridos
    else acc.set(key, { requeridos, es_feriado })
  }

  for (const sheetName of wb.SheetNames) {
    if (sheetName.toLowerCase() === 'resumen') continue

    const ws = wb.Sheets[sheetName]
    const raw = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: null })
    if (raw.length < 2) continue

    const r0 = raw[0] as any[]  // Row 0
    const r1 = raw[1] as any[]  // Row 1

    // Detect CP Soporte / Workforce pivot format:
    //   Row 0: ["Dia →", "feriado", "sábado", "lunes", ...]
    //   Row 1: ["Fecha →", 46143, 46144, ...]  (Excel date serials)
    const isWorkforce =
      String(r0?.[0] ?? '').toLowerCase().includes('dia') &&
      String(r1?.[0] ?? '').toLowerCase().includes('fecha') &&
      typeof r1?.[1] === 'number'

    if (isWorkforce) {
      // Build column map: col index → { fecha, es_feriado }
      const dateCols: { idx: number; fecha: string; es_feriado: boolean }[] = []
      for (let c = 1; c < r1.length; c++) {
        const serial = r1[c]
        if (typeof serial !== 'number') continue
        const fecha = excelSerialToDateStr(serial)
        const dayName = String(r0[c] ?? '').toLowerCase().trim()
        dateCols.push({ idx: c, fecha, es_feriado: dayName.includes('feriado') })
      }

      // Data rows start at index 3 (row 2 = sub-headers like "Franja ↓", "Hs Req")
      for (let r = 3; r < raw.length; r++) {
        const row = raw[r] as any[]
        if (!row) continue
        const firstCell = row[0]
        if (firstCell === null || firstCell === undefined) continue
        // Stop at "Total diario" summary row
        if (typeof firstCell === 'string' && firstCell.toLowerCase().includes('total')) break

        // Time interval: stored as Excel time fraction (0 = 00:00, 0.020833 = 00:30, ...)
        let intvStr = ''
        if (typeof firstCell === 'number') {
          intvStr = minutesToHHMM(Math.round(firstCell * 24 * 60))
        } else {
          const m = String(firstCell).match(/\b(\d{1,2}):(\d{2})\b/)
          if (m) intvStr = `${String(parseInt(m[1])).padStart(2, '0')}:${m[2]}`
        }
        if (!intvStr) continue

        for (const col of dateCols) {
          const val = row[col.idx]
          const req = typeof val === 'number' ? Math.round(val) : parseInt(String(val ?? 0)) || 0
          if (req > 0) addRow(col.fecha, intvStr, req, col.es_feriado)
        }
      }
      continue
    }

    // Fallback: simple format (col0=fecha, col1=intervalo, col2=requeridos)
    const firstHeader = String(r0?.[0] ?? '').trim().toLowerCase()
    if (['fecha', 'date', 'día', 'dia'].some(k => firstHeader.startsWith(k))) {
      for (let r = 1; r < raw.length; r++) {
        const row = raw[r] as any[]
        if (!row || row[0] === null || row[0] === undefined) continue
        let fechaStr = ''
        if (typeof row[0] === 'number') fechaStr = excelSerialToDateStr(row[0])
        else fechaStr = String(row[0]).trim().replace(/\//g, '-')

        let intvStr = ''
        if (typeof row[1] === 'number') intvStr = minutesToHHMM(Math.round(row[1] * 24 * 60))
        else {
          const m = String(row[1] ?? '').match(/\b(\d{1,2}):(\d{2})\b/)
          if (m) intvStr = `${String(parseInt(m[1])).padStart(2, '0')}:${m[2]}`
        }
        const req = typeof row[2] === 'number' ? Math.round(row[2]) : parseInt(String(row[2] ?? 0)) || 0
        if (fechaStr && intvStr && req > 0) addRow(fechaStr, intvStr, req, false)
      }
      continue
    }

    // Fallback: generic pivot (row 0 has date serials or date strings as headers)
    const dateCols: { idx: number; fecha: string; es_feriado: boolean }[] = []
    for (let c = 1; c < (r0?.length ?? 0); c++) {
      const hVal = r0[c]
      if (!hVal) continue
      let fechaStr = ''
      let es_feriado = false
      if (typeof hVal === 'number') {
        fechaStr = excelSerialToDateStr(hVal)
      } else {
        const s = String(hVal).trim()
        if (s.toLowerCase().includes('feriado')) es_feriado = true
        const m = s.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})|(\d{1,2}[-/]\d{1,2}[-/]\d{4})/)
        if (m) fechaStr = m[0].replace(/\//g, '-')
      }
      if (fechaStr) dateCols.push({ idx: c, fecha: fechaStr, es_feriado })
    }
    const dataStart = (raw as any[][]).findIndex((row, i) => {
      if (i === 0) return false
      const cell = row?.[0]
      if (cell === null || cell === undefined) return false
      return typeof cell === 'number' || String(cell).match(/\b\d{1,2}:\d{2}\b/) !== null
    })
    for (let r = Math.max(1, dataStart); r < raw.length; r++) {
      const row = raw[r] as any[]
      if (!row) continue
      const intvVal = row[0]
      if (intvVal === null || intvVal === undefined) continue
      let intvStr = ''
      if (typeof intvVal === 'number') intvStr = minutesToHHMM(Math.round(intvVal * 24 * 60))
      else {
        const m = String(intvVal).match(/\b(\d{1,2}):(\d{2})\b/)
        if (m) intvStr = `${String(parseInt(m[1])).padStart(2, '0')}:${m[2]}`
      }
      if (!intvStr) continue
      for (const col of dateCols) {
        const val = row[col.idx]
        const req = typeof val === 'number' ? Math.round(val) : parseInt(String(val ?? 0)) || 0
        if (req > 0) addRow(col.fecha, intvStr, req, col.es_feriado)
      }
    }
  }

  return [...acc.entries()].map(([key, val]) => {
    const sep = key.indexOf('|')
    return { fecha: key.substring(0, sep), intervalo: key.substring(sep + 1), ...val }
  })
}

// ─── Controllers ──────────────────────────────────────────────────────────────

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
    if (!servicio_id || !mes || !anio) return res.status(400).json({ error: 'servicio_id, mes y anio son requeridos' })

    const existing = await prisma.programacionMensual.findUnique({
      where: { servicio_id_mes_anio_semana: { servicio_id, mes, anio, semana } },
    })
    if (existing) return res.status(409).json({ error: 'Ya existe una programación para ese servicio y período' })

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
        requeridos: { orderBy: [{ fecha: 'asc' }, { intervalo: 'asc' }] },
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
    await prisma.programacionMensual.delete({ where: { id: parseInt(req.params.id) } })
    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al eliminar programación' })
  }
}

// Upsert requeridos from manual template (L-V / Sáb / Dom)
export const upsertRequeridos = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const prog = await prisma.programacionMensual.findUnique({ where: { id } })
    if (!prog) return res.status(404).json({ error: 'Programación no encontrada' })

    // req.body.values: [{ tipo_dia: 'SEMANA'|'SABADO'|'DOMINGO', intervalo, requeridos }]
    const { values } = req.body as {
      values: { tipo_dia: 'SEMANA' | 'SABADO' | 'DOMINGO'; intervalo: string; requeridos: number }[]
    }

    const dates = getDatesForPeriod(prog.mes, prog.anio, prog.semana)
    const rows: { programacion_id: number; fecha: Date; intervalo: string; requeridos: number; es_feriado: boolean }[] = []

    for (const date of dates) {
      const dow = date.getDay()
      const tipoDia = dow === 0 ? 'DOMINGO' : dow === 6 ? 'SABADO' : 'SEMANA'
      for (const v of values) {
        if (v.tipo_dia !== tipoDia) continue
        if (v.requeridos <= 0) continue
        rows.push({ programacion_id: id, fecha: date, intervalo: v.intervalo, requeridos: v.requeridos, es_feriado: false })
      }
    }

    await prisma.requeridoHorario.deleteMany({ where: { programacion_id: id } })
    if (rows.length) await prisma.requeridoHorario.createMany({ data: rows })

    return res.json({ ok: true, total: rows.length })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al guardar requeridos' })
  }
}

// Upload requeridos from Excel file
export const uploadRequeridos = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    if (!req.file) return res.status(400).json({ error: 'Archivo requerido' })

    const prog = await prisma.programacionMensual.findUnique({ where: { id } })
    if (!prog) return res.status(404).json({ error: 'Programación no encontrada' })

    const parsed = parseRequeridosExcel(req.file.path)
    fs.unlinkSync(req.file.path)

    if (!parsed.length) return res.status(400).json({ error: 'No se encontraron datos válidos en el archivo' })

    const rows = parsed.map(p => ({
      programacion_id: id,
      fecha: new Date(p.fecha + 'T12:00:00Z'),
      intervalo: p.intervalo,
      requeridos: p.requeridos,
      es_feriado: p.es_feriado,
    }))

    await prisma.requeridoHorario.deleteMany({ where: { programacion_id: id } })
    await prisma.requeridoHorario.createMany({ data: rows })

    return res.json({ ok: true, total: rows.length })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al procesar archivo de requeridos' })
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
    if (!prog.requeridos.length) return res.status(400).json({ error: 'Configure los requeridos antes de simular' })

    const rawAgents = await prisma.agente.findMany({
      where: { servicio_id: prog.servicio_id, activo: true },
      select: { id: true, nombre: true, segmento: true, horarios: true, contrato: true },
    })

    const agentInfos = prepareAgentInfos(rawAgents)
    const dates = getDatesForPeriod(prog.mes, prog.anio, prog.semana)
    const totalReduccion = prog.factor
      ? prog.factor.deslogueo + prog.factor.ausentismo + prog.factor.rotacion
      : 0

    const reqsMap = buildReqsMap(prog.requeridos)

    // Phase 1: Baseline simulation
    const baseline = runSim(agentInfos, reqsMap, dates, totalReduccion)

    // Phase 2: Movement proposals + re-simulation
    const { movements, simulation: simConMovimientos } = proposeMovements(
      baseline, agentInfos, dates, totalReduccion, reqsMap
    )

    // Phase 3: Holiday quotas (from post-movement simulation)
    const cuposFeriado = calcHolidayQuotas(simConMovimientos, agentInfos)

    const agentes_sin_ingreso = agentInfos.filter(a => a.ingresoMin === null).length

    return res.json({
      programacion: prog,
      nomina: baseline,
      simulacion: simConMovimientos,
      movimientos: movements,
      cupos_feriado: cuposFeriado,
      intervalos: [...new Set(baseline.map(r => r.intervalo))].sort(),
      fechas: dates.map(d => ({ fecha: dateStr(d), dia_num: d.getDate(), dia_semana: DIAS_SHORT[d.getDay()] })),
      total_agentes: agentInfos.length,
      agentes_sin_ingreso,
      stats: {
        nomina_under: baseline.filter(r => r.estado === 'UNDER').length,
        nomina_ok: baseline.filter(r => r.estado === 'OK' || r.estado === 'LIMITE').length,
        nomina_over: baseline.filter(r => r.estado === 'OVER').length,
        sim_under: simConMovimientos.filter(r => r.estado === 'UNDER').length,
        sim_ok: simConMovimientos.filter(r => r.estado === 'OK' || r.estado === 'LIMITE').length,
        sim_over: simConMovimientos.filter(r => r.estado === 'OVER').length,
      },
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

    const rawAgents = await prisma.agente.findMany({
      where: { servicio_id: prog.servicio_id, activo: true },
      select: { id: true, nombre: true, segmento: true, horarios: true, contrato: true },
    })

    const agentInfos = prepareAgentInfos(rawAgents)
    const dates = getDatesForPeriod(prog.mes, prog.anio, prog.semana)
    const totalReduccion = prog.factor
      ? prog.factor.deslogueo + prog.factor.ausentismo + prog.factor.rotacion
      : 0
    const reqsMap = buildReqsMap(prog.requeridos)

    const baseline = runSim(agentInfos, reqsMap, dates, totalReduccion)
    const { movements, simulation: simConMovimientos } = proposeMovements(
      baseline, agentInfos, dates, totalReduccion, reqsMap
    )
    const cuposFeriado = calcHolidayQuotas(simConMovimientos, agentInfos)

    const wb = XLSX.utils.book_new()

    const toExcelRows = (rows: SimRow[]) => rows.map(r => ({
      Fecha: r.fecha,
      Día: DIAS_ES[DIAS_SHORT.indexOf(r.dia_semana)],
      Intervalo: r.intervalo,
      Prime: ((): string => { const h = parseIntervalo(r.intervalo); return h >= 9 * 60 && h < 21 * 60 ? 'Prime' : 'No prime' })(),
      Requeridos: r.requeridos,
      'Límite Inferior': r.limite_inferior,
      'Límite Superior': r.limite_superior,
      Asignados: r.asignados,
      Faltante: r.faltante,
      Sobrante: r.sobrante,
      Estado: r.estado,
      'Nombres Presentes': r.agentes.join('; '),
      Feriado: r.es_feriado ? 'Sí' : 'No',
    }))

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toExcelRows(baseline)), 'Nómina')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(toExcelRows(simConMovimientos)), 'Simulación')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      movements.map(m => ({ Nombre: m.nombre, De: m.de, Hacia: m.hacia }))
    ), 'Movimientos')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      cuposFeriado.map(c => ({ Intervalo: c.intervalo, Isla: c.isla, Asignados: c.asignados, Cupos_Feriado: c.cupo }))
    ), 'Cupos_Feriado')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const mes = String(prog.mes).padStart(2, '0')
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

export const exportFrancos = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const prog = await prisma.programacionMensual.findUnique({
      where: { id },
      include: { servicio: { select: { id: true, nombre: true } } },
    })
    if (!prog) return res.status(404).json({ error: 'Programación no encontrada' })

    const rawAgents = await prisma.agente.findMany({
      where: { servicio_id: prog.servicio_id, activo: true },
      select: { id: true, nombre: true, segmento: true, horarios: true, contrato: true },
    })

    const agentInfos = prepareAgentInfos(rawAgents)
    const dates = getDatesForPeriod(prog.mes, prog.anio, prog.semana)

    // ── Hoja 1: Pivot agentes × fechas ────────────────────────────────────────
    const dateHeaders = dates.map(d => {
      const day = String(d.getDate()).padStart(2, '0')
      const mon = String(d.getMonth() + 1).padStart(2, '0')
      return `${day}/${mon} ${DIAS_SHORT[d.getDay()]}`
    })

    const pivotHeader = ['Nombre', 'Contrato', 'Segmento', 'Ingreso', 'Días de Franco', ...dateHeaders]

    const pivotRows = agentInfos.map(a => {
      const rawContrato = rawAgents.find(r => r.id === a.id)?.contrato ?? '—'
      const contratoLabel = a.contratoNorm === 'UNKNOWN' ? rawContrato : a.contratoNorm
      const francoNames = a.offDows.map(d => DIAS_ES[d]).join(', ')
      const ingresoStr = a.ingresoMin !== null ? minutesToHHMM(a.ingresoMin) : '—'
      const dateCells = dates.map(d => (a.offDows.includes(d.getDay()) ? 'F' : ''))
      return [a.nombre, contratoLabel, a.segmento ?? '—', ingresoStr, francoNames, ...dateCells]
    })

    // Summary row: count francos per day
    const summaryRow = [
      'Total francos', '', '', '', '',
      ...dates.map(d => agentInfos.filter(a => a.offDows.includes(d.getDay())).length),
    ]

    const ws1 = XLSX.utils.aoa_to_sheet([pivotHeader, ...pivotRows, summaryRow])
    ws1['!cols'] = [
      { wch: 32 }, { wch: 10 }, { wch: 18 }, { wch: 8 }, { wch: 22 },
      ...dates.map(() => ({ wch: 7 })),
    ]

    // ── Hoja 2: Detalle por fecha ──────────────────────────────────────────────
    const detailRows: (string | number)[][] = [
      ['Fecha', 'Día', 'Agentes de Franco', 'Agentes Presentes', '% Franco'],
    ]
    for (const d of dates) {
      const dow = d.getDay()
      const franco = agentInfos.filter(a => a.offDows.includes(dow))
      const presentes = agentInfos.length - franco.length
      const pct = agentInfos.length > 0 ? ((franco.length / agentInfos.length) * 100).toFixed(1) + '%' : '0%'
      const day = String(d.getDate()).padStart(2, '0')
      const mon = String(d.getMonth() + 1).padStart(2, '0')
      detailRows.push([
        `${day}/${mon}/${d.getFullYear()}`,
        DIAS_ES[dow],
        franco.map(a => a.nombre).join(', '),
        presentes,
        pct,
      ])
    }
    const ws2 = XLSX.utils.aoa_to_sheet(detailRows)
    ws2['!cols'] = [{ wch: 14 }, { wch: 12 }, { wch: 80 }, { wch: 18 }, { wch: 10 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws1, 'Francos_Agentes')
    XLSX.utils.book_append_sheet(wb, ws2, 'Francos_Por_Fecha')

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const mes = String(prog.mes).padStart(2, '0')
    const semStr = prog.semana > 0 ? `_sem${prog.semana}` : ''
    const filename = `francos_${prog.servicio.nombre}_${mes}_${prog.anio}${semStr}.xlsx`

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    return res.send(buf)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al exportar francos' })
  }
}
