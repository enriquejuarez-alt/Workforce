"use client";

import { useState, useRef } from 'react'
import { LifeBuoy, Send, Paperclip, X, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import Header from '@/components/hr/layout/Header'
import { soporteApi } from '@/lib/api'

const CATEGORIAS = ['Bug / Error', 'Problema de acceso', 'Dato incorrecto', 'Consulta', 'Otro']

export default function Soporte() {
  const [asunto, setAsunto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [categoria, setCategoria] = useState('')
  const [archivo, setArchivo] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) {
      toast.error('La imagen no puede superar los 5 MB')
      return
    }
    setArchivo(f)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!asunto.trim() || !descripcion.trim()) {
      toast.error('Completá el asunto y la descripción')
      return
    }

    setEnviando(true)
    try {
      const form = new FormData()
      form.append('asunto', asunto.trim())
      form.append('descripcion', descripcion.trim())
      if (categoria) form.append('categoria', categoria)
      if (archivo) form.append('captura', archivo)

      await soporteApi.enviarReporte(form)
      setEnviado(true)
      toast.success('Reporte enviado')
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al enviar el reporte')
    } finally {
      setEnviando(false)
    }
  }

  const handleNuevo = () => {
    setAsunto('')
    setDescripcion('')
    setCategoria('')
    setArchivo(null)
    setEnviado(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Soporte"
        subtitle="Reportá un problema o consulta al equipo de administración"
      />

      <div className="flex-1 overflow-y-auto p-6 flex justify-center">
        <div className="w-full max-w-xl">
          {enviado ? (
            <div className="card p-10 flex flex-col items-center gap-4 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-800">Reporte enviado</p>
                <p className="text-sm text-gray-500 mt-1">
                  El equipo de administración recibió tu reporte y lo revisará a la brevedad.
                </p>
              </div>
              <button className="btn-primary mt-2" onClick={handleNuevo}>
                Enviar otro reporte
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="card p-6 space-y-5">
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                <div className="w-10 h-10 rounded-lg bg-konecta/10 flex items-center justify-center">
                  <LifeBuoy size={20} className="text-konecta" />
                </div>
                <div>
                  <p className="font-bold text-gray-800">Nuevo ticket de soporte</p>
                  <p className="text-xs text-gray-500">Se enviará a enrique.juarez@konecta.com y joaquin.ballesteros@konecta.com</p>
                </div>
              </div>

              <div>
                <label className="label-base">Categoría</label>
                <select
                  className="input-base"
                  value={categoria}
                  onChange={(e) => setCategoria(e.target.value)}
                >
                  <option value="">Seleccioná una categoría (opcional)</option>
                  {CATEGORIAS.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label-base">Asunto <span className="text-red-500">*</span></label>
                <input
                  className="input-base"
                  placeholder="Describí brevemente el problema..."
                  value={asunto}
                  onChange={(e) => setAsunto(e.target.value)}
                  maxLength={150}
                />
              </div>

              <div>
                <label className="label-base">Descripción <span className="text-red-500">*</span></label>
                <textarea
                  className="input-base min-h-[120px] resize-y"
                  placeholder="Describí con detalle qué pasó, qué intentabas hacer y qué error viste..."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  maxLength={2000}
                />
                <p className="text-xs text-gray-400 text-right mt-1">{descripcion.length}/2000</p>
              </div>

              <div>
                <label className="label-base">Captura de pantalla (opcional)</label>
                <div
                  className="border-2 border-dashed border-gray-200 rounded-lg p-4 text-center cursor-pointer hover:border-konecta/50 transition-colors"
                  onClick={() => fileRef.current?.click()}
                >
                  {archivo ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Paperclip size={14} className="text-konecta" />
                        <span className="truncate max-w-xs">{archivo.name}</span>
                        <span className="text-xs text-gray-400">({(archivo.size / 1024).toFixed(0)} KB)</span>
                      </div>
                      <button
                        type="button"
                        className="text-gray-400 hover:text-red-500 p-1"
                        onClick={(e) => { e.stopPropagation(); setArchivo(null); if (fileRef.current) fileRef.current.value = '' }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400 space-y-1">
                      <Paperclip size={18} className="mx-auto text-gray-300" />
                      <p>Clic para adjuntar imagen o PDF</p>
                      <p className="text-xs">PNG, JPG, GIF, PDF — máx. 5 MB</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.gif,.webp,.pdf"
                  className="hidden"
                  onChange={handleFile}
                />
              </div>

              <button
                type="submit"
                className="btn-primary w-full"
                disabled={enviando}
              >
                <Send size={14} />
                {enviando ? 'Enviando...' : 'Enviar reporte'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
