'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, FileText, MapPin, CreditCard,
  BarChart3, ChevronDown, X, FileSpreadsheet, UserCircle,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useState } from 'react'
import { useSidebarStore } from '@/store/sidebar.store'

interface NavItem {
  label: string
  href?: string
  icon: React.ElementType
  children?: { label: string; href: string }[]
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  {
    label: 'Arendatori', icon: Users,
    children: [
      { label: 'Lista arendatori', href: '/arendatori' },
      { label: 'Adaugă arendator', href: '/arendatori/nou' },
    ],
  },
  {
    label: 'Contracte', icon: FileText,
    children: [
      { label: 'Lista contracte', href: '/contracte' },
      { label: 'Contract nou', href: '/contracte/nou' },
    ],
  },
  {
    label: 'Parcele', icon: MapPin,
    children: [
      { label: 'Lista parcele', href: '/parcele' },
      { label: 'Parcelă nouă', href: '/parcele/nou' },
    ],
  },
  { label: 'Plăți', href: '/plati', icon: CreditCard },
  { label: 'Rapoarte', href: '/rapoarte', icon: BarChart3 },
  {
    label: 'Declarații', icon: FileSpreadsheet,
    children: [
      { label: 'Dashboard fiscal', href: '/declaratii' },
      { label: 'D112 - Impozit arendă', href: '/declaratii/d112' },
      { label: 'Export APIA', href: '/declaratii/apia' },
      { label: 'Istoric declarații', href: '/declaratii/istoric' },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { open, close } = useSidebarStore()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  function toggleGroup(label: string) {
    setCollapsed(prev => ({ ...prev, [label]: !prev[label] }))
  }

  function isGroupActive(item: NavItem) {
    if (item.href) return pathname === item.href || pathname.startsWith(item.href + '/')
    return item.children?.some(c => pathname === c.href || pathname.startsWith(c.href + '/')) ?? false
  }

  return (
    <nav className={clsx(
      'w-56 flex flex-col h-full select-none flex-shrink-0 z-30',
      'fixed md:relative inset-y-0 left-0 transition-transform duration-200',
      open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
    )} style={{ backgroundColor: '#1e3a22' }}>
      {/* Logo */}
      <div className="px-4 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C8.5 2 6 4.5 6 4.5S3 7 3 10.5c0 2.8 1.8 5.2 4 6.5V20h2v-2h6v2h2v-3c2.2-1.3 4-3.7 4-6.5C21 7 18 2 12 2zm-2 14H8v-1.5C6.8 13.6 6 12.1 6 10.5 6 8 7.8 5.5 10 4.3V16zm6 0h-2V4.3c2.2 1.2 4 3.7 4 6.2 0 1.6-.8 3.1-2 4V16z"/>
            </svg>
          </div>
          <span className="font-bold text-sm text-white tracking-wide">
            Arenda<span className="text-amber-400">Pro</span>
          </span>
        </div>
        <button
          onClick={close}
          className="md:hidden p-1 rounded text-white/40 hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-2">
        {NAV_ITEMS.map(item => {
          if (!item.children) {
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'))
            return (
              <Link
                key={item.label}
                href={item.href!}
                onClick={close}
                className={clsx(
                  'flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors',
                  active
                    ? 'text-white font-medium'
                    : 'text-white/60 hover:text-white hover:bg-white/5',
                )}
                style={active ? { backgroundColor: 'rgba(255,255,255,0.08)' } : {}}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
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
                  'w-full flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors',
                  groupActive
                    ? 'text-white font-medium'
                    : 'text-white/60 hover:text-white hover:bg-white/5',
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                <ChevronDown className={clsx('w-3.5 h-3.5 transition-transform text-white/30', isOpen && 'rotate-180')} />
              </button>

              {isOpen && (
                <div>
                  {item.children.map(child => {
                    const childActive = pathname === child.href || pathname.startsWith(child.href + '/')
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={close}
                        className={clsx(
                          'flex items-center gap-2 pl-10 pr-4 py-2 text-xs transition-colors',
                          childActive
                            ? 'text-white font-medium'
                            : 'text-white/45 hover:text-white/80 hover:bg-white/5',
                        )}
                      >
                        <span className="w-1 h-1 rounded-full bg-current flex-shrink-0" />
                        {child.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Profil */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <Link
          href="/profil"
          onClick={close}
          className={clsx(
            'flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors',
            pathname.startsWith('/profil') ? 'text-white font-medium' : 'text-white/60 hover:text-white hover:bg-white/5',
          )}
        >
          <UserCircle className="w-4 h-4 flex-shrink-0" />
          <span>Profil</span>
        </Link>
      </div>
      <div className="px-4 py-2.5 text-[10px] text-white/25" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        v0.1.0 — Arenda Platform
      </div>
    </nav>
  )
}


interface NavItem {
  label: string
  href?: string
  icon: React.ElementType
  children?: { label: string; href: string }[]
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Arendatori',
    icon: Users,
    children: [
      { label: 'Lista arendatori', href: '/arendatori' },
      { label: 'Adauga arendator', href: '/arendatori/nou' },
    ],
  },
  {
    label: 'Contracte',
    icon: FileText,
    children: [
      { label: 'Lista contracte', href: '/contracte' },
      { label: 'Contract nou', href: '/contracte/nou' },
    ],
  },
  {
    label: 'Parcele',
    icon: MapPin,
    children: [
      { label: 'Lista parcele', href: '/parcele' },
      { label: 'Parcela noua', href: '/parcele/nou' },
    ],
  },
  {
    label: 'Plati',
    href: '/plati',
    icon: CreditCard,
  },
  {
    label: 'Rapoarte',
    href: '/rapoarte',
    icon: BarChart3,
  },
  {
    label: 'Declaratii',
    icon: FileSpreadsheet,
    children: [
      { label: 'Dashboard fiscal', href: '/declaratii' },
      { label: 'D112 - Impozit arenda', href: '/declaratii/d112' },
      { label: 'Export APIA', href: '/declaratii/apia' },
      { label: 'Istoric declaratii', href: '/declaratii/istoric' },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { open, close } = useSidebarStore()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  function toggleGroup(label: string) {
    setCollapsed(prev => ({ ...prev, [label]: !prev[label] }))
  }

  function isGroupActive(item: NavItem) {
    if (item.href) return pathname === item.href || pathname.startsWith(item.href + '/')
    return item.children?.some(c => pathname === c.href || pathname.startsWith(c.href + '/')) ?? false
  }

  return (
    <nav className={clsx(
      'w-56 bg-sidebar-bg flex flex-col h-full select-none flex-shrink-0 z-30',
      'fixed md:relative inset-y-0 left-0 transition-transform duration-200',
      open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
    )}>
      {/* Logo / Brand */}
      <div className="px-4 py-4 border-b border-sidebar-hover flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 className="w-6 h-6 text-brand-400" />
          <span className="text-sidebar-text font-semibold text-sm tracking-wide">
            Arenda<span className="text-brand-400">Pro</span>
          </span>
        </div>
        <button
          onClick={close}
          className="md:hidden p-1 rounded text-sidebar-muted hover:text-sidebar-text hover:bg-sidebar-hover transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {NAV_ITEMS.map(item => {
          if (!item.children) {
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'))
            return (
              <Link
                key={item.label}
                href={item.href!}
                onClick={close}
                className={clsx(
                  'flex items-center gap-2.5 px-4 py-2 text-sm transition-colors',
                  active
                    ? 'bg-sidebar-active text-white'
                    : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white',
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
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
                  'w-full flex items-center gap-2.5 px-4 py-2 text-sm transition-colors',
                  groupActive
                    ? 'text-white'
                    : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white',
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left">{item.label}</span>
                <ChevronDown
                  className={clsx(
                    'w-3 h-3 transition-transform text-sidebar-muted',
                    isOpen && 'rotate-180',
                  )}
                />
              </button>

              {isOpen && (
                <div className="ml-0 bg-sidebar-hover/30">
                  {item.children.map(child => {
                    const childActive = pathname === child.href || pathname.startsWith(child.href + '/')
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={close}
                        className={clsx(
                          'flex items-center gap-2 pl-10 pr-4 py-1.5 text-xs transition-colors',
                          childActive
                            ? 'text-brand-300 font-medium bg-sidebar-active/60'
                            : 'text-sidebar-muted hover:text-sidebar-text hover:bg-sidebar-hover',
                        )}
                      >
                        <span className="w-1 h-1 rounded-full bg-current flex-shrink-0" />
                        {child.label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Footer — Profil */}
      <div className="border-t border-sidebar-hover">
        <Link
          href="/profil"
          onClick={close}
          className={clsx(
            'flex items-center gap-2.5 px-4 py-2 text-sm transition-colors',
            pathname.startsWith('/profil')
              ? 'bg-sidebar-active text-white'
              : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white',
          )}
        >
          <UserCircle className="w-4 h-4 flex-shrink-0" />
          <span>Profil</span>
        </Link>
      </div>
      <div className="px-4 py-2 border-t border-sidebar-hover text-2xs text-sidebar-muted">
        v0.1.0 - Arenda Platform
      </div>
    </nav>
  )
}
