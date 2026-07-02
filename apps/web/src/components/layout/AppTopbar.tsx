'use client'

import { usePathname, useRouter } from 'next/navigation'
import { Bell, User, ChevronRight, Menu, LogOut, UserCircle, AlertTriangle, X } from 'lucide-react'
import { useSidebarStore } from '@/store/sidebar.store'
import { createClient } from '@/lib/supabase/client'
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAlerts } from '@/lib/alerte/useAlerts'
import { ImpersonationBanner } from '@/components/admin/ImpersonationBanner'

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
  const [bellOpen, setBellOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuPanelRef = useRef<HTMLDivElement>(null)
  const bellRef = useRef<HTMLDivElement>(null)
  const bellPanelRef = useRef<HTMLDivElement>(null)
  const alerts = useAlerts()

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    function handler(e: MouseEvent | TouchEvent) {
      const target = e.target as Node
      if (
        bellRef.current && !bellRef.current.contains(target) &&
        (!bellPanelRef.current || !bellPanelRef.current.contains(target))
      ) setBellOpen(false)
      if (
        menuRef.current && !menuRef.current.contains(target) &&
        (!menuPanelRef.current || !menuPanelRef.current.contains(target))
      ) setMenuOpen(false)
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('touchstart', handler, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('touchstart', handler)
    }
  }, [])

  async function handleSignOut() {
    setMenuOpen(false)
    await createClient().auth.signOut()
    router.push('/login')
  }

  const bellPanel = bellOpen && mounted ? createPortal(
    <div
      ref={bellPanelRef}
      className="fixed top-12 right-2 left-2 sm:left-auto sm:w-80 max-h-[75vh] flex flex-col bg-white border border-gray-200 rounded-xl shadow-xl z-[9999] overflow-hidden"
    >
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 flex-shrink-0">
        <span className="text-sm font-semibold text-gray-800">Alerte operative</span>
        <div className="flex items-center gap-2">
          {alerts.totalCritice > 0 && (
            <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">{alerts.totalCritice} critice</span>
          )}
          {alerts.totalMedii > 0 && (
            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-xs font-medium rounded-full">{alerts.totalMedii} atenție</span>
          )}
          <button onClick={() => setBellOpen(false)} className="p-0.5 rounded hover:bg-gray-100">
            <X className="w-3.5 h-3.5 text-gray-400" />
          </button>
        </div>
      </div>

      <div className="overflow-y-auto flex-1">
        {alerts.loading && (
          <div className="px-4 py-6 text-center text-sm text-gray-400">Se încarcă alertele...</div>
        )}
        {!alerts.loading && alerts.total === 0 && (
          <div className="px-4 py-6 text-center text-sm text-gray-400">Nicio alertă activă 🎉</div>
        )}

        {(alerts.data?.contracte ?? []).filter(c => c.priority !== 'scazuta').map(c => (
          <button key={c.id} onClick={() => { setBellOpen(false); router.push(`/contracte/${c.id}`) }}
            className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 text-left transition-colors">
            <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${c.priority === 'inalta' ? 'bg-red-500' : 'bg-amber-400'}`} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-800 truncate">Contract #{c.contract_number} — {c.lessor_name}</p>
              <p className="text-xs text-gray-500 truncate">{c.days_until_expiry !== null ? (c.days_until_expiry < 0 ? `Expirat acum ${Math.abs(c.days_until_expiry)} zile` : `Expiră în ${c.days_until_expiry} zile`) : 'Dată expirare lipsă'}</p>
            </div>
            <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0 mt-1" />
          </button>
        ))}

        {(alerts.data?.stocuri ?? []).filter(s => s.priority !== 'scazuta').map(s => (
          <button key={s.id} onClick={() => { setBellOpen(false); router.push('/inventar/stoc') }}
            className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 text-left transition-colors">
            <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${s.priority === 'inalta' ? 'bg-red-500' : 'bg-amber-400'}`} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-800 truncate">{s.product_name}</p>
              <p className="text-xs text-gray-500 truncate">Stoc {s.stock_status === 'epuizat' ? 'epuizat' : `critic: ${s.quantity_available?.toFixed(1)} ${s.unit ?? ''}`}</p>
            </div>
            <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0 mt-1" />
          </button>
        ))}

        {(alerts.data?.tranzactii ?? []).filter(t => !t.is_paid && t.is_overdue).map(t => (
          <button key={t.id} onClick={() => { setBellOpen(false); router.push(t.contract_id ? `/contracte/${t.contract_id}` : '/plati') }}
            className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 text-left transition-colors">
            <span className="mt-1 w-2 h-2 rounded-full flex-shrink-0 bg-red-500" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-800 truncate">Plată restantă — {t.lessor_name}</p>
              <p className="text-xs text-gray-500 truncate">{t.product_name} · {t.ron_net.toLocaleString('ro-RO')} RON</p>
            </div>
            <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0 mt-1" />
          </button>
        ))}

        {(alerts.data?.utilaje ?? []).filter(u => u.overall_priority !== 'low').map(u => (
          <button key={u.id} onClick={() => { setBellOpen(false); router.push(`/utilaje/${u.id}`) }}
            className="w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-gray-50 border-b border-gray-50 text-left transition-colors">
            <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${u.overall_priority === 'high' ? 'bg-red-500' : 'bg-amber-400'}`} />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-gray-800 truncate">{u.name} {u.brand ? `— ${u.brand}` : ''}</p>
              <p className="text-xs text-gray-500 truncate">{u.rca_status !== 'valid' ? `RCA: ${u.rca_status}` : u.itp_status && u.itp_status !== 'valid' ? `ITP: ${u.itp_status}` : 'Alertă utilaj'}</p>
            </div>
            <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0 mt-1" />
          </button>
        ))}
      </div>

      <div className="border-t border-gray-100 px-3 py-2 flex-shrink-0">
        <button onClick={() => { setBellOpen(false); router.push('/alerte') }}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium py-1">
          <AlertTriangle className="w-3.5 h-3.5" /> Vezi toate alertele
        </button>
      </div>
    </div>,
    document.body
  ) : null

  const profileMenu = menuOpen && mounted ? createPortal(
    <div
      ref={menuPanelRef}
      className="fixed top-12 right-2 w-44 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-[9999]"
    >
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
    </div>,
    document.body
  ) : null

  return (
    <>
    <ImpersonationBanner />
    <header className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-3 flex-shrink-0">
      <button
        onClick={toggle}
        className="md:hidden p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
        aria-label="Deschide meniu"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="flex-1 min-w-0">
        <div className="hidden sm:block">
          <Breadcrumb />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Bell */}
        <div className="relative" ref={bellRef}>
          <button
            onClick={() => setBellOpen(v => !v)}
            className="relative p-1.5 rounded hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Alerte"
            aria-expanded={bellOpen}
            aria-haspopup="true"
          >
            <Bell className="w-4 h-4" />
            {alerts.total > 0 && (
              <span className={`absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center rounded-full text-[9px] font-bold text-white ${alerts.totalCritice > 0 ? 'bg-red-500' : 'bg-amber-400'}`}>
                {alerts.total > 99 ? '99+' : alerts.total}
              </span>
            )}
          </button>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="w-7 h-7 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0 hover:bg-brand-600 transition-colors min-w-[44px] min-h-[44px]"
            aria-label="Meniu profil"
            aria-expanded={menuOpen}
            aria-haspopup="true"
          >
            <User className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </header>
    {bellPanel}
    {profileMenu}
    </>
  )
}
