'use client'

import { useAuthStore } from '@/store/auth.store'
import { useRouter, usePathname } from 'next/navigation'
import { Bell, LogOut, User, ChevronRight } from 'lucide-react'

function Breadcrumb() {
  const pathname = usePathname()
  const parts = pathname.split('/').filter(Boolean)

  const labels: Record<string, string> = {
    dashboard: 'Dashboard',
    arendatori: 'Arendatori',
    contracte: 'Contracte',
    parcele: 'Parcele',
    plati: 'Plăți',
    rapoarte: 'Rapoarte',
    admin: 'Administrare',
    nou: 'Nou',
    'lista-contracte': 'Lista + Contracte',
    'opriti-plata': 'Opriți de la plată',
    adeverinte: 'Adeverințe',
    utilizatori: 'Utilizatori',
    nomenclatoare: 'Nomenclatoare',
    'jurnal-audit': 'Jurnal Audit',
  }

  return (
    <nav className="flex items-center gap-1 text-sm text-gray-500">
      {parts.map((part, idx) => {
        const isLast = idx === parts.length - 1
        const label = labels[part] ?? part
        return (
          <span key={idx} className="flex items-center gap-1">
            {idx > 0 && <ChevronRight className="w-3 h-3" />}
            <span className={isLast ? 'text-gray-900 font-medium' : ''}>{label}</span>
          </span>
        )
      })}
    </nav>
  )
}

export function AppTopbar() {
  const { user, logout } = useAuthStore()
  const router = useRouter()

  async function handleLogout() {
    await logout()
    router.replace('/login')
  }

  return (
    <header className="h-12 bg-white border-b border-gray-200 flex items-center px-6 gap-4 flex-shrink-0 z-10">
      {/* Breadcrumb */}
      <div className="flex-1">
        <Breadcrumb />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        {/* Notifications (Phase 2) */}
        <button className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors relative">
          <Bell className="w-4 h-4" />
        </button>

        {/* User info */}
        <div className="flex items-center gap-2 text-sm">
          <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center">
            <User className="w-4 h-4 text-white" />
          </div>
          <div className="hidden sm:block">
            <div className="font-medium text-gray-800 leading-tight">
              {user?.firstName} {user?.lastName}
            </div>
            <div className="text-xs text-gray-500 leading-tight">{user?.roles[0]}</div>
          </div>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="p-1.5 rounded hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors"
          title="Deconectare"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}
