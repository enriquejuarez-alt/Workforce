import { Response } from 'express'
import prisma from '../prisma'
import { createAuditLog } from '../utils/audit'
import { AuthRequest } from '../middleware/auth'
import * as XLSX from 'xlsx'
import fs from 'fs'

function normalizeDni(val: any): string {
  return String(val || '').replace(/\D/g, '').trim()
}

// El reporte de RRHH trae fechas como serial de Excel (dias desde 1899-12-30).
function parseSerialDate(val: any): Date | null {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number') {
    const utc_days = Math.floor(val - 25569)
    return new Date(utc_days * 86400 * 1000)
  }
  const d = new Date(String(val).trim())
  return isNaN(d.getTime()) ? null : d
}

// Hoja "LP AL <fecha>" del reporte de RRHH: columnas Dni, Empleado, ...,
// Servicio, ..., Inicio Licencia, Fin Licencia, ..., Pagada (SI/NO).
function encontrarHojaLP(sheetNames: string[]): string | null {
  const candidata = sheetNames.find((n) => /^LP AL/i.test(n.trim()))
  return candidata ?? null
}

export const importLicenciasPaga = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' })

    const wb = XLSX.readFile(req.file.path)
    fs.unlinkSync(req.file.path)

    const hoja = encontrarHojaLP(wb.SheetNames)
    if (!hoja) {
      return res.status(400).json({ error: 'No se encontró una hoja "LP AL <fecha>" en el archivo' })
    }

    const ws = wb.Sheets[hoja]
    const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 })
    const header = (rows[0] ?? []).map((h) => String(h || '').trim().toLowerCase())

    const idxDni = header.indexOf('dni')
    const idxEmpleado = header.indexOf('empleado')
    const idxServicio = header.indexOf('servicio')
    const idxInicio = header.indexOf('inicio licencia')
    const idxFin = header.indexOf('fin licencia')
    const idxPagada = header.indexOf('pagada')

    if (idxDni < 0 || idxFin < 0 || idxPagada < 0) {
      return res.status(400).json({ error: 'La hoja no tiene las columnas esperadas (Dni, Fin Licencia, Pagada)' })
    }

    const dataRows = rows.slice(1).filter((r) => r && r.length > idxPagada)

    const todosAgentes = await prisma.agente.findMany({ select: { id: true, dni: true } })
    const agenteByDni = new Map(todosAgentes.map((a) => [normalizeDni(a.dni), a]))

    const importacion = await prisma.licenciaPagaImportacion.create({
      data: {
        archivo_nombre: req.file.originalname,
        importado_por: req.user!.userId,
        total_periodos: 0,
        agentes_encontrados: 0,
        agentes_no_encontrados: 0,
      },
    })

    let totalPeriodos = 0
    let encontrados = 0
    let noEncontrados = 0

    for (const row of dataRows) {
      const dni = normalizeDni(row[idxDni])
      if (!dni) continue

      const fin = parseSerialDate(row[idxFin])
      const inicio = idxInicio >= 0 ? parseSerialDate(row[idxInicio]) : null
      if (!fin) continue

      const pagadaRaw = String(row[idxPagada] ?? '').trim().toUpperCase()
      const pagada = pagadaRaw === 'SI' || pagadaRaw === 'SÍ'

      const agente = agenteByDni.get(dni) ?? null
      if (agente) encontrados++
      else noEncontrados++

      await prisma.licenciaPaga.create({
        data: {
          agente_id: agente?.id ?? null,
          agente_dni: dni,
          agente_nombre: idxEmpleado >= 0 ? String(row[idxEmpleado] || '').trim() : '',
          servicio_wf: idxServicio >= 0 ? String(row[idxServicio] || '').trim() || null : null,
          pagada,
          fecha_desde: inicio ?? fin,
          fecha_hasta: fin,
          importacion_id: importacion.id,
        },
      })
      totalPeriodos++
    }

    await prisma.licenciaPagaImportacion.update({
      where: { id: importacion.id },
      data: { total_periodos: totalPeriodos, agentes_encontrados: encontrados, agentes_no_encontrados: noEncontrados },
    })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'IMPORTAR_LICENCIAS_PAGA',
      entidad: 'LicenciaPagaImportacion',
      entidad_id: String(importacion.id),
      valor_nuevo: `${totalPeriodos} licencias, ${encontrados} encontrados, ${noEncontrados} sin match`,
    })

    return res.json({
      ok: true,
      total_periodos: totalPeriodos,
      agentes_encontrados: encontrados,
      agentes_no_encontrados: noEncontrados,
      importacion_id: importacion.id,
    })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al importar licencias con condición de pago' })
  }
}

export const listLicenciasPaga = async (req: AuthRequest, res: Response) => {
  try {
    const { desde, hasta } = req.query

    const where: any = {}
    // Vigencia: licencias que se superponen con [desde, hasta] (el mes de una planificación),
    // igual criterio que /vacaciones.
    if (desde && hasta) {
      where.fecha_desde = { lte: new Date(hasta as string) }
      where.fecha_hasta = { gte: new Date(desde as string) }
    }

    const licencias = await prisma.licenciaPaga.findMany({
      where,
      orderBy: [{ fecha_desde: 'desc' }, { agente_nombre: 'asc' }],
      take: 5000,
    })

    return res.json(licencias)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al listar licencias' })
  }
}

export const listImportacionesLicenciasPaga = async (req: AuthRequest, res: Response) => {
  try {
    const importaciones = await prisma.licenciaPagaImportacion.findMany({
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

export const deleteImportacionLicenciasPaga = async (req: AuthRequest, res: Response) => {
  try {
    const id = parseInt(req.params.id)
    await prisma.licenciaPaga.deleteMany({ where: { importacion_id: id } })
    await prisma.licenciaPagaImportacion.delete({ where: { id } })
    return res.json({ ok: true })
  } catch {
    return res.status(500).json({ error: 'Error al eliminar importación' })
  }
}
