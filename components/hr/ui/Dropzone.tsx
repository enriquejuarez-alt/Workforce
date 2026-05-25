"use client"

import { useRef, useState, DragEvent } from 'react'
import { Upload, FileSpreadsheet, X } from 'lucide-react'

interface DropzoneProps {
  onFile: (file: File) => void
  accept?: string
  maxSize?: number
  file?: File | null
  onClear?: () => void
  disabled?: boolean
}

export default function Dropzone({
  onFile, accept = '.xlsx,.xls', maxSize = 10 * 1024 * 1024,
  file, onClear, disabled = false,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')

  const handleFile = (f: File) => {
    setError('')
    if (maxSize && f.size > maxSize) {
      setError(`El archivo supera el tamaño máximo (${Math.round(maxSize / 1024 / 1024)}MB)`)
      return
    }
    onFile(f)
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  if (file) {
    return (
      <div className="border-2 border-green-300 bg-green-50 rounded-xl p-6 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
          <FileSpreadsheet size={24} className="text-green-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate">{file.name}</p>
          <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</p>
        </div>
        {onClear && (
          <button onClick={onClear} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
            <X size={16} />
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      <div
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          dragging
            ? 'border-konecta bg-blue-50'
            : 'border-gray-300 hover:border-konecta hover:bg-blue-50/30'
        } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <Upload size={24} className="text-gray-400" />
        </div>
        <p className="text-sm font-semibold text-gray-700 mb-1">
          Arrastrá un archivo o hacé clic para seleccionar
        </p>
        <p className="text-xs text-gray-400">Archivos Excel (.xlsx, .xls) hasta 10MB</p>
        <input ref={inputRef} type="file" accept={accept} className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}
