import cron from 'node-cron'
import nodemailer from 'nodemailer'
import prisma from '../prisma'
import { syncAgenteActivo } from '../controllers/licencias'

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

async function checkLicenciasVencidas() {
  const hoy = new Date()
  const inicioDia = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate()))
  const finDia = new Date(inicioDia.getTime() + 86400000 - 1)

  const licenciasVencidas = await prisma.licencia.findMany({
    where: {
      fecha_hasta: { gte: inicioDia, lte: finDia },
    },
    include: {
      agente: { include: { servicio: true } },
    },
  })

  for (const licencia of licenciasVencidas) {
    await syncAgenteActivo(licencia.agente_id)
  }

  if (licenciasVencidas.length === 0) return

  const admins = await prisma.usuario.findMany({
    where: { rol: 'ADMINISTRADOR', activo: true },
    select: { email: true },
  })

  if (!admins.length || !process.env.SMTP_USER) return

  const fechaStr = hoy.toLocaleDateString('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const rows = licenciasVencidas
    .map((l) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${l.agente.nombre}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${l.agente.servicio?.nombre ?? '—'}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${new Date(l.fecha_hasta).toLocaleDateString('es-AR')}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${l.motivo ?? '—'}</td>
      </tr>`)
    .join('')

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:700px;">
      <div style="background:#0054A6;padding:20px;border-radius:8px 8px 0 0;">
        <h2 style="color:white;margin:0;">Licencias con vencimiento hoy — ${fechaStr}</h2>
      </div>
      <div style="background:#f9f9f9;padding:20px;border:1px solid #ddd;border-radius:0 0 8px 8px;">
        <p style="color:#555;margin:0 0 16px;">Los siguientes agentes tienen licencias que vencen hoy. Por favor, verificá si se reincorporan o si la licencia debe extenderse.</p>
        <table style="width:100%;border-collapse:collapse;background:white;border-radius:6px;overflow:hidden;border:1px solid #e5e7eb;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:10px 8px;text-align:left;font-size:13px;color:#374151;">Agente</th>
              <th style="padding:10px 8px;text-align:left;font-size:13px;color:#374151;">Servicio</th>
              <th style="padding:10px 8px;text-align:left;font-size:13px;color:#374151;">Vence</th>
              <th style="padding:10px 8px;text-align:left;font-size:13px;color:#374151;">Motivo</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`

  const transport = createTransport()
  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: admins.map((a) => a.email).join(', '),
    subject: `[Walt] Licencias vencidas hoy — ${fechaStr}`,
    html,
  })

  console.log(`[Cron] Notificación enviada: ${licenciasVencidas.length} licencias vencidas hoy`)
}

export function initLicenciasVencimientoJob() {
  // Runs daily at 08:00 ART (UTC-3 → 11:00 UTC)
  cron.schedule('0 11 * * *', () => {
    checkLicenciasVencidas().catch((err) => {
      console.error('[Cron] Error en checkLicenciasVencidas:', err)
    })
  }, { timezone: 'America/Argentina/Buenos_Aires' })

  console.log('[Cron] licenciasVencimiento scheduled at 08:00 ART')
}
