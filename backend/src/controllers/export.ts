import { Response } from 'express'
import ExcelJS from 'exceljs'
import prisma from '../prisma'
import { getUserPermission, isCurrentMonth } from '../utils/permissions'
import { createAuditLog } from '../utils/audit'
import { AuthRequest } from '../middleware/auth'

const KONECTA_ORANGE = 'FFFF6600'
const HEADER_FONT_COLOR = 'FFFFFFFF'

async function buildWorkbook(agentes: any[], sheetName: string): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook()
  const sheet = workbook.addWorksheet(sheetName)

  sheet.columns = [
    { header: 'DNI', key: 'dni', width: 15 },
    { header: 'USUARIO', key: 'usuario', width: 18 },
    { header: 'NOMBRE', key: 'nombre', width: 30 },
    { header: 'SUPERIOR', key: 'superior', width: 25 },
    { header: 'SEGMENTO', key: 'segmento', width: 20 },
    { header: 'HORARIOS', key: 'horarios', width: 15 },
    { header: 'ESTADO', key: 'estado', width: 12 },
    { header: 'CONTRATO', key: 'contrato', width: 15 },
    { header: 'SITIO', key: 'sitio', width: 15 },
    { header: 'MODALIDAD', key: 'modalidad', width: 15 },
    { header: 'JEFE', key: 'jefe', width: 25 },
    { header: 'SERVICIO', key: 'servicio', width: 22 },
    { header: 'PRESENTE', key: 'presente', width: 12 },
  ]

  const headerRow = sheet.getRow(1)
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: KONECTA_ORANGE } }
    cell.font = { bold: true, color: { argb: HEADER_FONT_COLOR } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
  })
  headerRow.height = 24

  for (const a of agentes) {
    sheet.addRow({
      dni: a.dni,
      usuario: a.usuario,
      nombre: a.nombre,
      superior: a.superior || '',
      segmento: a.segmento || '',
      horarios: a.horarios || '',
      estado: a.estado || '',
      contrato: a.contrato || '',
      sitio: a.sitio || '',
      modalidad: a.modalidad || '',
      jefe: a.jefe || '',
      servicio: a.servicio?.nombre || '',
      presente: a.presente_en_nomina !== false ? 'Sí' : 'No',
    })
  }

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber > 1 && rowNumber % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F5' } }
      })
    }
  })

  return workbook
}

export const exportNomina = async (req: AuthRequest, res: Response) => {
  try {
    const nominaId = parseInt(req.params.nominaId)
    const nomina = await prisma.nominaMensual.findUnique({
      where: { id: nominaId },
      include: { servicio: true },
    })
    if (!nomina) return res.status(404).json({ error: 'Nómina no encontrada' })

    const adminUser = req.user?.rol === 'ADMINISTRADOR'
    const currentMonth = isCurrentMonth(nomina.mes, nomina.anio)

    if (!adminUser) {
      const permiso = await getUserPermission(req.user!.userId, nomina.servicio_id)
      if (!permiso?.puede_ver) return res.status(403).json({ error: 'Sin permiso' })
      if (!currentMonth && !permiso.puede_exportar_nominas_historicas) {
        return res.status(403).json({ error: 'Sin permiso para exportar nóminas históricas' })
      }
      if (currentMonth && !permiso.puede_exportar) {
        return res.status(403).json({ error: 'Sin permiso para exportar' })
      }
    }

    const snapshots = await prisma.agenteNominaMensual.findMany({
      where: { nomina_mensual_id: nominaId },
      include: { servicio: true },
      orderBy: { nombre: 'asc' },
    })

    // Aplicar cambios de contrato activos durante el período de la nómina
    const firstOfMonth = new Date(nomina.anio, nomina.mes - 1, 1)
    const lastOfMonth = new Date(nomina.anio, nomina.mes, 0, 23, 59, 59)
    const prismaAny = prisma as any
    const cambiosContrato = await prismaAny.cambioContrato.findMany({
      where: {
        servicio_id: nomina.servicio_id,
        OR: [
          { tipo: 'DEFINITIVO', fecha_desde: { lte: lastOfMonth } },
          { tipo: 'TEMPORAL', fecha_desde: { lte: lastOfMonth }, fecha_hasta: { gte: firstOfMonth } },
        ],
      },
      orderBy: { fecha_desde: 'desc' },
    })
    const contratoMap = new Map<number, string>()
    for (const c of cambiosContrato) {
      if (!contratoMap.has(c.agente_id)) contratoMap.set(c.agente_id, c.contrato_nuevo)
    }
    const snapshotsExport = contratoMap.size > 0
      ? snapshots.map((s) => ({ ...s, contrato: contratoMap.get(s.agente_id) ?? s.contrato }))
      : snapshots

    const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
    const sheetName = `${nomina.servicio.nombre} ${meses[nomina.mes - 1]} ${nomina.anio}`

    const workbook = await buildWorkbook(snapshotsExport, sheetName)

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'EXPORTAR_NOMINA',
      entidad: 'NominaMensual',
      entidad_id: String(nominaId),
      servicio_id: nomina.servicio_id,
      nomina_mensual_id: nominaId,
    })

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="nomina_${nomina.servicio.nombre.replace(/\s+/g, '_')}_${nomina.mes}_${nomina.anio}.xlsx"`)

    await workbook.xlsx.write(res)
    return res.end()
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al exportar' })
  }
}
