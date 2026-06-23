'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, FileText, CreditCard, Wheat,
  MapPin, Package, Receipt, BarChart3, Tractor, Activity,
  FolderOpen, FileSpreadsheet, Leaf, Bot, Menu as MenuIcon,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useRef, useEffect } from 'react'
import { useSidebarStore } from '@/store/sidebar.store'

const NAV_ITEMS = [
  { label: 'Dashboard',   href: '/dashboard',          icon: LayoutDashboard },
  { label: 'Alerte',      href: '/alerte',             icon: Bot },
  { label: 'Arendatori',  href: '/arendatori',         icon: Users },
  { label: 'Contracte',   href: '/contracte',          icon: FileText },
  { label: 'Tranzacții',  href: '/plati',              icon: CreditCard },
  { label: 'Distribuire', href: '/distribuire-arenda', icon: Wheat },
  { label: 'Parcele',     href: '/parcele',            icon: MapPin },
  { label: 'Campanie',    href: '/campanie',           icon: Wheat },
  { label: 'Utilaje',     href: '/utilaje',            icon: Tractor },
  { label: 'Fermă',       href: '/ferma',              icon: Activity },
  { label: 'Stocuri',     href: '/inventar/stoc',      icon: Package },
  { label: 'e-Factura',   href: '/efactura',           icon: Receipt },
  { label: 'APIA',        href: '/apia',               icon: FolderOpen },
  { label: 'Rapoarte',    href: '/rapoarte',           icon: BarChart3 },
  { label: 'Declarații',  href: '/declaratii',         icon: FileSpreadsheet },
  { label: 'Fitosanitar', href: '/fitosanitar',        icon: Leaf },
] as { label: string; href: string; icon: React.ElementType }[]

export function MobileNav() {
  const pathname = usePathname()
  const { toggle } = useSidebarStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeRef = useRef<HTMLAnchorElement>(null)

  // Auto-scroll active tab into view
  useEffect(() => {
    if (activeRef.current && scrollRef.current) {
      const container = scrollRef.current
      const el = activeRef.current
      const elLeft = el.offsetLeft
      const elRight = elLeft + el.offsetWidth
      const visLeft = container.scrollLeft
      const visRight = visLeft + container.clientWidth
      if (elLeft < visLeft + 8) {
        container.scrollTo({ left: elLeft - 8, behavior: 'smooth' })
      } else if (elRight > visRight - 8) {
        container.scrollTo({ left: elRight - container.clientWidth + 8, behavior: 'smooth' })
      }
    }
  }, [pathname])

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200 md:hidden flex items-stretch"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Fixed Menu button */}
      <button
        onClick={toggle}
        className="flex-shrink-0 flex flex-col items-center justify-center gap-0.5 px-3 h-14 text-[10px] font-medium text-gray-500 border-r border-gray-100 hover:bg-gray-50 active:bg-gray-100 transition-colors min-w-[52px]"
        aria-label="Meniu"
      >
        <MenuIcon className="w-5 h-5" />
        <span>Meniu</span>
      </button>

      {/* Scrollable tabs */}
      <div
        ref={scrollRef}
        className="flex-1 flex overflow-x-auto"
        style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
      >
        <div className="flex h-14">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                ref={active ? activeRef : undefined}
                className={clsx(
                  'flex flex-col items-center justify-center gap-0.5 px-3 text-[10px] font-medium transition-colors whitespace-nowrap min-w-[56px] min-h-[44px]',
                  active
                    ? 'text-green-700 border-t-2 border-green-600 -mt-px'
                    : 'text-gray-400 active:text-gray-600',
                )}
              >
                <Icon className={clsx('w-5 h-5 flex-shrink-0', active && 'text-green-700')} />
                <span>{label}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
