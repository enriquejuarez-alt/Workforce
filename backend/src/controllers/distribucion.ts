import { Response } from 'express'
import fs from 'fs'
import { AuthRequest } from '../middleware/auth'
import { loadNomina, readNominaRaw, readNominaAllSheets, pickDonorReceiver } from '../lib/distribucion/excelReader'
import {
  distribuir, buildDistribucionExcel, crossFillUsersContracts, buildCruzadaExcel,
  LiderConfig,
} from '../lib/distribucion/distributor'

// POST /api/distribucion/analizar
// Recibe 1 archivo Excel, devuelve líderes + servicios disponibles
export const analizarNomina = async (req: AuthRequest, res: Response) => {
  const file = req.file
  if (!file) return res.status(400).json({ error: 'Archivo requerido' })

  try {
    const { líderes, servicios, allSheets, selectedSheet, timeOptions } = loadNomina(file.path)
    return res.json({ líderes, servicios, allSheets, selectedSheet, timeOptions, filePath: file.path })
  } catch (err) {
    fs.unlink(file.path, () => {})
    const msg = err instanceof Error ? err.message : 'Error procesando archivo'
    return res.status(400).json({ error: msg })
  }
}

// POST /api/distribucion/procesar
// Recibe filePath + configs de líderes, devuelve assignments para UI
export const procesarDistribucion = async (req: AuthRequest, res: Response) => {
  const { filePath, selectedSheet, configs, ideal } = req.body as {
    filePath: string
    selectedSheet?: string
    configs: LiderConfig[]
    ideal?: number
  }

  if (!filePath || !configs?.length) {
    return res.status(400).json({ error: 'filePath y configs son requeridos' })
  }
  if (!fs.existsSync(filePath)) {
    return res.status(400).json({ error: 'Archivo no encontrado. Volvé a subir el Excel.' })
  }

  try {
    const { rows, originalRows } = loadNomina(filePath, selectedSheet)
    const result = distribuir(rows, configs, ideal ?? 21)
    return res.json({
      ...result,
      filePath,
      selectedSheet,
      originalRowsCount: originalRows.length,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error en distribución'
    return res.status(400).json({ error: msg })
  }
}

// POST /api/distribucion/descargar
// Recibe filePath + assignments (opcionalmente reasignados), devuelve Excel
export const descargarDistribucion = async (req: AuthRequest, res: Response) => {
  const { filePath, selectedSheet, assignments, counts, ideal } = req.body as {
    filePath: string
    selectedSheet?: string
    assignments: Record<string, { rep: string; service: string; ingreso: string; status: string }[]>
    counts: Record<string, number>
    ideal: number
  }

  if (!filePath || !assignments) {
    return res.status(400).json({ error: 'filePath y assignments son requeridos' })
  }
  if (!fs.existsSync(filePath)) {
    return res.status(400).json({ error: 'Archivo no encontrado. Volvé a subir el Excel.' })
  }

  try {
    const { originalRows } = loadNomina(filePath, selectedSheet)
    const buffer = await buildDistribucionExcel(originalRows, assignments, counts, ideal ?? 21, selectedSheet ?? 'NOMINA')

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="Nomina_asignada.xlsx"')
    return res.send(buffer)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error generando Excel'
    return res.status(500).json({ error: msg })
  }
}

// POST /api/distribucion/cruzar
// Recibe 2 archivos Excel, devuelve Excel cruzado
export const cruzarNominas = async (req: AuthRequest, res: Response) => {
  const files = req.files as Express.Multer.File[]
  if (!files || files.length < 2) {
    return res.status(400).json({ error: 'Se requieren exactamente 2 archivos' })
  }

  const [fileA, fileB] = files
  try {
    const { rows: rowsA } = readNominaRaw(fileA.path)
    const { rows: rowsB, sheetName: sheetB } = readNominaRaw(fileB.path)

    const { donor: donorSrc, receiver: receiverSrc } = pickDonorReceiver(rowsA, rowsB)
    const isDonorA = donorSrc === rowsA
    const donorPath = isDonorA ? fileA.path : fileB.path
    const { sheetName: receiverSheet } = isDonorA
      ? { sheetName: sheetB }
      : readNominaRaw(fileA.path)

    const donorPool = readNominaAllSheets(donorPath)
    const pool = donorPool.length > 0 ? donorPool : donorSrc

    const { result, noMatch } = crossFillUsersContracts(pool, receiverSrc)
    const buffer = await buildCruzadaExcel(result, noMatch, receiverSheet || 'NOMINA')

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', 'attachment; filename="Nomina_cruzada.xlsx"')
    return res.send(buffer)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error cruzando nóminas'
    return res.status(400).json({ error: msg })
  } finally {
    fs.unlink(fileA.path, () => {})
    fs.unlink(fileB.path, () => {})
  }
}
