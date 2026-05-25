import { Response } from 'express'
import prisma from '../prisma'
import { AuthRequest } from '../middleware/auth'

const CONFIGURABLE_ROLES = ['WORKFORCE', 'USUARIO', 'LIDER', 'CAPACITADOR'] as const

const DEFAULT_PATHS: Record<string, string[]> = {
  WORKFORCE: [
    '/dashboard', '/nomina', '/licencias', '/calendario', '/cambios',
    '/bajas', '/capacitaciones', '/vacaciones', '/comparacion', '/ausentismo',
    '/historial-agente', '/planificacion', '/programacion', '/distribucion', '/soporte',
  ],
  USUARIO: [
    '/dashboard', '/nomina', '/licencias', '/calendario', '/cambios',
    '/bajas', '/capacitaciones', '/vacaciones', '/comparacion', '/ausentismo',
    '/historial-agente', '/planificacion', '/programacion', '/distribucion', '/soporte',
  ],
  LIDER: [
    '/dashboard', '/nomina', '/licencias', '/calendario', '/bajas', '/ausentismo', '/soporte',
  ],
  CAPACITADOR: [
    '/capacitaciones', '/soporte',
  ],
}

export const getRolConfig = async (_req: AuthRequest, res: Response) => {
  try {
    const rows = await prisma.configuracionRolPath.findMany()
    const result: Record<string, string[]> = { ...DEFAULT_PATHS }
    for (const row of rows) {
      result[row.rol] = row.paths as string[]
    }
    return res.json(result)
  } catch (err) {
    console.error(err)
    return res.json(DEFAULT_PATHS)
  }
}

export const updateRolConfig = async (req: AuthRequest, res: Response) => {
  try {
    const config = req.body as Record<string, string[]>
    for (const rol of CONFIGURABLE_ROLES) {
      if (!Array.isArray(config[rol])) continue
      await prisma.configuracionRolPath.upsert({
        where: { rol },
        update: { paths: config[rol] },
        create: { rol, paths: config[rol] },
      })
    }
    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al guardar configuración' })
  }
}

export const resetRolConfig = async (req: AuthRequest, res: Response) => {
  try {
    const { rol } = req.params
    if (!CONFIGURABLE_ROLES.includes(rol as any)) {
      return res.status(400).json({ error: 'Rol inválido' })
    }
    await prisma.configuracionRolPath.deleteMany({ where: { rol } })
    return res.json({ ok: true, defaults: DEFAULT_PATHS[rol] })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error al resetear configuración' })
  }
}
