'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, FileText, MapPin, CreditCard,
  BarChart3, ChevronDown, X, FileSpreadsheet, Leaf, Settings, Settings2, Shield, Wheat, Tractor, Activity, Receipt, FolderOpen, Package, Bot, Truck, Building2, ChevronRight,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useState, useEffect } from 'react'
import { useSidebarStore } from '@/store/sidebar.store'
import { useFarmStore, type FarmOption } from '@/store/farm.store'
import { createClient } from '@/lib/supabase/client'

// ─── Sidebar themes ───────────────────────────────────────────────────────────
type SidebarTheme = 'green' | 'amber' | 'light'

const THEMES: Record<SidebarTheme, {
  bg: string; activeItem: string; inactiveItem: string
  activeBar: string; activeIcon: string; inactiveIcon: string
  childActive: string; childInactive: string; childDotActive: string; childDotInactive: string
  sectionLabel: string; chevron: string
  adminActive: string; adminInactive: string
  avatarBg: string; avatarDot: string; avatarRing: string
  userText: string; userSubText: string; divider: string
  logoText: string; logoSub: string; closeBtnText: string
}> = {
  green: {
    bg: 'linear-gradient(180deg, #162a16 0%, #1a3320 60%, #1f3d24 100%)',
    activeItem: 'bg-white/10 text-white font-medium',
    inactiveItem: 'text-white/55 hover:text-white/90 hover:bg-white/5',
    activeBar: 'bg-emerald-400', activeIcon: 'text-emerald-400', inactiveIcon: 'text-white/40',
    childActive: 'text-emerald-300 font-medium', childInactive: 'text-white/40 hover:text-white/75',
    childDotActive: 'bg-emerald-400', childDotInactive: 'bg-white/30',
    sectionLabel: 'text-white/25', chevron: 'text-white/30',
    adminActive: 'bg-amber-500/20 text-amber-300 font-medium', adminInactive: 'text-white/40 hover:text-white/70 hover:bg-white/5',
    avatarBg: 'bg-emerald-700', avatarDot: 'bg-emerald-400', avatarRing: 'ring-[#1a3320]',
    userText: 'text-white/80', userSubText: 'text-white/35', divider: 'bg-white/[0.08]',
    logoText: 'text-white', logoSub: 'text-white/35', closeBtnText: 'text-white/40 hover:text-white',
  },
  amber: {
    bg: 'linear-gradient(180deg, #1c1200 0%, #2c1d04 60%, #3a2808 100%)',
    activeItem: 'bg-white/10 text-white font-medium',
    inactiveItem: 'text-white/55 hover:text-white/90 hover:bg-white/5',
    activeBar: 'bg-amber-400', activeIcon: 'text-amber-400', inactiveIcon: 'text-white/40',
    childActive: 'text-amber-300 font-medium', childInactive: 'text-white/40 hover:text-white/75',
    childDotActive: 'bg-amber-400', childDotInactive: 'bg-white/30',
    sectionLabel: 'text-white/25', chevron: 'text-white/30',
    adminActive: 'bg-amber-500/20 text-amber-300 font-medium', adminInactive: 'text-white/40 hover:text-white/70 hover:bg-white/5',
    avatarBg: 'bg-amber-800', avatarDot: 'bg-amber-400', avatarRing: 'ring-[#2c1d04]',
    userText: 'text-white/80', userSubText: 'text-white/35', divider: 'bg-white/[0.08]',
    logoText: 'text-white', logoSub: 'text-white/35', closeBtnText: 'text-white/40 hover:text-white',
  },
  light: {
    bg: 'linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)',
    activeItem: 'bg-green-50 text-green-800 font-medium',
    inactiveItem: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
    activeBar: 'bg-green-600', activeIcon: 'text-green-600', inactiveIcon: 'text-gray-400',
    childActive: 'text-green-700 font-medium', childInactive: 'text-gray-500 hover:text-gray-800 hover:bg-gray-50',
    childDotActive: 'bg-green-500', childDotInactive: 'bg-gray-300',
    sectionLabel: 'text-gray-400', chevron: 'text-gray-400',
    adminActive: 'bg-amber-50 text-amber-700 font-medium', adminInactive: 'text-gray-500 hover:text-gray-800 hover:bg-gray-100',
    avatarBg: 'bg-green-600', avatarDot: 'bg-green-400', avatarRing: 'ring-gray-100',
    userText: 'text-gray-800', userSubText: 'text-gray-400', divider: 'bg-gray-200',
    logoText: 'text-gray-900', logoSub: 'text-gray-400', closeBtnText: 'text-gray-400 hover:text-gray-700',
  },
}

interface NavItem {
  label: string
  href?: string
  icon: React.ElementType
  permKey?: string
  tourKey?: string
  children?: { label: string; href: string; tourKey?: string }[]
}

const SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: 'GENERAL',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, permKey: 'can_dashboard' },
      { label: 'Alerte AI', href: '/alerte', icon: Bot, permKey: 'can_dashboard' },
      { label: 'Rapoarte', href: '/rapoarte', icon: BarChart3, permKey: 'can_rapoarte' },
      { label: 'Configurează Ferma', href: '/general/configureaza-ferma', icon: Settings2, permKey: 'can_dashboard' },
    ],
  },
  {
    label: 'GESTIUNE',
    items: [
      {
        label: 'Arendatori', icon: Users, permKey: 'can_arendasi', tourKey: 'nav-arendatori',
        children: [
          { label: 'Lista arendatori', href: '/arendatori' },
          { label: 'Adaugă arendator', href: '/arendatori/nou' },
        ],
      },
      {
        label: 'Contracte', icon: FileText, permKey: 'can_contracte', tourKey: 'nav-contracte',
        children: [
          { label: 'Lista contracte', href: '/contracte' },
          { label: 'Contract nou', href: '/contracte/nou' },
        ],
      },
      { label: 'Tranzactii Arenda', href: '/plati', icon: CreditCard, permKey: 'can_facturi' },
      { label: 'Distribuire Arendă', href: '/distribuire-arenda', icon: Wheat, permKey: 'can_facturi', tourKey: 'nav-distribuire' },
      {
        label: 'Parcele', icon: MapPin, permKey: 'can_parcele', tourKey: 'nav-parcele',
        children: [
          { label: 'Lista parcele', href: '/parcele' },
          { label: 'Parcelă nouă', href: '/parcele/nou' },
          { label: 'Hartă Parcele', href: '/parcele/harta', tourKey: 'nav-harta-parcele' },
        ],
      },
    ],
  },
  {
    label: 'PRODUCȚIE',
    items: [
      {
        label: 'Campanie', icon: Wheat, permKey: 'can_utilaje', tourKey: 'nav-campanie',
        children: [
          { label: 'Planuri culturi', href: '/campanie' },
          { label: 'Activități câmp', href: '/campanie/activitati', tourKey: 'nav-activitati' },
          { label: 'Stocuri & Inputuri', href: '/campanie/stocuri', tourKey: 'nav-stocuri' },
        ],
      },
      {
        label: 'Utilaje', icon: Tractor, permKey: 'can_utilaje',
        children: [
          { label: 'Parc utilaje', href: '/utilaje' },
          { label: 'Implementuri', href: '/utilaje/implementuri' },
          { label: 'Operatori', href: '/utilaje/operatori' },
        ],
      },
      { label: 'Monitorizare Fermă', href: '/ferma', icon: Activity, permKey: 'can_ferma', tourKey: 'nav-ferma' },
    ],
  },
  {
    label: 'INVENTAR',
    items: [
      {
        label: 'Stocuri Inputuri', icon: Package, permKey: 'can_utilaje',
        children: [
          { label: 'Stoc curent', href: '/inventar/stoc' },
          { label: 'Loturi inputuri', href: '/inventar/loturi' },
          { label: 'Furnizori', href: '/inventar/furnizori' },
          { label: 'Miscari stoc', href: '/inventar/miscari' },
        ],
      },
    ],
  },
  {
    label: 'FINANCIAR',
    items: [
      { label: 'e-Factura ANAF', href: '/efactura', icon: Receipt, permKey: 'can_facturi' },
      { label: 'e-Transport ANAF', href: '/etransport', icon: Truck, permKey: 'can_facturi' },
    ],
  },
  {
    label: 'SUBVENȚII',
    items: [
      { label: 'Dosar APIA', href: '/apia', icon: FolderOpen, permKey: 'can_declaratii' },
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
  const [isAdmin, setIsAdmin] = useState(false)
  const [theme, setTheme] = useState<SidebarTheme>('green')
  const [farmPickerOpen, setFarmPickerOpen] = useState(false)

  const { effectiveUserId, userId, role, availableFarms, loaded, switchFarm } = useFarmStore()

  useEffect(() => {
    const saved = localStorage.getItem('sidebar-theme') as SidebarTheme | null
    if (saved && saved in THEMES) setTheme(saved)
  }, [])

  function changeTheme(t: SidebarTheme) {
    setTheme(t)
    localStorage.setItem('sidebar-theme', t)
  }

  useEffect(() => {
    const db = createClient()
    db.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      setUserEmail(user.email ?? '')
      const [{ data: permsData }, { data: profileData }] = await Promise.all([
        db.from('user_permissions').select('*').eq('user_id', user.id).maybeSingle(),
        db.from('profiles').select('is_admin').eq('id', user.id).maybeSingle(),
      ])
      if (permsData) setPerms(permsData as Record<string, boolean>)
      if (profileData?.is_admin) setIsAdmin(true)
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
    const t = THEMES[theme]

    if (!item.children) {
      const active = pathname === item.href || (!!item.href && item.href !== '/' && pathname.startsWith(item.href + '/'))
      return (
        <Link
          key={item.label}
          href={item.href!}
          onClick={close}
          data-tour={item.tourKey}
          className={clsx(
            'relative flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-sm transition-all duration-150',
            active ? t.activeItem : t.inactiveItem,
          )}
        >
          {active && (
            <span className={clsx('absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full', t.activeBar)} />
          )}
          <item.icon className={clsx('w-4 h-4 flex-shrink-0', active ? t.activeIcon : t.inactiveIcon)} />
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
          data-tour={item.tourKey}
          className={clsx(
            'relative w-full flex items-center gap-3 mx-2 px-3 py-2 rounded-lg text-sm transition-all duration-150',
            groupActive ? t.activeItem : t.inactiveItem,
          )}
          style={{ width: 'calc(100% - 1rem)' }}
        >
          {groupActive && (
            <span className={clsx('absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full', t.activeBar)} />
          )}
          <item.icon className={clsx('w-4 h-4 flex-shrink-0', groupActive ? t.activeIcon : t.inactiveIcon)} />
          <span className="flex-1 text-left">{item.label}</span>
          <ChevronDown className={clsx('w-3 h-3 transition-transform', t.chevron, isOpen && 'rotate-180')} />
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
                  data-tour={child.tourKey}
                  className={clsx(
                    'flex items-center gap-2 pl-11 pr-4 py-1.5 text-xs transition-colors',
                    childActive ? t.childActive : t.childInactive,
                  )}
                >
                  <span className={clsx('w-1 h-1 rounded-full flex-shrink-0', childActive ? t.childDotActive : t.childDotInactive)} />
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
  const t = THEMES[theme]

  return (
    <nav
      className={clsx(
        'w-56 flex flex-col h-full select-none flex-shrink-0 z-30',
        'fixed md:relative inset-y-0 left-0 transition-transform duration-200',
        open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
      )}
      style={{ background: t.bg }}
    >
      {/* ── Logo ─────────────────────────── */}
      <div className="px-4 py-4 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="relative w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0">
            <div className="absolute inset-0 rounded-xl" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }} />
            <Leaf className="relative z-10 w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col leading-none">
            <span className={clsx('font-bold text-sm tracking-wide', t.logoText)}>Arenda<span className="text-amber-400">Pro</span></span>
            <span className={clsx('text-[9px] tracking-wider mt-0.5', t.logoSub)}>Platformă agricolă</span>
          </div>
        </div>
        <button onClick={close} className={clsx('md:hidden p-1 rounded transition-colors', t.closeBtnText)}>
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* ── Navigation ───────────────────── */}
      <div className="flex-1 overflow-y-auto py-2 space-y-0.5">
        {SECTIONS.map(section => {
          const visibleItems = section.items.filter(canShow)
          if (visibleItems.length === 0) return null
          return (
            <div key={section.label} className="mb-1">
              <p className={clsx('px-5 py-1.5 text-[9px] font-semibold tracking-widest uppercase', t.sectionLabel)}>
                {section.label}
              </p>
              {visibleItems.map(renderItem)}
            </div>
          )
        })}
      </div>

      {/* ── Wheat illustration ────────────── */}
      <div className="px-0 pt-2 pb-2 flex-shrink-0 pointer-events-none select-none">
        <svg viewBox="0 0 400 120" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%">
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
          <line x1="60" y1="95" x2="63" y2="13" stroke="#c8973a" strokeWidth="1.5" strokeLinecap="round"/>
          <ellipse cx="55" cy="16" rx="4" ry="2.5" fill="#e8b84b" transform="rotate(-30 55 16)"/>
          <ellipse cx="65" cy="16" rx="4" ry="2.5" fill="#e8b84b" transform="rotate(30 65 16)"/>
          <line x1="60" y1="14" x2="60" y2="19" stroke="#c8973a" strokeWidth="1"/>
          <ellipse cx="56" cy="28" rx="4" ry="2.5" fill="#d4a035" transform="rotate(-30 56 28)"/>
          <ellipse cx="64" cy="28" rx="4" ry="2.5" fill="#d4a035" transform="rotate(30 64 28)"/>
          <line x1="60" y1="26" x2="60" y2="31" stroke="#c8973a" strokeWidth="1"/>
          <ellipse cx="55" cy="38" rx="4" ry="2.5" fill="#c8973a" transform="rotate(-30 55 38)"/>
          <ellipse cx="65" cy="38" rx="4" ry="2.5" fill="#c8973a" transform="rotate(30 65 38)"/>
          <line x1="60" y1="36" x2="60" y2="41" stroke="#c8973a" strokeWidth="1"/>
          <ellipse cx="56" cy="48" rx="4" ry="2.5" fill="#c8973a" transform="rotate(-30 56 48)"/>
          <ellipse cx="64" cy="48" rx="4" ry="2.5" fill="#c8973a" transform="rotate(30 64 48)"/>
          <line x1="60" y1="46" x2="60" y2="51" stroke="#c8973a" strokeWidth="1"/>
          <line x1="63" y1="13" x2="61" y2="2" stroke="#d4a035" strokeWidth="1" strokeLinecap="round"/>
          {/* Stalk 3 */}
          <line x1="102" y1="95" x2="100" y2="25" stroke="#c8973a" strokeWidth="1.5" strokeLinecap="round"/>
          <ellipse cx="97" cy="28" rx="4" ry="2.5" fill="#e8b84b" transform="rotate(-30 97 28)"/>
          <ellipse cx="107" cy="28" rx="4" ry="2.5" fill="#e8b84b" transform="rotate(30 107 28)"/>
          <line x1="102" y1="26" x2="102" y2="31" stroke="#c8973a" strokeWidth="1"/>
          <ellipse cx="97" cy="38" rx="4" ry="2.5" fill="#d4a035" transform="rotate(-30 97 38)"/>
          <ellipse cx="107" cy="38" rx="4" ry="2.5" fill="#d4a035" transform="rotate(30 107 38)"/>
          <line x1="102" y1="36" x2="102" y2="41" stroke="#c8973a" strokeWidth="1"/>
          <ellipse cx="98" cy="48" rx="4" ry="2.5" fill="#c8973a" transform="rotate(-30 98 48)"/>
          <ellipse cx="106" cy="48" rx="4" ry="2.5" fill="#c8973a" transform="rotate(30 106 48)"/>
          <line x1="102" y1="46" x2="102" y2="51" stroke="#c8973a" strokeWidth="1"/>
          <ellipse cx="97" cy="57" rx="4" ry="2.5" fill="#c8973a" transform="rotate(-30 97 57)"/>
          <ellipse cx="107" cy="57" rx="4" ry="2.5" fill="#c8973a" transform="rotate(30 107 57)"/>
          <line x1="102" y1="55" x2="102" y2="60" stroke="#c8973a" strokeWidth="1"/>
          <line x1="100" y1="25" x2="102" y2="14" stroke="#d4a035" strokeWidth="1" strokeLinecap="round"/>
          {/* Stalk 4 */}
          <line x1="144" y1="95" x2="142" y2="20" stroke="#c8973a" strokeWidth="1.5" strokeLinecap="round"/>
          <ellipse cx="139" cy="23" rx="4" ry="2.5" fill="#e8b84b" transform="rotate(-30 139 23)"/>
          <ellipse cx="149" cy="23" rx="4" ry="2.5" fill="#e8b84b" transform="rotate(30 149 23)"/>
          <line x1="144" y1="21" x2="144" y2="26" stroke="#c8973a" strokeWidth="1"/>
          <ellipse cx="139" cy="33" rx="4" ry="2.5" fill="#d4a035" transform="rotate(-30 139 33)"/>
          <ellipse cx="149" cy="33" rx="4" ry="2.5" fill="#d4a035" transform="rotate(30 149 33)"/>
          <line x1="144" y1="31" x2="144" y2="36" stroke="#c8973a" strokeWidth="1"/>
          <ellipse cx="140" cy="43" rx="4" ry="2.5" fill="#c8973a" transform="rotate(-30 140 43)"/>
          <ellipse cx="148" cy="43" rx="4" ry="2.5" fill="#c8973a" transform="rotate(30 148 43)"/>
          <line x1="144" y1="41" x2="144" y2="46" stroke="#c8973a" strokeWidth="1"/>
          <line x1="142" y1="20" x2="144" y2="9" stroke="#d4a035" strokeWidth="1" strokeLinecap="round"/>
          {/* Stalk 5 */}
          <line x1="186" y1="95" x2="188" y2="15" stroke="#c8973a" strokeWidth="1.5" strokeLinecap="round"/>
          <ellipse cx="181" cy="18" rx="4" ry="2.5" fill="#e8b84b" transform="rotate(-30 181 18)"/>
          <ellipse cx="191" cy="18" rx="4" ry="2.5" fill="#e8b84b" transform="rotate(30 191 18)"/>
          <line x1="186" y1="16" x2="186" y2="21" stroke="#c8973a" strokeWidth="1"/>
          <ellipse cx="182" cy="28" rx="4" ry="2.5" fill="#d4a035" transform="rotate(-30 182 28)"/>
          <ellipse cx="190" cy="28" rx="4" ry="2.5" fill="#d4a035" transform="rotate(30 190 28)"/>
          <line x1="186" y1="26" x2="186" y2="31" stroke="#c8973a" strokeWidth="1"/>
          <ellipse cx="181" cy="38" rx="4" ry="2.5" fill="#c8973a" transform="rotate(-30 181 38)"/>
          <ellipse cx="191" cy="38" rx="4" ry="2.5" fill="#c8973a" transform="rotate(30 191 38)"/>
          <line x1="186" y1="36" x2="186" y2="41" stroke="#c8973a" strokeWidth="1"/>
          <ellipse cx="182" cy="47" rx="4" ry="2.5" fill="#c8973a" transform="rotate(-30 182 47)"/>
          <ellipse cx="190" cy="47" rx="4" ry="2.5" fill="#c8973a" transform="rotate(30 190 47)"/>
          <line x1="186" y1="45" x2="186" y2="50" stroke="#c8973a" strokeWidth="1"/>
          <line x1="188" y1="15" x2="186" y2="4" stroke="#d4a035" strokeWidth="1" strokeLinecap="round"/>
          {/* Stalk 6 */}
          <line x1="228" y1="95" x2="230" y2="22" stroke="#c8973a" strokeWidth="1.5" strokeLinecap="round"/>
          <ellipse cx="223" cy="25" rx="4" ry="2.5" fill="#e8b84b" transform="rotate(-30 223 25)"/>
          <ellipse cx="233" cy="25" rx="4" ry="2.5" fill="#e8b84b" transform="rotate(30 233 25)"/>
          <line x1="228" y1="23" x2="228" y2="28" stroke="#c8973a" strokeWidth="1"/>
          <ellipse cx="224" cy="35" rx="4" ry="2.5" fill="#d4a035" transform="rotate(-30 224 35)"/>
          <ellipse cx="232" cy="35" rx="4" ry="2.5" fill="#d4a035" transform="rotate(30 232 35)"/>
          <line x1="228" y1="33" x2="228" y2="38" stroke="#c8973a" strokeWidth="1"/>
          <ellipse cx="223" cy="45" rx="4" ry="2.5" fill="#c8973a" transform="rotate(-30 223 45)"/>
          <ellipse cx="233" cy="45" rx="4" ry="2.5" fill="#c8973a" transform="rotate(30 233 45)"/>
          <line x1="228" y1="43" x2="228" y2="48" stroke="#c8973a" strokeWidth="1"/>
          <line x1="230" y1="22" x2="228" y2="11" stroke="#d4a035" strokeWidth="1" strokeLinecap="round"/>
          {/* Stalk 7 */}
          <line x1="270" y1="95" x2="268" y2="27" stroke="#c8973a" strokeWidth="1.5" strokeLinecap="round"/>
          <ellipse cx="265" cy="30" rx="4" ry="2.5" fill="#e8b84b" transform="rotate(-30 265 30)"/>
          <ellipse cx="275" cy="30" rx="4" ry="2.5" fill="#e8b84b" transform="rotate(30 275 30)"/>
          <line x1="270" y1="28" x2="270" y2="33" stroke="#c8973a" strokeWidth="1"/>
          <ellipse cx="265" cy="40" rx="4" ry="2.5" fill="#d4a035" transform="rotate(-30 265 40)"/>
          <ellipse cx="275" cy="40" rx="4" ry="2.5" fill="#d4a035" transform="rotate(30 275 40)"/>
          <line x1="270" y1="38" x2="270" y2="43" stroke="#c8973a" strokeWidth="1"/>
          <ellipse cx="266" cy="50" rx="4" ry="2.5" fill="#c8973a" transform="rotate(-30 266 50)"/>
          <ellipse cx="274" cy="50" rx="4" ry="2.5" fill="#c8973a" transform="rotate(30 274 50)"/>
          <line x1="270" y1="48" x2="270" y2="53" stroke="#c8973a" strokeWidth="1"/>
          <line x1="268" y1="27" x2="270" y2="16" stroke="#d4a035" strokeWidth="1" strokeLinecap="round"/>
          {/* Stalk 8 */}
          <line x1="312" y1="95" x2="314" y2="19" stroke="#c8973a" strokeWidth="1.5" strokeLinecap="round"/>
          <ellipse cx="307" cy="22" rx="4" ry="2.5" fill="#e8b84b" transform="rotate(-30 307 22)"/>
          <ellipse cx="317" cy="22" rx="4" ry="2.5" fill="#e8b84b" transform="rotate(30 317 22)"/>
          <line x1="312" y1="20" x2="312" y2="25" stroke="#c8973a" strokeWidth="1"/>
          <ellipse cx="307" cy="32" rx="4" ry="2.5" fill="#d4a035" transform="rotate(-30 307 32)"/>
          <ellipse cx="317" cy="32" rx="4" ry="2.5" fill="#d4a035" transform="rotate(30 317 32)"/>
          <line x1="312" y1="30" x2="312" y2="35" stroke="#c8973a" strokeWidth="1"/>
          <ellipse cx="308" cy="42" rx="4" ry="2.5" fill="#c8973a" transform="rotate(-30 308 42)"/>
          <ellipse cx="316" cy="42" rx="4" ry="2.5" fill="#c8973a" transform="rotate(30 316 42)"/>
          <line x1="312" y1="40" x2="312" y2="45" stroke="#c8973a" strokeWidth="1"/>
          <ellipse cx="307" cy="51" rx="4" ry="2.5" fill="#c8973a" transform="rotate(-30 307 51)"/>
          <ellipse cx="317" cy="51" rx="4" ry="2.5" fill="#c8973a" transform="rotate(30 317 51)"/>
          <line x1="312" y1="49" x2="312" y2="54" stroke="#c8973a" strokeWidth="1"/>
          <line x1="314" y1="19" x2="312" y2="8" stroke="#d4a035" strokeWidth="1" strokeLinecap="round"/>
          {/* Stalk 9 */}
          <line x1="354" y1="95" x2="352" y2="24" stroke="#c8973a" strokeWidth="1.5" strokeLinecap="round"/>
          <ellipse cx="349" cy="27" rx="4" ry="2.5" fill="#e8b84b" transform="rotate(-30 349 27)"/>
          <ellipse cx="359" cy="27" rx="4" ry="2.5" fill="#e8b84b" transform="rotate(30 359 27)"/>
          <line x1="354" y1="25" x2="354" y2="30" stroke="#c8973a" strokeWidth="1"/>
          <ellipse cx="349" cy="37" rx="4" ry="2.5" fill="#d4a035" transform="rotate(-30 349 37)"/>
          <ellipse cx="359" cy="37" rx="4" ry="2.5" fill="#d4a035" transform="rotate(30 359 37)"/>
          <line x1="354" y1="35" x2="354" y2="40" stroke="#c8973a" strokeWidth="1"/>
          <ellipse cx="350" cy="47" rx="4" ry="2.5" fill="#c8973a" transform="rotate(-30 350 47)"/>
          <ellipse cx="358" cy="47" rx="4" ry="2.5" fill="#c8973a" transform="rotate(30 358 47)"/>
          <line x1="354" y1="45" x2="354" y2="50" stroke="#c8973a" strokeWidth="1"/>
          <line x1="352" y1="24" x2="354" y2="13" stroke="#d4a035" strokeWidth="1" strokeLinecap="round"/>
          {/* Ambient glow */}
          <ellipse cx="200" cy="93" rx="190" ry="9" fill="#c8973a" fillOpacity="0.07"/>
        </svg>
      </div>

      {/* ── Admin link (admins only) ─────── */}
      {isAdmin && (
        <div className="px-2 pb-1 flex-shrink-0">
          <Link
            href="/admin-cp"
            onClick={close}
            className={clsx(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150',
              pathname.startsWith('/admin-cp') ? t.adminActive : t.adminInactive,
            )}
          >
            <Shield className="w-4 h-4 flex-shrink-0" />
            <span>Admin Panel</span>
          </Link>
        </div>
      )}

      {/* ── Farm switcher (only if user is member of multiple farms) ─ */}
      {loaded && availableFarms.length > 1 && (
        <div className="px-2 pb-1 flex-shrink-0">
          <div className={clsx('mx-0 h-px mb-1', t.divider)} />
          <div className="relative">
            <button
              onClick={() => setFarmPickerOpen(p => !p)}
              className={clsx(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors',
                t.inactiveItem,
              )}
            >
              <Building2 className={clsx('w-3.5 h-3.5 flex-shrink-0', t.inactiveIcon)} />
              <div className="flex-1 text-left min-w-0">
                <div className="truncate font-medium" style={{ fontSize: 10 }}>
                  {effectiveUserId === userId
                    ? 'Ferma mea'
                    : (availableFarms.find(f => f.farmOwnerId === effectiveUserId)?.farmName ?? 'Fermă membră')}
                </div>
                {effectiveUserId !== userId && (
                  <div style={{ fontSize: 9 }} className="opacity-60 capitalize">{role}</div>
                )}
              </div>
              <ChevronRight className={clsx('w-3 h-3 flex-shrink-0 transition-transform', t.chevron, farmPickerOpen && 'rotate-90')} />
            </button>

            {farmPickerOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden z-50">
                {availableFarms.map((farm: FarmOption) => (
                  <button
                    key={farm.farmOwnerId}
                    onClick={() => {
                      setFarmPickerOpen(false)
                      switchFarm(farm.farmOwnerId === userId ? null : farm.farmOwnerId)
                    }}
                    className={clsx(
                      'w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-gray-50 transition-colors',
                      farm.farmOwnerId === effectiveUserId && 'bg-amber-50',
                    )}
                  >
                    <Building2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-800 truncate">{farm.farmName}</div>
                      <div className="text-gray-400 capitalize" style={{ fontSize: 9 }}>
                        {farm.farmOwnerId === userId ? 'proprietar' : farm.role}
                      </div>
                    </div>
                    {farm.farmOwnerId === effectiveUserId && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Member badge — visible when acting as farm member */}
      {loaded && effectiveUserId !== userId && availableFarms.length === 1 && (
        <div className="px-2 pb-1 flex-shrink-0">
          <div className={clsx('mx-0 h-px mb-1', t.divider)} />
          <div className={clsx('flex items-center gap-2 px-3 py-1.5 rounded-lg mx-0', t.inactiveItem)}>
            <Building2 className={clsx('w-3.5 h-3.5 flex-shrink-0', t.inactiveIcon)} />
            <div className="flex-1 min-w-0">
              <div className="truncate font-medium" style={{ fontSize: 10 }}>
                {availableFarms[0]?.farmName ?? 'Fermă membră'}
              </div>
              <div style={{ fontSize: 9 }} className="opacity-60 capitalize">{role}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Settings + Profile ────────────── */}
      <div className="flex-shrink-0">
        {/* Hide Settings only for non-owner members with can_setari explicitly false */}
        {(role === 'proprietar' || perms?.can_setari !== false) && (
        <Link
          href="/setari"
          onClick={close}
          className={clsx(
            'relative flex items-center gap-3 mx-2 my-1 px-3 py-2 rounded-lg text-sm transition-all duration-150',
            settingsActive ? t.activeItem : t.inactiveItem,
          )}
        >
          {settingsActive && (
            <span className={clsx('absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full', t.activeBar)} />
          )}
          <Settings className={clsx('w-4 h-4 flex-shrink-0', settingsActive ? t.activeIcon : t.inactiveIcon)} />
          <span>Setări</span>
        </Link>
        )}
        <div className={clsx('mx-4 h-px', t.divider)} />
        <div className="flex items-center gap-2 px-3 py-2.5">
          <div className="relative flex-shrink-0">
            <div className={clsx('w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white', t.avatarBg)}>
              AP
            </div>
            <span className={clsx('absolute bottom-0 right-0 w-2 h-2 rounded-full ring-1', t.avatarDot, t.avatarRing)} />
          </div>
          <div className="flex flex-col leading-none min-w-0 flex-1">
            <span className={clsx('text-[11px] font-medium truncate', t.userText)}>{userEmail || 'admin@arenda.ro'}</span>
            <span className={clsx('text-[9px] mt-0.5 capitalize', t.userSubText)}>
              {loaded ? (role === 'proprietar' ? 'Proprietar' : role) : 'Administrator'}
            </span>
          </div>
          {/* ── Theme switcher ── */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => changeTheme('green')}
              title="Temă verde"
              className={clsx('w-4 h-4 rounded-full transition-all border-2', theme === 'green' ? 'border-white/60 scale-110' : 'border-transparent opacity-60 hover:opacity-90')}
              style={{ background: 'linear-gradient(135deg, #22c55e, #15803d)' }}
            />
            <button
              onClick={() => changeTheme('amber')}
              title="Temă chihlimbar"
              className={clsx('w-4 h-4 rounded-full transition-all border-2', theme === 'amber' ? 'border-white/60 scale-110' : 'border-transparent opacity-60 hover:opacity-90')}
              style={{ background: 'linear-gradient(135deg, #f59e0b, #b45309)' }}
            />
            <button
              onClick={() => changeTheme('light')}
              title="Temă deschisă"
              className={clsx('w-4 h-4 rounded-full transition-all border-2', theme === 'light' ? 'border-gray-500 scale-110' : 'border-transparent opacity-60 hover:opacity-90')}
              style={{ background: 'linear-gradient(135deg, #f8fafc, #cbd5e1)' }}
            />
          </div>
        </div>
      </div>
    </nav>
  )
}

