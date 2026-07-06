import { Request, Response, NextFunction } from 'express'
import { verifyToken, JWTPayload } from '../utils/jwt'
import prisma from '../prisma'

export interface AuthRequest extends Request {
  user?: JWTPayload
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' })
  }

  const token = authHeader.split(' ')[1]
  try {
    const payload = verifyToken(token)

    // Verifica que el usuario siga activo en BD (captura desactivaciones sin esperar expiración del token)
    const user = await prisma.usuario.findUnique({
      where: { id: payload.userId },
      select: { activo: true },
    })
    if (!user?.activo) {
      return res.status(401).json({ error: 'Usuario inactivo o no encontrado' })
    }

    req.user = payload
    return next()
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' })
  }
}

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.rol !== 'ADMINISTRADOR') {
    return res.status(403).json({ error: 'Requiere rol de administrador' })
  }
  return next()
}

// Permite solo a los roles indicados
export const requireRole = (...roles: string[]) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'Su rol no tiene acceso a este recurso' })
    }
    return next()
  }

// Bloquea a los roles indicados, deja pasar al resto
export const blockRole = (...roles: string[]) =>
  (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user && roles.includes(req.user.rol)) {
      return res.status(403).json({ error: 'Su rol no tiene acceso a este módulo' })
    }
    return next()
  }
