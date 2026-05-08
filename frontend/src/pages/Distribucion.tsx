import { useState, useRef, useCallback } from 'react'
import { Upload, X, ChevronDown, Plus, Minus, Download, RotateCcw, ArrowLeftRight, Users, GripVertical, CheckCircle2, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import axios from 'axios'
import Header from '../components/layout/Header'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LiderConfig {
  nombre: string
  horaInicio: string
  puesto: 'Líder' | 'Referente' | 'Pusher'
  skills: string[]
}

interface RepAsignado {
  rep: string
  service: string
  ingreso: string
  status: string
}

interface DistribucionResult {
  assignments: Record<string, RepAsignado[]>
  counts: Record<string, number>
  pusher: string | null
  ideal: number
  lideresOrdenados: string[]
  filePath: string
  selectedSheet: string
}

type Mode = 'armador' | 'cruce'
type Step = 'upload' | 'config' | 'results'

// ── Upload Zone ───────────────────────────────────────────────────────────────

function UploadZone({ onFiles, multiple = false, label }: {
  onFiles: (files: File[]) => void
  multiple?: boolean
  label: string
}) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handle = (files: FileList | null) => {
    if (!files) return
    const arr = Array.from(files).filter(f =>
      f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
    )
    if (arr.length === 0) { toast.error('Solo se aceptan archivos .xlsx / .xls'); return }
    onFiles(arr)
  }

  return (
    <div
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); handle(e.dataTransfer.files) }}
      onClick={() => inputRef.current?.click()}
      className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-all
        ${dragging ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-gray-50 hover:border-blue-300 hover:bg-blue-50/40'}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center">
        <Upload size={24} className="text-blue-600" />
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-700">{label}</p>
        <p className="text-xs text-gray-400 mt-1">Arrastrá o hacé click · .xlsx / .xls</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        multiple={multiple}
        className="hidden"
        onChange={e => handle(e.target.files)}
      />
    </div>
  )
}

// ── Skill chip ────────────────────────────────────────────────────────────────

function SkillChip({ skill, onRemove }: { skill: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 rounded-full text-xs text-blue-700 font-medium">
      {skill}
      <button onClick={onRemove} className="hover:text-red-500 transition-colors"><X size={10} /></button>
    </span>
  )
}

// ── Leader config card ────────────────────────────────────────────────────────

function LiderCard({ config, servicios, timeOptions, onChange }: {
  config: LiderConfig
  servicios: string[]
  timeOptions: string[]
  onChange: (c: LiderConfig) => void
}) {
  const [skillInput, setSkillInput] = useState('')
  const availableSkills = servicios.filter(s => !config.skills.includes(s))

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-gray-800 truncate flex-1">{config.nombre}</p>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ml-2 shrink-0
          ${config.puesto === 'Líder' ? 'bg-blue-50 text-blue-700 border-blue-200'
          : config.puesto === 'Referente' ? 'bg-purple-50 text-purple-700 border-purple-200'
          : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
          {config.puesto}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="label-base">Hora inicio</label>
          <select
            value={config.horaInicio}
            onChange={e => onChange({ ...config, horaInicio: e.target.value })}
            className="input-base text-xs py-1.5"
          >
            {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label-base">Puesto</label>
          <select
            value={config.puesto}
            onChange={e => onChange({ ...config, puesto: e.target.value as LiderConfig['puesto'] })}
            className="input-base text-xs py-1.5"
          >
            <option>Líder</option>
            <option>Referente</option>
            <option>Pusher</option>
          </select>
        </div>
      </div>

      <div>
        <label className="label-base">Skills (vacío = todos)</label>
        <div className="flex flex-wrap gap-1 min-h-[28px] mb-1.5">
          {config.skills.map(s => (
            <SkillChip
              key={s}
              skill={s}
              onRemove={() => onChange({ ...config, skills: config.skills.filter(x => x !== s) })}
            />
          ))}
        </div>
        <div className="flex gap-1.5">
          <select
            value={skillInput}
            onChange={e => setSkillInput(e.target.value)}
            className="input-base text-xs py-1 flex-1"
          >
            <option value="">Agregar skill...</option>
            {availableSkills.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            onClick={() => {
              if (skillInput) {
                onChange({ ...config, skills: [...config.skills, skillInput] })
                setSkillInput('')
              }
            }}
            className="btn-primary px-2 py-1 text-xs"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Results board with drag-drop ──────────────────────────────────────────────

function ResultsBoard({ result, onUpdate }: {
  result: DistribucionResult
  onUpdate: (assignments: Record<string, RepAsignado[]>) => void
}) {
  const [assignments, setAssignments] = useState(result.assignments)
  const [draggingRep, setDraggingRep] = useState<{ rep: RepAsignado; fromLeader: string } | null>(null)

  const handleDrop = (toLeader: string) => {
    if (!draggingRep || draggingRep.fromLeader === toLeader) return
    const updated = { ...assignments }
    updated[draggingRep.fromLeader] = updated[draggingRep.fromLeader].filter(r => r.rep !== draggingRep.rep.rep)
    updated[toLeader] = [...updated[toLeader], draggingRep.rep]
    setAssignments(updated)
    onUpdate(updated)
    setDraggingRep(null)
  }

  const counts = Object.fromEntries(Object.entries(assignments).map(([l, rs]) => [l, rs.length]))

  return (
    <div className="space-y-3">
      {/* Stats bar */}
      <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-xl border border-blue-100">
        <div className="flex items-center gap-2">
          <Users size={14} className="text-blue-600" />
          <span className="text-sm font-semibold text-blue-800">
            {Object.values(assignments).flat().length} asignados
          </span>
        </div>
        <div className="h-4 w-px bg-blue-200" />
        <span className="text-sm text-blue-700">Ideal: <strong>{result.ideal}</strong> por líder</span>
        {result.pusher && (
          <>
            <div className="h-4 w-px bg-blue-200" />
            <span className="text-xs text-orange-700 font-medium bg-orange-50 px-2 py-0.5 rounded-full border border-orange-200">
              Pusher sugerido: {result.pusher}
            </span>
          </>
        )}
        <p className="text-xs text-blue-500 ml-auto">Arrastrá los nombres entre columnas para reasignar</p>
      </div>

      {/* Leader columns */}
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(result.lideresOrdenados.length, 4)}, 1fr)` }}>
        {result.lideresOrdenados.map(leader => {
          const reps = assignments[leader] ?? []
          const cnt = reps.length
          const diff = cnt - result.ideal
          return (
            <div
              key={leader}
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(leader)}
              className="rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col"
              style={{ minHeight: 200 }}
            >
              {/* Column header */}
              <div className="px-3 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                <p className="text-xs font-bold text-gray-700 truncate flex-1">{leader}</p>
                <span className={`text-xs font-black px-2 py-0.5 rounded-full ml-2 shrink-0
                  ${diff > 2 ? 'bg-red-50 text-red-600 border border-red-200'
                  : diff < -2 ? 'bg-yellow-50 text-yellow-600 border border-yellow-200'
                  : 'bg-green-50 text-green-600 border border-green-200'}`}>
                  {cnt}
                </span>
              </div>

              {/* Rep list */}
              <div className="flex-1 p-2 space-y-1 overflow-y-auto" style={{ maxHeight: 320 }}>
                {reps.map(r => (
                  <div
                    key={r.rep}
                    draggable
                    onDragStart={() => setDraggingRep({ rep: r, fromLeader: leader })}
                    onDragEnd={() => setDraggingRep(null)}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs cursor-grab active:cursor-grabbing transition-all
                      ${r.status === 'LP' ? 'bg-yellow-50 border-yellow-200' : 'bg-gray-50 border-gray-100 hover:border-blue-200 hover:bg-blue-50/40'}`}
                  >
                    <GripVertical size={10} className="text-gray-300 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-700 truncate">{r.rep}</p>
                      <p className="text-gray-400 truncate">{r.service} · {r.ingreso}</p>
                    </div>
                    {r.status === 'LP' && (
                      <span className="text-[9px] font-bold text-yellow-600 bg-yellow-100 px-1 rounded shrink-0">LP</span>
                    )}
                  </div>
                ))}
                {reps.length === 0 && (
                  <p className="text-xs text-gray-300 text-center pt-6">Sin asignados</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Distribucion() {
  const [mode, setMode] = useState<Mode>('armador')
  const [step, setStep] = useState<Step>('upload')
  const [loading, setLoading] = useState(false)

  // Armador state
  const [file, setFile] = useState<File | null>(null)
  const [analisis, setAnalisis] = useState<{
    líderes: string[]; servicios: string[]; allSheets: string[]; selectedSheet: string; timeOptions: string[]; filePath: string
  } | null>(null)
  const [ideal, setIdeal] = useState(21)
  const [configs, setConfigs] = useState<LiderConfig[]>([])
  const [result, setResult] = useState<DistribucionResult | null>(null)
  const [currentAssignments, setCurrentAssignments] = useState<Record<string, RepAsignado[]>>({})
  const [downloading, setDownloading] = useState(false)

  // Cruce state
  const [cruceFiles, setCruceFiles] = useState<File[]>([])
  const [cruceLoading, setCruceLoading] = useState(false)

  // ── Armador handlers ────────────────────────────────────────────────────────

  const handleUploadArmador = async (files: File[]) => {
    setFile(files[0])
    setLoading(true)
    try {
      const fd = new FormData()
      fd.append('file', files[0])
      const res = await axios.post('/api/distribucion/analizar', fd)
      setAnalisis(res.data)
      setConfigs(res.data.líderes.map((l: string) => ({
        nombre: l,
        horaInicio: '08:00',
        puesto: 'Líder' as const,
        skills: [],
      })))
      setStep('config')
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : 'Error analizando archivo'
      toast.error(msg || 'Error analizando archivo')
    } finally {
      setLoading(false)
    }
  }

  const handleProcesar = async () => {
    if (!analisis) return
    setLoading(true)
    try {
      const res = await axios.post('/api/distribucion/procesar', {
        filePath: analisis.filePath,
        selectedSheet: analisis.selectedSheet,
        configs,
        ideal,
      })
      setResult(res.data)
      setCurrentAssignments(res.data.assignments)
      setStep('results')
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.error : 'Error procesando'
      toast.error(msg || 'Error procesando')
    } finally {
      setLoading(false)
    }
  }

  const handleDescargar = async () => {
    if (!result) return
    setDownloading(true)
    try {
      const res = await axios.post('/api/distribucion/descargar', {
        filePath: result.filePath,
        selectedSheet: result.selectedSheet,
        assignments: currentAssignments,
        counts: Object.fromEntries(
          Object.entries(currentAssignments).map(([l, rs]) => [l, rs.length])
        ),
        ideal: result.ideal,
      }, { responseType: 'blob' })

      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = 'Nomina_asignada.xlsx'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Descargando Nomina_asignada.xlsx')
    } catch {
      toast.error('Error generando Excel')
    } finally {
      setDownloading(false)
    }
  }

  const handleReset = () => {
    setStep('upload')
    setFile(null)
    setAnalisis(null)
    setConfigs([])
    setResult(null)
    setCurrentAssignments({})
  }

  // ── Cruce handler ───────────────────────────────────────────────────────────

  const handleCruzar = async () => {
    if (cruceFiles.length < 2) { toast.error('Necesitás 2 archivos'); return }
    setCruceLoading(true)
    try {
      const fd = new FormData()
      cruceFiles.forEach(f => fd.append('files', f))
      const res = await axios.post('/api/distribucion/cruzar', fd, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = 'Nomina_cruzada.xlsx'
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Descargando Nomina_cruzada.xlsx')
      setCruceFiles([])
    } catch {
      toast.error('Error cruzando nóminas')
    } finally {
      setCruceLoading(false)
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Distribución de Nómina"
        subtitle="Armado automático y cruce de nóminas"
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Mode tabs */}
        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl w-fit">
          {([['armador', 'Armador de Nómina'], ['cruce', 'Cruce de Datos']] as const).map(([m, label]) => (
            <button
              key={m}
              onClick={() => { setMode(m); if (m === 'armador') handleReset() }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                mode === m ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── ARMADOR ── */}
        {mode === 'armador' && (
          <>
            {/* Steps indicator */}
            <div className="flex items-center gap-2">
              {(['upload', 'config', 'results'] as Step[]).map((s, i) => {
                const labels = ['Subir archivo', 'Configurar líderes', 'Resultados']
                const done = ['upload', 'config', 'results'].indexOf(step) > i
                const active = step === s
                return (
                  <div key={s} className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all
                      ${done ? 'bg-green-500 text-white' : active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}>
                      {done ? <CheckCircle2 size={14} /> : i + 1}
                    </div>
                    <span className={`text-xs font-medium ${active ? 'text-gray-900' : 'text-gray-400'}`}>
                      {labels[i]}
                    </span>
                    {i < 2 && <div className="w-8 h-px bg-gray-200 mx-1" />}
                  </div>
                )
              })}
              {step !== 'upload' && (
                <button onClick={handleReset} className="ml-auto flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors">
                  <RotateCcw size={12} /> Reiniciar
                </button>
              )}
            </div>

            {/* Step: Upload */}
            {step === 'upload' && (
              <div className="max-w-lg">
                {loading ? (
                  <div className="card p-10 flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-gray-500">Analizando archivo...</p>
                  </div>
                ) : (
                  <UploadZone
                    label="Subí la nómina para distribuir (1 archivo)"
                    onFiles={handleUploadArmador}
                  />
                )}
              </div>
            )}

            {/* Step: Config */}
            {step === 'config' && analisis && (
              <div className="space-y-5">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2">
                    <CheckCircle2 size={14} className="text-green-600" />
                    <span className="text-sm text-green-800 font-medium">{file?.name}</span>
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <label className="text-sm font-semibold text-gray-700">Ratio ideal:</label>
                    <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden bg-white">
                      <button onClick={() => setIdeal(i => Math.max(1, i - 1))} className="px-2 py-1.5 hover:bg-gray-50 transition-colors">
                        <Minus size={12} className="text-gray-500" />
                      </button>
                      <span className="px-3 text-sm font-bold text-gray-800 min-w-[2.5rem] text-center">{ideal}</span>
                      <button onClick={() => setIdeal(i => i + 1)} className="px-2 py-1.5 hover:bg-gray-50 transition-colors">
                        <Plus size={12} className="text-gray-500" />
                      </button>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="section-title mb-3">{analisis.líderes.length} líderes detectados</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {configs.map((c, i) => (
                      <LiderCard
                        key={c.nombre}
                        config={c}
                        servicios={analisis.servicios}
                        timeOptions={analisis.timeOptions}
                        onChange={updated => setConfigs(prev => prev.map((x, j) => j === i ? updated : x))}
                      />
                    ))}
                  </div>
                </div>

                <button
                  onClick={handleProcesar}
                  disabled={loading}
                  className="btn-primary px-6 py-2.5"
                >
                  {loading ? 'Procesando...' : 'Generar distribución'}
                </button>
              </div>
            )}

            {/* Step: Results */}
            {step === 'results' && result && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-bold text-gray-700">Distribución generada</h3>
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      onClick={() => setStep('config')}
                      className="btn-secondary px-3 py-2 text-xs"
                    >
                      ← Reconfigurar
                    </button>
                    <button
                      onClick={handleDescargar}
                      disabled={downloading}
                      className="btn-primary px-4 py-2 text-sm"
                    >
                      <Download size={14} />
                      {downloading ? 'Descargando...' : 'Descargar Excel'}
                    </button>
                  </div>
                </div>
                <ResultsBoard
                  result={{ ...result, assignments: currentAssignments }}
                  onUpdate={setCurrentAssignments}
                />
              </div>
            )}
          </>
        )}

        {/* ── CRUCE ── */}
        {mode === 'cruce' && (
          <div className="max-w-2xl space-y-5">
            <div className="card p-5 space-y-4">
              <div>
                <p className="text-sm font-bold text-gray-700 mb-1">¿Cómo funciona el cruce?</p>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Subí dos nóminas. La app detecta automáticamente cuál es la "completa" (donante) y cuál la "incompleta" (receptora),
                  y rellena los campos <strong>USUARIO</strong>, <strong>CONTRATO</strong> y <strong>MODALIDAD</strong> vacíos usando DNI como clave primaria.
                  Descargás un Excel con los datos completados + una hoja de auditoría "No Match".
                </p>
              </div>

              {cruceFiles.length > 0 && (
                <div className="space-y-2">
                  {cruceFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                      <CheckCircle2 size={14} className="text-green-600 shrink-0" />
                      <span className="text-sm text-green-800 font-medium truncate flex-1">{f.name}</span>
                      <button
                        onClick={() => setCruceFiles(prev => prev.filter((_, j) => j !== i))}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {cruceFiles.length < 2 && (
                <UploadZone
                  label={cruceFiles.length === 0
                    ? 'Subí los 2 archivos de nómina (podés seleccionar ambos a la vez)'
                    : 'Subí el segundo archivo'}
                  multiple
                  onFiles={files => setCruceFiles(prev => [...prev, ...files].slice(0, 2))}
                />
              )}

              {cruceFiles.length === 2 && (
                <div className="flex items-center gap-3 pt-1">
                  <button
                    onClick={handleCruzar}
                    disabled={cruceLoading}
                    className="btn-primary px-5 py-2.5"
                  >
                    <ArrowLeftRight size={15} />
                    {cruceLoading ? 'Cruzando...' : 'Cruzar y descargar'}
                  </button>
                  <button
                    onClick={() => setCruceFiles([])}
                    className="btn-secondary px-4 py-2.5 text-sm"
                  >
                    Limpiar
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertCircle size={14} className="text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-800">
                El archivo con más campos USUARIO y CONTRATO completos se usa como donante. La detección es automática.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
