import { Request, Response } from 'express'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import prisma from '../prisma'
import { signToken } from '../utils/jwt'
import { createAuditLog } from '../utils/audit'

const CLIENT_ID       = process.env.GOOGLE_CLIENT_ID     ?? ''
const CLIENT_SECRET   = process.env.GOOGLE_CLIENT_SECRET ?? ''
const CALLBACK_URL    = process.env.GOOGLE_CALLBACK_URL  ?? 'http://localhost:3001/api/auth/google/callback'
const FRONTEND_URL    = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '')

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
    // 1 — Intercambiar code por access_token
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

    // 2 — Obtener datos del usuario de Google
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    const googleUser = await userInfoRes.json() as {
      id: string; email?: string; name?: string
    }

    if (!googleUser.email) {
      return res.redirect(`${FRONTEND_URL}/login?error=google_no_email`)
    }

    // 3 — Buscar o crear usuario
    let user = await prisma.usuario.findUnique({ where: { email: googleUser.email } })

    if (!user) {
      const randomHash = await bcrypt.hash(crypto.randomUUID(), 10)
      user = await prisma.usuario.create({
        data: {
          nombre:        googleUser.name ?? googleUser.email.split('@')[0],
          email:         googleUser.email,
          password_hash: randomHash,
          rol:           'USUARIO',
          activo:        true,
        },
      })
    } else if (!user.activo) {
      return res.redirect(`${FRONTEND_URL}/login?error=user_inactive`)
    }

    await prisma.usuario.update({
      where: { id: user.id },
      data:  { ultimo_acceso: new Date() },
    })

    const token = signToken({
      userId:    user.id,
      email:     user.email,
      rol:       user.rol,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore — servicio_id exists at runtime but Prisma types are out of sync
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

    return res.redirect(`${FRONTEND_URL}/auth/callback?token=${encodeURIComponent(token)}`)
  } catch (err) {
    console.error('[Google OAuth] callback error:', err)
    return res.redirect(`${FRONTEND_URL}/login?error=google_server_error`)
  }
}
