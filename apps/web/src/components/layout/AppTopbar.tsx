'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Bell, User, ChevronRight, Menu, LogOut, UserCircle } from 'lucide-react'
import { useSidebarStore } from '@/store/sidebar.store'
import { createClient } from '@/lib/supabase/client'
import { useState, useRef, useEffect } from 'react'

function Breadcrumb() {
  const pathname = usePathname()
  const parts = pathname.split('/').filter(Boolean)

  const labels: Record<string, string> = {
    dashboard: 'Dashboard',
    arendatori: 'Arendatori',
    contracte: 'Contracte',
    parcele: 'Parcele',
    plati: 'Tranzacții',
    rapoarte: 'Rapoarte',
    admin: 'Administrare',
    nou: 'Nou',
    declaratii: 'Declaratii',
    d112: 'D112',
    apia: 'APIA',
    istoric: 'Istoric',
    harta: 'Hartă Parcele',
    profil: 'Profil',
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
  const router = useRouter()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function handleSignOut() {
    setMenuOpen(false)
    await createClient().auth.signOut()
    router.push('/login')
  }

  return (
    <header className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-3 flex-shrink-0 z-10">
      <button
        onClick={toggle}
        className="md:hidden p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
        aria-label="Deschide meniu"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex-1 min-w-0 hidden sm:block">
        <Breadcrumb />
      </div>

      <div className="flex items-center gap-3">
        <button className="p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors">
          <Bell className="w-4 h-4" />
        </button>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0 hover:bg-brand-600 transition-colors"
          >
            <User className="w-4 h-4 text-white" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-9 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
              <button
                onClick={() => { setMenuOpen(false); router.push('/profil') }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <UserCircle className="w-4 h-4 text-gray-400" />
                Profil
              </button>
              <div className="border-t border-gray-100 my-1" />
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              >
                <LogOut className="w-4 h-4" />
                Deconectare
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
