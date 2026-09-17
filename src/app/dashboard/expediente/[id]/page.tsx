'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, Save, Loader2, AlertCircle, CheckCircle2,
  User, Calendar, Clock, Activity, Plus, Trash2, ChevronDown, ChevronUp,
  Search, X, ExternalLink, Camera,
} from 'lucide-react'
import { expedienteRepository } from '@/repositories/expediente'
import { ejerciciosRepository } from '@/repositories/ejercicios'

/* ── Tipos ── */
interface EvaluacionPostural {
  id: string
  tipo: 'inicial' | 'seguimiento' | 'alta'
  evaluacion_frontal: Record<string, { hallazgo: string; lado: string }>
  evaluacion_posterior: Record<string, { hallazgo: string; lado: string }>
  evaluacion_lateral: Record<string, { hallazgo: string; lado: string }>
  foto_postural: string | null
  notas: string
}

interface SesionDetalle {
  id: string
  cita_id: string
  paciente_nombre: string
  paciente_id: string
  fisioterapeuta_nombre: string
  servicio_nombre: string
  fecha_hora: string
  fecha_hora_fin: string
  cita_estado: string
  motivo_consulta: string
  diagnostico_cie10: string
  diagnostico_descripcion: string
  tratamiento_realizado: string
  observaciones: string
  proxima_sesion_recomendada: string
  escala_dolor_inicio: number | null
  escala_dolor_fin: number | null
  evaluaciones: EvaluacionPostural[]
}

/* ── Rutina de ejercicios ── */
interface RutinaItem {
  id: string
  sesion: string
  ejercicio: number
  ejercicio_nombre: string
  ejercicio_categoria: string
  ejercicio_video_url: string
  series: number | null
  repeticiones: number | null
  duracion_segundos: number | null
  descanso_segundos: number | null
  instrucciones_especificas: string
  orden: number
}

const CAT_COLOR_RUT: Record<string, string> = {
  fuerza:       'bg-red-100 text-red-700',
  flexibilidad: 'bg-emerald-100 text-emerald-700',
  equilibrio:   'bg-blue-100 text-blue-700',
  cardio:       'bg-orange-100 text-orange-700',
  funcional:    'bg-violet-100 text-violet-700',
}

function RutinaEjercicioModal({ sesionId, item, orden, onSaved, onClose }: {
  sesionId: string
  item: RutinaItem | null
  orden: number
  onSaved: () => void
  onClose: () => void
}) {
  const [ejerciciosBusq, setEjerciciosBusq] = useState<any[]>([])
  const [q, setQ] = useState('')
  const [loadingEj, setLoadingEj] = useState(false)
  const [form, setForm] = useState({
    ejercicio:               item?.ejercicio ?? (null as number | null),
    ejercicio_nombre:        item?.ejercicio_nombre ?? '',
    ejercicio_categoria:     item?.ejercicio_categoria ?? '',
    series:                  item?.series?.toString() ?? '',
    repeticiones:            item?.repeticiones?.toString() ?? '',
    duracion_segundos:       item?.duracion_segundos?.toString() ?? '',
    descanso_segundos:       item?.descanso_segundos?.toString() ?? '',
    instrucciones_especificas: item?.instrucciones_especificas ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    clearTimeout(debRef.current)
    debRef.current = setTimeout(() => {
      setLoadingEj(true)
      ejerciciosRepository.listar(q ? { q } : {})
        .then((data: any) => setEjerciciosBusq(Array.isArray(data) ? data : (data.results ?? [])))
        .catch(() => setEjerciciosBusq([]))
        .finally(() => setLoadingEj(false))
    }, 300)
  }, [q])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.ejercicio) { setError('Selecciona un ejercicio.'); return }
    if (!form.series && !form.duracion_segundos) {
      setError('Especifica series/repeticiones o duración en segundos.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      const payload = {
        ejercicio: form.ejercicio,
        series: form.series ? Number(form.series) : null,
        repeticiones: form.repeticiones ? Number(form.repeticiones) : null,
        duracion_segundos: form.duracion_segundos ? Number(form.duracion_segundos) : null,
        descanso_segundos: form.descanso_segundos ? Number(form.descanso_segundos) : null,
        instrucciones_especificas: form.instrucciones_especificas,
      }
      if (item) {
        await ejerciciosRepository.actualizarRutina(item.id, payload)
      } else {
        await ejerciciosRepository.agregarARutina({ ...payload, sesion: sesionId, orden })
      }
      onSaved()
      onClose()
    } catch (err: any) {
      const d = err?.response?.data
      if (d?.non_field_errors) setError(d.non_field_errors[0])
      else if (d?.detail) setError(d.detail)
      else setError('No se pudo guardar el ejercicio.')
    } finally {
      setSaving(false)
    }
  }

  const NUM_INPUT = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {item ? 'Editar ejercicio' : 'Agregar ejercicio'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}

          {/* Selector de ejercicio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Ejercicio <span className="text-red-400">*</span>
            </label>

            {form.ejercicio ? (
              <div className="flex items-center gap-2 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-sky-800">{form.ejercicio_nombre}</p>
                  {form.ejercicio_categoria && (
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${CAT_COLOR_RUT[form.ejercicio_categoria] ?? 'bg-gray-100 text-gray-600'}`}>
                      {form.ejercicio_categoria}
                    </span>
                  )}
                </div>
                <button type="button"
                  onClick={() => setForm({ ...form, ejercicio: null, ejercicio_nombre: '', ejercicio_categoria: '' })}
                  className="text-sky-400 hover:text-sky-600 p-1">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar en biblioteca…"
                    className="pl-9 w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  />
                </div>
                {loadingEj ? (
                  <div className="text-center py-3"><Loader2 className="w-4 h-4 animate-spin text-sky-500 mx-auto" /></div>
                ) : (
                  <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-50">
                    {ejerciciosBusq.length === 0
                      ? <p className="text-sm text-gray-400 text-center py-3">Sin ejercicios</p>
                      : ejerciciosBusq.slice(0, 8).map((ej: any) => (
                        <button key={ej.id} type="button"
                          className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-sky-50 transition-colors text-left"
                          onClick={() => setForm({ ...form, ejercicio: ej.id, ejercicio_nombre: ej.nombre, ejercicio_categoria: ej.categoria })}>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{ej.nombre}</p>
                            {ej.grupo_muscular_nombre && (
                              <p className="text-xs text-gray-400">{ej.grupo_muscular_nombre}</p>
                            )}
                          </div>
                          {ej.categoria && (
                            <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${CAT_COLOR_RUT[ej.categoria] ?? 'bg-gray-100 text-gray-600'}`}>
                              {ej.categoria}
                            </span>
                          )}
                        </button>
                      ))
                    }
                  </div>
                )}
              </>
            )}
          </div>

          {/* Parámetros */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Series</label>
              <input type="number" min="1" value={form.series}
                onChange={(e) => setForm({ ...form, series: e.target.value })}
                placeholder="3" className={NUM_INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Repeticiones</label>
              <input type="number" min="1" value={form.repeticiones}
                onChange={(e) => setForm({ ...form, repeticiones: e.target.value })}
                placeholder="15" className={NUM_INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Duración (seg)</label>
              <input type="number" min="1" value={form.duracion_segundos}
                onChange={(e) => setForm({ ...form, duracion_segundos: e.target.value })}
                placeholder="45" className={NUM_INPUT} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Descanso (seg)</label>
              <input type="number" min="0" value={form.descanso_segundos}
                onChange={(e) => setForm({ ...form, descanso_segundos: e.target.value })}
                placeholder="60" className={NUM_INPUT} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Instrucciones específicas</label>
            <textarea value={form.instrucciones_especificas}
              onChange={(e) => setForm({ ...form, instrucciones_especificas: e.target.value })}
              rows={2} placeholder="Indicaciones particulares para este paciente…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-70">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Guardando…' : item ? 'Guardar' : 'Agregar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Componentes UI ── */
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  )
}

const INPUT_CLS = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent'
const TEXTAREA_CLS = `${INPUT_CLS} resize-none`

/* ── Escala de dolor ── */
function EscalaDolor({
  value, onChange, label,
}: { value: number | null; onChange: (v: number | null) => void; label: string }) {
  const color = (n: number) =>
    n <= 3 ? 'bg-emerald-500' : n <= 6 ? 'bg-amber-500' : 'bg-red-500'

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex items-center gap-1.5 flex-wrap">
        {Array.from({ length: 11 }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onChange(value === i ? null : i)}
            className={`w-8 h-8 rounded-lg text-sm font-semibold transition-all border-2 ${
              value === i
                ? `${color(i)} text-white border-transparent scale-110`
                : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            {i}
          </button>
        ))}
        {value !== null && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-gray-400 hover:text-gray-600 ml-1"
          >
            Borrar
          </button>
        )}
      </div>
      {value !== null && (
        <p className={`text-xs mt-1 font-medium ${
          value <= 3 ? 'text-emerald-600' : value <= 6 ? 'text-amber-600' : 'text-red-600'
        }`}>
          {value === 0 ? 'Sin dolor' : value <= 3 ? 'Leve' : value <= 6 ? 'Moderado' : 'Severo'} ({value}/10)
        </p>
      )}
    </div>
  )
}

/* ── Evaluación postural ── */
const ZONAS_POSTURALES = ['cabeza', 'hombros', 'columna', 'pelvis', 'rodillas', 'tobillos']
const LADOS = ['', 'izquierdo', 'derecho', 'bilateral']
const TIPO_EVAL_LABEL: Record<string, string> = {
  inicial: 'Inicial', seguimiento: 'Seguimiento', alta: 'Alta',
}

type PlanoPostural = 'evaluacion_frontal' | 'evaluacion_posterior' | 'evaluacion_lateral'

interface EvalForm {
  tipo: 'inicial' | 'seguimiento' | 'alta'
  evaluacion_frontal: Record<string, { hallazgo: string; lado: string }>
  evaluacion_posterior: Record<string, { hallazgo: string; lado: string }>
  evaluacion_lateral: Record<string, { hallazgo: string; lado: string }>
  notas: string
}

const EVAL_EMPTY: EvalForm = {
  tipo: 'inicial',
  evaluacion_frontal: {},
  evaluacion_posterior: {},
  evaluacion_lateral: {},
  notas: '',
}

function EvaluacionCard({
  ev, sesionId, onDeleted, onUpdated,
}: {
  ev: EvaluacionPostural
  sesionId: string
  onDeleted: () => void
  onUpdated: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState<EvalForm>({
    tipo: ev.tipo,
    evaluacion_frontal: ev.evaluacion_frontal,
    evaluacion_posterior: ev.evaluacion_posterior,
    evaluacion_lateral: ev.evaluacion_lateral,
    notas: ev.notas,
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [fotoUrl, setFotoUrl] = useState<string | null>(ev.foto_postural ?? null)
  const [uploadingFoto, setUploadingFoto] = useState(false)
  const fotoInputRef = useRef<HTMLInputElement>(null)

  const handleFotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingFoto(true)
    try {
      const updated = await expedienteRepository.subirFotoEvaluacion(ev.id, file)
      setFotoUrl(updated.foto_postural)
    } catch {
      // silencioso — no bloquea el flujo
    } finally {
      setUploadingFoto(false)
      if (fotoInputRef.current) fotoInputRef.current.value = ''
    }
  }

  const setZona = (plano: PlanoPostural, zona: string, campo: 'hallazgo' | 'lado', valor: string) => {
    setForm((f) => ({
      ...f,
      [plano]: {
        ...f[plano],
        [zona]: { ...f[plano][zona], [campo]: valor },
      },
    }))
  }

  const guardar = async () => {
    setSaving(true)
    try {
      await expedienteRepository.actualizarEvaluacion(ev.id, form)
      onUpdated()
      setEditMode(false)
    } finally {
      setSaving(false)
    }
  }

  const eliminar = async () => {
    if (!confirm('¿Eliminar esta evaluación?')) return
    setDeleting(true)
    try {
      await expedienteRepository.eliminarEvaluacion(ev.id)
      onDeleted()
    } finally {
      setDeleting(false)
    }
  }

  const PLANOS: { key: PlanoPostural; label: string }[] = [
    { key: 'evaluacion_frontal', label: 'Frontal' },
    { key: 'evaluacion_posterior', label: 'Posterior' },
    { key: 'evaluacion_lateral', label: 'Lateral' },
  ]

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Cabecera */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            ev.tipo === 'inicial' ? 'bg-sky-100 text-sky-700' :
            ev.tipo === 'seguimiento' ? 'bg-violet-100 text-violet-700' :
            'bg-emerald-100 text-emerald-700'
          }`}>
            {TIPO_EVAL_LABEL[ev.tipo]}
          </span>
          {ev.notas && <span className="text-xs text-gray-500 line-clamp-1">{ev.notas}</span>}
        </div>
        <div className="flex items-center gap-2">
          {!editMode && (
            <button onClick={() => setEditMode(true)}
              className="text-xs text-sky-600 hover:underline">Editar</button>
          )}
          <button onClick={eliminar} disabled={deleting}
            className="text-gray-400 hover:text-red-500 transition-colors p-1">
            {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600 p-1">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Contenido expandible */}
      {expanded && (
        <div className="p-4 space-y-4">
          {editMode && (
            <div className="flex items-center gap-3">
              <select value={form.tipo}
                onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as EvalForm['tipo'] }))}
                className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent">
                <option value="inicial">Inicial</option>
                <option value="seguimiento">Seguimiento</option>
                <option value="alta">Alta</option>
              </select>
            </div>
          )}

          {/* Tabla de zonas por plano */}
          {PLANOS.map(({ key, label }) => (
            <div key={key}>
              <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</h5>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border border-gray-100 rounded-lg overflow-hidden">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">Zona</th>
                      <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">Hallazgo</th>
                      <th className="text-left px-3 py-2 text-xs text-gray-500 font-medium">Lado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {ZONAS_POSTURALES.map((zona) => {
                      const datos = editMode ? form[key][zona] : ev[key][zona]
                      return (
                        <tr key={zona}>
                          <td className="px-3 py-2 text-gray-700 capitalize font-medium">{zona}</td>
                          <td className="px-3 py-2">
                            {editMode
                              ? <input type="text" value={form[key][zona]?.hallazgo ?? ''}
                                  onChange={(e) => setZona(key, zona, 'hallazgo', e.target.value)}
                                  className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500"
                                  placeholder="Hallazgo…" />
                              : <span className="text-gray-600">{datos?.hallazgo || <span className="text-gray-300">—</span>}</span>
                            }
                          </td>
                          <td className="px-3 py-2">
                            {editMode
                              ? <select value={form[key][zona]?.lado ?? ''}
                                  onChange={(e) => setZona(key, zona, 'lado', e.target.value)}
                                  className="border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-sky-500">
                                  {LADOS.map((l) => <option key={l} value={l}>{l || 'Sin especificar'}</option>)}
                                </select>
                              : <span className="text-gray-500 capitalize">{datos?.lado || <span className="text-gray-300">—</span>}</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Foto postural */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Foto postural
            </label>
            <input
              ref={fotoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFotoChange}
              disabled={uploadingFoto}
            />
            {fotoUrl ? (
              <div className="relative inline-block">
                <img
                  src={fotoUrl}
                  alt="Evaluación postural"
                  className="max-h-56 rounded-xl border border-gray-200 object-contain cursor-pointer"
                  onClick={() => window.open(fotoUrl, '_blank')}
                />
                <button
                  type="button"
                  onClick={() => fotoInputRef.current?.click()}
                  disabled={uploadingFoto}
                  className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-white/90 hover:bg-white border border-gray-200 text-gray-700 px-2.5 py-1.5 rounded-lg text-xs font-medium shadow-sm transition-colors disabled:opacity-60"
                >
                  {uploadingFoto
                    ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    : <Camera className="w-3.5 h-3.5" />}
                  Cambiar foto
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fotoInputRef.current?.click()}
                disabled={uploadingFoto}
                className="flex flex-col items-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-5 w-full hover:border-sky-300 hover:bg-sky-50/50 transition-colors disabled:opacity-60"
              >
                {uploadingFoto
                  ? <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
                  : <Camera className="w-6 h-6 text-gray-400" />}
                <span className="text-sm text-gray-500">
                  {uploadingFoto ? 'Subiendo foto…' : 'Agregar foto postural'}
                </span>
                {!uploadingFoto && (
                  <span className="text-xs text-gray-400">Tomar foto o subir desde galería</span>
                )}
              </button>
            )}
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notas</label>
            {editMode
              ? <textarea value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                  rows={2} className={TEXTAREA_CLS} />
              : <p className="text-sm text-gray-600">{ev.notas || <span className="text-gray-300">Sin notas</span>}</p>
            }
          </div>

          {editMode && (
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditMode(false)}
                className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Cancelar</button>
              <button onClick={guardar} disabled={saving}
                className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-70">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Guardar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ── Formulario de nueva evaluación ── */
function NuevaEvaluacionForm({
  sesionId, onCreada,
}: { sesionId: string; onCreada: () => void }) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<EvalForm>(EVAL_EMPTY)
  const [saving, setSaving] = useState(false)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string | null>(null)
  const fotoInputRef = useRef<HTMLInputElement>(null)

  const handleFotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFotoFile(file)
    setFotoPreview(URL.createObjectURL(file))
  }

  const limpiarFoto = () => {
    setFotoFile(null)
    if (fotoPreview) URL.revokeObjectURL(fotoPreview)
    setFotoPreview(null)
    if (fotoInputRef.current) fotoInputRef.current.value = ''
  }

  const setZona = (plano: PlanoPostural, zona: string, campo: 'hallazgo' | 'lado', valor: string) => {
    setForm((f) => ({
      ...f,
      [plano]: { ...f[plano], [zona]: { ...f[plano][zona], [campo]: valor } },
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const evaluacion = await expedienteRepository.crearEvaluacion({ ...form, sesion: sesionId })
      if (fotoFile) {
        try { await expedienteRepository.subirFotoEvaluacion(evaluacion.id, fotoFile) } catch {}
      }
      onCreada()
      setOpen(false)
      setForm(EVAL_EMPTY)
      limpiarFoto()
    } finally {
      setSaving(false)
    }
  }

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="flex items-center gap-2 border border-dashed border-sky-300 text-sky-600 hover:bg-sky-50 px-4 py-3 rounded-xl text-sm font-medium transition-colors w-full justify-center">
      <Plus className="w-4 h-4" />Agregar evaluación postural
    </button>
  )

  const PLANOS: { key: PlanoPostural; label: string }[] = [
    { key: 'evaluacion_frontal', label: 'Frontal' },
    { key: 'evaluacion_posterior', label: 'Posterior' },
    { key: 'evaluacion_lateral', label: 'Lateral' },
  ]

  return (
    <form onSubmit={handleSubmit} className="border border-sky-200 bg-sky-50/30 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold text-gray-800">Nueva evaluación postural</h4>
        <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
          <ChevronUp className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Tipo</label>
        <select value={form.tipo}
          onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as EvalForm['tipo'] }))}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent">
          <option value="inicial">Inicial</option>
          <option value="seguimiento">Seguimiento</option>
          <option value="alta">Alta</option>
        </select>
      </div>

      {PLANOS.map(({ key, label }) => (
        <div key={key}>
          <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</h5>
          <div className="grid grid-cols-1 gap-2">
            {ZONAS_POSTURALES.map((zona) => (
              <div key={zona} className="grid grid-cols-3 gap-2 items-center">
                <span className="text-sm text-gray-700 capitalize font-medium">{zona}</span>
                <input type="text" value={form[key][zona]?.hallazgo ?? ''}
                  onChange={(e) => setZona(key, zona, 'hallazgo', e.target.value)}
                  placeholder="Hallazgo…"
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
                <select value={form[key][zona]?.lado ?? ''}
                  onChange={(e) => setZona(key, zona, 'lado', e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent">
                  {LADOS.map((l) => <option key={l} value={l}>{l || 'Sin especificar'}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Foto postural */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Foto postural <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <input
          ref={fotoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFotoSelect}
        />
        {fotoPreview ? (
          <div className="relative inline-block">
            <img
              src={fotoPreview}
              alt="Vista previa"
              className="max-h-40 rounded-xl border border-gray-200 object-contain"
            />
            <button
              type="button"
              onClick={limpiarFoto}
              className="absolute top-1.5 right-1.5 bg-white/90 border border-gray-200 rounded-full p-0.5 text-gray-500 hover:text-red-500 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fotoInputRef.current?.click()}
            className="flex flex-col items-center gap-1.5 border-2 border-dashed border-gray-200 rounded-xl p-4 w-full hover:border-sky-300 hover:bg-sky-50/50 transition-colors"
          >
            <Camera className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-500">Tomar foto o subir desde galería</span>
          </button>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
        <textarea value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
          rows={2} placeholder="Observaciones adicionales…"
          className={TEXTAREA_CLS} />
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => setOpen(false)}
          className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
          Cancelar
        </button>
        <button type="submit" disabled={saving}
          className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-70">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Guardar evaluación
        </button>
      </div>
    </form>
  )
}

/* ── Página de detalle ── */
export default function SesionDetallePage() {
  const { id } = useParams<{ id: string }>()
  const [sesion, setSesion] = useState<SesionDetalle | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const [rutina, setRutina] = useState<RutinaItem[]>([])
  const [loadingRutina, setLoadingRutina] = useState(true)
  const [rutinaModal, setRutinaModal] = useState<{ open: boolean; item: RutinaItem | null }>({ open: false, item: null })

  const [form, setForm] = useState({
    motivo_consulta: '',
    diagnostico_cie10: '',
    diagnostico_descripcion: '',
    tratamiento_realizado: '',
    observaciones: '',
    proxima_sesion_recomendada: '',
    escala_dolor_inicio: null as number | null,
    escala_dolor_fin: null as number | null,
  })

  const cargar = useCallback(() => {
    setLoading(true)
    expedienteRepository.obtenerSesion(id)
      .then((s) => {
        setSesion(s)
        setForm({
          motivo_consulta: s.motivo_consulta,
          diagnostico_cie10: s.diagnostico_cie10,
          diagnostico_descripcion: s.diagnostico_descripcion,
          tratamiento_realizado: s.tratamiento_realizado,
          observaciones: s.observaciones,
          proxima_sesion_recomendada: s.proxima_sesion_recomendada,
          escala_dolor_inicio: s.escala_dolor_inicio,
          escala_dolor_fin: s.escala_dolor_fin,
        })
      })
      .catch(() => setSesion(null))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { cargar() }, [cargar])

  const cargarRutina = useCallback(() => {
    setLoadingRutina(true)
    ejerciciosRepository.listarRutina(id)
      .then((data) => setRutina(Array.isArray(data) ? data : (data.results ?? [])))
      .catch(() => setRutina([]))
      .finally(() => setLoadingRutina(false))
  }, [id])

  useEffect(() => { cargarRutina() }, [cargarRutina])

  const handleDeleteRutina = async (rutinaId: string) => {
    if (!confirm('¿Eliminar este ejercicio de la rutina?')) return
    try { await ejerciciosRepository.eliminarDeRutina(rutinaId) } catch {}
    cargarRutina()
  }

  const set = (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }))

  const guardar = async () => {
    setSaving(true)
    setSaved(false)
    setSaveError(null)
    try {
      await expedienteRepository.actualizarSesion(id, form)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      setSaveError(err?.response?.data?.detail ?? 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
    </div>
  )

  if (!sesion) return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <AlertCircle className="w-10 h-10 text-red-400" />
      <p className="text-gray-600">Sesión no encontrada.</p>
      <Link href="/dashboard/expediente" className="text-sky-600 hover:underline text-sm">Volver</Link>
    </div>
  )

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <Link href="/dashboard/expediente"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ChevronLeft className="w-4 h-4" />Expediente
        </Link>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{sesion.paciente_nombre}</h1>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 flex-wrap">
              <span className="flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-gray-400" />{sesion.fisioterapeuta_nombre}
              </span>
              <span className="flex items-center gap-1">
                <Activity className="w-3.5 h-3.5 text-gray-400" />{sesion.servicio_nombre}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                {new Date(sesion.fecha_hora).toLocaleDateString('es-EC', {
                  weekday: 'short', day: 'numeric', month: 'long', year: 'numeric',
                })}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-gray-400" />
                {new Date(sesion.fecha_hora).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
                {' – '}
                {new Date(sesion.fecha_hora_fin).toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Guardar */}
          <div className="flex items-center gap-3">
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                <CheckCircle2 className="w-4 h-4" />Guardado
              </span>
            )}
            {saveError && (
              <span className="flex items-center gap-1.5 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" />{saveError}
              </span>
            )}
            <button
              onClick={guardar}
              disabled={saving}
              className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-70"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar sesión
            </button>
          </div>
        </div>
      </div>

      {/* ── Formulario ── */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-8">

          {/* ── Sección 1: Consulta ── */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-2">
              Consulta
            </h2>

            <Campo label="Motivo de consulta *">
              <textarea value={form.motivo_consulta} onChange={set('motivo_consulta')}
                rows={3} placeholder="Describe el motivo principal de la consulta..."
                className={TEXTAREA_CLS} />
            </Campo>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Campo label="Código CIE-10">
                <input type="text" value={form.diagnostico_cie10} onChange={set('diagnostico_cie10')}
                  placeholder="M54.5" maxLength={10}
                  className={`${INPUT_CLS} font-mono`} />
              </Campo>
              <div className="md:col-span-2">
                <Campo label="Descripción diagnóstica">
                  <input type="text" value={form.diagnostico_descripcion} onChange={set('diagnostico_descripcion')}
                    placeholder="Lumbalgia inespecífica…"
                    className={INPUT_CLS} />
                </Campo>
              </div>
            </div>
          </section>

          {/* ── Sección 2: Escala de dolor ── */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-2">
              Escala de dolor (EVA)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <EscalaDolor
                value={form.escala_dolor_inicio}
                onChange={(v) => setForm((f) => ({ ...f, escala_dolor_inicio: v }))}
                label="Al inicio de la sesión"
              />
              <EscalaDolor
                value={form.escala_dolor_fin}
                onChange={(v) => setForm((f) => ({ ...f, escala_dolor_fin: v }))}
                label="Al finalizar la sesión"
              />
            </div>
            {form.escala_dolor_inicio !== null && form.escala_dolor_fin !== null && (
              <p className={`text-sm font-medium ${
                form.escala_dolor_fin < form.escala_dolor_inicio ? 'text-emerald-600' :
                form.escala_dolor_fin > form.escala_dolor_inicio ? 'text-red-600' : 'text-gray-500'
              }`}>
                {form.escala_dolor_fin < form.escala_dolor_inicio
                  ? `Mejoría: −${form.escala_dolor_inicio - form.escala_dolor_fin} puntos`
                  : form.escala_dolor_fin > form.escala_dolor_inicio
                  ? `Aumento: +${form.escala_dolor_fin - form.escala_dolor_inicio} puntos`
                  : 'Sin cambio en la escala de dolor'}
              </p>
            )}
          </section>

          {/* ── Sección 3: Tratamiento ── */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-2">
              Tratamiento y evolución
            </h2>

            <Campo label="Tratamiento realizado">
              <textarea value={form.tratamiento_realizado} onChange={set('tratamiento_realizado')}
                rows={4} placeholder="Describe las técnicas y procedimientos aplicados..."
                className={TEXTAREA_CLS} />
            </Campo>

            <Campo label="Observaciones">
              <textarea value={form.observaciones} onChange={set('observaciones')}
                rows={3} placeholder="Respuesta del paciente, incidencias, notas clínicas..."
                className={TEXTAREA_CLS} />
            </Campo>

            <Campo label="Recomendación para próxima sesión">
              <textarea value={form.proxima_sesion_recomendada} onChange={set('proxima_sesion_recomendada')}
                rows={2} placeholder="Continuación del tratamiento, ajustes, ejercicios asignados..."
                className={TEXTAREA_CLS} />
            </Campo>
          </section>

          {/* ── Sección 4: Evaluaciones posturales ── */}
          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide border-b border-gray-100 pb-2">
              Evaluaciones posturales
            </h2>

            {sesion.evaluaciones.length === 0 && (
              <p className="text-sm text-gray-400">Sin evaluaciones posturales registradas.</p>
            )}

            <div className="space-y-3">
              {sesion.evaluaciones.map((ev) => (
                <EvaluacionCard
                  key={ev.id}
                  ev={ev}
                  sesionId={sesion.id}
                  onDeleted={cargar}
                  onUpdated={cargar}
                />
              ))}
            </div>

            <NuevaEvaluacionForm sesionId={sesion.id} onCreada={cargar} />
          </section>

          {/* ── Sección 5: Rutina de ejercicios ── */}
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                Rutina de ejercicios
              </h2>
              <button
                type="button"
                onClick={() => setRutinaModal({ open: true, item: null })}
                className="flex items-center gap-1.5 text-sm text-sky-600 hover:text-sky-700 font-medium"
              >
                <Plus className="w-4 h-4" />Agregar
              </button>
            </div>

            {loadingRutina ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-sky-500" />
              </div>
            ) : rutina.length === 0 ? (
              <p className="text-sm text-gray-400">Sin ejercicios asignados a esta sesión.</p>
            ) : (
              <div className="space-y-2">
                {rutina.map((item) => (
                  <div key={item.id}
                    className="flex items-start gap-3 bg-gray-50 border border-gray-100 rounded-xl px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-900">{item.ejercicio_nombre}</p>
                        {item.ejercicio_categoria && (
                          <span className="text-xs bg-white border border-gray-200 text-gray-500 px-1.5 py-0.5 rounded">
                            {item.ejercicio_categoria}
                          </span>
                        )}
                        {item.ejercicio_video_url && (
                          <a href={item.ejercicio_video_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-0.5 text-xs text-sky-500 hover:underline">
                            <ExternalLink className="w-3 h-3" />Video
                          </a>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {item.series
                          ? `${item.series} series${item.repeticiones ? ` × ${item.repeticiones} reps` : ''}`
                          : item.duracion_segundos ? `${item.duracion_segundos}s` : '—'}
                        {item.descanso_segundos ? ` · ${item.descanso_segundos}s descanso` : ''}
                      </p>
                      {item.instrucciones_especificas && (
                        <p className="text-xs text-gray-400 mt-0.5 italic">{item.instrucciones_especificas}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setRutinaModal({ open: true, item })}
                        className="text-xs text-sky-600 hover:underline px-2 py-1">
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRutina(item.id)}
                        className="text-gray-300 hover:text-red-500 transition-colors p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {rutinaModal.open && (
              <RutinaEjercicioModal
                sesionId={id}
                item={rutinaModal.item}
                orden={rutina.length + 1}
                onSaved={cargarRutina}
                onClose={() => setRutinaModal({ open: false, item: null })}
              />
            )}
          </section>

          {/* Botón guardar inferior */}
          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button
              onClick={guardar}
              disabled={saving}
              className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-70"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
