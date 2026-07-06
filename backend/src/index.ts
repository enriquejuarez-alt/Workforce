import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import path from 'path'
import routes from './routes'
import { initLicenciasVencimientoJob } from './jobs/licenciasVencimiento'

const app = express()
const PORT = process.env.PORT || 3001

const allowedOrigins: (string | RegExp)[] = [/^http:\/\/localhost:\d+$/]
if (process.env.FRONTEND_URL) allowedOrigins.push(process.env.FRONTEND_URL)

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true)
    const ok = allowedOrigins.some((o) =>
      typeof o === 'string' ? o === origin : o.test(origin)
    )
    ok ? callback(null, true) : callback(new Error('CORS no permitido'))
  },
  credentials: true,
}))

app.use(express.json({ limit: '500kb' }))
app.use(express.urlencoded({ extended: true, limit: '500kb' }))

app.use('/uploads', express.static(path.join(__dirname, '..', process.env.UPLOADS_DIR || 'uploads')))
app.use('/api', routes)

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack)
  const msg = process.env.NODE_ENV === 'production' ? 'Error interno del servidor' : (err.message || 'Error interno del servidor')
  res.status(err.status ?? 500).json({ error: msg })
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`)
  initLicenciasVencimientoJob()
})

export default app
