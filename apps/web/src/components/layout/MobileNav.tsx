'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, FileText, Wheat, MapPin, ScanLine } from 'lucide-react'
import { clsx } from 'clsx'

const NAV_ITEMS = [
  { label: 'Dashboard',  href: '/dashboard',         icon: LayoutDashboard },
  { label: 'Contracte',  href: '/contracte',          icon: FileText },
  { label: 'Distribuire',href: '/distribuire-arenda', icon: Wheat },
  { label: 'Parcele',    href: '/parcele',            icon: MapPin },
  { label: 'Facturi',    href: '/facturi-import',     icon: ScanLine },
]

export function MobileNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="grid grid-cols-5 h-14">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href + '/'))
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors min-h-[44px]',
                active ? 'text-green-700' : 'text-gray-400 active:text-gray-600',
              )}
            >
              <Icon className={clsx('w-5 h-5 flex-shrink-0', active && 'text-green-700')} />
              <span>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
