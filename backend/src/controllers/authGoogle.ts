import { Request, Response } from 'express'
import crypto from 'crypto'
import prisma from '../prisma'
import { signToken } from '../utils/jwt'
import { createAuditLog } from '../utils/audit'

const CLIENT_ID       = process.env.GOOGLE_CLIENT_ID     ?? ''
const CLIENT_SECRET   = process.env.GOOGLE_CLIENT_SECRET ?? ''
const CALLBACK_URL    = process.env.GOOGLE_CALLBACK_URL  ?? 'http://localhost:3001/api/auth/google/callback'
const FRONTEND_URL    = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '')

// Códigos de un solo uso: evita exponer el JWT en la URL
// Expiración: 30 segundos, un solo uso
interface PendingCode { token: string; expires: number }
const pendingCodes = new Map<string, PendingCode>()

// Limpieza periódica de códigos expirados
setInterval(() => {
  const now = Date.now()
  for (const [k, v] of pendingCodes) {
    if (v.expires < now) pendingCodes.delete(k)
  }
}, 60_000)

export function googleAuth(_req: Request, res: Response) {
  if (!CLIENT_ID) {
    return res.status(503).json({ error: 'Google OAuth no configurado (GOOGLE_CLIENT_ID faltante)' })
  }

  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  CALLBACK_URL,
    response_type: 'code',
    scope:         'openid email profile',
    access_type:   'online',
    prompt:        'select_account',
  })
  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}

export async function googleCallback(req: Request, res: Response) {
  const { code, error: oauthError } = req.query as Record<string, string>

  if (oauthError || !code) {
    return res.redirect(`${FRONTEND_URL}/login?error=google_cancelled`)
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri:  CALLBACK_URL,
        grant_type:    'authorization_code',
      }),
    })
    const tokenData = await tokenRes.json() as { access_token?: string; error?: string }

    if (!tokenData.access_token) {
      console.error('[Google OAuth] token exchange failed:', tokenData.error)
      return res.redirect(`${FRONTEND_URL}/login?error=google_token_failed`)
    }

    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const googleUser = await userInfoRes.json() as { id: string; email?: string; name?: string }

    if (!googleUser.email) {
      return res.redirect(`${FRONTEND_URL}/login?error=google_no_email`)
    }

    const user = await prisma.usuario.findUnique({ where: { email: googleUser.email } })

    if (!user) {
      return res.redirect(`${FRONTEND_URL}/login?error=user_not_found`)
    }

    if (!user.activo) {
      return res.redirect(`${FRONTEND_URL}/login?error=user_inactive`)
    }

    await prisma.usuario.update({
      where: { id: user.id },
      data:  { ultimo_acceso: new Date() },
    })

    const jwt = signToken({
      userId:    user.id,
      email:     user.email,
      rol:       user.rol,
      // @ts-ignore — servicio_id exists at runtime
      servicioId: user.servicio_id ?? null,
    })

    await createAuditLog({
      usuario_id: user.id,
      accion:     'LOGIN_GOOGLE',
      entidad:    'Usuario',
      entidad_id: String(user.id),
      ip:         req.ip,
      user_agent: req.headers['user-agent'],
    })

    // Generar código efímero (30s, un solo uso) — el JWT nunca aparece en la URL
    const onetimeCode = crypto.randomBytes(32).toString('hex')
    pendingCodes.set(onetimeCode, { token: jwt, expires: Date.now() + 30_000 })

    return res.redirect(`${FRONTEND_URL}/auth/callback?code=${onetimeCode}`)
  } catch (err) {
    console.error('[Google OAuth] callback error:', err)
    return res.redirect(`${FRONTEND_URL}/login?error=google_server_error`)
  }
}

// POST /api/auth/exchange — canjea el código efímero por el JWT real
export function exchangeCode(req: Request, res: Response) {
  const { code } = req.body as { code?: string }
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Código requerido' })
  }

  const entry = pendingCodes.get(code)
  if (!entry || entry.expires < Date.now()) {
    pendingCodes.delete(code)
    return res.status(400).json({ error: 'Código inválido o expirado' })
  }

  pendingCodes.delete(code) // un solo uso
  return res.json({ token: entry.token })
}
