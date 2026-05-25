"use client"

import { useState, useRef, useEffect } from 'react'
import { X, Send, ChevronDown, CheckCircle, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { soporteApi } from '@/lib/api'

type Message = { from: 'bot' | 'user'; text: string; time: string }

const QUICK_ACTIONS = [
  { label: 'No puedo ingresar al sistema', asunto: 'No puedo ingresar al sistema', categoria: 'Problema de acceso' },
  { label: 'Error de contraseña', asunto: 'Error con mi contraseña', categoria: 'Credenciales' },
  { label: 'Dato incorrecto en nómina', asunto: 'Dato incorrecto en la nómina', categoria: 'Dato incorrecto' },
  { label: 'Problema con mi usuario', asunto: 'Problema con mi usuario', categoria: 'Problema de acceso' },
  { label: 'Otra consulta', asunto: 'Consulta o reclamo', categoria: 'Consulta' },
]

function nowTime() {
  return new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

const INITIAL_MESSAGES: Message[] = [
  { from: 'bot', text: 'Hola, soy Walt, tu asistente virtual 👋', time: nowTime() },
  { from: 'bot', text: 'Te ayudo con tu reclamo por error de acceso u otro problema del sistema.', time: nowTime() },
]

function BotFace({ size = 40, animated = false }: { size?: number; animated?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={animated ? { animation: 'botFloat 3s ease-in-out infinite' } : undefined}
    >
      <rect x="19" y="4" width="2" height="7" rx="1" fill="white" opacity="0.7" />
      <circle cx="20" cy="3.5" r="2.5" fill="#7DD3FC">
        <animate attributeName="r" values="2.5;3.2;2.5" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="1;0.6;1" dur="2s" repeatCount="indefinite" />
      </circle>
      <rect x="5" y="10" width="30" height="24" rx="7" fill="white" opacity="0.92" />
      <circle cx="5" cy="21" r="2.5" fill="white" opacity="0.55" />
      <circle cx="35" cy="21" r="2.5" fill="white" opacity="0.55" />
      <ellipse cx="14" cy="20" rx="4" ry="4" fill="#0054A6">
        <animate attributeName="ry" values="4;4;4;4;0.4;4;4;4;4;4;4;4;0.4;4" dur="5s" repeatCount="indefinite" />
      </ellipse>
      <circle cx="15.4" cy="18.6" r="1.2" fill="white" opacity="0.9" />
      <ellipse cx="26" cy="20" rx="4" ry="4" fill="#0054A6">
        <animate attributeName="ry" values="4;4;4;4;0.4;4;4;4;4;4;4;4;0.4;4" dur="5s" repeatCount="indefinite" />
      </ellipse>
      <circle cx="27.4" cy="18.6" r="1.2" fill="white" opacity="0.9" />
      <path d="M13.5 27 Q20 31.5 26.5 27" stroke="#0054A6" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  )
}

function TypingDots() {
  return (
    <div className="flex items-center gap-2">
      <div className="w-6 h-6 rounded-full bg-konecta/10 flex items-center justify-center shrink-0">
        <BotFace size={18} />
      </div>
      <div className="bg-white border border-gray-100 shadow-sm rounded-2xl rounded-tl-sm px-3 py-2.5 flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-gray-400"
            style={{ animation: `typingDot 1.2s ease-in-out ${i * 0.2}s infinite` }}
          />
        ))}
      </div>
    </div>
  )
}

export default function SoporteWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [selectedAction, setSelectedAction] = useState<typeof QUICK_ACTIONS[0] | null>(null)
  const [inputText, setInputText] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [done, setDone] = useState(false)
  const [botTyping, setBotTyping] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, botTyping])

  useEffect(() => {
    if (selectedAction && open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [selectedAction, open])

  const addMsg = (msg: Omit<Message, 'time'>) =>
    setMessages((prev) => [...prev, { ...msg, time: nowTime() }])

  const botReply = (text: string, delay = 500) => {
    setBotTyping(true)
    setTimeout(() => {
      setBotTyping(false)
      addMsg({ from: 'bot', text })
    }, delay)
  }

  const handleSelectAction = (action: typeof QUICK_ACTIONS[0]) => {
    setSelectedAction(action)
    addMsg({ from: 'user', text: action.label })
    botReply('Contame qué sucede para ayudarte mejor. Podés escribirlo acá abajo 👇', 600)
  }

  const handleSend = async () => {
    const texto = inputText.trim()
    if (!texto || !selectedAction) return
    addMsg({ from: 'user', text: texto })
    setInputText('')
    setEnviando(true)
    try {
      const form = new FormData()
      form.append('asunto', selectedAction.asunto)
      form.append('descripcion', texto)
      form.append('categoria', selectedAction.categoria)
      if (archivo) form.append('captura', archivo)
      await soporteApi.enviarReporte(form)
      setDone(true)
      botReply('✅ Tu reporte fue enviado. El equipo lo revisará a la brevedad. ¡Gracias!', 400)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Error al enviar el reporte')
      botReply('❌ Hubo un error al enviar. Intentá de nuevo.', 300)
    } finally {
      setEnviando(false)
      setArchivo(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 5 * 1024 * 1024) { toast.error('Máx. 5 MB'); return }
    setArchivo(f)
    addMsg({ from: 'user', text: `📎 Adjunté: ${f.name}` })
  }

  const handleClose = () => {
    setOpen(false)
    setTimeout(() => {
      setMessages(INITIAL_MESSAGES)
      setSelectedAction(null); setInputText('')
      setArchivo(null); setDone(false); setBotTyping(false)
      if (fileRef.current) fileRef.current.value = ''
    }, 300)
  }

  const handleNewReport = () => {
    setMessages(INITIAL_MESSAGES)
    setSelectedAction(null); setInputText('')
    setArchivo(null); setDone(false); setBotTyping(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <>
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 w-[360px] max-h-[580px] flex flex-col bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
          style={{ animation: 'slideUp 0.22s cubic-bezier(0.34,1.56,0.64,1)' }}
        >
          <div
            className="flex items-center gap-3 px-4 py-3 shrink-0"
            style={{ background: 'linear-gradient(135deg, #001540 0%, #0054A6 100%)' }}
          >
            <div className="relative shrink-0">
              <div className="w-11 h-11 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center" style={{ animation: 'botFloat 3s ease-in-out infinite' }}>
                <BotFace size={34} />
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 rounded-full border-2 border-[#001540]">
                <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75" />
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm leading-tight">Walt</p>
              <p className="text-white/55 text-xs mt-0.5">En línea · Soporte al sistema</p>
            </div>
            <button onClick={handleClose} className="text-white/50 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10">
              <X size={15} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-slate-50/70" style={{ minHeight: 0 }}>
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'} gap-2`} style={{ animation: 'msgIn 0.18s ease-out' }}>
                {msg.from === 'bot' && (
                  <div className="w-6 h-6 rounded-full bg-konecta/10 flex items-center justify-center shrink-0 mt-1">
                    <BotFace size={18} />
                  </div>
                )}
                <div className={`max-w-[78%] flex flex-col gap-0.5 ${msg.from === 'user' ? 'items-end' : 'items-start'}`}>
                  <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                    msg.from === 'bot'
                      ? 'bg-white text-gray-800 rounded-tl-sm shadow-sm border border-gray-100'
                      : 'text-white rounded-tr-sm'
                  }`} style={msg.from === 'user' ? { background: 'linear-gradient(135deg,#0054A6,#1A6EC2)' } : undefined}>
                    {msg.text}
                  </div>
                  <span className="text-[10px] text-gray-400 px-1">{msg.time}</span>
                </div>
              </div>
            ))}

            {botTyping && <TypingDots />}

            {!selectedAction && !done && !botTyping && (
              <div className="space-y-1.5 pt-1">
                <p className="text-[11px] text-gray-400 font-semibold px-1 mb-2 uppercase tracking-wide">Describí tu problema</p>
                {QUICK_ACTIONS.map((action, i) => (
                  <button
                    key={action.label}
                    onClick={() => handleSelectAction(action)}
                    className="w-full flex items-center justify-between gap-2 bg-white hover:bg-konecta/5 border border-gray-200 hover:border-konecta/40 rounded-xl px-3 py-2.5 text-left transition-all group shadow-sm"
                    style={{ animation: `msgIn 0.15s ease-out ${i * 0.05}s both` }}
                  >
                    <span className="text-sm font-medium text-gray-700 group-hover:text-konecta">{action.label}</span>
                    <ChevronRight size={14} className="text-gray-300 group-hover:text-konecta shrink-0 transition-colors" />
                  </button>
                ))}
              </div>
            )}

            {done && (
              <div className="flex justify-center pt-1">
                <button onClick={handleNewReport} className="text-xs text-konecta hover:underline font-semibold">
                  + Reportar otro problema
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {selectedAction && !done && (
            <div className="border-t border-gray-100 bg-white shrink-0">
              {archivo && (
                <div className="flex items-center gap-2 px-4 pt-2">
                  <span className="text-xs text-konecta bg-konecta/8 px-2 py-0.5 rounded-full truncate max-w-[220px]">
                    📎 {archivo.name}
                  </span>
                  <button className="text-gray-400 hover:text-red-500" onClick={() => { setArchivo(null); if (fileRef.current) fileRef.current.value = '' }}>
                    <X size={11} />
                  </button>
                </div>
              )}
              <div className="flex items-end gap-2 px-3 py-2.5">
                <button
                  type="button"
                  title="Adjuntar captura"
                  className="text-gray-300 hover:text-konecta transition-colors mb-1 shrink-0"
                  onClick={() => fileRef.current?.click()}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                  </svg>
                </button>
                <textarea
                  ref={inputRef}
                  className="flex-1 resize-none text-sm text-gray-800 placeholder:text-gray-400 border-0 focus:outline-none bg-transparent min-h-[36px] max-h-[100px] leading-relaxed"
                  placeholder="Escribí tu mensaje..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                />
                <button
                  onClick={handleSend}
                  disabled={enviando || !inputText.trim()}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-all shrink-0 mb-0.5 disabled:opacity-35"
                  style={{ background: inputText.trim() ? 'linear-gradient(135deg,#0054A6,#1A6EC2)' : '#E5E7EB' }}
                >
                  {enviando
                    ? <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                    : <Send size={15} className={inputText.trim() ? 'text-white' : 'text-gray-400'} />
                  }
                </button>
              </div>
              <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.gif,.webp,.pdf" className="hidden" onChange={handleFile} />
            </div>
          )}

          <div className="bg-gray-50 border-t border-gray-100 px-4 py-1.5 flex items-center justify-center gap-1.5 shrink-0">
            <CheckCircle size={11} className="text-green-500" />
            <p className="text-[10px] text-gray-400 font-medium">Estamos para ayudarte · Tu tranquilidad es nuestra prioridad</p>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg hover:shadow-xl active:scale-95 transition-all duration-150 flex items-center justify-center overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #001540 0%, #0054A6 100%)',
          animation: open ? undefined : 'btnBob 2.5s ease-in-out infinite',
        }}
        title="Asistente Virtual"
      >
        {open ? (
          <ChevronDown size={22} className="text-white" />
        ) : (
          <BotFace size={36} animated />
        )}
        {!open && (
          <span className="absolute inset-0 rounded-full bg-konecta/40 animate-ping" style={{ animationDuration: '2.5s' }} />
        )}
      </button>

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes msgIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes botFloat {
          0%,100% { transform: translateY(0px); }
          50%      { transform: translateY(-3px); }
        }
        @keyframes btnBob {
          0%,100% { transform: translateY(0px) scale(1); }
          50%      { transform: translateY(-4px) scale(1.03); }
        }
        @keyframes typingDot {
          0%,60%,100% { transform: translateY(0); opacity: 0.4; }
          30%          { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </>
  )
}
