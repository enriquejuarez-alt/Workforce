import { Response } from 'express'
import nodemailer from 'nodemailer'
import fs from 'fs'
import { AuthRequest } from '../middleware/auth'

const DESTINATARIOS = [
  'enrique.juarez@konecta.com',
  'joaquin.ballesteros@konecta.com',
]

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.office365.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { ciphers: 'SSLv3' },
  })
}

export const enviarReporte = async (req: AuthRequest, res: Response) => {
  try {
    const { asunto, descripcion, categoria } = req.body

    if (!asunto || !descripcion) {
      return res.status(400).json({ error: 'Asunto y descripción son requeridos' })
    }

    const usuario = req.user
    const fechaHora = new Date().toLocaleString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' })

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px;">
        <div style="background: #0054A6; padding: 20px; border-radius: 8px 8px 0 0;">
          <h2 style="color: white; margin: 0;">Reporte de soporte — Proyecto Walt</h2>
        </div>
        <div style="background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 8px 8px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px; font-weight: bold; width: 140px; color: #555;">Categoría</td>
              <td style="padding: 8px;">${categoria || 'Sin categoría'}</td>
            </tr>
            <tr style="background: #fff;">
              <td style="padding: 8px; font-weight: bold; color: #555;">Asunto</td>
              <td style="padding: 8px;">${asunto}</td>
            </tr>
            <tr>
              <td style="padding: 8px; font-weight: bold; color: #555;">Usuario</td>
              <td style="padding: 8px;">${usuario?.email || '—'} (ID: ${usuario?.userId || '—'})</td>
            </tr>
            <tr style="background: #fff;">
              <td style="padding: 8px; font-weight: bold; color: #555;">Fecha</td>
              <td style="padding: 8px;">${fechaHora}</td>
            </tr>
          </table>
          <div style="margin-top: 16px; padding: 12px; background: white; border-radius: 6px; border: 1px solid #e5e7eb;">
            <p style="font-weight: bold; color: #555; margin: 0 0 8px;">Descripción</p>
            <p style="margin: 0; white-space: pre-wrap; color: #333;">${descripcion}</p>
          </div>
        </div>
      </div>
    `

    const attachments: any[] = []
    if (req.file) {
      attachments.push({
        filename: req.file.originalname,
        path: req.file.path,
      })
    }

    const transport = createTransport()

    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: DESTINATARIOS.join(', '),
      subject: `[Soporte] ${categoria ? `[${categoria}] ` : ''}${asunto}`,
      html: htmlBody,
      attachments,
    })

    if (req.file) fs.unlinkSync(req.file.path)

    return res.json({ ok: true, message: 'Reporte enviado correctamente' })
  } catch (err) {
    console.error('Error al enviar reporte:', err)
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
    return res.status(500).json({ error: 'Error al enviar el reporte. Verificá la configuración de email.' })
  }
}
