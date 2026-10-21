'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  CreditCard, Search, Plus, X, Loader2, RefreshCw, AlertCircle,
  CheckCircle2, RotateCcw, DollarSign, Clock, Package, TrendingUp, Award,
} from 'lucide-react'
import { cobrosRepository } from '@/repositories/cobros'
import { pacientesRepository } from '@/repositories/pacientes'

/* ── Tipos ── */
interface PagoRow {
  id: string
  paciente_nombre: string
  paciente_id: string | null
  concepto: string
  monto: string
  metodo: string
  estado: string
  referencia: string
  notas: string
  tiene_factura: boolean
  created_at: string
}

interface PaqueteRow {
  id: string
  paciente_nombre: string
  servicio_nombre: string
  total_sesiones: number
  sesiones_usadas: number
  sesiones_disponibles: number
  precio_total: string
  estado: string
  fecha_vence: string | null
  notas: string
  created_at: string
}

interface ResumenData {
  total_hoy: string
  total_mes: string
  pendientes_count: number
  pendientes_monto: string
  pagados_hoy: number
  paquetes_activos: number
}

/* ── Config visual ── */
const METODO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo', transferencia: 'Transferencia',
  tarjeta: 'Tarjeta', en_linea: 'En línea',
}
const ESTADO_PAGO: Record<string, { label: string; cls: string }> = {
  pendiente:   { label: 'Pendiente',   cls: 'bg-amber-100 text-amber-700' },
  pagado:      { label: 'Pagado',      cls: 'bg-emerald-100 text-emerald-700' },
  reembolsado: { label: 'Reembolsado', cls: 'bg-gray-100 text-gray-500' },
}
const ESTADO_PAQUETE: Record<string, { label: string; cls: string }> = {
  activo:    { label: 'Activo',    cls: 'bg-emerald-100 text-emerald-700' },
  agotado:   { label: 'Agotado',   cls: 'bg-amber-100 text-amber-700' },
  vencido:   { label: 'Vencido',   cls: 'bg-red-100 text-red-600' },
  cancelado: { label: 'Cancelado', cls: 'bg-gray-100 text-gray-500' },
}

function fmt(monto: string | number) {
  return `$${Number(monto).toLocaleString('es-EC', { minimumFractionDigits: 2 })}`
}

/* ── StatCard ── */
function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string; sub?: string; color: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 px-5 py-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-gray-400 font-medium">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
        {sub && <p className="text-xs text-gray-400">{sub}</p>}
      </div>
    </div>
  )
}

/* ── Modal: Registrar cobro (3 pasos: paciente → paquete → pago) ── */
function ModalNuevoPago({ open, onClose, onCreado }: {
  open: boolean; onClose: () => void; onCreado: () => void
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [paciente, setPaciente] = useState<{ id: string; nombre: string; grupo_nombre?: string | null } | null>(null)
  const [paquetes, setPaquetes] = useState<PaqueteRow[]>([])
  const [loadingPaq, setLoadingPaq] = useState(false)
  const [paquete, setPaquete] = useState<PaqueteRow | null>(null)
  const [form, setForm] = useState({ monto: '', metodo: 'efectivo', referencia: '', notas: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busq, setBusq] = useState('')
  const [resultados, setResultados] = useState<any[]>([])
  const [loadingBusq, setLoadingBusq] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!open) return
    setStep(1); setPaciente(null); setPaquetes([]); setPaquete(null)
    setForm({ monto: '', metodo: 'efectivo', referencia: '', notas: '' })
    setBusq(''); setResultados([]); setError(null)
  }, [open])

  useEffect(() => {
    if (!open || step !== 1) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (!busq.trim()) { setResultados([]); return }
      setLoadingBusq(true)
      pacientesRepository.listar({ q: busq })
        .then((data: any) => setResultados(Array.isArray(data) ? data : (data.results ?? [])))
        .catch(() => setResultados([]))
        .finally(() => setLoadingBusq(false))
    }, 300)
  }, [busq, open, step])

  const selectPaciente = (p: any) => {
    const nombre = p.nombre_completo ?? `${p.user?.nombres ?? ''} ${p.user?.apellidos ?? ''}`.trim()
    setPaciente({ id: p.id, nombre, grupo_nombre: p.grupo_nombre ?? null })
    setBusq(''); setResultados([]); setStep(2); setLoadingPaq(true)
    cobrosRepository.listarPaquetes({ paciente: p.id })
      .then((data: any) => setPaquetes(Array.isArray(data) ? data : (data.results ?? [])))
      .catch(() => setPaquetes([]))
      .finally(() => setLoadingPaq(false))
  }

  const selectPaquete = (pk: PaqueteRow) => {
    setPaquete(pk)
    setForm((f) => ({ ...f, monto: pk.precio_total }))
    setStep(3)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!paquete) return
    if (!form.monto || Number(form.monto) <= 0) { setError('Ingresa un monto válido.'); return }
    setSaving(true); setError(null)
    try {
      await cobrosRepository.crearPago({
        paquete: paquete.id,
        monto: form.monto,
        metodo: form.metodo,
        referencia: form.referencia,
        notas: form.notas,
      })
      onCreado(); onClose()
    } catch (err: any) {
      const d = err?.response?.data
      if (d?.non_field_errors) setError(d.non_field_errors[0])
      else if (d?.detail) setError(d.detail)
      else setError('No se pudo registrar el cobro.')
    } finally { setSaving(false) }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Registrar cobro</h2>
            {step > 1 && paciente && (
              <p className="text-xs text-gray-500 mt-0.5">{paciente.nombre}</p>
            )}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Indicador de paso */}
          <div className="flex items-center gap-2 mb-5">
            {[1, 2, 3].map((s) => (
              <>
                <div key={s} className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                  step >= s ? 'bg-sky-600 text-white' : 'bg-gray-100 text-gray-400'
                }`}>{s}</div>
                {s < 3 && <div key={`line-${s}`} className={`flex-1 h-0.5 ${step > s ? 'bg-sky-600' : 'bg-gray-100'}`} />}
              </>
            ))}
          </div>

          {/* Paso 1: Buscar paciente */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">Busca al paciente para registrar su cobro:</p>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={busq} onChange={(e) => setBusq(e.target.value)}
                  placeholder="Nombre del paciente…" autoFocus
                  className="pl-9 w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
              </div>
              {loadingBusq && (
                <div className="flex justify-center py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-sky-500" />
                </div>
              )}
              {!loadingBusq && resultados.length > 0 && (
                <div className="border border-gray-200 rounded-xl divide-y divide-gray-50 max-h-52 overflow-y-auto">
                  {resultados.map((p) => (
                    <button key={p.id} type="button" onClick={() => selectPaciente(p)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-sky-50 transition-colors text-left">
                      <div className="w-8 h-8 rounded-full bg-sky-100 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-sky-600">
                          {(p.nombre_completo || '?')[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{p.nombre_completo}</p>
                        {p.cedula && <p className="text-xs text-gray-400">{p.cedula}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {!loadingBusq && busq && resultados.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-2">Sin resultados</p>
              )}
            </div>
          )}

          {/* Paso 2: Seleccionar paquete */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">Selecciona el paquete a cobrar:</p>
                <button onClick={() => { setStep(1); setPaciente(null) }}
                  className="text-xs text-gray-400 hover:text-gray-600">Cambiar paciente</button>
              </div>
              {loadingPaq && (
                <div className="flex justify-center py-6">
                  <Loader2 className="w-5 h-5 animate-spin text-sky-500" />
                </div>
              )}
              {!loadingPaq && paquetes.length === 0 && (
                <div className="space-y-3">
                  <div className="text-center py-6 text-gray-400 text-sm">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Este paciente no tiene paquetes registrados.
                  </div>
                  {paciente?.grupo_nombre && (
                    <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                      <Award className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-amber-800">Paciente con beneficio de grupo</p>
                        <p className="text-amber-700 mt-0.5">
                          {paciente.nombre} pertenece al grupo <strong>{paciente.grupo_nombre}</strong>. Su cobro se gestiona en la sección de Beneficios.
                        </p>
                        <a href="/dashboard/beneficios"
                          className="inline-block mt-2 text-xs font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900">
                          Ir a Beneficios →
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {!loadingPaq && paquetes.length > 0 && (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {paquetes.map((pk) => {
                    const pct = pk.total_sesiones > 0 ? Math.round((pk.sesiones_usadas / pk.total_sesiones) * 100) : 0
                    const estadoCfg = ESTADO_PAQUETE[pk.estado] ?? { label: pk.estado, cls: 'bg-gray-100 text-gray-500' }
                    return (
                      <button key={pk.id} type="button" onClick={() => selectPaquete(pk)}
                        className="w-full text-left border border-gray-200 rounded-xl px-4 py-3 hover:border-sky-300 hover:bg-sky-50 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-gray-900">{pk.servicio_nombre}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${estadoCfg.cls}`}>
                            {estadoCfg.label}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{pk.sesiones_disponibles} de {pk.total_sesiones} sesiones disponibles</span>
                          <span className="font-semibold text-gray-900">{fmt(pk.precio_total)}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${pct >= 80 ? 'bg-amber-400' : 'bg-sky-400'}`}
                            style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Paso 3: Datos del pago */}
          {step === 3 && paquete && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-sky-50 border border-sky-100 rounded-xl px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-sky-900">{paquete.servicio_nombre}</p>
                  <p className="text-xs text-sky-600">{paquete.sesiones_disponibles} sesiones disponibles</p>
                </div>
                <button type="button" onClick={() => setStep(2)}
                  className="text-xs text-sky-500 hover:underline">Cambiar</button>
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  <AlertCircle className="w-4 h-4 shrink-0" />{error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Monto <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <input type="number" min="0.01" step="0.01" value={form.monto}
                      onChange={(e) => setForm({ ...form, monto: e.target.value })} placeholder="0.00"
                      className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Método</label>
                  <select value={form.metodo} onChange={(e) => setForm({ ...form, metodo: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent">
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="tarjeta">Tarjeta</option>
                    <option value="en_linea">En línea</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">N.º referencia / comprobante</label>
                <input type="text" value={form.referencia}
                  onChange={(e) => setForm({ ...form, referencia: e.target.value })}
                  placeholder="Número de transferencia, recibo…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
                <textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })}
                  rows={2} placeholder="Observaciones adicionales…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose}
                  className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-70">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando…</> : 'Registrar cobro'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Modal: Nuevo paquete ── */
function ModalNuevoPaquete({ open, onClose, onCreado }: {
  open: boolean; onClose: () => void; onCreado: () => void
}) {
  const [paciente, setPaciente] = useState<{ id: string; nombre: string } | null>(null)
  const [form, setForm] = useState({
    servicio: '', total_sesiones: '10', precio_total: '', fecha_vence: '', notas: '',
  })
  const [servicios, setServicios] = useState<{ id: string; nombre: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busqPac, setBusqPac] = useState('')
  const [resultadosPac, setResultadosPac] = useState<any[]>([])
  const [loadingPac, setLoadingPac] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!open) return
    setPaciente(null); setBusqPac(''); setResultadosPac([])
    setForm({ servicio: '', total_sesiones: '10', precio_total: '', fecha_vence: '', notas: '' })
    setError(null)
    cobrosRepository.listarServicios()
      .then((data: any) => setServicios(Array.isArray(data) ? data : (data.results ?? [])))
      .catch(() => {})
  }, [open])

  useEffect(() => {
    if (!open) return
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (!busqPac.trim()) { setResultadosPac([]); return }
      setLoadingPac(true)
      pacientesRepository.listar({ q: busqPac })
        .then((data: any) => setResultadosPac(Array.isArray(data) ? data : (data.results ?? [])))
        .catch(() => setResultadosPac([]))
        .finally(() => setLoadingPac(false))
    }, 300)
  }, [busqPac, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!paciente || !form.servicio || !form.precio_total) {
      setError('Completa los campos obligatorios.')
      return
    }
    setSaving(true); setError(null)
    try {
      await cobrosRepository.crearPaquete({
        paciente: paciente.id,
        servicio: form.servicio,
        total_sesiones: parseInt(form.total_sesiones),
        precio_total: form.precio_total,
        fecha_vence: form.fecha_vence || undefined,
        notas: form.notas,
      })
      onCreado(); onClose()
    } catch (err: any) {
      const d = err?.response?.data
      if (d?.detail) setError(d.detail)
      else if (d?.paciente) setError(`Paciente: ${Array.isArray(d.paciente) ? d.paciente[0] : d.paciente}`)
      else setError('No se pudo crear el paquete.')
    } finally { setSaving(false) }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">Nuevo paquete de sesiones</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}

          {/* Paciente */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Paciente <span className="text-red-400">*</span>
            </label>
            {paciente ? (
              <div className="flex items-center gap-2 bg-sky-50 border border-sky-200 rounded-lg px-3 py-2">
                <p className="flex-1 text-sm font-medium text-sky-800">{paciente.nombre}</p>
                <button type="button" onClick={() => setPaciente(null)}
                  className="text-sky-400 hover:text-sky-600">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={busqPac} onChange={(e) => setBusqPac(e.target.value)}
                    placeholder="Buscar paciente…"
                    className="pl-9 w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
                </div>
                {loadingPac && <div className="mt-1 flex"><Loader2 className="w-4 h-4 animate-spin text-sky-500" /></div>}
                {resultadosPac.length > 0 && (
                  <div className="mt-1 border border-gray-200 rounded-xl divide-y divide-gray-50 max-h-36 overflow-y-auto">
                    {resultadosPac.map((p) => (
                      <button key={p.id} type="button"
                        onClick={() => { setPaciente({ id: p.id, nombre: p.nombre_completo }); setBusqPac(''); setResultadosPac([]) }}
                        className="w-full text-left px-4 py-2.5 hover:bg-sky-50 transition-colors text-sm text-gray-900">
                        {p.nombre_completo}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Servicio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Servicio <span className="text-red-400">*</span>
            </label>
            <select value={form.servicio} onChange={(e) => setForm({ ...form, servicio: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent">
              <option value="">Seleccionar servicio…</option>
              {servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">N.º sesiones <span className="text-red-400">*</span></label>
              <input type="number" min="1" value={form.total_sesiones}
                onChange={(e) => setForm({ ...form, total_sesiones: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Precio total <span className="text-red-400">*</span></label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                <input type="number" min="0.01" step="0.01" value={form.precio_total}
                  onChange={(e) => setForm({ ...form, precio_total: e.target.value })} placeholder="0.00"
                  className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha de vencimiento</label>
            <input type="date" value={form.fecha_vence}
              onChange={(e) => setForm({ ...form, fecha_vence: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
            <input type="text" value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })}
              placeholder="Condiciones especiales, descuentos…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">
              Cancelar
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-70">
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Creando…</> : 'Crear paquete'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Tab Pagos ── */
function TabPagos({ q, reload }: { q: string; reload: number }) {
  const [pagos, setPagos] = useState<PagoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [filtroMetodo, setFiltroMetodo] = useState('')
  const [modalNuevo, setModalNuevo] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (q) params.q = q
      if (filtroEstado) params.estado = filtroEstado
      if (filtroMetodo) params.metodo = filtroMetodo
      const data = await cobrosRepository.listarPagos(params)
      setPagos(Array.isArray(data) ? data : (data.results ?? []))
    } catch { setPagos([]) } finally { setLoading(false) }
  }, [q, filtroEstado, filtroMetodo])

  useEffect(() => { cargar() }, [cargar, reload])

  const doAction = async (id: string, action: 'pagado' | 'reembolso') => {
    setActionLoading(id)
    try {
      if (action === 'pagado') await cobrosRepository.marcarPagado(id)
      else await cobrosRepository.reembolsar(id)
      cargar()
    } finally { setActionLoading(null) }
  }

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {[['', 'Todos'], ['pendiente', 'Pendientes'], ['pagado', 'Pagados'], ['reembolsado', 'Reembolsados']].map(([v, l]) => (
            <button key={v} onClick={() => setFiltroEstado(v)}
              className={`px-3 py-1.5 font-medium transition-colors ${filtroEstado === v ? 'bg-sky-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              {l}
            </button>
          ))}
        </div>
        <select value={filtroMetodo} onChange={(e) => setFiltroMetodo(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent">
          <option value="">Todos los métodos</option>
          <option value="efectivo">Efectivo</option>
          <option value="transferencia">Transferencia</option>
          <option value="tarjeta">Tarjeta</option>
          <option value="en_linea">En línea</option>
        </select>
        <div className="ml-auto">
          <button onClick={() => setModalNuevo(true)}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
            <Plus className="w-4 h-4" />Registrar cobro
          </button>
        </div>
      </div>

      {loading && <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-sky-500" /></div>}

      {!loading && pagos.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Sin cobros registrados</p>
        </div>
      )}

      {!loading && pagos.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Paciente / Concepto</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Monto</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Método</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Fecha</th>
                <th className="w-32" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pagos.map((p) => {
                const estadoCfg = ESTADO_PAGO[p.estado] ?? { label: p.estado, cls: 'bg-gray-100 text-gray-600' }
                const isLoading = actionLoading === p.id
                return (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{p.paciente_nombre}</p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[220px]">{p.concepto}</p>
                      {p.referencia && <p className="text-xs text-gray-400 font-mono">{p.referencia}</p>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(p.monto)}</td>
                    <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                      {METODO_LABEL[p.metodo] ?? p.metodo}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${estadoCfg.cls}`}>
                        {estadoCfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 hidden lg:table-cell">
                      {new Date(p.created_at).toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        {p.estado === 'pendiente' && (
                          <button onClick={() => doAction(p.id, 'pagado')} disabled={isLoading}
                            title="Marcar como pagado"
                            className="flex items-center gap-1 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2.5 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50">
                            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            Cobrar
                          </button>
                        )}
                        {p.estado === 'pagado' && (
                          <button onClick={() => doAction(p.id, 'reembolso')} disabled={isLoading}
                            title="Registrar reembolso"
                            className="flex items-center gap-1 text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 px-2.5 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50">
                            {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                            Devolver
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <ModalNuevoPago open={modalNuevo} onClose={() => setModalNuevo(false)} onCreado={cargar} />
    </>
  )
}

/* ── Tab Paquetes ── */
function TabPaquetes({ q, reload }: { q: string; reload: number }) {
  const [paquetes, setPaquetes] = useState<PaqueteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('')
  const [modalNuevo, setModalNuevo] = useState(false)
  const [cancelLoading, setCancelLoading] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (q) params.q = q
      if (filtroEstado) params.estado = filtroEstado
      const data = await cobrosRepository.listarPaquetes(params)
      setPaquetes(Array.isArray(data) ? data : (data.results ?? []))
    } catch { setPaquetes([]) } finally { setLoading(false) }
  }, [q, filtroEstado])

  useEffect(() => { cargar() }, [cargar, reload])

  const cancelar = async (id: string) => {
    if (!confirm('¿Cancelar este paquete?')) return
    setCancelLoading(id)
    try { await cobrosRepository.cancelarPaquete(id); cargar() }
    finally { setCancelLoading(null) }
  }

  return (
    <>
      <div className="flex items-center gap-3 flex-wrap mb-4">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
          {[['', 'Todos'], ['activo', 'Activos'], ['agotado', 'Agotados'], ['vencido', 'Vencidos']].map(([v, l]) => (
            <button key={v} onClick={() => setFiltroEstado(v)}
              className={`px-3 py-1.5 font-medium transition-colors ${filtroEstado === v ? 'bg-sky-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
              {l}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <button onClick={() => setModalNuevo(true)}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
            <Plus className="w-4 h-4" />Nuevo paquete
          </button>
        </div>
      </div>

      {loading && <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-sky-500" /></div>}

      {!loading && paquetes.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Sin paquetes registrados</p>
        </div>
      )}

      {!loading && paquetes.length > 0 && (
        <div className="space-y-3">
          {paquetes.map((pk) => {
            const estadoCfg = ESTADO_PAQUETE[pk.estado] ?? { label: pk.estado, cls: 'bg-gray-100 text-gray-500' }
            const pct = pk.total_sesiones > 0 ? Math.round((pk.sesiones_usadas / pk.total_sesiones) * 100) : 0
            const isCanceling = cancelLoading === pk.id
            return (
              <div key={pk.id} className="bg-white rounded-xl border border-gray-100 px-5 py-4 hover:border-gray-200 transition-colors">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-gray-900">{pk.paciente_nombre}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${estadoCfg.cls}`}>
                        {estadoCfg.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5">{pk.servicio_nombre}</p>
                    {pk.notas && <p className="text-xs text-gray-400 mt-1">{pk.notas}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-gray-900">{fmt(pk.precio_total)}</p>
                    <p className="text-xs text-gray-400">
                      {new Date(pk.created_at).toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{pk.sesiones_usadas} de {pk.total_sesiones} sesiones usadas</span>
                    <span className="font-medium">{pk.sesiones_disponibles} disponibles</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${pct >= 100 ? 'bg-red-400' : pct >= 80 ? 'bg-amber-400' : 'bg-sky-500'}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                  <div>
                    {pk.fecha_vence && (
                      <p className="text-xs text-gray-400">
                        Vence: {new Date(pk.fecha_vence + 'T00:00:00').toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    )}
                  </div>
                  {pk.estado === 'activo' && (
                    <button onClick={() => cancelar(pk.id)} disabled={isCanceling}
                      className="text-xs text-gray-400 hover:text-red-500 transition-colors flex items-center gap-1 disabled:opacity-50">
                      {isCanceling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                      Cancelar paquete
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ModalNuevoPaquete open={modalNuevo} onClose={() => setModalNuevo(false)} onCreado={cargar} />
    </>
  )
}

/* ── Página principal ── */
type Tab = 'pagos' | 'paquetes'

export default function CobrosPage() {
  const [tab, setTab] = useState<Tab>('pagos')
  const [q, setQ] = useState('')
  const [resumen, setResumen] = useState<ResumenData | null>(null)
  const [reload, setReload] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedQ, setDebouncedQ] = useState('')

  useEffect(() => {
    cobrosRepository.resumen().then(setResumen).catch(() => {})
  }, [reload])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQ(q), 300)
  }, [q])

  const triggerReload = () => setReload((r) => r + 1)

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <CreditCard className="w-5 h-5 text-gray-400" />
            <h1 className="text-lg font-semibold text-gray-900">Cobros</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Paciente o referencia…"
                className="pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-56 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              />
              {q && (
                <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button onClick={triggerReload}
              className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50" title="Actualizar">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* KPIs */}
        {resumen && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard icon={TrendingUp} label="Cobrado hoy" value={fmt(resumen.total_hoy)}
              sub={`${resumen.pagados_hoy} cobro${resumen.pagados_hoy !== 1 ? 's' : ''}`}
              color="bg-emerald-100 text-emerald-600" />
            <StatCard icon={DollarSign} label="Cobrado este mes" value={fmt(resumen.total_mes)}
              color="bg-sky-100 text-sky-600" />
            <StatCard icon={Clock} label="Pendientes" value={fmt(resumen.pendientes_monto)}
              sub={`${resumen.pendientes_count} cobro${resumen.pendientes_count !== 1 ? 's' : ''}`}
              color="bg-amber-100 text-amber-600" />
            <StatCard icon={Package} label="Paquetes activos" value={String(resumen.paquetes_activos)}
              color="bg-violet-100 text-violet-600" />
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-100">
          {([['pagos', 'Pagos', CreditCard], ['paquetes', 'Paquetes de sesiones', Package]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === id ? 'border-sky-600 text-sky-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {tab === 'pagos' && <TabPagos q={debouncedQ} reload={reload} />}
        {tab === 'paquetes' && <TabPaquetes q={debouncedQ} reload={reload} />}
      </div>
    </div>
  )
}
