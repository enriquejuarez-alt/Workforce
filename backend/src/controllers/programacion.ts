import { Response } from 'express'
import prisma from '../prisma'
import { AuthRequest } from '../middleware/auth'
import * as XLSX from 'xlsx'
import * as fs from 'fs'
import ExcelJS from 'exceljs'

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

// Like getDatesForPeriod but for conversor/cronograma: specific weeks always
// span Mon→Sun (may cross month boundary), mes completo keeps original range.
function getDatesForConversor(mes: number, anio: number, semana: number): Date[] {
  if (semana === 0) return getDatesForPeriod(mes, anio, 0)

  const weekStartDay = (semana - 1) * 7 + 1
  const firstDate = new Date(anio, mes - 1, weekStartDay)
  const dow = firstDate.getDay() // 0=Sun, 1=Mon … 6=Sat
  const daysToMonday = dow === 0 ? 6 : dow - 1
  const monday = new Date(firstDate)
  monday.setDate(monday.getDate() - daysToMonday)

  const out: Date[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(d.getDate() + i)
    out.push(d)
  }
  return out
}

// For each date in `dates`, returns the peak (max) requeridos across all intervals.
// For dates that fall outside the current month, looks up the adjacent month's
// programming for the same service and uses its requeridos.
async function loadPeakReqsByDate(
  servicio_id: number,
  dates: Date[],
  currentProgId: number,
  currentMes: number,
  currentAnio: number,
  currentReqs: { fecha: Date | string; requeridos: number }[],
): Promise<Map<string, number>> {
  const peak = new Map<string, number>()

  for (const r of currentReqs) {
    const ds = dateStr(new Date(r.fecha))
    peak.set(ds, Math.max(peak.get(ds) ?? 0, r.requeridos))
  }

  // Group cross-month dates by month/year
  const crossGroups = new Map<string, { mes: number; anio: number }>()
  for (const d of dates) {
    if (d.getMonth() + 1 !== currentMes || d.getFullYear() !== currentAnio) {
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`
      crossGroups.set(key, { mes: d.getMonth() + 1, anio: d.getFullYear() })
    }
  }

  for (const { mes, anio } of crossGroups.values()) {
    const adj = await prisma.programacionMensual.findFirst({
      where: { servicio_id, mes, anio, id: { not: currentProgId } },
      include: { requeridos: true },
      orderBy: { fecha_creacion: 'desc' },
    })
    if (adj) {
      for (const r of adj.requeridos) {
        const ds = dateStr(new Date(r.fecha))
        peak.set(ds, Math.max(peak.get(ds) ?? 0, r.requeridos))
      }
    }
  }

  return peak
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

type RawProgramacionAgent = {
  id: number
  nombre: string
  segmento: string | null
  horarios: string | null
  contrato: string | null
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

      // Dynamic tolerance bands
      let li: number, up: number
      if (req < 10)       { li = Math.max(req - 1, 0); up = req + 1 }
      else if (req < 20)  { li = Math.max(req - 2, 0); up = req + 2 }
      else                { li = Math.floor(req * 0.9); up = Math.ceil(req * 1.1) }

      let presentes = agentInfos.filter(a => {
        if (a.offDows.includes(dow)) return false
        const ing = overrideIngreso?.has(a.id) ? overrideIngreso.get(a.id)! : a.ingresoMin
        if (ing === null) return false
        return ing <= intMin && intMin < ing + getHorasPorDia(a.contratoNorm) * 60
      })

      // Sunday special logic: exclude agents who worked Saturday, then prioritize 36HS
      if (dow === 0) {
        const prevDs = dateStr(new Date(date.getTime() - 24 * 60 * 60 * 1000))
        const satNames = new Set<string>()
        for (const r of rows) {
          if (r.fecha === prevDs) r.agentes.forEach(n => satNames.add(n))
        }
        const withoutSat = presentes.filter(a => !satNames.has(a.nombre))
        const hs36 = withoutSat.filter(a => a.contratoNorm === '36HS')
        const others = withoutSat.filter(a => a.contratoNorm !== '36HS')
        presentes = [...hs36, ...others.slice(0, Math.max(0, li - hs36.length))]
      }

      const raw = presentes.length
      const reduccion = Math.floor(raw * totalReduccion)
      const asignados = Math.max(0, raw - reduccion)

      let estado: SimRow['estado']
      if (asignados < li)       estado = 'UNDER'
      else if (asignados === li) estado = 'LIMITE'
      else if (asignados <= up) estado = 'OK'
      else                       estado = 'OVER'

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

  movements.sort((a, b) => a.de !== b.de ? a.de.localeCompare(b.de) : a.nombre.localeCompare(b.nombre))
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

// ─── Agent source: nómina snapshot or active agents ───────────────────────────

// Whitelist: only agents explicitly marked as active count towards coverage
const ACTIVE_ESTADOS = new Set(['activo', 'act', 'active', 'disponible'])

function isAvailableForWork(estado: string | null | undefined): boolean {
  if (!estado) return true  // no estado = include (legacy data without estado)
  return ACTIVE_ESTADOS.has(estado.toLowerCase().trim())
}

function normalizeProgramacionText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function isTecnicaService(nombre: string | null | undefined): boolean {
  const normalized = normalizeProgramacionText(nombre)
  return normalized.includes('soporte tecnico') || normalized.includes('tecnica')
}

const SMB_SEGMENT_WHERE = [
  { segmento: { startsWith: 'SMB', mode: 'insensitive' as const } },
  { segmento: { contains: 'TECNICA', mode: 'insensitive' as const } },
  { segmento: { contains: 'TÉCNICA', mode: 'insensitive' as const } },
]

function dedupeAgentsById(agents: RawProgramacionAgent[]): RawProgramacionAgent[] {
  const seen = new Set<number>()
  const unique: RawProgramacionAgent[] = []
  for (const agent of agents) {
    if (seen.has(agent.id)) continue
    seen.add(agent.id)
    unique.push(agent)
  }
  return unique
}

async function getAgentsForProg(
  prog: { servicio_id: number; nomina_id: number | null; mes?: number; anio?: number }
): Promise<RawProgramacionAgent[]> {
  const servicio = await prisma.servicio.findUnique({
    where: { id: prog.servicio_id },
    select: { nombre: true },
  })
  const includeSmb = isTecnicaService(servicio?.nombre)

  if (prog.nomina_id) {
    const nomina = await prisma.nominaMensual.findUnique({
      where: { id: prog.nomina_id },
      select: { mes: true, anio: true },
    })
    const mes = prog.mes ?? nomina?.mes
    const anio = prog.anio ?? nomina?.anio

    const snapshots = await prisma.agenteNominaMensual.findMany({
      where: { nomina_mensual_id: prog.nomina_id, presente_en_nomina: true },
      select: { agente_id: true, nombre: true, segmento: true, horarios: true, contrato: true, estado: true },
    })

    const smbSnapshots = includeSmb && mes && anio
      ? await prisma.agenteNominaMensual.findMany({
          where: {
            presente_en_nomina: true,
            OR: SMB_SEGMENT_WHERE,
            nomina_mensual: {
              mes,
              anio,
            },
          },
          select: { agente_id: true, nombre: true, segmento: true, horarios: true, contrato: true, estado: true },
        })
      : []

    const agents = [...snapshots, ...smbSnapshots]
      .filter(s => isAvailableForWork(s.estado))
      .map(s => ({
        id: s.agente_id,
        nombre: s.nombre,
        segmento: s.segmento,
        horarios: s.horarios,
        contrato: s.contrato,
      }))

    return dedupeAgentsById(agents)
  }

  const agents = await prisma.agente.findMany({
    where: {
      activo: true,
      OR: includeSmb
        ? [
            { servicio_id: prog.servicio_id },
            ...SMB_SEGMENT_WHERE,
          ]
        : [{ servicio_id: prog.servicio_id }],
    },
    select: { id: true, nombre: true, segmento: true, horarios: true, contrato: true, estado: true },
  })
  return dedupeAgentsById(agents.filter(a => isAvailableForWork(a.estado)))
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

function getWorkforceSheets(wb: XLSX.WorkBook): string[] {
  return wb.SheetNames.filter(n => n.toLowerCase() !== 'resumen')
}

function parseRequeridosExcel(
  filePath: string,
  sheetsFilter?: string[]
): { fecha: string; intervalo: string; requeridos: number; es_feriado: boolean }[] {
  const wb = XLSX.readFile(filePath, { cellDates: false })

  // Accumulator: sum requeridos across selected sheets for same (fecha, intervalo)
  const acc = new Map<string, { requeridos: number; es_feriado: boolean }>()
  const addRow = (fecha: string, intervalo: string, requeridos: number, es_feriado: boolean) => {
    const key = `${fecha}|${intervalo}`
    const existing = acc.get(key)
    if (existing) existing.requeridos += requeridos
    else acc.set(key, { requeridos, es_feriado })
  }

  const availableSheets = getWorkforceSheets(wb)
  const sheetsToProcess = sheetsFilter && sheetsFilter.length > 0
    ? availableSheets.filter(n => sheetsFilter.includes(n))
    : availableSheets

  for (const sheetName of sheetsToProcess) {

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
        nomina: { select: { id: true, mes: true, anio: true, estado: true, total_agentes: true } },
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
        nomina: { select: { id: true, mes: true, anio: true, estado: true, total_agentes: true } },
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

// Set nómina base for simulation
export const setNomina = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const { nomina_id } = req.body as { nomina_id: number | null }
    const prog = await prisma.programacionMensual.update({
      where: { id },
      data: { nomina_id: nomina_id ?? null },
      include: {
        servicio: { select: { id: true, nombre: true, color: true } },
        nomina: { select: { id: true, mes: true, anio: true, estado: true, total_agentes: true } },
        factor: true,
        _count: { select: { requeridos: true } },
      },
    })
    return res.json(prog)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al actualizar nómina base' })
  }
}

// Preview requeridos Excel — returns available sheet names without saving
export const previewRequeridos = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Archivo requerido' })
    try {
      const wb = XLSX.readFile(req.file.path, { cellDates: false })
      const sheets = getWorkforceSheets(wb)
      return res.json({ sheets })
    } finally {
      fs.unlinkSync(req.file.path)
    }
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al leer el archivo' })
  }
}

// Upload requeridos from Excel file
export const uploadRequeridos = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    if (!req.file) return res.status(400).json({ error: 'Archivo requerido' })

    const prog = await prisma.programacionMensual.findUnique({ where: { id } })
    if (!prog) return res.status(404).json({ error: 'Programación no encontrada' })

    let sheetsFilter: string[] | undefined
    if (req.body?.sheets) {
      try { sheetsFilter = JSON.parse(req.body.sheets) } catch { /* ignore */ }
    }
    const parsed = parseRequeridosExcel(req.file.path, sheetsFilter)
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

    const rawAgents = await getAgentsForProg(prog)

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

    // Per-date agent presence (used by Curvas UI for days without requeridos)
    const presencia_por_fecha: Record<string, { presentes: number; francos: number }> = {}
    for (const date of dates) {
      const ds = dateStr(date)
      const dow = date.getDay()
      presencia_por_fecha[ds] = {
        presentes: agentInfos.filter(a => !a.offDows.includes(dow) && a.ingresoMin !== null).length,
        francos:   agentInfos.filter(a =>  a.offDows.includes(dow)).length,
      }
    }

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
      presencia_por_fecha,
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

    const rawAgents = await getAgentsForProg(prog)
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

    const wb = new ExcelJS.Workbook()
    wb.creator = 'Nomina Konecta'

    // Color scheme per estado
    const ROW_FILL: Record<string, string> = {
      UNDER: 'FFFEE2E2', LIMITE: 'FFFFF7ED', OK: 'FFF0FDF4', OVER: 'FFDBEAFE',
    }
    const CELL_FILL: Record<string, string> = {
      UNDER: 'FFEF4444', LIMITE: 'FFEA580C', OK: 'FF16A34A', OVER: 'FF2563EB',
    }

    const HDR_BG = 'FF1F2937'
    const HDR_FG = 'FFFFFFFF'

    const addHeader = (ws: ExcelJS.Worksheet, cols: string[]) => {
      const row = ws.addRow(cols)
      row.height = 22
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HDR_BG } }
        cell.font = { bold: true, color: { argb: HDR_FG }, size: 10 }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      })
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' }
    }

    const addSimSheet = (name: string, rows: SimRow[]) => {
      const ws = wb.addWorksheet(name)
      ws.views = [{ state: 'frozen', ySplit: 1 }]
      ws.columns = [
        { width: 12 }, { width: 11 }, { width: 10 }, { width: 10 }, { width: 11 },
        { width: 11 }, { width: 11 }, { width: 11 }, { width: 10 }, { width: 10 },
        { width: 10 }, { width: 60 }, { width: 8 },
      ]
      addHeader(ws, ['Fecha', 'Día', 'Intervalo', 'Prime', 'Requeridos',
        'L. Inferior', 'L. Superior', 'Asignados', 'Faltante', 'Sobrante',
        'Estado', 'Agentes Presentes', 'Feriado'])

      for (const r of rows) {
        const intMin = parseIntervalo(r.intervalo)
        const diaIdx = DIAS_SHORT.indexOf(r.dia_semana)
        const exRow = ws.addRow([
          r.fecha,
          diaIdx >= 0 ? DIAS_ES[diaIdx] : r.dia_semana,
          r.intervalo,
          intMin >= 9 * 60 && intMin < 21 * 60 ? 'Prime' : 'No prime',
          r.requeridos, r.limite_inferior, r.limite_superior,
          r.asignados, r.faltante, r.sobrante,
          r.estado, r.agentes.join('; '), r.es_feriado ? 'Sí' : 'No',
        ])
        const rowFill = ROW_FILL[r.estado]
        if (rowFill) {
          exRow.eachCell(cell => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowFill } }
            cell.alignment = { vertical: 'middle' }
          })
          const estadoCell = exRow.getCell(11)
          estadoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: CELL_FILL[r.estado] } }
          estadoCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
          estadoCell.alignment = { vertical: 'middle', horizontal: 'center' }
        }
      }
    }

    addSimSheet('Nómina', baseline)
    addSimSheet('Simulación', simConMovimientos)

    // Movimientos
    const wsMov = wb.addWorksheet('Movimientos')
    wsMov.views = [{ state: 'frozen', ySplit: 1 }]
    wsMov.columns = [{ width: 6 }, { width: 32 }, { width: 14 }, { width: 5 }, { width: 14 }]
    addHeader(wsMov, ['#', 'Agente', 'Turno Actual', '→', 'Turno Propuesto'])
    movements.forEach((m, i) => {
      const row = wsMov.addRow([i + 1, m.nombre, m.de, '→', m.hacia])
      row.eachCell(cell => { cell.alignment = { vertical: 'middle' } })
      row.getCell(3).font = { name: 'Courier New', size: 10 }
      row.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } }
      row.getCell(5).font = { name: 'Courier New', bold: true, size: 10, color: { argb: 'FF166534' } }
    })

    // Cupos feriado
    const wsCupos = wb.addWorksheet('Cupos_Feriado')
    wsCupos.views = [{ state: 'frozen', ySplit: 1 }]
    wsCupos.columns = [{ width: 12 }, { width: 30 }, { width: 12 }, { width: 14 }]
    addHeader(wsCupos, ['Intervalo', 'Isla / Segmento', 'Asignados', 'Cupos Feriado'])
    for (const c of cuposFeriado) {
      const row = wsCupos.addRow([c.intervalo, c.isla, c.asignados, c.cupo])
      row.eachCell(cell => { cell.alignment = { vertical: 'middle' } })
      row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } }
      row.getCell(4).font = { bold: true, color: { argb: 'FF075985' } }
    }

    const buf = await wb.xlsx.writeBuffer()
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

    const rawAgents = await getAgentsForProg(prog)

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

// Visual calendar: agent × day — ingreso time or "F" (franco), with colors
export const exportConversor = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const prog = await prisma.programacionMensual.findUnique({
      where: { id },
      include: { servicio: { select: { id: true, nombre: true } }, requeridos: true },
    })
    if (!prog) return res.status(404).json({ error: 'Programación no encontrada' })

    const rawAgents = await getAgentsForProg(prog)
    const agentInfos = prepareAgentInfos(rawAgents)
    const dates = getDatesForConversor(prog.mes, prog.anio, prog.semana)

    const peakByDate = await loadPeakReqsByDate(
      prog.servicio_id, dates, prog.id, prog.mes, prog.anio, prog.requeridos,
    )

    const contractOrder = ['36HS', '30HS', '35HS', '24HS', 'UNKNOWN']
    const sorted = [...agentInfos].sort((a, b) => {
      const ca = contractOrder.indexOf(a.contratoNorm)
      const cb = contractOrder.indexOf(b.contratoNorm)
      return ca !== cb ? ca - cb : a.nombre.localeCompare(b.nombre)
    })

    const wb = new ExcelJS.Workbook()
    const ws = wb.addWorksheet('Conversor')

    // Freeze first 4 columns + header row
    ws.views = [{ state: 'frozen', xSplit: 4, ySplit: 1 }]
    ws.columns = [
      { width: 32 }, { width: 10 }, { width: 8 }, { width: 8 },
      ...dates.map(() => ({ width: 7 })),
    ]

    // Header row
    const headerRow = ws.addRow([
      'Nombre', 'Contrato', 'Ingreso', 'Break',
      ...dates.map(d => {
        const dd = String(d.getDate()).padStart(2, '0')
        const mm = String(d.getMonth() + 1).padStart(2, '0')
        return `${dd}/${mm}\n${DIAS_SHORT[d.getDay()]}`
      }),
    ])
    headerRow.height = 28
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F2937' } }
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    })
    headerRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' }
    // Shade weekend headers
    dates.forEach((d, idx) => {
      if (d.getDay() === 0 || d.getDay() === 6) {
        headerRow.getCell(5 + idx).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } }
      }
    })

    // Data rows
    sorted.forEach((a, i) => {
      const rawContrato = rawAgents.find(r => r.id === a.id)?.contrato ?? '—'
      const contratoLabel = a.contratoNorm === 'UNKNOWN' ? rawContrato : a.contratoNorm
      const ingresoStr = a.ingresoMin !== null ? minutesToHHMM(a.ingresoMin) : '—'
      const breakMin = a.ingresoMin !== null
        ? a.ingresoMin + Math.round(getHorasPorDia(a.contratoNorm) / 2 * 60)
        : null
      const breakStr = breakMin !== null ? minutesToHHMM(breakMin) : '—'
      const dayCells = dates.map(d =>
        a.offDows.includes(d.getDay()) ? 'F'
          : (a.ingresoMin !== null ? minutesToHHMM(a.ingresoMin) : '—')
      )
      const row = ws.addRow([a.nombre, contratoLabel, ingresoStr, breakStr, ...dayCells])
      row.height = 17
      const rowBg = i % 2 === 0 ? 'FFFFFFFF' : 'FFF9FAFB'
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: rowBg } }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      })
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' }
      dates.forEach((d, idx) => {
        const cell = row.getCell(5 + idx)
        const val = dayCells[idx]
        if (val === 'F') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } }
          cell.font = { bold: true, color: { argb: 'FF9CA3AF' }, size: 9 }
        } else if (val !== '—') {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: i % 2 === 0 ? 'FFF0FDF4' : 'FFE8FCEF' } }
          cell.font = { name: 'Courier New', size: 9, color: { argb: 'FF166534' } }
        }
      })
    })

    // Summary rows
    const addSummary = (label: string, vals: number[]) => {
      const row = ws.addRow([label, '', '', '', ...vals])
      row.height = 18
      row.eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }
        cell.font = { bold: true, size: 10 }
        cell.alignment = { vertical: 'middle', horizontal: 'center' }
      })
      row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' }
    }
    addSummary('Presentes', dates.map(d => sorted.filter(a => !a.offDows.includes(d.getDay()) && a.ingresoMin !== null).length))
    addSummary('Francos', dates.map(d => sorted.filter(a => a.offDows.includes(d.getDay())).length))

    // Requeridos (pico del día) — azul
    const reqRow = ws.addRow(['Requeridos (pico)', '', '', '', ...dates.map(d => peakByDate.get(dateStr(d)) ?? 0)])
    reqRow.height = 18
    reqRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } }
      cell.font = { bold: true, size: 10, color: { argb: 'FF075985' } }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    })
    reqRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' }

    const buf = await wb.xlsx.writeBuffer()
    const mes = String(prog.mes).padStart(2, '0')
    const semStr = prog.semana > 0 ? `_sem${prog.semana}` : ''
    const filename = `conversor_${prog.servicio.nombre}_${mes}_${prog.anio}${semStr}.xlsx`

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    return res.send(buf)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al exportar conversor' })
  }
}

// JSON: agent × day schedule for UI view
export const getCronograma = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    const prog = await prisma.programacionMensual.findUnique({
      where: { id },
      include: { requeridos: true },
    })
    if (!prog) return res.status(404).json({ error: 'Programación no encontrada' })

    const rawAgents = await getAgentsForProg(prog)
    const agentInfos = prepareAgentInfos(rawAgents)
    const dates = getDatesForConversor(prog.mes, prog.anio, prog.semana)

    const peakByDate = await loadPeakReqsByDate(
      prog.servicio_id, dates, prog.id, prog.mes, prog.anio, prog.requeridos,
    )

    const contractOrder = ['36HS', '30HS', '35HS', '24HS', 'UNKNOWN']
    const sorted = [...agentInfos].sort((a, b) => {
      const ca = contractOrder.indexOf(a.contratoNorm)
      const cb = contractOrder.indexOf(b.contratoNorm)
      return ca !== cb ? ca - cb : a.nombre.localeCompare(b.nombre)
    })

    const agents = sorted.map(a => {
      const raw = rawAgents.find(r => r.id === a.id)
      const breakMin = a.ingresoMin !== null
        ? a.ingresoMin + Math.round(getHorasPorDia(a.contratoNorm) / 2 * 60)
        : null
      const dias: Record<string, string> = {}
      for (const d of dates) {
        dias[dateStr(d)] = a.offDows.includes(d.getDay())
          ? 'F'
          : (a.ingresoMin !== null ? minutesToHHMM(a.ingresoMin) : '—')
      }
      return {
        id: a.id,
        nombre: a.nombre,
        contrato: raw?.contrato ?? null,
        contratoNorm: a.contratoNorm,
        segmento: a.segmento,
        ingreso: a.ingresoMin !== null ? minutesToHHMM(a.ingresoMin) : null,
        hora_break: breakMin !== null ? minutesToHHMM(breakMin) : null,
        francos: a.offDows.map(d => DIAS_ES[d]),
        dias,
      }
    })

    const requeridos_pico: Record<string, number> = {}
    for (const d of dates) {
      requeridos_pico[dateStr(d)] = peakByDate.get(dateStr(d)) ?? 0
    }

    return res.json({
      agents,
      dates: dates.map(d => ({
        fecha: dateStr(d),
        dia_num: d.getDate(),
        dia_semana: DIAS_SHORT[d.getDay()],
        dow: d.getDay(),
      })),
      total: agents.length,
      requeridos_pico,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al obtener cronograma' })
  }
}
