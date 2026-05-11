'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, FileText, MapPin, CreditCard,
  ShoppingBag, BarChart3, Headphones, Settings, ChevronDown,
  Building2,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useState } from 'react'


interface NavItem {
  label: string
  href?: string
  icon: React.ElementType
  permission?: string
  children?: { label: string; href: string; permission?: string }[]
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
    permission: 'lessor:read',
    children: [
      { label: 'Lista arendatori', href: '/arendatori' },
      { label: 'Lista + contracte', href: '/arendatori/lista-contracte' },
      { label: 'Adaugă arendator', href: '/arendatori/nou', permission: 'lessor:create' },
      { label: 'Opriți de la plată', href: '/arendatori/opriti-plata' },
      { label: 'Liste APIA', href: '/arendatori/apia' },
      { label: 'Adeverințe primărie', href: '/arendatori/adeverinte' },
    ],
  },
  {
    label: 'Contracte',
    icon: FileText,
    permission: 'contract:read',
    children: [
      { label: 'Lista contracte', href: '/contracte' },
      { label: 'Contract nou', href: '/contracte/nou', permission: 'contract:create' },
    ],
  },
  {
    label: 'Parcele',
    icon: MapPin,
    permission: 'parcel:read',
    children: [
      { label: 'Lista parcele', href: '/parcele' },
      { label: 'Parcelă nouă', href: '/parcele/nou', permission: 'parcel:create' },
    ],
  },
  {
    label: 'Plăți restante',
    href: '/plati/restante',
    icon: CreditCard,
    permission: 'payment:read',
  },
  {
    label: 'Plăți',
    icon: CreditCard,
    permission: 'payment:read',
    children: [
      { label: 'Dashboard plăți', href: '/plati' },
      { label: 'Loturi plăți', href: '/plati/loturi' },
      { label: 'Numerar', href: '/plati/numerar' },
      { label: 'Bancă', href: '/plati/banca' },
      { label: 'Mandat poștal', href: '/plati/mandat-postal' },
      { label: 'Produse agricole', href: '/plati/produse' },
      { label: 'Borderou', href: '/plati/borderou' },
      { label: 'Monetar zilnic', href: '/plati/monetar-zilnic' },
    ],
  },
  {
    label: 'Oferte cumpărare',
    href: '/oferte-cumparare',
    icon: ShoppingBag,
    permission: 'lessor:read',
  },
  {
    label: 'Rapoarte',
    href: '/rapoarte',
    icon: BarChart3,
    permission: 'report:read',
  },
  {
    label: 'Asistență tehnică',
    href: '/asistenta-tehnica',
    icon: Headphones,
  },
  {
    label: 'Administrare',
    icon: Settings,
    permission: 'admin:users:manage',
    children: [
      { label: 'Utilizatori', href: '/admin/utilizatori' },
      { label: 'Roluri', href: '/admin/roluri' },
      { label: 'Nomenclatoare', href: '/admin/nomenclatoare' },
      { label: 'Template-uri', href: '/admin/template-uri' },
      { label: 'Setări tenant', href: '/admin/setari-tenant' },
      { label: 'Jurnal audit', href: '/admin/jurnal-audit' },
    ],
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  function toggleGroup(label: string) {
    setCollapsed(prev => ({ ...prev, [label]: !prev[label] }))
  }

  function isGroupActive(item: NavItem) {
    if (item.href) return pathname === item.href || pathname.startsWith(item.href + '/')
    return item.children?.some(c => pathname === c.href || pathname.startsWith(c.href + '/')) ?? false
  }

  return (
    <nav className="w-56 bg-sidebar-bg flex flex-col h-full select-none flex-shrink-0">
      {/* Logo / Brand */}
      <div className="px-4 py-4 border-b border-sidebar-hover">
        <div className="flex items-center gap-2">
          <Building2 className="w-6 h-6 text-brand-400" />
          <span className="text-sidebar-text font-semibold text-sm tracking-wide">
            Arenda<span className="text-brand-400">Pro</span>
          </span>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        {NAV_ITEMS.map(item => {
          if (item.permission) return null

          // Leaf item - keep going
          if (!item.children) {
            const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href + '/'))
            return (
              <Link
                key={item.label}
                href={item.href!}
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

          // Group item with children
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

      {/* Footer */}
      <div className="px-4 py-3 border-t border-sidebar-hover text-2xs text-sidebar-muted">
        v0.1.0 — Arenda Platform
      </div>
    </nav>
  )
}
