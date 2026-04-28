import { Response } from 'express'
import prisma from '../prisma'
import { createAuditLog } from '../utils/audit'
import { AuthRequest } from '../middleware/auth'
import * as XLSX from 'xlsx'
import fs from 'fs'

function parseWfDate(val: any): Date | null {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number') {
    const utc_days = Math.floor(val - 25569)
    return new Date(utc_days * 86400 * 1000)
  }
  const str = String(val).trim()
  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (match) {
    return new Date(`${match[3]}-${match[2]}-${match[1]}T00:00:00.000Z`)
  }
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d
}

function mergeRanges(ranges: Array<{ desde: Date; hasta: Date }>): Array<{ desde: Date; hasta: Date }> {
  if (ranges.length === 0) return []
  const sorted = [...ranges].sort((a, b) => a.desde.getTime() - b.desde.getTime())
  const merged: Array<{ desde: Date; hasta: Date }> = [{ desde: sorted[0].desde, hasta: sorted[0].hasta }]
  for (let i = 1; i < sorted.length; i++) {
    const current = merged[merged.length - 1]
    const next = sorted[i]
    const gapDays = (next.desde.getTime() - current.hasta.getTime()) / (1000 * 60 * 60 * 24)
    if (gapDays <= 3) {
      current.hasta = new Date(Math.max(current.hasta.getTime(), next.hasta.getTime()))
    } else {
      merged.push({ desde: next.desde, hasta: next.hasta })
    }
  }
  return merged
}

export const importVacaciones = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' })

    const wb = XLSX.readFile(req.file.path)
    fs.unlinkSync(req.file.path)

    const ws = wb.Sheets[wb.SheetNames[0]]
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })

    // Row 0 is the header row; data starts at row 1
    const dataRows = rows.slice(1).filter((r) => r && r.length > 11)

    // Columns in the WF file (0-indexed):
    // 0: seq, 1: WF Id, 2: Nro Orden, 3: Empleado nombre, 4: DNI,
    // 5: Motivo, 10: Desde, 11: Hasta, 13: Site, 14: Servicio WF

    const byDni = new Map<string, {
      nombre: string
      site: string
      servicioWf: string
      ranges: Array<{ desde: Date; hasta: Date }>
    }>()

    let totalDias = 0

    for (const row of dataRows) {
      const motivo = String(row[5] || '').trim().toUpperCase()
      if (motivo !== 'VACACIONES') continue

      const dni = String(row[4] || '').trim()
      if (!dni) continue

      const desde = parseWfDate(row[10])
      const hasta = parseWfDate(row[11])
      if (!desde || !hasta) continue

      totalDias++

      if (!byDni.has(dni)) {
        byDni.set(dni, {
          nombre: String(row[3] || '').trim(),
          site: String(row[13] || '').trim(),
          servicioWf: String(row[14] || '').trim(),
          ranges: [],
        })
      }
      byDni.get(dni)!.ranges.push({ desde, hasta })
    }

    const importacion = await prisma.vacacionImportacion.create({
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

    for (const [dni, info] of byDni.entries()) {
      const merged = mergeRanges(info.ranges)
      const agente = await prisma.agente.findFirst({ where: { dni } })

      if (agente) encontrados++
      else noEncontrados++

      for (const { desde, hasta } of merged) {
        await prisma.vacacion.create({
          data: {
            agente_id: agente?.id ?? null,
            agente_dni: dni,
            agente_nombre: info.nombre,
            fecha_desde: desde,
            fecha_hasta: hasta,
            site: info.site || null,
            servicio_wf: info.servicioWf || null,
            importacion_id: importacion.id,
          },
        })
        totalPeriodos++
      }
    }

    await prisma.vacacionImportacion.update({
      where: { id: importacion.id },
      data: { total_periodos: totalPeriodos, agentes_encontrados: encontrados, agentes_no_encontrados: noEncontrados },
    })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'IMPORTAR_VACACIONES',
      entidad: 'VacacionImportacion',
      entidad_id: String(importacion.id),
      valor_nuevo: `${totalPeriodos} periodos, ${encontrados} encontrados, ${noEncontrados} sin match`,
    })

    return res.json({
      ok: true,
      total_dias: totalDias,
      total_periodos: totalPeriodos,
      agentes_encontrados: encontrados,
      agentes_no_encontrados: noEncontrados,
      importacion_id: importacion.id,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al importar vacaciones' })
  }
}

export const listVacaciones = async (req: AuthRequest, res: Response) => {
  try {
    const { search, estado, importacion_id } = req.query
    const now = new Date()

    const where: any = {}
    if (importacion_id) where.importacion_id = parseInt(importacion_id as string)
    if (search) {
      where.OR = [
        { agente_nombre: { contains: search as string, mode: 'insensitive' } },
        { agente_dni: { contains: search as string, mode: 'insensitive' } },
      ]
    }

    const vacaciones = await prisma.vacacion.findMany({
      where,
      include: {
        agente: { include: { servicio: true } },
        importacion: { select: { id: true, archivo_nombre: true, fecha_importacion: true } },
      },
      orderBy: [{ fecha_desde: 'asc' }, { agente_nombre: 'asc' }],
    })

    const withStatus = vacaciones.map((v) => {
      let estadoCalc: string
      if (now < v.fecha_desde) estadoCalc = 'PROGRAMADA'
      else if (now > v.fecha_hasta) estadoCalc = 'FINALIZADA'
      else estadoCalc = 'VIGENTE'
      return { ...v, estado_calculado: estadoCalc }
    })

    const filtered = estado
      ? withStatus.filter((v) => v.estado_calculado === (estado as string).toUpperCase())
      : withStatus

    return res.json(filtered)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al listar vacaciones' })
  }
}

export const listImportacionesVacaciones = async (req: AuthRequest, res: Response) => {
  try {
    const importaciones = await prisma.vacacionImportacion.findMany({
      include: {
        importador: { select: { id: true, nombre: true } },
        _count: { select: { vacaciones: true } },
      },
      orderBy: { fecha_importacion: 'desc' },
    })
    return res.json(importaciones)
  } catch {
    return res.status(500).json({ error: 'Error al listar importaciones de vacaciones' })
  }
}

export const deleteVacacion = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    await prisma.vacacion.delete({ where: { id } })
    return res.json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Error al eliminar vacación' })
  }
}

export const deleteImportacionVacaciones = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    await prisma.vacacion.deleteMany({ where: { importacion_id: id } })
    await prisma.vacacionImportacion.delete({ where: { id } })
    return res.json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Error al eliminar importación' })
  }
}
