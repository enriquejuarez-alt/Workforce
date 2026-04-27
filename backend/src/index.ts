import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import routes from './routes'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || /^http:\/\/localhost:\d+$/.test(origin)) {
      callback(null, true)
    } else {
      callback(new Error('CORS no permitido'))
    }
  },
  credentials: true,
}))

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

app.use('/uploads', express.static(path.join(__dirname, '..', process.env.UPLOADS_DIR || 'uploads')))
app.use('/api', routes)

app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack)
  res.status(500).json({ error: err.message || 'Error interno del servidor' })
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`)
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`)
})

export default app
