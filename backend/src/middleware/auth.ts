import { Request, Response, NextFunction } from 'express'
import { verifyToken, JWTPayload } from '../utils/jwt'

export interface AuthRequest extends Request {
  user?: JWTPayload
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' })
  }

  const token = authHeader.split(' ')[1]
  try {
    const payload = verifyToken(token)
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
