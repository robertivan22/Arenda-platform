'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getDashboardStats } from '@/lib/mockStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { Users, FileText, MapPin, CreditCard, AlertTriangle, TrendingUp } from 'lucide-react'

function StatCard({ label, value, icon: Icon, sub, variant = 'default' }: {
  label: string; value: string | number; icon: React.ElementType; sub?: string; variant?: 'default' | 'warning' | 'danger'
}) {
  const v = { default: 'border-gray-200 bg-white', warning: 'border-yellow-200 bg-yellow-50', danger: 'border-red-200 bg-red-50' }
  const iv = { default: 'bg-brand-100 text-brand-600', warning: 'bg-yellow-100 text-yellow-600', danger: 'bg-red-100 text-red-600' }
  return (
    <div className={`rounded-lg border p-4 flex items-start gap-3 ${v[variant]}`}>
      <div className={`p-2 rounded-lg ${iv[variant]}`}><Icon className="w-5 h-5" /></div>
      <div>
        <div className="text-2xl font-semibold text-gray-900">{value}</div>
        <div className="text-sm text-gray-600">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [s, setS] = useState(getDashboardStats())

  useEffect(() => { setS(getDashboardStats()) }, [])

  const links = [
    { label: 'Arendator nou', href: '/arendatori/nou' },
    { label: 'Contract nou', href: '/contracte/nou' },
    { label: 'Parcelă nouă', href: '/parcele/nou' },
    { label: 'Plăți restante', href: '/plati' },
    { label: 'Rapoarte', href: '/rapoarte' },
  ]

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Vizualizare generală platformă" />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard label="Arendatori activi" value={s.lessorsTotal} icon={Users} />
        <StatCard label="Contracte active" value={s.contractsActive} icon={FileText} />
        <StatCard label="Contracte care expiră (30 zile)" value={s.contractsExpiring} icon={TrendingUp} variant={s.contractsExpiring > 0 ? 'warning' : 'default'} />
        <StatCard label="Parcele înregistrate" value={s.parcelsTotal} icon={MapPin} sub={`Suprafață totală: ${s.surfaceTotal} ha`} />
        <StatCard label="Plăți restante" value={s.paymentsOverdue} icon={AlertTriangle} sub={`${s.paymentsOverdueAmount} RON`} variant={s.paymentsOverdue > 0 ? 'danger' : 'default'} />
        <StatCard label="Total restanțe (RON)" value={s.paymentsOverdueAmount} icon={CreditCard} variant={parseFloat(s.paymentsOverdueAmount) > 0 ? 'danger' : 'default'} />
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="text-sm font-semibold text-gray-700 mb-3">Acțiuni rapide</div>
        <div className="flex flex-wrap gap-2">
          {links.map(link => (
            <button key={link.href} onClick={() => router.push(link.href)}
              className="px-3 py-1.5 text-xs rounded border border-brand-300 text-brand-600 hover:bg-brand-50 transition-colors font-medium">
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
