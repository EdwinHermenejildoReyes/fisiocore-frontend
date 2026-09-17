'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useDispatch, useSelector } from 'react-redux'
import { useState, useEffect } from 'react'
import {
  Activity,
  Calendar,
  Users,
  ClipboardList,
  Dumbbell,
  CreditCard,
  BarChart2,
  Settings,
  LogOut,
  Home,
  Menu,
  X,
} from 'lucide-react'
import { logoutUser } from '@/store/auth/slices'
import NotificationBell from '@/components/NotificationBell'

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  exact: boolean
  roles: string[]   // roles que pueden ver este ítem; [] = todos
}

// roles: [] significa que todos los roles de staff tienen acceso
const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',               label: 'Inicio',        icon: Home,          exact: true,  roles: [] },
  { href: '/dashboard/agenda',        label: 'Agenda',        icon: Calendar,      exact: false, roles: [] },
  { href: '/dashboard/pacientes',     label: 'Pacientes',     icon: Users,         exact: false, roles: [] },
  { href: '/dashboard/expediente',    label: 'Expediente',    icon: ClipboardList, exact: false, roles: ['admin', 'fisioterapeuta'] },
  { href: '/dashboard/ejercicios',    label: 'Ejercicios',    icon: Dumbbell,      exact: false, roles: ['admin', 'fisioterapeuta'] },
  { href: '/dashboard/pagos',         label: 'Cobros',        icon: CreditCard,    exact: false, roles: ['admin', 'recepcionista'] },
  { href: '/dashboard/reportes',      label: 'Reportes',      icon: BarChart2,     exact: false, roles: [] },
  { href: '/dashboard/configuracion', label: 'Configuración', icon: Settings,      exact: false, roles: ['admin'] },
]

// Rutas protegidas: ruta → roles permitidos
const ROUTE_PERMISSIONS: Record<string, string[]> = {
  '/dashboard/expediente':    ['admin', 'fisioterapeuta'],
  '/dashboard/ejercicios':    ['admin', 'fisioterapeuta'],
  '/dashboard/pagos':         ['admin', 'recepcionista'],
  '/dashboard/configuracion': ['admin'],
}

const ROL_LABEL: Record<string, string> = {
  admin:          'Administrador',
  fisioterapeuta: 'Fisioterapeuta',
  recepcionista:  'Recepcionista',
  paciente:       'Paciente',
}

function canAccess(rol: string, roles: string[]) {
  return roles.length === 0 || roles.includes(rol)
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const dispatch = useDispatch()
  const { user } = useSelector((state: any) => state.auth)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Redirigir si el usuario intenta acceder a una ruta no permitida
  useEffect(() => {
    if (!user?.rol) return
    const entry = Object.entries(ROUTE_PERMISSIONS).find(([route]) =>
      pathname.startsWith(route)
    )
    if (entry && !canAccess(user.rol, entry[1])) {
      router.replace('/dashboard')
    }
  }, [pathname, user?.rol, router])

  // Cierra el sidebar al navegar
  useEffect(() => { setSidebarOpen(false) }, [pathname])

  // Bloquea scroll del body cuando el sidebar móvil está abierto
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [sidebarOpen])

  const handleLogout = () => {
    dispatch(logoutUser())
    window.location.href = '/login'
  }

  const initials = user
    ? `${user.nombres?.[0] ?? ''}${user.apellidos?.[0] ?? ''}`.toUpperCase()
    : '?'

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-sky-600 rounded-lg flex items-center justify-center">
            <Activity className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-lg font-bold">
            <span className="text-sky-600">Fisio</span>Core
          </span>
        </div>
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
        >
          <X size={18} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.filter(item => canAccess(user?.rol ?? '', item.roles)).map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-sky-50 text-sky-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon size={17} className={active ? 'text-sky-600' : 'text-gray-400'} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User */}
      <div className="border-t border-gray-100 p-3">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <div className="w-8 h-8 bg-sky-100 rounded-full flex items-center justify-center shrink-0">
            <span className="text-sky-700 text-xs font-bold">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user?.nombres} {user?.apellidos}
            </p>
            <p className="text-xs text-gray-400 truncate">
              {ROL_LABEL[user?.rol ?? ''] ?? user?.rol}
            </p>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <NotificationBell />
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded-lg hover:bg-gray-100"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </div>
    </>
  )

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">

      {/* ─── Sidebar desktop (siempre visible en lg+) ─── */}
      <aside className="hidden lg:flex w-60 bg-white border-r border-gray-100 flex-col shrink-0">
        <SidebarContent />
      </aside>

      {/* ─── Sidebar móvil (slide-in) ─── */}
      <>
        {/* Overlay */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Drawer */}
        <aside
          className={`lg:hidden fixed inset-y-0 left-0 z-50 w-64 bg-white flex flex-col shadow-xl transition-transform duration-300 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <SidebarContent />
        </aside>
      </>

      {/* ─── Área principal ─── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Top bar móvil */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Abrir menú"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-sky-600 rounded-md flex items-center justify-center">
              <Activity className="w-3 h-3 text-white" />
            </div>
            <span className="text-base font-bold">
              <span className="text-sky-600">Fisio</span>Core
            </span>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <div className="w-7 h-7 bg-sky-100 rounded-full flex items-center justify-center">
              <span className="text-sky-700 text-xs font-bold">{initials}</span>
            </div>
          </div>
        </header>

        {/* Contenido */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
