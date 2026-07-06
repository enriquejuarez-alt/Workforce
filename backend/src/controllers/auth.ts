import { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import { z } from 'zod'
import prisma from '../prisma'
import { signToken } from '../utils/jwt'
import { createAuditLog } from '../utils/audit'
import { AuthRequest } from '../middleware/auth'

const loginSchema = z.object({
  email:    z.string({ error: 'El email es requerido' }).email('Email inválido').max(254),
  password: z.string({ error: 'La contraseña es requerida' }).min(1, 'La contraseña es requerida').max(128),
})

export const login = async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0].message })
    }
    const { email, password } = parsed.data

    const user = await prisma.usuario.findUnique({ where: { email } })
    if (!user || !user.activo) {
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }

    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return res.status(401).json({ error: 'Credenciales inválidas' })
    }

    await prisma.usuario.update({
      where: { id: user.id },
      data: { ultimo_acceso: new Date() },
    })

    const token = signToken({ userId: user.id, email: user.email, rol: user.rol, servicioId: user.servicio_id ?? null })

    await createAuditLog({
      usuario_id: user.id,
      accion: 'LOGIN',
      entidad: 'Usuario',
      entidad_id: String(user.id),
      ip: req.ip,
      user_agent: req.headers['user-agent'],
    })

    const { password_hash, ...safe } = user
    return res.json({ token, user: safe })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.usuario.findUnique({
      where: { id: req.user!.userId },
      include: {
        permisos: {
          include: { servicio: true },
          where: { servicio: { activo: true } },
        },
      },
    })

    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' })
    const { password_hash, ...safe } = user
    return res.json(safe)
  } catch (err) {
    return res.status(500).json({ error: 'Error interno del servidor' })
  }
}

export const logout = async (req: AuthRequest, res: Response) => {
  await createAuditLog({
    usuario_id: req.user?.userId,
    accion: 'LOGOUT',
    entidad: 'Usuario',
    entidad_id: String(req.user?.userId),
    ip: req.ip,
    user_agent: req.headers['user-agent'],
  })
  return res.json({ message: 'Sesión cerrada' })
}
