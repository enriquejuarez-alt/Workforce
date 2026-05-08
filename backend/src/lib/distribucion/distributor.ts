import ExcelJS from 'exceljs'
import { NominaRow } from './excelReader'
import { normalize, normDni, normUsuario, normActivo, normContrato, toTime, renameToCanon, Row, chooseJoinKey } from './normalizer'

const IDEAL_PER_LEADER = 21
const ASSIGN_WINDOW = 2 // hours

// ── Time helpers ──────────────────────────────────────────────────────────────

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function inWindow(repTime: string, leaderStart: string): boolean {
  const rt = timeToMinutes(repTime)
  const ls = timeToMinutes(leaderStart)
  const le = (ls + ASSIGN_WINDOW * 60) % (24 * 60)
  return ls <= le ? (rt >= ls && rt <= le) : (rt >= ls || rt <= le)
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LiderConfig {
  nombre: string
  horaInicio: string
  puesto: 'Líder' | 'Referente' | 'Pusher'
  skills: string[]
}

export interface RepAsignado {
  rep: string
  service: string
  ingreso: string
  status: string
}

export interface DistribucionResult {
  assignments: Record<string, RepAsignado[]>
  counts: Record<string, number>
  pusher: string | null
  ideal: number
  lideresOrdenados: string[]
}

// ── Distribution algorithm ────────────────────────────────────────────────────

export function distribuir(
  rows: NominaRow[],
  configs: LiderConfig[],
  ideal: number = IDEAL_PER_LEADER,
): DistribucionResult {
  const assignments: Record<string, RepAsignado[]> = {}
  const counts: Record<string, number> = {}

  for (const c of configs) {
    assignments[c.nombre] = []
    counts[c.nombre] = 0
  }

  const sorted = [...rows].sort((a, b) => {
    if (!a.ING_TIME) return 1
    if (!b.ING_TIME) return -1
    return timeToMinutes(a.ING_TIME) - timeToMinutes(b.ING_TIME)
  })

  for (const row of sorted) {
    if (!row.ING_TIME) continue
    const svc = row.SERVICIO

    const cands = configs.filter(c => {
      if (!inWindow(row.ING_TIME!, c.horaInicio)) return false
      if (c.skills.length > 0 && !c.skills.includes(svc)) return false
      return true
    })

    if (cands.length === 0) continue
    const chosen = cands.reduce((a, b) => counts[a.nombre] <= counts[b.nombre] ? a : b)

    assignments[chosen.nombre].push({
      rep: row.NOMBRE,
      service: svc,
      ingreso: row.ING_TIME!,
      status: row.ACTIVO,
    })
    counts[chosen.nombre]++
  }

  // find pusher (leader under ideal with most appropriate role)
  const under = configs.filter(c => counts[c.nombre] < ideal)
  const byRole = (role: string) => under.filter(c => c.puesto === role)
  const pushers   = byRole('Pusher')
  const referents = byRole('Referente')
  const lids      = byRole('Líder')
  const pushCands = pushers.length ? pushers : referents.length ? referents : lids
  const pusher = pushCands.length > 0
    ? pushCands.reduce((a, b) => counts[a.nombre] <= counts[b.nombre] ? a : b).nombre
    : null

  const lideresOrdenados = [...configs]
    .sort((a, b) => timeToMinutes(a.horaInicio) - timeToMinutes(b.horaInicio))
    .map(c => c.nombre)

  return { assignments, counts, pusher, ideal, lideresOrdenados }
}

// ── Excel export ──────────────────────────────────────────────────────────────

const DESIRED_ORDER = ['DNI','USUARIO','Nombre','Superior','Servicio','Ingreso','Estado','CONTRATO','MODALIDAD','JEFE','ASIGNADO_A']

function buildExportRows(
  originalRows: Row[],
  assignments: Record<string, RepAsignado[]>,
): Record<string, unknown>[] {
  const rep2leader: Record<string, string> = {}
  for (const [leader, reps] of Object.entries(assignments)) {
    for (const r of reps) rep2leader[r.rep] = leader
  }

  const assignedNames = new Set(Object.keys(rep2leader))

  return originalRows
    .filter(r => assignedNames.has(String(r.NOMBRE ?? '').trim()))
    .map(r => {
      const nombre = String(r.NOMBRE ?? '').trim()
      return {
        DNI        : r.DNI ?? '',
        USUARIO    : r.USUARIO ?? '',
        Nombre     : nombre,
        Superior   : r.SUPERIOR ?? '',
        Servicio   : r.SERVICIO ?? '',
        Ingreso    : r.INGRESO ?? '',
        Estado     : normActivo(r.ACTIVO),
        CONTRATO   : normContrato(r.CONTRATO),
        MODALIDAD  : String(r.MODALIDAD ?? '').trim(),
        JEFE       : r.JEFE ?? '',
        ASIGNADO_A : rep2leader[nombre] ?? '',
      }
    })
}

export async function buildDistribucionExcel(
  originalRows: Row[],
  assignments: Record<string, RepAsignado[]>,
  counts: Record<string, number>,
  ideal: number,
  sheetName: string,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()

  // Main sheet
  const ws = wb.addWorksheet(sheetName || 'NOMINA')
  const exportRows = buildExportRows(originalRows, assignments)

  ws.addRow(DESIRED_ORDER)
  for (const row of exportRows) {
    ws.addRow(DESIRED_ORDER.map(col => row[col] ?? ''))
  }

  // Style header
  const headerRow = ws.getRow(1)
  headerRow.font = { bold: true }
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }

  // Column widths
  const widths: Record<string, number> = {
    DNI: 13, USUARIO: 14, Nombre: 24, Superior: 26, Servicio: 20,
    Ingreso: 10, Estado: 12, CONTRATO: 14, MODALIDAD: 14, JEFE: 24, ASIGNADO_A: 22,
  }
  DESIRED_ORDER.forEach((col, i) => {
    ws.getColumn(i + 1).width = widths[col] ?? 14
  })

  // Summary sheet
  const ws2 = wb.addWorksheet('Resumen')
  ws2.addRow(['Líder', 'Ideal', 'Asignados', 'Diferencia'])
  ws2.getRow(1).font = { bold: true }
  for (const [leader, cnt] of Object.entries(counts)) {
    ws2.addRow([leader, ideal, cnt, cnt - ideal])
  }
  ws2.columns = [{ width: 28 }, { width: 10 }, { width: 12 }, { width: 14 }]

  return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>
}

// ── Cross-fill ────────────────────────────────────────────────────────────────

const FILL_FROM_DONOR = ['USUARIO', 'CONTRATO', 'MODALIDAD']
const CROSS_ORDER = ['DNI','USUARIO','Nombre','Superior','Servicio','Ingreso','Estado','CONTRATO','MODALIDAD','JEFE']

export function crossFillUsersContracts(
  donorRows: Row[],
  receiverRows: Row[],
  fields: string[] = FILL_FROM_DONOR,
): { result: Row[]; noMatch: Row[] } {
  const hasDni = donorRows.some(r => 'DNI' in r) && receiverRows.some(r => 'DNI' in r)

  function makeMap(rows: Row[], keyFn: (r: Row) => string, col: string): Map<string, unknown> {
    const map = new Map<string, unknown>()
    for (const row of rows) {
      const k = keyFn(row)
      if (k && !map.has(k)) map.set(k, row[col])
    }
    return map
  }

  const dniMaps: Record<string, Map<string, unknown>> = {}
  const nameMaps: Record<string, Map<string, unknown>> = {}
  for (const col of fields) {
    if (hasDni) dniMaps[col] = makeMap(donorRows, r => normDni(r.DNI), col)
    nameMaps[col] = makeMap(donorRows, r => normalize(r.NOMBRE), col)
  }

  const donorKeys = new Set([
    ...donorRows.map(r => normDni(r.DNI)),
    ...donorRows.map(r => normalize(r.NOMBRE)),
  ])

  const noMatch: Row[] = []

  const result = receiverRows.map(row => {
    const out = { ...row }
    const dniKey = normDni(row.DNI)
    const nameKey = normalize(row.NOMBRE)

    const matchedByDni = hasDni && donorKeys.has(dniKey)
    const matchedByName = donorKeys.has(nameKey)
    if (!matchedByDni && !matchedByName) noMatch.push(row)

    for (const col of fields) {
      const existing = String(out[col] ?? '').trim()
      if (existing !== '') continue
      const byDni = hasDni ? dniMaps[col]?.get(dniKey) : undefined
      const byName = nameMaps[col]?.get(nameKey)
      out[col] = byDni ?? byName ?? ''
    }
    return out
  })

  // Apply final normalizations
  return {
    result: result.map(r => ({
      ...r,
      USUARIO  : normUsuario(r.USUARIO),
      ACTIVO   : normActivo(r.ACTIVO),
      CONTRATO : normContrato(r.CONTRATO),
      MODALIDAD: String(r.MODALIDAD ?? '').trim(),
    })),
    noMatch,
  }
}

export async function buildCruzadaExcel(
  crossedRows: Row[],
  noMatch: Row[],
  sheetName: string,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()

  const ws = wb.addWorksheet(sheetName || 'NOMINA')
  ws.addRow(CROSS_ORDER)
  ws.getRow(1).font = { bold: true }
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }

  for (const row of crossedRows) {
    const visible = {
      DNI       : row.DNI ?? '',
      USUARIO   : row.USUARIO ?? '',
      Nombre    : row.NOMBRE ?? '',
      Superior  : row.SUPERIOR ?? '',
      Servicio  : row.SERVICIO ?? '',
      Ingreso   : row.INGRESO ?? '',
      Estado    : row.ACTIVO ?? '',
      CONTRATO  : row.CONTRATO ?? '',
      MODALIDAD : row.MODALIDAD ?? '',
      JEFE      : row.JEFE ?? '',
    }
    ws.addRow(CROSS_ORDER.map(col => (visible as Record<string, unknown>)[col] ?? ''))
  }

  const widths: Record<string, number> = {
    DNI:13, USUARIO:14, Nombre:24, Superior:26, Servicio:20,
    Ingreso:10, Estado:12, CONTRATO:14, MODALIDAD:14, JEFE:24,
  }
  CROSS_ORDER.forEach((col, i) => { ws.getColumn(i + 1).width = widths[col] ?? 14 })

  // No-match audit sheet
  const wsNm = wb.addWorksheet('No Match')
  if (noMatch.length > 0) {
    wsNm.addRow(['DNI', 'Nombre'])
    wsNm.getRow(1).font = { bold: true }
    for (const r of noMatch) {
      wsNm.addRow([r.DNI ?? '', r.NOMBRE ?? ''])
    }
  } else {
    wsNm.addRow(['OK - Sin registros sin match'])
  }
  wsNm.columns = [{ width: 14 }, { width: 28 }]

  return wb.xlsx.writeBuffer() as unknown as Promise<Buffer>
}
