'use client'

import { usePathname, useRouter } from 'next/navigation'
import {
  Users, FileText, CreditCard, Wheat,
  MapPin, Package, Receipt, BarChart3, Tractor, Activity,
  FolderOpen, FileSpreadsheet, Leaf, Menu as MenuIcon, Truck,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useRef, useEffect } from 'react'
import { useSidebarStore } from '@/store/sidebar.store'

const NAV_ITEMS = [
  { label: 'Distribuire', href: '/distribuire-arenda', icon: Wheat },
  { label: 'Arendatori',  href: '/arendatori',         icon: Users },
  { label: 'Contracte',   href: '/contracte',          icon: FileText },
  { label: 'Parcele',     href: '/parcele',            icon: MapPin },
  { label: 'Stocuri',     href: '/inventar/stoc',      icon: Package },
  { label: 'Campanie',    href: '/campanie',           icon: Wheat },
  { label: 'Utilaje',     href: '/utilaje',            icon: Tractor },
  { label: 'Fermă',       href: '/ferma',              icon: Activity },
  { label: 'Tranzacții',  href: '/plati',              icon: CreditCard },
  { label: 'Fitosanitar', href: '/fitosanitar',        icon: Leaf },
  { label: 'e-Factura',   href: '/efactura',           icon: Receipt },
  { label: 'e-Transport', href: '/etransport',          icon: Truck },
  { label: 'APIA',        href: '/apia',               icon: FolderOpen },
  { label: 'Rapoarte',    href: '/rapoarte',           icon: BarChart3 },
  { label: 'Declarații',  href: '/declaratii',         icon: FileSpreadsheet },
] as { label: string; href: string; icon: React.ElementType }[]

export function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { toggle } = useSidebarStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeIndexRef = useRef<number>(-1)

  // Auto-scroll active tab into view — instant, no smooth animation
  useEffect(() => {
    const idx = NAV_ITEMS.findIndex(({ href }) => pathname === href || pathname.startsWith(href + '/'))
    if (idx === -1) return
    activeIndexRef.current = idx
    const container = scrollRef.current
    if (!container) return
    // Each item is min-w-[56px]; find the button by index
    const item = container.querySelectorAll('button')[idx] as HTMLElement | undefined
    if (!item) return
    const elLeft = item.offsetLeft
    const elRight = elLeft + item.offsetWidth
    const visLeft = container.scrollLeft
    const visRight = visLeft + container.clientWidth
    if (elLeft < visLeft + 8) {
      container.scrollLeft = elLeft - 8
    } else if (elRight > visRight - 8) {
      container.scrollLeft = elRight - container.clientWidth + 8
    }
  }, [pathname])

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200 md:hidden flex items-stretch"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}
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
        style={{ scrollbarWidth: 'none' } as React.CSSProperties}
      >
        <div className="flex h-14">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <button
                key={href}
                type="button"
                onClick={() => router.push(href)}
                className={clsx(
                  'flex flex-col items-center justify-center gap-0.5 px-3 text-[10px] font-medium whitespace-nowrap min-w-[56px] min-h-[44px] flex-shrink-0 border-0 bg-transparent cursor-pointer',
                  active
                    ? 'text-green-700 border-t-2 border-green-600 -mt-px'
                    : 'text-gray-400 active:text-gray-600',
                )}
              >
                <Icon className={clsx('w-5 h-5 flex-shrink-0', active && 'text-green-700')} />
                <span>{label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
