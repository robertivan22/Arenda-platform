'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, FileText, MapPin, CreditCard,
  BarChart3, ChevronDown, X, FileSpreadsheet, Leaf, Settings,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useState, useEffect } from 'react'
import { useSidebarStore } from '@/store/sidebar.store'
import { createClient } from '@/lib/supabase/client'

interface NavItem {
  label: string
  href?: string
  icon: React.ElementType
  permKey?: string
  children?: { label: string; href: string }[]
}

const SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: 'GENERAL',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permKey: 'can_dashboard' },
      { label: 'Rapoarte', href: '/rapoarte', icon: BarChart3, permKey: 'can_rapoarte' },
    ],
  },
  {
    label: 'GESTIUNE',
    items: [
      {
        label: 'Arendatori', icon: Users, permKey: 'can_arendasi',
        children: [
          { label: 'Lista arendatori', href: '/arendatori' },
          { label: 'Adaugă arendator', href: '/arendatori/nou' },
        ],
      },
      {
        label: 'Contracte', icon: FileText, permKey: 'can_contracte',
        children: [
          { label: 'Lista contracte', href: '/contracte' },
          { label: 'Contract nou', href: '/contracte/nou' },
        ],
      },
      {
        label: 'Parcele', icon: MapPin, permKey: 'can_parcele',
        children: [
          { label: 'Lista parcele', href: '/parcele' },
          { label: 'Parcelă nouă', href: '/parcele/nou' },
        ],
      },
      { label: 'Hartă Parcele', href: '/parcele/harta', icon: MapPin, permKey: 'can_parcele' },
    ],
  },
  {
    label: 'FINANCIAR',
    items: [
      { label: 'Tranzacții', href: '/plati', icon: CreditCard, permKey: 'can_facturi' },
    ],
  },
  {
    label: 'DOCUMENTE',
    items: [
      {
        label: 'Declarații', icon: FileSpreadsheet, permKey: 'can_declaratii',
        children: [
          { label: 'Dashboard fiscal', href: '/declaratii' },
          { label: 'D112 - Impozit arendă', href: '/declaratii/d112' },
          { label: 'Export APIA', href: '/declaratii/apia' },
          { label: 'Istoric declarații', href: '/declaratii/istoric' },
        ],
      },
      { label: 'Registru Fitosanitar', href: '/fitosanitar', icon: Leaf, permKey: 'can_fitosanitar' },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { open, close } = useSidebarStore()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [perms, setPerms] = useState<Record<string, boolean> | null>(null)
  const [userEmail, setUserEmail] = useState<string>('')

  useEffect(() => {
    const db = createClient()
    db.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserEmail(user.email ?? '')
      const { data } = await db
        .from('user_permissions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
      if (data) setPerms(data as Record<string, boolean>)
    })
  }, [])

  function canShow(item: NavItem): boolean {
    if (!item.permKey || perms === null) return true
    return perms[item.permKey] !== false
  }

  function toggleGroup(label: string) {
    setCollapsed(prev => ({ ...prev, [label]: !prev[label] }))
  }

  function isGroupActive(item: NavItem) {
    if (item.href) return pathname === item.href || pathname.startsWith(item.href + '/')
    return item.children?.some(c => pathname === c.href || pathname.startsWith(c.href + '/')) ?? false
  }

  function renderItem(item: NavItem) {
    if (!canShow(item)) return null

    if (!item.children) {
      const active = pathname === item.href || (!!item.href && item.href !== '/' && pathname.startsWith(item.href + '/'))
      return (
        <Link
          key={item.label}
          href={item.href!}
          onClick={close}
          className={clsx(
            'relative flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-sm transition-all duration-150',
            active
              ? 'bg-white/10 text-white font-medium'
              : 'text-white/55 hover:text-white/90 hover:bg-white/5',
          )}
        >
          {active && (
            <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-emerald-400" />
          )}
          <item.icon className={clsx('w-4 h-4 flex-shrink-0', active ? 'text-emerald-400' : 'text-white/40')} />
          <span>{item.label}</span>
        </Link>
      )
    }

    const groupActive = isGroupActive(item)
    const isOpen = collapsed[item.label] !== undefined
      ? !collapsed[item.label]
      : groupActive

    return (
      <div key={item.label}>
        <button
          onClick={() => toggleGroup(item.label)}
          className={clsx(
            'relative w-full flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-sm transition-all duration-150',
            groupActive
              ? 'bg-white/10 text-white font-medium'
              : 'text-white/55 hover:text-white/90 hover:bg-white/5',
          )}
          style={{ width: 'calc(100% - 1rem)' }}
        >
          {groupActive && (
            <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-emerald-400" />
          )}
          <item.icon className={clsx('w-4 h-4 flex-shrink-0', groupActive ? 'text-emerald-400' : 'text-white/40')} />
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronDown className={clsx('w-3 h-3 transition-transform text-white/30', isOpen && 'rotate-180')} />
        </button>

        {isOpen && (
          <div className="mt-0.5 mb-1">
            {item.children!.map(child => {
              const childActive = pathname === child.href || pathname.startsWith(child.href + '/')
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={close}
                  className={clsx(
                    'flex items-center gap-2 pl-11 pr-4 py-1.5 text-xs transition-colors',
                    childActive ? 'text-emerald-300 font-medium' : 'text-white/40 hover:text-white/75',
                  )}
                >
                  <span className={clsx('w-1 h-1 rounded-full flex-shrink-0', childActive ? 'bg-emerald-400' : 'bg-white/30')} />
                  {child.label}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const settingsActive = pathname.startsWith('/setari')

  return (
    <nav
      className={clsx(
        'w-56 flex flex-col h-full select-none flex-shrink-0 z-30',
        'fixed md:relative inset-y-0 left-0 transition-transform duration-200',
        open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      )}
      style={{ background: 'linear-gradient(180deg, #162a16 0%, #1a3320 60%, #1f3d24 100%)' }}
    >
      {/* ── Logo ─────────────────────────── */}
      <div className="px-4 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0">
            <div className="absolute inset-0 rounded-xl" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }} />
            <Leaf className="relative z-10 w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-bold text-sm text-white tracking-wide">Arenda<span className="text-amber-400">Pro</span></span>
            <span className="text-[9px] text-white/35 tracking-wider mt-0.5">Platformă agricolă</span>
          </div>
        </div>
        <button onClick={close} className="md:hidden p-1 rounded text-white/40 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="mx-4 h-px bg-white/8 flex-shrink-0" />

      {/* ── Navigation ───────────────────── */}
      <div className="flex-1 overflow-y-auto py-2 space-y-0.5">
        {SECTIONS.map(section => {
          const visibleItems = section.items.filter(canShow)
          if (visibleItems.length === 0) return null
          return (
            <div key={section.label} className="mb-1">
              <p className="px-5 py-1.5 text-[9px] font-semibold tracking-widest text-white/25 uppercase">
                {section.label}
              </p>
              {visibleItems.map(renderItem)}
            </div>
          )
        })}
      </div>

      {/* ── Wheat illustration ────────────── */}
      <div className="px-2 pt-1 pb-0 flex-shrink-0 pointer-events-none select-none" style={{ opacity: 0.55 }}>
        <svg viewBox="0 0 400 120" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%">
          {/* Ground */}
          <rect x="0" y="95" width="400" height="25" fill="#0f1f0f" rx="2" />
          {/* Stalk 1 */}
          <line x1="18" y1="95" x2="18" y2="19" stroke="#c8973a" strokeWidth="1.5" strokeLinecap="round"/>
          <ellipse cx="13" cy="22" rx="4" ry="2.5" fill="#e8b84b" transform="rotate(-30 13 22)"/>
          <ellipse cx="23" cy="22" rx="4" ry="2.5" fill="#e8b84b" transform="rotate(30 23 22)"/>
          <line x1="18" y1="20" x2="18" y2="25" stroke="#c8973a" strokeWidth="1"/>
          <ellipse cx="13" cy="33" rx="4" ry="2.5" fill="#d4a035" transform="rotate(-30 13 33)"/>
          <ellipse cx="23" cy="33" rx="4" ry="2.5" fill="#d4a035" transform="rotate(30 23 33)"/>
          <line x1="18" y1="31" x2="18" y2="36" stroke="#c8973a" strokeWidth="1"/>
          <ellipse cx="14" cy="42" rx="4" ry="2.5" fill="#c8973a" transform="rotate(-30 14 42)"/>
          <ellipse cx="22" cy="42" rx="4" ry="2.5" fill="#c8973a" transform="rotate(30 22 42)"/>
          <line x1="18" y1="40" x2="18" y2="45" stroke="#c8973a" strokeWidth="1"/>
          <ellipse cx="13" cy="51" rx="4" ry="2.5" fill="#c8973a" transform="rotate(-30 13 51)"/>
          <ellipse cx="23" cy="51" rx="4" ry="2.5" fill="#c8973a" transform="rotate(30 23 51)"/>
          <line x1="18" y1="49" x2="18" y2="54" stroke="#c8973a" strokeWidth="1"/>
          <line x1="18" y1="19" x2="20" y2="8" stroke="#d4a035" strokeWidth="1" strokeLinecap="round"/>
          {/* Stalk 2 */}
          <line x1="38" y1="95" x2="41" y2="13" stroke="#c8973a" strokeWidth="1.5" strokeLinecap="round"/>
          <ellipse cx="33" cy="16" rx="4" ry="2.5" fill="#e8b84b" transform="rotate(-30 33 16)"/>
          <ellipse cx="43" cy="16" rx="4" ry="2.5" fill="#e8b84b" transform="rotate(30 43 16)"/>
          <line x1="38" y1="14" x2="38" y2="19" stroke="#c8973a" strokeWidth="1"/>
          <ellipse cx="34" cy="28" rx="4" ry="2.5" fill="#d4a035" transform="rotate(-30 34 28)"/>
          <ellipse cx="42" cy="28" rx="4" ry="2.5" fill="#d4a035" transform="rotate(30 42 28)"/>
          <line x1="38" y1="26" x2="38" y2="31" stroke="#c8973a" strokeWidth="1"/>
          <ellipse cx="33" cy="38" rx="4" ry="2.5" fill="#c8973a" transform="rotate(-30 33 38)"/>
          <ellipse cx="43" cy="38" rx="4" ry="2.5" fill="#c8973a" transform="rotate(30 43 38)"/>
          <line x1="38" y1="36" x2="38" y2="41" stroke="#c8973a" strokeWidth="1"/>
          <ellipse cx="34" cy="48" rx="4" ry="2.5" fill="#c8973a" transform="rotate(-30 34 48)"/>
          <ellipse cx="42" cy="48" rx="4" ry="2.5" fill="#c8973a" transform="rotate(30 42 48)"/>
          <line x1="38" y1="46" x2="38" y2="51" stroke="#c8973a" strokeWidth="1"/>
          <line x1="41" y1="13" x2="39" y2="2" stroke="#d4a035" strokeWidth="1" strokeLinecap="round"/>
          {/* Stalk 3 */}
          <line x1="58" y1="95" x2="56" y2="25" stroke="#c8973a" strokeWidth="1.5" strokeLinecap="round"/>
          <ellipse cx="53" cy="28" rx="4" ry="2.5" fill="#e8b84b" transform="rotate(-30 53 28)"/>
          <ellipse cx="63" cy="28" rx="4" ry="2.5" fill="#e8b84b" transform="rotate(30 63 28)"/>
          <line x1="58" y1="26" x2="58" y2="31" stroke="#c8973a" strokeWidth="1"/>
          <ellipse cx="53" cy="38" rx="4" ry="2.5" fill="#d4a035" transform="rotate(-30 53 38)"/>
          <ellipse cx="63" cy="38" rx="4" ry="2.5" fill="#d4a035" transform="rotate(30 63 38)"/>
          <line x1="58" y1="36" x2="58" y2="41" stroke="#c8973a" strokeWidth="1"/>
          <ellipse cx="54" cy="48" rx="4" ry="2.5" fill="#c8973a" transform="rotate(-30 54 48)"/>
          <ellipse cx="62" cy="48" rx="4" ry="2.5" fill="#c8973a" transform="rotate(30 62 48)"/>
          <line x1="58" y1="46" x2="58" y2="51" stroke="#c8973a" strokeWidth="1"/>
          <ellipse cx="53" cy="57" rx="4" ry="2.5" fill="#c8973a" transform="rotate(-30 53 57)"/>
          <ellipse cx="63" cy="57" rx="4" ry="2.5" fill="#c8973a" transform="rotate(30 63 57)"/>
          <line x1="58" y1="55" x2="58" y2="60" stroke="#c8973a" strokeWidth="1"/>
          <line x1="56" y1="25" x2="58" y2="14" stroke="#d4a035" strokeWidth="1" strokeLinecap="round"/>
          {/* Ambient glow */}
          <ellipse cx="200" cy="93" rx="190" ry="9" fill="#c8973a" fillOpacity="0.07"/>
        </svg>
      </div>

      {/* ── Settings + Profile ────────────── */}
      <div className="flex-shrink-0">
        <div className="mx-4 h-px bg-white/8" />
        <Link
          href="/setari"
          onClick={close}
          className={clsx(
            'relative flex items-center gap-3 mx-2 my-1 px-3 py-2 rounded-lg text-sm transition-all duration-150',
            settingsActive ? 'bg-white/10 text-white font-medium' : 'text-white/55 hover:text-white/90 hover:bg-white/5',
          )}
        >
          {settingsActive && (
            <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-emerald-400" />
          )}
          <Settings className={clsx('w-4 h-4 flex-shrink-0', settingsActive ? 'text-emerald-400' : 'text-white/40')} />
          <span>Setări</span>
        </Link>
        <div className="mx-4 h-px bg-white/8" />
        <div className="flex items-center gap-2.5 px-4 py-3">
          <div className="relative flex-shrink-0">
            <div className="w-7 h-7 rounded-full bg-emerald-700 flex items-center justify-center text-[11px] font-bold text-white">
              AP
            </div>
            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-1 ring-[#1a3320]" />
          </div>
          <div className="flex flex-col leading-none min-w-0">
            <span className="text-[11px] font-medium text-white/80 truncate">{userEmail || 'admin@arenda.ro'}</span>
            <span className="text-[9px] text-white/35 mt-0.5">Administrator</span>
          </div>
        </div>
      </div>
    </nav>
  )
}

