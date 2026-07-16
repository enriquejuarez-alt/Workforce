import { Response } from 'express'
import fs from 'fs'
import readline from 'readline'
import { v4 as uuidv4 } from 'uuid'
import prisma from '../prisma'
import { createAuditLog } from '../utils/audit'
import { AuthRequest } from '../middleware/auth'

// Mapeo del "area_nombre" del archivo historico (agrupador intermedio del
// sistema origen, 12 valores) a las filas reales de Servicio en esta base
// (hoy solo 5, y en la practica casi todo cae bajo "Soporte Tecnico").
const AREA_A_SERVICIO: Record<string, string> = {
  'SOPORTE TECNICO': 'Soporte Técnico',
  MOVIL: 'Soporte Técnico',
  HOGAR: 'Soporte Técnico',
  SMB: 'Soporte Técnico',
  'CORPORATIVO B2B': 'Soporte Técnico',
  'EXPERIENCIA Y ENTRENAMIENTO': 'Soporte Técnico',
  VAM: 'Soporte Técnico',
  'PERSONAL PAY': 'Soporte Técnico',
  'WORKFORCE MANAGEMENT & REPORTING': 'Soporte Técnico',
  VENTAS: 'Ventas',
  'VENTAS IN': 'Ventas',
  RETENCION: 'Retención',
}

function normalizarTexto(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase()
}

function normalizarDni(s: string): string {
  return s.replace(/\D/g, '')
}

function parseFechaArchivo(s: string): Date {
  const [d, m, y] = s.split('/').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function mismoDia(a: Date, b: Date): boolean {
  return a.getUTCFullYear() === b.getUTCFullYear() && a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() === b.getUTCDate()
}

interface FilaDia {
  fecha: Date
  areaNombre: string
  servicioNombre: string
  superior: string
  sitio: string
  contrato: string
}

interface IntervaloServicio {
  servicioId: number | null
  segmento: string
  sitio: string
  contrato: string
  fechaDesde: Date
  fechaHasta: Date | null
}

interface IntervaloSuperior {
  superior: string
  fechaDesde: Date
}

interface PlanAgente {
  dni: string
  nombreArchivo: string
  agenteId: number | null
  nuevosServicios: IntervaloServicio[]
  nuevosSuperiores: IntervaloSuperior[]
  ultimoServicioId: number | null
  ultimoSegmento: string
  ultimoSitio: string
  ultimoContrato: string
  ultimoSuperior: string
}

interface Plan {
  archivoNombre: string
  fechaDesdeArchivo: Date
  fechaHastaArchivo: Date
  agentes: PlanAgente[]
  areasSinMapeo: Set<string>
}

const pendingImports = new Map<string, Plan>()

export const validarHistorialServicio = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No se proporcionó archivo' })

    const byDni = new Map<string, { nombre: string; rows: FilaDia[] }>()
    const areasSinMapeo = new Set<string>()

    const rl = readline.createInterface({ input: fs.createReadStream(req.file.path, { encoding: 'utf8' }), crlfDelay: Infinity })
    let isFirst = true
    for await (const line of rl) {
      if (isFirst) { isFirst = false; continue }
      if (!line.trim()) continue
      const cols = line.split(';')
      const fecha = cols[1]
      const nombre = cols[3]
      const documento = cols[4]
      const areaNombre = cols[10]
      const servicioNombre = cols[12]
      const superior = cols[24]
      const sitio = cols[20]
      const contrato = cols[17]
      if (!documento || !fecha) continue
      const dni = normalizarDni(documento)
      if (!dni) continue
      if (!byDni.has(dni)) byDni.set(dni, { nombre: nombre?.trim() || dni, rows: [] })
      byDni.get(dni)!.rows.push({
        fecha: parseFechaArchivo(fecha),
        areaNombre: (areaNombre ?? '').trim(),
        servicioNombre: (servicioNombre ?? '').trim(),
        superior: (superior ?? '').trim(),
        sitio: (sitio ?? '').trim(),
        contrato: (contrato ?? '').trim(),
      })
    }

    fs.unlinkSync(req.file.path)

    if (byDni.size === 0) {
      return res.status(400).json({ error: 'El archivo no contiene filas válidas (se esperaban columnas separadas por ";" con documento y fecha_maestro)' })
    }

    let fechaMin: Date | null = null
    let fechaMax: Date | null = null
    for (const { rows } of byDni.values()) {
      for (const r of rows) {
        if (!fechaMin || r.fecha < fechaMin) fechaMin = r.fecha
        if (!fechaMax || r.fecha > fechaMax) fechaMax = r.fecha
      }
    }

    const servicios = await prisma.servicio.findMany({ select: { id: true, nombre: true } })
    const servicioIdPorNombre = new Map(servicios.map((s) => [normalizarTexto(s.nombre), s.id]))

    function resolverServicioId(areaNombre: string): number | null {
      const destino = AREA_A_SERVICIO[normalizarTexto(areaNombre)]
      if (!destino) {
        if (areaNombre) areasSinMapeo.add(areaNombre)
        return null
      }
      return servicioIdPorNombre.get(normalizarTexto(destino)) ?? null
    }

    const agentesExistentes = await prisma.agente.findMany({
      select: { id: true, dni: true },
    })
    const agenteIdPorDni = new Map(agentesExistentes.map((a) => [normalizarDni(a.dni), a.id]))
    const agenteIdsExistentes = [...agenteIdPorDni.values()]

    const historialServicioExistente = await prisma.agenteServicioHistorial.findMany({
      where: { agente_id: { in: agenteIdsExistentes } },
      select: { agente_id: true, servicio_id: true, fecha_desde: true },
    })
    const historialSuperiorExistente = await prisma.agenteSuperiorHistorial.findMany({
      where: { agente_id: { in: agenteIdsExistentes } },
      select: { agente_id: true, superior_nuevo: true, fecha_efectiva: true },
    })
    const servicioHistPorAgente = new Map<number, typeof historialServicioExistente>()
    for (const h of historialServicioExistente) {
      if (!servicioHistPorAgente.has(h.agente_id)) servicioHistPorAgente.set(h.agente_id, [])
      servicioHistPorAgente.get(h.agente_id)!.push(h)
    }
    const superiorHistPorAgente = new Map<number, typeof historialSuperiorExistente>()
    for (const h of historialSuperiorExistente) {
      if (!superiorHistPorAgente.has(h.agente_id)) superiorHistPorAgente.set(h.agente_id, [])
      superiorHistPorAgente.get(h.agente_id)!.push(h)
    }

    const planAgentes: PlanAgente[] = []
    let agentesACrear = 0
    let transicionesServicioNuevas = 0
    let transicionesSuperiorNuevas = 0

    for (const [dni, { nombre, rows }] of byDni) {
      rows.sort((a, b) => a.fecha.getTime() - b.fecha.getTime())

      const intervalosServicio: IntervaloServicio[] = []
      let servicioActual: (IntervaloServicio & { key: string }) | null = null
      for (const r of rows) {
        const servicioId = resolverServicioId(r.areaNombre)
        const key = `${servicioId}|${r.servicioNombre}`
        if (!servicioActual || servicioActual.key !== key) {
          if (servicioActual) servicioActual.fechaHasta = r.fecha
          servicioActual = { servicioId, segmento: r.servicioNombre, sitio: r.sitio, contrato: r.contrato, fechaDesde: r.fecha, fechaHasta: null, key }
          intervalosServicio.push(servicioActual)
        }
      }

      const intervalosSuperior: IntervaloSuperior[] = []
      let superiorActual: string | null = null
      for (const r of rows) {
        if (superiorActual === null || superiorActual !== r.superior) {
          intervalosSuperior.push({ superior: r.superior, fechaDesde: r.fecha })
          superiorActual = r.superior
        }
      }

      const agenteId = agenteIdPorDni.get(dni) ?? null
      const nuevosServicios: IntervaloServicio[] = []
      const nuevosSuperiores: IntervaloSuperior[] = []

      if (agenteId !== null) {
        const historialExistente = servicioHistPorAgente.get(agenteId) ?? []
        for (const intervalo of intervalosServicio) {
          const yaExiste = historialExistente.some((h) => h.servicio_id === intervalo.servicioId && mismoDia(h.fecha_desde, intervalo.fechaDesde))
          if (!yaExiste) nuevosServicios.push(intervalo)
        }
        const historialSupExistente = superiorHistPorAgente.get(agenteId) ?? []
        for (const intervalo of intervalosSuperior) {
          const yaExiste = historialSupExistente.some((h) => (h.superior_nuevo ?? '') === intervalo.superior && mismoDia(h.fecha_efectiva, intervalo.fechaDesde))
          if (!yaExiste) nuevosSuperiores.push(intervalo)
        }
      } else {
        agentesACrear++
        nuevosServicios.push(...intervalosServicio)
        nuevosSuperiores.push(...intervalosSuperior)
      }

      transicionesServicioNuevas += nuevosServicios.length
      transicionesSuperiorNuevas += nuevosSuperiores.length

      const ultimo = rows[rows.length - 1]
      planAgentes.push({
        dni,
        nombreArchivo: nombre,
        agenteId,
        nuevosServicios,
        nuevosSuperiores,
        ultimoServicioId: resolverServicioId(ultimo.areaNombre),
        ultimoSegmento: ultimo.servicioNombre,
        ultimoSitio: ultimo.sitio,
        ultimoContrato: ultimo.contrato,
        ultimoSuperior: ultimo.superior,
      })
    }

    const token = uuidv4()
    pendingImports.set(token, {
      archivoNombre: req.file.originalname,
      fechaDesdeArchivo: fechaMin!,
      fechaHastaArchivo: fechaMax!,
      agentes: planAgentes,
      areasSinMapeo,
    })
    setTimeout(() => pendingImports.delete(token), 30 * 60 * 1000)

    return res.json({
      token,
      fecha_desde_archivo: fechaMin!.toISOString().substring(0, 10),
      fecha_hasta_archivo: fechaMax!.toISOString().substring(0, 10),
      agentes_en_archivo: byDni.size,
      agentes_ya_existentes: byDni.size - agentesACrear,
      agentes_a_crear: agentesACrear,
      transiciones_servicio_nuevas: transicionesServicioNuevas,
      transiciones_superior_nuevas: transicionesSuperiorNuevas,
      areas_sin_mapeo: [...areasSinMapeo],
      muestra_agentes_a_crear: planAgentes
        .filter((a) => a.agenteId === null)
        .slice(0, 20)
        .map((a) => ({ dni: a.dni, nombre: a.nombreArchivo })),
    })
  } catch (err) {
    console.error(err)
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
    return res.status(500).json({ error: 'Error al procesar el archivo' })
  }
}

export const confirmarHistorialServicio = async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.body
    const plan = pendingImports.get(token)
    if (!plan) {
      return res.status(404).json({ error: 'La vista previa expiró o ya fue confirmada. Volvé a subir el archivo.' })
    }

    let agentesCreados = 0
    let transicionesServicioCreadas = 0
    let transicionesSuperiorCreadas = 0

    for (const pa of plan.agentes) {
      if (pa.nuevosServicios.length === 0 && pa.nuevosSuperiores.length === 0 && pa.agenteId !== null) continue

      await prisma.$transaction(async (tx) => {
        let agenteId = pa.agenteId

        if (agenteId === null) {
          const creado = await tx.agente.create({
            data: {
              dni: pa.dni,
              usuario: `hist_${pa.dni}`,
              nombre: pa.nombreArchivo,
              servicio_id: pa.ultimoServicioId,
              segmento: pa.ultimoSegmento || null,
              sitio: pa.ultimoSitio || null,
              contrato: pa.ultimoContrato || null,
              superior: pa.ultimoSuperior || null,
              activo: true,
              presente_ultima_carga: false,
            },
          })
          agenteId = creado.id
          agentesCreados++
        }

        for (const intervalo of pa.nuevosServicios) {
          const vigente = await tx.agenteServicioHistorial.findFirst({ where: { agente_id: agenteId!, fecha_hasta: null } })
          if (vigente && vigente.fecha_desde < intervalo.fechaDesde) {
            await tx.agenteServicioHistorial.update({ where: { id: vigente.id }, data: { fecha_hasta: intervalo.fechaDesde } })
          }
          await tx.agenteServicioHistorial.create({
            data: {
              agente_id: agenteId!,
              servicio_id: intervalo.servicioId,
              segmento: intervalo.segmento || null,
              sitio: intervalo.sitio || null,
              contrato: intervalo.contrato || null,
              fecha_desde: intervalo.fechaDesde,
              fecha_hasta: intervalo.fechaHasta,
              motivo: `Importación histórico ${plan.archivoNombre}`,
              creado_por: req.user!.userId,
            },
          })
          transicionesServicioCreadas++
        }

        for (const intervalo of pa.nuevosSuperiores) {
          const anterior = await tx.agenteSuperiorHistorial.findFirst({
            where: { agente_id: agenteId!, fecha_efectiva: { lte: intervalo.fechaDesde } },
            orderBy: { fecha_efectiva: 'desc' },
          })
          await tx.agenteSuperiorHistorial.create({
            data: {
              agente_id: agenteId!,
              servicio_id: pa.ultimoServicioId,
              superior_anterior: anterior?.superior_nuevo ?? null,
              superior_nuevo: intervalo.superior || null,
              fecha_efectiva: intervalo.fechaDesde,
              motivo: `Importación histórico ${plan.archivoNombre}`,
              creado_por: req.user!.userId,
            },
          })
          transicionesSuperiorCreadas++
        }

        if (pa.agenteId !== null && pa.nuevosServicios.length > 0) {
          await tx.agente.update({
            where: { id: agenteId! },
            data: {
              servicio_id: pa.ultimoServicioId,
              segmento: pa.ultimoSegmento || undefined,
              superior: pa.ultimoSuperior || undefined,
            },
          })
        }
      })
    }

    const importacion = await prisma.historialServicioImportacion.create({
      data: {
        archivo_nombre: plan.archivoNombre,
        fecha_desde_archivo: plan.fechaDesdeArchivo,
        fecha_hasta_archivo: plan.fechaHastaArchivo,
        importado_por: req.user!.userId,
        agentes_en_archivo: plan.agentes.length,
        agentes_creados: agentesCreados,
        agentes_no_encontrados: 0,
        transiciones_servicio_creadas: transicionesServicioCreadas,
        transiciones_superior_creadas: transicionesSuperiorCreadas,
        areas_sin_mapeo: [...plan.areasSinMapeo],
      },
    })

    await createAuditLog({
      usuario_id: req.user!.userId,
      accion: 'IMPORTAR_HISTORIAL_SERVICIOS',
      entidad: 'HistorialServicioImportacion',
      entidad_id: String(importacion.id),
      valor_nuevo: `${plan.archivoNombre}: ${agentesCreados} agentes creados, ${transicionesServicioCreadas} transiciones de servicio, ${transicionesSuperiorCreadas} de superior`,
    })

    pendingImports.delete(token)

    return res.status(201).json(importacion)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al confirmar la importación' })
  }
}

export const listHistorialServicioImportaciones = async (req: AuthRequest, res: Response) => {
  try {
    const data = await prisma.historialServicioImportacion.findMany({
      include: { importador: { select: { id: true, nombre: true } } },
      orderBy: { fecha_importacion: 'desc' },
    })
    return res.json(data)
  } catch {
    return res.status(500).json({ error: 'Error al listar importaciones' })
  }
}
