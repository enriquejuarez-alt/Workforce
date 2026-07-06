import jwt from 'jsonwebtoken'

const SECRET = process.env.JWT_SECRET
if (!SECRET) throw new Error('JWT_SECRET no está definido — revisar variables de entorno')

const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h'

export interface JWTPayload {
  userId: number
  email: string
  rol: string
  servicioId: number | null
}

export const signToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN as any })
}

export const verifyToken = (token: string): JWTPayload => {
  return jwt.verify(token, SECRET) as JWTPayload
}
