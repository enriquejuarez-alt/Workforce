import path from 'path'

// ── Text normalization ────────────────────────────────────────────────────────

export function normalize(text: unknown): string {
  const s = String(text ?? '').trim().toLowerCase()
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '')
}

export function normDni(x: unknown): string {
  return String(x ?? '').replace(/\D/g, '')
}

export function normUsuario(x: unknown): string {
  if (x === null || x === undefined) return ''
  const s = String(x).trim()
  if (!s) return ''
  const clean = s.replace(/[\s\-_]/g, '')
  if (clean.toLowerCase().startsWith('u')) {
    const digits = clean.slice(1).replace(/\D/g, '')
    return digits ? `u${digits}` : ''
  }
  const n = parseFloat(clean)
  if (!isNaN(n) && Number.isInteger(n)) return `u${n}`
  const digits = clean.replace(/\D/g, '')
  return digits ? `u${digits}` : clean.toLowerCase()
}

export function normActivo(x: unknown): string {
  return String(x ?? '').trim().toUpperCase()
}

export function normContrato(x: unknown): string {
  let s = String(x ?? '').trim()
  if (!s) return ''
  let u = s.toUpperCase()
  const removeTokens = [
    'ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO',
    'AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE',
    'TEMPORAL','DEFINITIVO','TEMP','DEF',
  ]
  for (const t of removeTokens) u = u.split(t).join(' ')
  let m = u.match(/(\d{2})\s*H?S/)
  if (!m) m = u.match(/\b(30|36)\b/)
  if (m) return `${parseInt(m[1])} hs`
  m = u.match(/(\d+)/)
  if (m) return `${parseInt(m[1])} hs`
  return ''
}

// ── Time parsing ──────────────────────────────────────────────────────────────

export function toTime(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null

  if (typeof val === 'string') {
    const v = val.trim()
    for (const fmt of [/^(\d{1,2}):(\d{2}):\d{2}$/, /^(\d{1,2}):(\d{2})$/]) {
      const m = v.match(fmt)
      if (m) return `${m[1].padStart(2,'0')}:${m[2]}`
    }
  }

  // Excel serial number (fraction of a day)
  if (typeof val === 'number') {
    const totalMinutes = Math.round((val % 1) * 24 * 60)
    const h = Math.floor(totalMinutes / 60) % 24
    const min = totalMinutes % 60
    return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`
  }

  if (val instanceof Date) {
    return `${String(val.getHours()).padStart(2,'0')}:${String(val.getMinutes()).padStart(2,'0')}`
  }

  return null
}

// ── Column header detection ───────────────────────────────────────────────────

const HEADER_EXPECTED = new Set([
  'dni','usuario','nombre','superior','servicio','ingreso','activo','estado','jefe','contrato','modalidad',
])

function scoreRow(row: unknown[]): number {
  return row.filter(v => HEADER_EXPECTED.has(normalize(v))).length
}

export function reheaderIfNeeded(raw: unknown[][]): { headers: string[]; rows: unknown[][] } {
  if (raw.length === 0) return { headers: [], rows: [] }

  const firstRow = raw[0] as unknown[]
  if (scoreRow(firstRow) >= 3) {
    return { headers: firstRow.map(v => String(v ?? '').trim()), rows: raw.slice(1) }
  }

  const limit = Math.min(10, raw.length)
  for (let i = 0; i < limit; i++) {
    if (scoreRow(raw[i]) >= 3) {
      return { headers: raw[i].map(v => String(v ?? '').trim()), rows: raw.slice(i + 1) }
    }
  }

  return { headers: firstRow.map(v => String(v ?? '').trim()), rows: raw.slice(1) }
}

// ── Column alias → canonical name ─────────────────────────────────────────────

const ALIASES: Record<string, string[]> = {
  DNI      : ['dni','documento','doc','id'],
  USUARIO  : ['usuario','user','legajo','employee id','usuario sap'],
  NOMBRE   : ['nombre','name'],
  SUPERIOR : ['superior','supervisor','lider','coordinador'],
  SERVICIO : ['servicio','skill','servicio/skill','segmento'],
  INGRESO  : ['ingreso','hora ingreso','ing hora','inicio','entrada','horario','horarios'],
  ACTIVO   : ['activo','estado'],
  JEFE     : ['jefe','jefatura','manager'],
  CONTRATO : ['contrato','contrat'],
  MODALIDAD: ['modalidad','home / presencial','home/presencial','home','presencial'],
}

export function renameToCanon(headers: string[]): string[] {
  return headers.map(h => {
    const norm = normalize(h)
    for (const [canon, opts] of Object.entries(ALIASES)) {
      if (norm === canon.toLowerCase() || opts.includes(norm)) return canon
    }
    return h
  })
}

// ── Rows as objects ───────────────────────────────────────────────────────────

export type Row = Record<string, unknown>

export function rowsToObjects(headers: string[], rows: unknown[][]): Row[] {
  return rows.map(r => {
    const obj: Row = {}
    headers.forEach((h, i) => { obj[h] = r[i] ?? '' })
    return obj
  }).filter(obj => Object.values(obj).some(v => v !== '' && v !== null && v !== undefined))
}

// ── Join key selection ────────────────────────────────────────────────────────

export function chooseJoinKey(colsFull: string[], colsPart: string[]): string | null {
  for (const col of ['DNI', 'NOMBRE', 'USUARIO']) {
    if (colsFull.includes(col) && colsPart.includes(col)) return col
  }
  return null
}

// ── Sheet rank for "most recent NOMINA sheet" ─────────────────────────────────

const MONTHS: Record<string, number> = {
  ENERO:1, FEBRERO:2, MARZO:3, ABRIL:4, MAYO:5, JUNIO:6,
  JULIO:7, AGOSTO:8, SEPTIEMBRE:9, OCTUBRE:10, NOVIEMBRE:11, DICIEMBRE:12,
}

export function sheetRank(name: string): number {
  const n = name.toUpperCase()
  const years = [...n.matchAll(/(\d{2,4})/g)].map(m => parseInt(m[1]))
  const year = years.length > 0 ? Math.max(...years) : 999
  let month = 0
  for (const [k, v] of Object.entries(MONTHS)) {
    if (n.includes(k)) { month = v; break }
  }
  return year * 100 + month
}

export function isNominaSheet(name: string): boolean {
  const n = name.toUpperCase()
  return n.includes('NOMINA') && !n.includes('RRSS')
}

export function isRrss(val: unknown): boolean {
  const s = normalize(val)
  return s.includes('rrss') || s.includes('redes sociales') || s.includes('social media')
}

export function pickNominaSheet(sheetNames: string[]): string {
  const preferred = [
    'NOMINA SEPTIEMBRE','NOMINA OCTUBRE','NOMINA AGOSTO',
    'NOMINA JULIO','NOMINA JUNIO','NOMINA MAYO',
  ]
  for (const p of preferred) {
    const found = sheetNames.find(n => n.trim().toUpperCase() === p)
    if (found) return found
  }
  const nomina = sheetNames.find(n => isNominaSheet(n))
  if (nomina) return nomina
  return sheetNames[0] ?? ''
}

// ── File extension helper ─────────────────────────────────────────────────────

export function isExcel(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase()
  return ext === '.xlsx' || ext === '.xls'
}
