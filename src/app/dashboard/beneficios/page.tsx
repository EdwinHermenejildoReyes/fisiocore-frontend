'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Award, ChevronLeft, ChevronRight, RefreshCw, Loader2,
  CheckCircle2, Clock, DollarSign, Users, AlertTriangle,
  CheckCheck, X, Search,
} from 'lucide-react'
import { beneficiosRepository } from '@/repositories/beneficios'
import { getErrorMessage } from '@/utils/errorMessages'

/* ── Tipos ── */
interface Grupo {
  id: string
  nombre: string
  descripcion: string
  total_pacientes: number
}

interface Config {
  id: string
  grupo: string
  grupo_nombre: string
  meses_obligatorios: number[]
  monto_mensual: string
  sesiones_incluidas: number
}

interface BeneficioRow {
  id: string
  paciente_id: string
  paciente_nombre: string
  grupo_nombre: string
  año: number
  mes: number
  nombre_mes: string
  es_obligatorio: boolean
  pagado: boolean
  fecha_pago: string | null
  monto: string
  metodo_pago: string
  notas: string
  sesiones_usadas: number
  sesiones_disponibles: number
}

interface Reporte {
  año: number | string
  mes: number | string
  total_atletas: number
  pagados: number
  pendientes: number
  obligatorios_pendientes: number
  monto_recaudado: number
  monto_pendiente_obligatorio: number
}

/* ── Helpers ── */
const MESES = [
  '', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
const METODO_LABEL: Record<string, string> = {
  efectivo: 'Efectivo', transferencia: 'Transferencia', tarjeta: 'Tarjeta',
}

function fmt(v: string | number) {
  return `$${Number(v).toLocaleString('es-EC', { minimumFractionDigits: 2 })}`
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

/* ── Modal: Marcar pagado ── */
function ModalMarcarPagado({ beneficio, onClose, onConfirm }: {
  beneficio: BeneficioRow | null
  onClose: () => void
  onConfirm: (id: string, metodo: string, notas: string) => void
}) {
  const [metodo, setMetodo] = useState('efectivo')
  const [notas, setNotas] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (beneficio) { setMetodo('efectivo'); setNotas('') }
  }, [beneficio])

  if (!beneficio) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onConfirm(beneficio.id, metodo, notas)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Registrar pago</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <p className="text-sm text-gray-500">Atleta</p>
            <p className="font-medium text-gray-900">{beneficio.paciente_nombre}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Monto</p>
            <p className="font-bold text-gray-900 text-lg">{fmt(beneficio.monto)}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Método de pago</label>
            <select
              value={metodo}
              onChange={(e) => setMetodo(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="efectivo">Efectivo</option>
              <option value="transferencia">Transferencia</option>
              <option value="tarjeta">Tarjeta</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Notas (opcional)</label>
            <input
              type="text"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Referencia, observaciones…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-gray-200 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-sky-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
              Confirmar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Página principal ── */
export default function BeneficiosPage() {
  const hoy = new Date()
  const [año, setAño] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const [grupos, setGrupos] = useState<Grupo[]>([])
  const [configs, setConfigs] = useState<Config[]>([])
  const [grupoSel, setGrupoSel] = useState<string>('')
  const [beneficios, setBeneficios] = useState<BeneficioRow[]>([])
  const [reporte, setReporte] = useState<Reporte | null>(null)
  const [loading, setLoading] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [modalPago, setModalPago] = useState<BeneficioRow | null>(null)
  const [tab, setTab] = useState<'mes' | 'historial'>('mes')
  const [busqueda, setBusqueda] = useState('')

  // Historial
  const [histNombre, setHistNombre] = useState('')
  const [histBeneficios, setHistBeneficios] = useState<BeneficioRow[]>([])
  const [histLoading, setHistLoading] = useState(false)

  // Cargar grupos y configs al montar
  useEffect(() => {
    Promise.all([
      beneficiosRepository.listarGrupos(),
      beneficiosRepository.listarConfigs(),
    ]).then(([g, c]) => {
      const gList = Array.isArray(g) ? g : (g.results ?? [])
      const cList = Array.isArray(c) ? c : (c.results ?? [])
      setGrupos(gList)
      setConfigs(cList)
      if (gList.length > 0) setGrupoSel(gList[0].id)
    }).catch(() => {})
  }, [])

  const cargarDatos = useCallback(() => {
    if (!grupoSel) return
    setLoading(true)
    setError(null)
    Promise.all([
      beneficiosRepository.listarMensual({ grupo: grupoSel, año, mes }),
      beneficiosRepository.reporte({ grupo: grupoSel, año, mes }),
    ])
      .then(([b, r]) => {
        setBeneficios(Array.isArray(b) ? b : (b.results ?? []))
        setReporte(r)
      })
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false))
  }, [grupoSel, año, mes])

  useEffect(() => { cargarDatos() }, [cargarDatos])

  const handleGenerar = async () => {
    if (!grupoSel) return
    setGenerando(true)
    setError(null)
    try {
      const res = await beneficiosRepository.generarMes({ grupo_id: grupoSel, año, mes })
      cargarDatos()
      if (res.creados === 0) setError(`Todos los registros ya existen (${res.existentes} atletas).`)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setGenerando(false)
    }
  }

  const handleMarcarPagado = async (id: string, metodo: string, notas: string) => {
    await beneficiosRepository.marcarPagado(id, { metodo_pago: metodo, notas })
    setModalPago(null)
    cargarDatos()
  }

  const handleDesmarcar = async (id: string) => {
    await beneficiosRepository.desmarcarPagado(id)
    cargarDatos()
  }

  const prevMes = () => {
    if (mes === 1) { setMes(12); setAño((a) => a - 1) } else setMes((m) => m - 1)
  }
  const nextMes = () => {
    if (mes === 12) { setMes(1); setAño((a) => a + 1) } else setMes((m) => m + 1)
  }

  const configActual = configs.find((c) => c.grupo === grupoSel)
  const esObligatorio = configActual?.meses_obligatorios.includes(mes) ?? false

  // Historial: buscar por nombre de atleta
  const buscarHistorial = () => {
    if (!histNombre.trim()) return
    setHistLoading(true)
    beneficiosRepository.listarMensual({ nombre: histNombre.trim() })
      .then((d) => setHistBeneficios(Array.isArray(d) ? d : (d.results ?? [])))
      .catch(() => setHistBeneficios([]))
      .finally(() => setHistLoading(false))
  }

  const beneficiosFiltrados = busqueda.trim()
    ? beneficios.filter((b) =>
        b.paciente_nombre.toLowerCase().includes(busqueda.toLowerCase())
      )
    : beneficios

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-sky-100 rounded-xl flex items-center justify-center">
            <Award className="w-5 h-5 text-sky-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Beneficios mensuales</h1>
            <p className="text-sm text-gray-400">Control de pagos por grupo de atletas</p>
          </div>
        </div>

        {/* Selector de grupo */}
        {grupos.length > 0 && (
          <select
            value={grupoSel}
            onChange={(e) => setGrupoSel(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 bg-white"
          >
            {grupos.map((g) => (
              <option key={g.id} value={g.id}>{g.nombre}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['mes', 'historial'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'mes' ? 'Mes actual' : 'Historial'}
          </button>
        ))}
      </div>

      {tab === 'mes' && (
        <>
          {/* ── Navegación de mes ── */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
              <button onClick={prevMes} className="p-1 rounded hover:bg-gray-100 text-gray-500">
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm font-semibold text-gray-800 w-36 text-center">
                {MESES[mes]} {año}
              </span>
              <button onClick={nextMes} className="p-1 rounded hover:bg-gray-100 text-gray-500">
                <ChevronRight size={16} />
              </button>
            </div>

            {esObligatorio && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-amber-100 text-amber-700 px-3 py-1.5 rounded-full">
                <AlertTriangle size={12} />
                Mes obligatorio
              </span>
            )}

            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={cargarDatos}
                disabled={loading}
                className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                title="Actualizar"
              >
                <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={handleGenerar}
                disabled={generando || !grupoSel}
                className="flex items-center gap-2 bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-50"
              >
                {generando ? <Loader2 size={14} className="animate-spin" /> : <Users size={14} />}
                Generar mes
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* ── Stats ── */}
          {reporte && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={Users} label="Total atletas" value={String(reporte.total_atletas)} color="bg-sky-100 text-sky-600" />
              <StatCard icon={CheckCircle2} label="Pagaron" value={String(reporte.pagados)} color="bg-emerald-100 text-emerald-600" />
              <StatCard icon={Clock} label="Pendientes" value={String(reporte.pendientes)}
                sub={reporte.obligatorios_pendientes > 0 ? `${reporte.obligatorios_pendientes} obligatorios` : undefined}
                color="bg-amber-100 text-amber-600"
              />
              <StatCard icon={DollarSign} label="Recaudado" value={fmt(reporte.monto_recaudado)} color="bg-violet-100 text-violet-600" />
            </div>
          )}

          {/* ── Búsqueda ── */}
          {beneficios.length > 0 && (
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar atleta…"
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          )}

          {/* ── Tabla ── */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-20 text-gray-400">
                <Loader2 className="animate-spin w-6 h-6" />
              </div>
            ) : beneficios.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Award className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No hay registros para este mes.</p>
                <p className="text-xs mt-1">Usa "Generar mes" para crear los registros del grupo.</p>
              </div>
            ) : beneficiosFiltrados.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">
                No se encontró ningún atleta con ese nombre.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                      Atleta {busqueda && <span className="normal-case font-normal text-sky-600">({beneficiosFiltrados.length} de {beneficios.length})</span>}
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Estado</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Sesiones</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Monto</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Método / Fecha</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {beneficiosFiltrados.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{b.paciente_nombre}</p>
                        {b.es_obligatorio && !b.pagado && (
                          <span className="text-xs text-amber-600 font-medium">Obligatorio</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {b.pagado ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs font-medium px-2.5 py-1 rounded-full">
                            <CheckCircle2 size={11} />Pagado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-medium px-2.5 py-1 rounded-full">
                            <Clock size={11} />Pendiente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {b.sesiones_usadas}/{configActual?.sesiones_incluidas ?? '—'}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{fmt(b.monto)}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {b.pagado
                          ? <>
                              <span>{METODO_LABEL[b.metodo_pago] ?? b.metodo_pago}</span>
                              {b.fecha_pago && <span className="block text-xs text-gray-400">{b.fecha_pago}</span>}
                            </>
                          : '—'
                        }
                      </td>
                      <td className="px-4 py-3 text-right">
                        {b.pagado ? (
                          <button
                            onClick={() => handleDesmarcar(b.id)}
                            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                            title="Desmarcar pago"
                          >
                            Desmarcar
                          </button>
                        ) : (
                          <button
                            onClick={() => setModalPago(b)}
                            className="text-xs bg-sky-50 text-sky-700 hover:bg-sky-100 px-3 py-1.5 rounded-lg font-medium transition-colors"
                          >
                            Marcar pagado
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {tab === 'historial' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={histNombre}
                onChange={(e) => setHistNombre(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && buscarHistorial()}
                placeholder="Nombre del atleta…"
                className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 w-72"
              />
            </div>
            <button
              onClick={buscarHistorial}
              disabled={histLoading}
              className="bg-sky-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-50 flex items-center gap-2"
            >
              {histLoading ? <Loader2 size={14} className="animate-spin" /> : null}
              Buscar
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {histBeneficios.length === 0 ? (
              <div className="text-center py-16 text-gray-400 text-sm">
                Busca un atleta por nombre para ver su historial de beneficios.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Período</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Grupo</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Estado</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Sesiones</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Monto</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wide">Pago</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {histBeneficios.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-medium text-gray-900">
                        {b.nombre_mes} {b.año}
                        {b.es_obligatorio && <span className="ml-2 text-xs text-amber-600">(Obligatorio)</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{b.grupo_nombre}</td>
                      <td className="px-4 py-3">
                        {b.pagado
                          ? <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-700 text-xs font-medium px-2.5 py-1 rounded-full"><CheckCircle2 size={11} />Pagado</span>
                          : <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-medium px-2.5 py-1 rounded-full"><Clock size={11} />Pendiente</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-gray-600">{b.sesiones_usadas} usadas</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{fmt(b.monto)}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {b.pagado
                          ? <>{METODO_LABEL[b.metodo_pago] ?? b.metodo_pago} {b.fecha_pago && <span className="text-xs text-gray-400">· {b.fecha_pago}</span>}</>
                          : '—'
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      <ModalMarcarPagado
        beneficio={modalPago}
        onClose={() => setModalPago(null)}
        onConfirm={handleMarcarPagado}
      />
    </div>
  )
}
