'use client'

import { useQuery } from '@tanstack/react-query'
import { apiGet } from '@/lib/api-client'
import { PageHeader } from '@/components/layout/PageHeader'
import { Users, FileText, MapPin, CreditCard, AlertTriangle, TrendingUp } from 'lucide-react'

interface DashboardStats {
  lessorsTotal: number
  contractsActive: number
  contractsExpiring: number
  parcelsTotal: number
  surfaceTotal: string
  paymentsOverdue: number
  paymentsOverdueAmount: string
}

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ElementType
  sub?: string
  variant?: 'default' | 'warning' | 'danger'
}

function StatCard({ label, value, icon: Icon, sub, variant = 'default' }: StatCardProps) {
  const variants = {
    default: 'border-gray-200 bg-white',
    warning: 'border-yellow-200 bg-yellow-50',
    danger:  'border-red-200 bg-red-50',
  }
  const iconVariants = {
    default: 'bg-brand-100 text-brand-600',
    warning: 'bg-yellow-100 text-yellow-600',
    danger:  'bg-red-100 text-red-600',
  }

  return (
    <div className={`rounded-lg border p-4 flex items-start gap-3 ${variants[variant]}`}>
      <div className={`p-2 rounded-lg ${iconVariants[variant]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <div className="text-2xl font-semibold text-gray-900">{value}</div>
        <div className="text-sm text-gray-600">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<{ data: DashboardStats }>({
    queryKey: ['dashboard-stats'],
    queryFn: () => apiGet<DashboardStats>('/dashboard/stats'),
    // Fallback for dev
    placeholderData: {
      data: {
        lessorsTotal: 0,
        contractsActive: 0,
        contractsExpiring: 0,
        parcelsTotal: 0,
        surfaceTotal: '0.00',
        paymentsOverdue: 0,
        paymentsOverdueAmount: '0.00',
      }
    }
  })

  const s = stats?.data

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Vizualizare generală platformă"
      />

      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-gray-200 bg-white p-4 h-24 animate-pulse bg-gray-100" />
          ))}
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            <StatCard
              label="Arendatori activi"
              value={s?.lessorsTotal ?? 0}
              icon={Users}
            />
            <StatCard
              label="Contracte active"
              value={s?.contractsActive ?? 0}
              icon={FileText}
            />
            <StatCard
              label="Contracte care expiră (30 zile)"
              value={s?.contractsExpiring ?? 0}
              icon={TrendingUp}
              variant={s?.contractsExpiring ? 'warning' : 'default'}
            />
            <StatCard
              label="Parcele înregistrate"
              value={s?.parcelsTotal ?? 0}
              icon={MapPin}
              sub={`Suprafață totală: ${s?.surfaceTotal ?? '0'} ha`}
            />
            <StatCard
              label="Plăți restante"
              value={s?.paymentsOverdue ?? 0}
              icon={AlertTriangle}
              sub={`${s?.paymentsOverdueAmount ?? '0'} RON`}
              variant={s?.paymentsOverdue ? 'danger' : 'default'}
            />
            <StatCard
              label="Total restanțe (RON)"
              value={s?.paymentsOverdueAmount ?? '0'}
              icon={CreditCard}
              variant={parseFloat(s?.paymentsOverdueAmount ?? '0') > 0 ? 'danger' : 'default'}
            />
          </div>

          {/* Quick links */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm font-semibold text-gray-700 mb-3">Acțiuni rapide</div>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Arendator nou', href: '/arendatori/nou' },
                { label: 'Contract nou', href: '/contracte/nou' },
                { label: 'Parcelă nouă', href: '/parcele/nou' },
                { label: 'Plăți restante', href: '/plati/restante' },
                { label: 'Rapoarte', href: '/rapoarte' },
              ].map(link => (
                <a
                  key={link.href}
                  href={link.href}
                  className="px-3 py-1.5 text-xs rounded border border-brand-300 text-brand-600 hover:bg-brand-50 transition-colors font-medium"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
