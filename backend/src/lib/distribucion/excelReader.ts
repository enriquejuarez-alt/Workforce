import * as XLSX from 'xlsx'
import {
  reheaderIfNeeded, renameToCanon, rowsToObjects, toTime, isRrss, isNominaSheet,
  pickNominaSheet, sheetRank, normalize, normDni, normUsuario, normActivo, normContrato,
  isExcel, Row,
} from './normalizer'

// ── Raw sheet reader ──────────────────────────────────────────────────────────

function readRawSheet(filePath: string, sheetName: string): unknown[][] {
  const wb = XLSX.readFile(filePath, { cellDates: true })
  const ws = wb.Sheets[sheetName]
  if (!ws) return []
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][]
}

function getWorkbook(filePath: string): XLSX.WorkBook {
  return XLSX.readFile(filePath, { cellDates: true })
}

// ── Parse one sheet into canonical rows ───────────────────────────────────────

function parseSheet(raw: unknown[][]): Row[] {
  const { headers, rows } = reheaderIfNeeded(raw)
  const canon = renameToCanon(headers)
  const objs = rowsToObjects(canon, rows)

  // deduplicate columns (keep first)
  const seen = new Set<string>()
  const uniqueCanon = canon.map(h => {
    if (seen.has(h)) return `__dup_${h}`
    seen.add(h)
    return h
  })

  return objs.map(row => {
    const clean: Row = {}
    uniqueCanon.forEach(h => {
      if (!h.startsWith('__dup_')) clean[h] = row[h]
    })
    return clean
  })
}

// ── Load single-sheet nomina with full normalizations ─────────────────────────

export interface LoadNominaResult {
  rows: NominaRow[]
  originalRows: Row[]
  selectedSheet: string
  allSheets: string[]
  líderes: string[]
  servicios: string[]
  timeOptions: string[]
}

export interface NominaRow extends Row {
  NOMBRE: string
  SUPERIOR: string
  SERVICIO: string
  ING_TIME: string | null
  ACTIVO: string
}

export function loadNomina(filePath: string, forcedSheet?: string): LoadNominaResult {
  if (!isExcel(filePath)) throw new Error('Solo se aceptan archivos .xlsx o .xls')

  const wb = getWorkbook(filePath)
  const allSheets = wb.SheetNames
  const selectedSheet = forcedSheet && allSheets.includes(forcedSheet)
    ? forcedSheet
    : pickNominaSheet(allSheets)

  const raw = XLSX.utils.sheet_to_json(wb.Sheets[selectedSheet], { header: 1, defval: '' }) as unknown[][]
  const rows = parseSheet(raw)
  const originalRows = [...rows]

  const required = ['SUPERIOR', 'NOMBRE', 'INGRESO', 'SERVICIO', 'ACTIVO']
  const missing = required.filter(c => !rows.some(r => c in r))
  if (missing.length > 0) throw new Error(`Faltan columnas: ${missing.join(', ')}`)

  const filtered = rows
    .filter(r => r.SUPERIOR && String(r.SUPERIOR).trim() !== '')
    .filter(r => !isRrss(r.SERVICIO))

  const normalized: NominaRow[] = filtered.map(r => ({
    ...r,
    NOMBRE   : String(r.NOMBRE ?? '').trim(),
    SUPERIOR : String(r.SUPERIOR ?? '').trim(),
    SERVICIO : String(r.SERVICIO ?? '').trim(),
    ACTIVO   : normActivo(r.ACTIVO),
    ING_TIME : toTime(r.INGRESO),
  }))

  const líderes = [...new Set(normalized.map(r => r.SUPERIOR).filter(Boolean))].sort()
  const servicios = [...new Set(normalized.map(r => r.SERVICIO).filter(Boolean))].sort()
  const timeOptions = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2,'0')}:00`)

  return { rows: normalized, originalRows, selectedSheet, allSheets, líderes, servicios, timeOptions }
}

// ── Read raw without full normalization (for cross-fill) ─────────────────────

export function readNominaRaw(filePath: string, forcedSheet?: string): { rows: Row[]; sheetName: string } {
  const wb = getWorkbook(filePath)
  const allSheets = wb.SheetNames
  const sheetName = forcedSheet && allSheets.includes(forcedSheet)
    ? forcedSheet
    : pickNominaSheet(allSheets)

  const raw = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' }) as unknown[][]
  return { rows: parseSheet(raw), sheetName }
}

// ── Read ALL NOMINA sheets (most recent first) for use as donor ───────────────

export function readNominaAllSheets(filePath: string): Row[] {
  const wb = getWorkbook(filePath)
  const sheets = wb.SheetNames
    .filter(isNominaSheet)
    .sort((a, b) => sheetRank(b) - sheetRank(a))

  if (sheets.length === 0) {
    const raw = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }) as unknown[][]
    return parseSheet(raw)
  }

  return sheets.flatMap(s => {
    const raw = XLSX.utils.sheet_to_json(wb.Sheets[s], { header: 1, defval: '' }) as unknown[][]
    return parseSheet(raw)
  })
}

// ── Identify donor vs receiver ────────────────────────────────────────────────

export function pickDonorReceiver(rowsA: Row[], rowsB: Row[]): { donor: Row[]; receiver: Row[] } {
  const scoreA = rowsA.filter(r => r.USUARIO && String(r.USUARIO).trim() !== '').length
               + rowsA.filter(r => r.CONTRATO && String(r.CONTRATO).trim() !== '').length
  const scoreB = rowsB.filter(r => r.USUARIO && String(r.USUARIO).trim() !== '').length
               + rowsB.filter(r => r.CONTRATO && String(r.CONTRATO).trim() !== '').length
  return scoreA >= scoreB ? { donor: rowsA, receiver: rowsB } : { donor: rowsB, receiver: rowsA }
}
