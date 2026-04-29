import { useState, useRef } from 'react'
import { LifeBuoy, X, Send, Paperclip, CheckCircle, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { soporteApi } from '../../lib/api'

const CATEGORIAS = ['Bug / Error', 'Problema de acceso', 'Dato incorrecto', 'Consulta', 'Otro']

export default function SoporteWidget() {
  const [open, setOpen] = useState(false)
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
    if (f.size > 5 * 1024 * 1024) { toast.error('Máx. 5 MB'); return }
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
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al enviar el reporte')
    } finally {
      setEnviando(false)
    }
  }

  const handleClose = () => {
    setOpen(false)
    setTimeout(() => {
      setAsunto(''); setDescripcion(''); setCategoria('')
      setArchivo(null); setEnviado(false)
      if (fileRef.current) fileRef.current.value = ''
    }, 300)
  }

  return (
    <>
      {/* Panel flotante */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-96 max-h-[85vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden animate-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="bg-konecta px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <LifeBuoy size={18} className="text-white" />
              <div>
                <p className="text-white font-bold text-sm">Soporte</p>
                <p className="text-white/70 text-xs">Reportá un problema al equipo</p>
              </div>
            </div>
            <button onClick={handleClose} className="text-white/70 hover:text-white p-1 rounded transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4">
            {enviado ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle size={28} className="text-green-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-800">Reporte enviado</p>
                  <p className="text-xs text-gray-500 mt-1">El equipo lo revisará a la brevedad.</p>
                </div>
                <button
                  className="btn-primary text-xs mt-2"
                  onClick={() => {
                    setAsunto(''); setDescripcion(''); setCategoria('')
                    setArchivo(null); setEnviado(false)
                    if (fileRef.current) fileRef.current.value = ''
                  }}
                >
                  Enviar otro reporte
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="label-base text-xs">Categoría</label>
                  <select className="input-base text-xs" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                    <option value="">Sin categoría</option>
                    {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="label-base text-xs">Asunto <span className="text-red-500">*</span></label>
                  <input
                    className="input-base text-xs"
                    placeholder="Describí brevemente el problema..."
                    value={asunto}
                    onChange={(e) => setAsunto(e.target.value)}
                    maxLength={150}
                  />
                </div>

                <div>
                  <label className="label-base text-xs">Descripción <span className="text-red-500">*</span></label>
                  <textarea
                    className="input-base text-xs min-h-[90px] resize-none"
                    placeholder="¿Qué pasó? ¿Qué estabas haciendo?"
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    maxLength={2000}
                  />
                </div>

                {/* Adjunto */}
                <div>
                  <label className="label-base text-xs">Captura (opcional)</label>
                  <div
                    className="border border-dashed border-gray-300 rounded-lg p-3 text-center cursor-pointer hover:border-konecta/50 transition-colors"
                    onClick={() => fileRef.current?.click()}
                  >
                    {archivo ? (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600 truncate max-w-[200px] flex items-center gap-1">
                          <Paperclip size={11} className="text-konecta shrink-0" /> {archivo.name}
                        </span>
                        <button
                          type="button"
                          className="text-gray-400 hover:text-red-500 p-1"
                          onClick={(e) => { e.stopPropagation(); setArchivo(null); if (fileRef.current) fileRef.current.value = '' }}
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 flex items-center justify-center gap-1">
                        <Paperclip size={12} /> Adjuntar imagen o PDF
                      </p>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.gif,.webp,.pdf" className="hidden" onChange={handleFile} />
                </div>

                <button type="submit" className="btn-primary w-full text-xs" disabled={enviando}>
                  <Send size={12} />
                  {enviando ? 'Enviando...' : 'Enviar reporte'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Botón flotante */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-konecta shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-150 flex items-center justify-center"
        title="Soporte"
      >
        {open
          ? <ChevronDown size={22} className="text-white" />
          : <LifeBuoy size={22} className="text-white" />
        }
      </button>
    </>
  )
}
