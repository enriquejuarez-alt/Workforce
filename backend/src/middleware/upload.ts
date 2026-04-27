import multer from 'multer'
import path from 'path'
import fs from 'fs'

const uploadDir = process.env.UPLOADS_DIR || './uploads'
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9)
    cb(null, uniqueSuffix + path.extname(file.originalname))
  },
})

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['.xlsx', '.xls']
  const ext = path.extname(file.originalname).toLowerCase()
  if (allowed.includes(ext)) {
    cb(null, true)
  } else {
    cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'))
  }
}

export const uploadExcel = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
})
