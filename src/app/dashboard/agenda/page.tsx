'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useSelector } from 'react-redux'
import { Calendar, dateFnsLocalizer, Views, View } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, addDays } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  Plus, ChevronLeft, ChevronRight, X, Calendar as CalIcon,
  Clock, User, MapPin, FileText, CheckCircle2, XCircle,
  AlertCircle, Loader2, RefreshCw, Search, CalendarClock, Pencil, Trash2,
} from 'lucide-react'
import { agendaRepository } from '@/repositories/agenda'
import { pacientesRepository } from '@/repositories/pacientes'
import { configuracionRepository } from '@/repositories/configuracion'
import 'react-big-calendar/lib/css/react-big-calendar.css'

/* ── Localizer ── */
const locales = { es }
const localizer = dateFnsLocalizer({
  format, parse,
  startOfWeek: (d: Date) => startOfWeek(d, { weekStartsOn: 1 }),
  getDay, locales,
})

const MESSAGES = {
  today: 'Hoy', previous: 'Anterior', next: 'Siguiente',
  month: 'Mes', week: 'Semana', day: 'Día', agenda: 'Lista',
  date: 'Fecha', time: 'Hora', event: 'Cita',
  noEventsInRange: 'No hay citas en este período.',
  showMore: (n: number) => `+${n} más`,
}

/* ── Tipos ── */
interface CitaEvento {
  id: string; title: string; start: Date; end: Date; resource: CitaAPI
}
interface CitaAPI {
  id: string; paciente_nombre: string; fisioterapeuta_nombre: string
  servicio_nombre: string; servicio_color: string; sala_nombre: string | null
  fecha_hora: string; fecha_hora_fin: string; duracion_minutos: number
  estado: string; origen: string
}
interface CitaDetalle extends CitaAPI {
  notas_paciente: string; notas_internas: string
  paciente: { id: string; nombre_completo: string; cedula: string }
  fisioterapeuta: { id: string; nombre_completo: string }
  servicio: { id: string; nombre: string; duracion_minutos: number; precio: string; color: string }
  sala: { id: string; nombre: string } | null
}
interface Fisioterapeuta { id: string; nombre_completo: string; email: string }
interface PacienteResult { id: string; nombre_completo: string; cedula: string }
interface Servicio { id: string; nombre: string; duracion_minutos: number; color: string }
interface Sala { id: string; nombre: string }
interface ResumenHoy { total: number; pendientes: number; confirmadas: number; completadas: number; canceladas: number }

/* ── Badge de estado ── */
const ESTADO_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  pendiente:  { label: 'Pendiente',  bg: 'bg-amber-100',   text: 'text-amber-700' },
  confirmada: { label: 'Confirmada', bg: 'bg-sky-100',     text: 'text-sky-700' },
  en_curso:   { label: 'En curso',   bg: 'bg-emerald-100', text: 'text-emerald-700' },
  completada: { label: 'Completada', bg: 'bg-gray-100',    text: 'text-gray-600' },
  cancelada:  { label: 'Cancelada',  bg: 'bg-red-100',     text: 'text-red-600' },
  no_asistio: { label: 'No asistió', bg: 'bg-red-100',     text: 'text-red-600' },
}

function EstadoBadge({ estado }: { estado: string }) {
  const cfg = ESTADO_CONFIG[estado] ?? { label: estado, bg: 'bg-gray-100', text: 'text-gray-600' }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  )
}

/* ── Buscador de pacientes ── */
function PacienteBuscador({ value, onChange }: {
  value: PacienteResult | null
  onChange: (p: PacienteResult | null) => void
}) {
  const [q, setQ] = useState('')
  const [resultados, setResultados] = useState<PacienteResult[]>([])
  const [open, setOpen] = useState(false)
  const [buscando, setBuscando] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!q || q.length < 2) { setResultados([]); setOpen(false); return }
    debounceRef.current = setTimeout(async () => {
      setBuscando(true)
      try {
        const data = await pacientesRepository.listar({ q })
        const list: any[] = Array.isArray(data) ? data : (data.results ?? [])
        setResultados(list.map((p) => ({
          id: p.id,
          nombre_completo: p.nombre_completo
            ?? p.user?.nombre_completo
            ?? `${p.user?.nombres ?? ''} ${p.user?.apellidos ?? ''}`.trim(),
          cedula: p.cedula ?? '',
        })))
        setOpen(true)
      } catch { setResultados([]) }
      finally { setBuscando(false) }
    }, 300)
  }, [q])

  if (value) {
    return (
      <div className="flex items-center gap-2 border border-sky-300 bg-sky-50 rounded-lg px-3 py-2.5 text-sm">
        <User className="w-4 h-4 text-sky-500 shrink-0" />
        <span className="flex-1 font-medium text-gray-900">{value.nombre_completo}</span>
        {value.cedula && <span className="text-gray-400 text-xs">CI {value.cedula}</span>}
        <button type="button" onClick={() => onChange(null)} className="text-gray-400 hover:text-gray-600 ml-1">
          <X className="w-4 h-4" />
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        {buscando && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
        )}
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por nombre o cédula…"
          className="w-full border border-gray-200 rounded-lg pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
        />
      </div>
      {open && resultados.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          {resultados.slice(0, 6).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { onChange(p); setQ(''); setOpen(false) }}
              className="w-full text-left px-4 py-2.5 hover:bg-sky-50 text-sm transition-colors border-b border-gray-50 last:border-0"
            >
              <span className="font-medium text-gray-900">{p.nombre_completo}</span>
              {p.cedula && <span className="text-gray-400 ml-2 text-xs">CI {p.cedula}</span>}
            </button>
          ))}
        </div>
      )}
      {open && !buscando && q.length >= 2 && resultados.length === 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg px-4 py-3 text-sm text-gray-400">
          Sin resultados para "{q}"
        </div>
      )}
    </div>
  )
}

/* ── Modal: Nueva cita ── */
interface NuevaCitaForm {
  paciente: PacienteResult | null
  fisioterapeuta_id: string
  servicio_id: string
  sala_id: string
  fecha_hora: string
  duracion_minutos: string
  notas_paciente: string
  notas_internas: string
}

const FORM_EMPTY: NuevaCitaForm = {
  paciente: null, fisioterapeuta_id: '', servicio_id: '', sala_id: '',
  fecha_hora: '', duracion_minutos: '60', notas_paciente: '', notas_internas: '',
}

function NuevaCitaModal({ open, onClose, onSaved, fisioterapeutas, servicios, salas, initialDateTime }: {
  open: boolean; onClose: () => void; onSaved: () => void
  fisioterapeutas: Fisioterapeuta[]; servicios: Servicio[]; salas: Sala[]
  initialDateTime?: Date
}) {
  const [form, setForm] = useState<NuevaCitaForm>(FORM_EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      const dt = initialDateTime ? format(initialDateTime, "yyyy-MM-dd'T'HH:mm") : ''
      setForm({ ...FORM_EMPTY, fecha_hora: dt })
      setError(null)
    }
  }, [open, initialDateTime])

  const set = (field: keyof NuevaCitaForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const val = e.target.value
      setForm((f) => {
        const next = { ...f, [field]: val }
        if (field === 'servicio_id') {
          const svc = servicios.find((s) => s.id === val)
          if (svc) next.duracion_minutos = String(svc.duracion_minutos)
        }
        return next
      })
    }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.paciente || !form.fisioterapeuta_id || !form.fecha_hora) {
      setError('Completa los campos obligatorios (paciente, fisioterapeuta y fecha).')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await agendaRepository.crearCita({
        paciente: form.paciente.id,
        fisioterapeuta: form.fisioterapeuta_id,
        ...(form.servicio_id && { servicio: form.servicio_id }),
        ...(form.sala_id && { sala: form.sala_id }),
        fecha_hora: form.fecha_hora,
        duracion_minutos: parseInt(form.duracion_minutos),
        notas_paciente: form.notas_paciente,
        notas_internas: form.notas_internas,
      })
      onSaved()
      onClose()
    } catch (err: any) {
      const d = err?.response?.data
      if (d?.fecha_hora) setError(Array.isArray(d.fecha_hora) ? d.fecha_hora[0] : d.fecha_hora)
      else if (d?.non_field_errors) setError(d.non_field_errors[0])
      else if (d?.detail) setError(d.detail)
      else setError('No se pudo guardar la cita. Verifica los datos.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Nueva cita</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Paciente <span className="text-red-400">*</span>
            </label>
            <PacienteBuscador
              value={form.paciente}
              onChange={(p) => setForm((f) => ({ ...f, paciente: p }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fisioterapeuta <span className="text-red-400">*</span>
            </label>
            <select
              value={form.fisioterapeuta_id}
              onChange={set('fisioterapeuta_id')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            >
              <option value="">Seleccionar fisioterapeuta</option>
              {fisioterapeutas.map((f) => (
                <option key={f.id} value={f.id}>{f.nombre_completo}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Servicio</label>
            <select
              value={form.servicio_id}
              onChange={set('servicio_id')}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            >
              <option value="">Sin especificar</option>
              {servicios.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha y hora <span className="text-red-400">*</span>
              </label>
              <input
                type="datetime-local"
                value={form.fecha_hora}
                onChange={set('fecha_hora')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Duración</label>
              <select
                value={form.duracion_minutos}
                onChange={set('duracion_minutos')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              >
                {[15, 20, 30, 45, 60, 90, 120].map((m) => (
                  <option key={m} value={m}>{m} min</option>
                ))}
              </select>
            </div>
          </div>

          {salas.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sala</label>
              <select
                value={form.sala_id}
                onChange={set('sala_id')}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              >
                <option value="">Sin asignar</option>
                {salas.map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas para el paciente</label>
            <textarea
              value={form.notas_paciente}
              onChange={set('notas_paciente')}
              rows={2}
              placeholder="Indicaciones previas, preparación…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas internas</label>
            <textarea
              value={form.notas_internas}
              onChange={set('notas_internas')}
              rows={2}
              placeholder="Observaciones del equipo clínico…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-70"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando…</> : 'Guardar cita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Modal: Detalle de cita ── */
function DetalleCitaModal({ citaId, onClose, onUpdated }: {
  citaId: string | null; onClose: () => void; onUpdated: () => void
}) {
  const [cita, setCita] = useState<CitaDetalle | null>(null)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [reasignando, setReasignando] = useState(false)
  const [nuevaFechaHora, setNuevaFechaHora] = useState('')
  const [reasignarError, setReasignarError] = useState('')
  const [editando, setEditando] = useState(false)
  const [editDuracion, setEditDuracion] = useState('')
  const [editNotas, setEditNotas] = useState('')
  const [editError, setEditError] = useState('')
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false)
  const { user } = useSelector((state: any) => state.auth)
  const puedeEliminar = user?.rol === 'admin' || user?.rol === 'recepcionista'

  useEffect(() => {
    if (!citaId) return
    setLoading(true)
    setReasignando(false)
    setEditando(false)
    agendaRepository.obtenerCita(citaId)
      .then(setCita)
      .catch(() => setCita(null))
      .finally(() => setLoading(false))
  }, [citaId])

  const doAction = async (action: 'confirmar' | 'completar' | 'cancelar') => {
    if (!citaId) return
    setActionLoading(action)
    try {
      if (action === 'confirmar') await agendaRepository.confirmarCita(citaId)
      else if (action === 'completar') await agendaRepository.completarCita(citaId)
      else await agendaRepository.cancelarCita(citaId)
      onUpdated()
      onClose()
    } catch {} finally { setActionLoading(null) }
  }

  const iniciarReasignacion = () => {
    if (!cita) return
    const local = new Date(cita.fecha_hora)
    const offset = local.getTimezoneOffset()
    const adjusted = new Date(local.getTime() - offset * 60000)
    setNuevaFechaHora(adjusted.toISOString().slice(0, 16))
    setReasignarError('')
    setEditando(false)
    setReasignando(true)
  }

  const iniciarEdicion = () => {
    if (!cita) return
    setEditDuracion(String(cita.duracion_minutos))
    setEditNotas(cita.notas_internas ?? '')
    setEditError('')
    setReasignando(false)
    setEditando(true)
  }

  const eliminarCita = async () => {
    if (!citaId) return
    setActionLoading('eliminar')
    try {
      await agendaRepository.eliminarCita(citaId)
      onUpdated()
      onClose()
    } catch {} finally { setActionLoading(null) }
  }

  const guardarEdicion = async () => {
    if (!citaId) return
    setActionLoading('editar')
    setEditError('')
    try {
      await agendaRepository.actualizarCita(citaId, {
        duracion_minutos: parseInt(editDuracion),
        notas_internas: editNotas,
      })
      onUpdated()
      onClose()
    } catch (err: any) {
      setEditError(err?.response?.data?.detail ?? 'No se pudo guardar los cambios.')
    } finally { setActionLoading(null) }
  }

  const guardarReasignacion = async () => {
    if (!citaId || !nuevaFechaHora) return
    setActionLoading('reasignar')
    setReasignarError('')
    try {
      await agendaRepository.actualizarCita(citaId, { fecha_hora: nuevaFechaHora })
      onUpdated()
      onClose()
    } catch (err: any) {
      const d = err?.response?.data
      if (d?.fecha_hora) setReasignarError(Array.isArray(d.fecha_hora) ? d.fecha_hora[0] : d.fecha_hora)
      else if (d?.detail) setReasignarError(d.detail)
      else setReasignarError('No se pudo reprogramar la cita.')
    } finally { setActionLoading(null) }
  }

  if (!citaId) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Detalle de cita</h2>
          <div className="flex items-center gap-1">
            {puedeEliminar && (
              <button
                onClick={() => setConfirmandoEliminar(true)}
                className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded transition-colors"
                title="Eliminar cita"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {confirmandoEliminar && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
            <p className="text-sm font-semibold text-red-800 flex items-center gap-1.5">
              <Trash2 className="w-4 h-4" />
              ¿Eliminar esta cita permanentemente?
            </p>
            <p className="text-xs text-red-600">Esta acción no se puede deshacer.</p>
            <div className="flex gap-2">
              <button
                onClick={eliminarCita}
                disabled={!!actionLoading}
                className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
              >
                {actionLoading === 'eliminar' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Sí, eliminar
              </button>
              <button
                onClick={() => setConfirmandoEliminar(false)}
                disabled={!!actionLoading}
                className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-sm transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="p-6">
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
            </div>
          )}

          {!loading && !cita && (
            <p className="text-center text-sm text-gray-400 py-8">No se pudo cargar la cita.</p>
          )}

          {!loading && cita && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <EstadoBadge estado={cita.estado} />
                <span className="text-xs text-gray-400 capitalize">{cita.origen}</span>
              </div>

              {/* Servicio */}
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: cita.servicio?.color ?? '#3B82F6' }}
                />
                <span className="font-semibold text-gray-900">{cita.servicio?.nombre ?? 'Sin servicio'}</span>
                {cita.servicio?.duracion_minutos && (
                  <span className="text-sm text-gray-400">({cita.servicio.duracion_minutos} min)</span>
                )}
              </div>

              {/* Datos */}
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center gap-2 text-gray-700">
                  <User className="w-4 h-4 text-gray-400 shrink-0" />
                  <span className="font-medium">{cita.paciente?.nombre_completo}</span>
                  {cita.paciente?.cedula && (
                    <span className="text-gray-400 text-xs">CI {cita.paciente.cedula}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <User className="w-4 h-4 text-gray-400 shrink-0" />
                  <span>{cita.fisioterapeuta?.nombre_completo}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <CalIcon className="w-4 h-4 text-gray-400 shrink-0" />
                  <span>
                    {format(new Date(cita.fecha_hora), "EEEE d 'de' MMMM, HH:mm", { locale: es })}
                    {' – '}
                    {format(new Date(cita.fecha_hora_fin), 'HH:mm')}
                  </span>
                </div>
                {cita.sala && (
                  <div className="flex items-center gap-2 text-gray-700">
                    <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
                    <span>{cita.sala.nombre}</span>
                  </div>
                )}
                {cita.notas_paciente && (
                  <div className="flex gap-2 text-gray-600 bg-gray-50 p-2.5 rounded-lg">
                    <FileText className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
                    <p className="text-xs">{cita.notas_paciente}</p>
                  </div>
                )}
                {cita.notas_internas && (
                  <div className="flex gap-2 bg-amber-50 p-2.5 rounded-lg">
                    <FileText className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-amber-800 text-xs">{cita.notas_internas}</p>
                  </div>
                )}
              </div>

              {/* Panel de reasignación */}
              {reasignando && (
                <div className="border border-sky-200 bg-sky-50 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-sky-800 flex items-center gap-1.5">
                    <CalendarClock className="w-4 h-4" />
                    Reprogramar cita
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nuevo día y hora</label>
                    <input
                      type="datetime-local"
                      value={nuevaFechaHora}
                      onChange={(e) => setNuevaFechaHora(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-white"
                    />
                  </div>
                  {reasignarError && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />{reasignarError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={guardarReasignacion}
                      disabled={!!actionLoading || !nuevaFechaHora}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
                    >
                      {actionLoading === 'reasignar'
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <CheckCircle2 className="w-4 h-4" />}
                      Guardar cambio
                    </button>
                    <button
                      onClick={() => { setReasignando(false); setReasignarError('') }}
                      disabled={!!actionLoading}
                      className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-sm transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Panel de edición */}
              {editando && (
                <div className="border border-violet-200 bg-violet-50 rounded-xl p-4 space-y-3">
                  <p className="text-sm font-semibold text-violet-800 flex items-center gap-1.5">
                    <Pencil className="w-4 h-4" />
                    Editar cita
                  </p>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Duración</label>
                    <select
                      value={editDuracion}
                      onChange={(e) => setEditDuracion(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white"
                    >
                      {[15, 20, 30, 45, 60, 90, 120].map((m) => (
                        <option key={m} value={m}>{m} min</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Notas internas</label>
                    <textarea
                      value={editNotas}
                      onChange={(e) => setEditNotas(e.target.value)}
                      rows={2}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 bg-white resize-none"
                    />
                  </div>
                  {editError && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />{editError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={guardarEdicion}
                      disabled={!!actionLoading}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-violet-600 hover:bg-violet-700 text-white py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
                    >
                      {actionLoading === 'editar'
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <CheckCircle2 className="w-4 h-4" />}
                      Guardar
                    </button>
                    <button
                      onClick={() => { setEditando(false); setEditError('') }}
                      disabled={!!actionLoading}
                      className="px-4 py-2 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg text-sm transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Acciones */}
              {!reasignando && !editando && cita.estado === 'pendiente' && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="flex gap-2">
                    <button
                      onClick={() => doAction('confirmar')}
                      disabled={!!actionLoading}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                    >
                      {actionLoading === 'confirmar'
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <CheckCircle2 className="w-4 h-4" />}
                      Confirmar
                    </button>
                    <button
                      onClick={() => doAction('cancelar')}
                      disabled={!!actionLoading}
                      className="flex-1 flex items-center justify-center gap-1.5 border border-red-200 text-red-600 hover:bg-red-50 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                    >
                      {actionLoading === 'cancelar'
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <XCircle className="w-4 h-4" />}
                      Cancelar cita
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={iniciarReasignacion}
                      disabled={!!actionLoading}
                      className="flex-1 flex items-center justify-center gap-1.5 border border-sky-200 text-sky-700 hover:bg-sky-50 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                    >
                      <CalendarClock className="w-4 h-4" />
                      Reprogramar
                    </button>
                    <button
                      onClick={iniciarEdicion}
                      disabled={!!actionLoading}
                      className="flex-1 flex items-center justify-center gap-1.5 border border-violet-200 text-violet-700 hover:bg-violet-50 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                    >
                      <Pencil className="w-4 h-4" />
                      Editar
                    </button>
                  </div>
                </div>
              )}

              {!reasignando && !editando && cita.estado === 'confirmada' && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div className="flex gap-2">
                    <button
                      onClick={() => doAction('completar')}
                      disabled={!!actionLoading}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                    >
                      {actionLoading === 'completar'
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <CheckCircle2 className="w-4 h-4" />}
                      Completar
                    </button>
                    <button
                      onClick={() => doAction('cancelar')}
                      disabled={!!actionLoading}
                      className="flex-1 flex items-center justify-center gap-1.5 border border-red-200 text-red-600 hover:bg-red-50 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                    >
                      {actionLoading === 'cancelar'
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <XCircle className="w-4 h-4" />}
                      Cancelar cita
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={iniciarReasignacion}
                      disabled={!!actionLoading}
                      className="flex-1 flex items-center justify-center gap-1.5 border border-sky-200 text-sky-700 hover:bg-sky-50 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                    >
                      <CalendarClock className="w-4 h-4" />
                      Reprogramar
                    </button>
                    <button
                      onClick={iniciarEdicion}
                      disabled={!!actionLoading}
                      className="flex-1 flex items-center justify-center gap-1.5 border border-violet-200 text-violet-700 hover:bg-violet-50 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                    >
                      <Pencil className="w-4 h-4" />
                      Editar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Página principal ── */
export default function AgendaPage() {
  const [view, setView] = useState<View>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? Views.DAY : Views.WEEK
  )
  const [date, setDate] = useState(new Date())
  const [events, setEvents] = useState<CitaEvento[]>([])
  const [loading, setLoading] = useState(false)
  const [fisioterapeutas, setFisioterapeutas] = useState<Fisioterapeuta[]>([])
  const [servicios, setServicios] = useState<Servicio[]>([])
  const [salas, setSalas] = useState<Sala[]>([])
  const [filtroFisio, setFiltroFisio] = useState('')
  const [detalleCitaId, setDetalleCitaId] = useState<string | null>(null)
  const [modalNuevaCita, setModalNuevaCita] = useState(false)
  const [slotSeleccionado, setSlotSeleccionado] = useState<Date | undefined>(undefined)
  const [resumen, setResumen] = useState<ResumenHoy | null>(null)

  const cargarResumen = useCallback(() => {
    agendaRepository.resumenHoy().then(setResumen).catch(() => {})
  }, [])

  useEffect(() => {
    Promise.all([
      agendaRepository.listarFisioterapeutas().catch(() => []),
      configuracionRepository.listarServicios().catch(() => []),
      configuracionRepository.listarSalas().catch(() => []),
    ]).then(([fisios, svcs, sls]) => {
      const toList = (d: any) => Array.isArray(d) ? d : (d?.results ?? [])
      setFisioterapeutas(toList(fisios))
      setServicios(toList(svcs))
      setSalas(toList(sls))
    })
    cargarResumen()
  }, [cargarResumen])

  const cargarCitas = useCallback(async (rangeDate: Date, currentView: View, fisioId: string) => {
    setLoading(true)
    try {
      let fecha_inicio: string
      let fecha_fin: string

      if (currentView === Views.MONTH) {
        const start = new Date(rangeDate.getFullYear(), rangeDate.getMonth(), 1)
        const end = new Date(rangeDate.getFullYear(), rangeDate.getMonth() + 1, 0)
        fecha_inicio = format(start, 'yyyy-MM-dd')
        fecha_fin = format(end, 'yyyy-MM-dd')
      } else if (currentView === Views.WEEK) {
        const start = startOfWeek(rangeDate, { weekStartsOn: 1 })
        fecha_inicio = format(start, 'yyyy-MM-dd')
        fecha_fin = format(addDays(start, 6), 'yyyy-MM-dd')
      } else {
        fecha_inicio = format(rangeDate, 'yyyy-MM-dd')
        fecha_fin = fecha_inicio
      }

      const params: Record<string, string> = { fecha_inicio, fecha_fin }
      if (fisioId) params.fisioterapeuta = fisioId

      const data = await agendaRepository.listarCitas(params)
      const list: CitaAPI[] = Array.isArray(data) ? data : (data.results ?? [])
      setEvents(
        list.map((c) => ({
          id: c.id,
          title: `${c.paciente_nombre} — ${c.servicio_nombre}`,
          start: new Date(c.fecha_hora),
          end: new Date(c.fecha_hora_fin),
          resource: c,
        }))
      )
    } catch {
      setEvents([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    cargarCitas(date, view, filtroFisio)
  }, [date, view, filtroFisio, cargarCitas])

  const refresh = () => {
    cargarCitas(date, view, filtroFisio)
    cargarResumen()
  }

  const eventStyleGetter = (event: CitaEvento) => {
    const color = event.resource.servicio_color ?? '#3B82F6'
    const estado = event.resource.estado
    return {
      style: {
        backgroundColor: color,
        borderColor: color,
        opacity: estado === 'cancelada' || estado === 'no_asistio' ? 0.4 : 1,
        color: '#fff',
        borderRadius: '6px',
        fontSize: '12px',
        padding: '2px 6px',
      },
    }
  }

  const irHoy = () => setDate(new Date())
  const irAnterior = () => {
    if (view === Views.MONTH) setDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
    else if (view === Views.WEEK) setDate((d) => addDays(d, -7))
    else setDate((d) => addDays(d, -1))
  }
  const irSiguiente = () => {
    if (view === Views.MONTH) setDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
    else if (view === Views.WEEK) setDate((d) => addDays(d, 7))
    else setDate((d) => addDays(d, 1))
  }

  const tituloFecha = () => {
    if (view === Views.MONTH) return format(date, 'MMMM yyyy', { locale: es })
    if (view === Views.WEEK) {
      const start = startOfWeek(date, { weekStartsOn: 1 })
      return `${format(start, 'd MMM', { locale: es })} – ${format(addDays(start, 6), 'd MMM yyyy', { locale: es })}`
    }
    return format(date, "EEEE d 'de' MMMM yyyy", { locale: es })
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Barra superior ── */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 py-3 space-y-2.5">

        {/* Fila 1: navegación de fecha */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0">
            <button onClick={irAnterior} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors shrink-0">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h1 className="text-sm sm:text-base font-semibold text-gray-900 capitalize text-center truncate px-1">
              {tituloFecha()}
            </h1>
            <button onClick={irSiguiente} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors shrink-0">
              <ChevronRight className="w-5 h-5" />
            </button>
            <button onClick={irHoy} className="px-2.5 py-1 text-xs sm:text-sm font-medium text-sky-600 border border-sky-200 rounded-lg hover:bg-sky-50 transition-colors shrink-0">
              Hoy
            </button>
          </div>

          {/* Nueva cita siempre visible */}
          <button
            onClick={() => { setSlotSeleccionado(undefined); setModalNuevaCita(true) }}
            className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nueva cita</span>
            <span className="sm:hidden">Nueva</span>
          </button>
        </div>

        {/* Fila 2: vista + filtros */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs sm:text-sm">
            {([Views.DAY, Views.WEEK, Views.MONTH] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-2.5 py-1.5 font-medium transition-colors ${
                  view === v ? 'bg-sky-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {v === Views.DAY ? 'Día' : v === Views.WEEK ? 'Semana' : 'Mes'}
              </button>
            ))}
          </div>

          {fisioterapeutas.length > 0 && (
            <select
              value={filtroFisio}
              onChange={(e) => setFiltroFisio(e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent flex-1 sm:flex-none min-w-0"
            >
              <option value="">Todos los fisios</option>
              {fisioterapeutas.map((f) => (
                <option key={f.id} value={f.id}>{f.nombre_completo}</option>
              ))}
            </select>
          )}

          <button
            onClick={refresh}
            disabled={loading}
            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50 ml-auto sm:ml-0"
            title="Actualizar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* KPIs de hoy — scroll horizontal en móvil */}
        {resumen && (
          <div className="flex items-center gap-4 overflow-x-auto pb-0.5 scrollbar-none">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide shrink-0">Hoy</span>
            {[
              { label: 'total', value: resumen.total, color: 'text-gray-700' },
              { label: 'pendientes', value: resumen.pendientes, color: 'text-amber-600' },
              { label: 'confirmadas', value: resumen.confirmadas, color: 'text-sky-600' },
              { label: 'completadas', value: resumen.completadas, color: 'text-emerald-600' },
              { label: 'canceladas', value: resumen.canceladas, color: 'text-red-500' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-baseline gap-1 shrink-0">
                <span className={`font-bold text-sm ${color}`}>{value}</span>
                <span className="text-gray-400 text-xs">{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Calendario ── */}
      <div className="flex-1 p-4 min-h-0">
        <style>{`
          .rbc-calendar { font-family: inherit; }
          .rbc-toolbar { display: none; }
          .rbc-header { font-size: 12px; font-weight: 600; color: #6b7280; padding: 8px 4px; border-bottom: 1px solid #f3f4f6; }
          .rbc-today { background-color: #f0f9ff; }
          .rbc-event { border-radius: 6px !important; cursor: pointer; min-height: 36px !important; }
          .rbc-event:focus { outline: none; box-shadow: 0 0 0 2px #0ea5e9; }
          .rbc-event-content { overflow: hidden !important; height: 100%; }
          .rbc-slot-selection { background-color: rgba(14,165,233,0.12); border-radius: 4px; }
          .rbc-time-content { border-top: 1px solid #e5e7eb; }
          .rbc-timeslot-group { border-bottom-color: #f3f4f6; }
          .rbc-time-slot { color: #9ca3af; font-size: 11px; }
          .rbc-off-range-bg { background: #f9fafb; }
          .rbc-show-more { color: #0ea5e9; font-weight: 600; font-size: 11px; }
          .rbc-month-row { border-color: #f3f4f6; }
          .rbc-day-bg + .rbc-day-bg { border-color: #f3f4f6; }
        `}</style>
        <Calendar
          localizer={localizer}
          events={events}
          view={view}
          date={date}
          onNavigate={setDate}
          onView={setView}
          onSelectEvent={(event) => setDetalleCitaId((event as CitaEvento).id)}
          onSelectSlot={({ start }) => { setSlotSeleccionado(start as Date); setModalNuevaCita(true) }}
          selectable
          messages={MESSAGES}
          culture="es"
          eventPropGetter={eventStyleGetter}
          style={{ height: '100%' }}
          step={30}
          timeslots={2}
          min={new Date(2024, 0, 1, 7, 0)}
          max={new Date(2024, 0, 1, 21, 0)}
          formats={{
            dayFormat: (date, culture, localizer) => localizer!.format(date, 'EEE d', culture),
            timeGutterFormat: (date, culture, localizer) => localizer!.format(date, 'HH:mm', culture),
            eventTimeRangeFormat: ({ start, end }, culture, localizer) =>
              `${localizer!.format(start, 'HH:mm', culture)} – ${localizer!.format(end, 'HH:mm', culture)}`,
          }}
          components={{
            event: ({ event }: { event: CitaEvento }) => (
              <div className="flex flex-col h-full overflow-hidden px-0.5">
                <span className="text-xs font-semibold leading-tight truncate">
                  {event.resource.paciente_nombre}
                </span>
                <span className="text-[10px] opacity-80 leading-tight">
                  {format(event.start, 'HH:mm')}–{format(event.end, 'HH:mm')}
                </span>
              </div>
            ),
          }}
        />
      </div>

      {/* ── Modales ── */}
      <NuevaCitaModal
        open={modalNuevaCita}
        onClose={() => setModalNuevaCita(false)}
        onSaved={refresh}
        fisioterapeutas={fisioterapeutas}
        servicios={servicios}
        salas={salas}
        initialDateTime={slotSeleccionado}
      />
      <DetalleCitaModal
        citaId={detalleCitaId}
        onClose={() => setDetalleCitaId(null)}
        onUpdated={refresh}
      />
    </div>
  )
}
