'use client'

import { usePathname } from 'next/navigation'
import { Bell, User, ChevronRight, Menu } from 'lucide-react'
import { useSidebarStore } from '@/store/sidebar.store'

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
  const { toggle } = useSidebarStore()

  return (
    <header className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-3 flex-shrink-0 z-10">
      {/* Hamburger — mobile only */}
      <button
        onClick={toggle}
        className="md:hidden p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
        aria-label="Deschide meniu"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Breadcrumb */}
      <div className="flex-1 min-w-0">
        <Breadcrumb />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <button className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors">
          <Bell className="w-4 h-4" />
        </button>

        {/* User avatar */}
        <div className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-white" />
        </div>
      </div>
    </header>
  )
}
