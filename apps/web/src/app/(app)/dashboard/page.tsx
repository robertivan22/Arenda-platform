'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { Users, FileText, MapPin, CreditCard, AlertTriangle, TrendingUp } from 'lucide-react'

interface Stats {
  lessorsTotal: number
  contractsActive: number
  contractsExpiring: number
  parcelsTotal: number
  surfaceTotal: string
  paymentsOverdue: number
  paymentsOverdueAmount: string
}

const EMPTY: Stats = {
  lessorsTotal: 0, contractsActive: 0, contractsExpiring: 0,
  parcelsTotal: 0, surfaceTotal: '0.00', paymentsOverdue: 0, paymentsOverdueAmount: '0.00',
}

function StatCard({ label, value, icon: Icon, sub, variant = 'default' }: {
  label: string; value: string | number; icon: React.ElementType; sub?: string; variant?: 'default' | 'warning' | 'danger'
}) {
  const v = { default: 'border-gray-200 bg-white', warning: 'border-yellow-200 bg-yellow-50', danger: 'border-red-200 bg-red-50' }
  const iv = { default: 'bg-brand-100 text-brand-600', warning: 'bg-yellow-100 text-yellow-600', danger: 'bg-red-100 text-red-600' }
  return (
    <div className={`rounded-xl border p-5 flex items-start gap-4 ${v[variant]}`}>
      <div className={`p-2.5 rounded-xl ${iv[variant]}`}><Icon className="w-5 h-5" /></div>
      <div>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-sm text-gray-600 mt-0.5">{label}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [s, setS] = useState<Stats>(EMPTY)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const db = createClient()
      const now = new Date()
      const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const today = now.toISOString().split('T')[0]
      const [
        { count: lessorsTotal },
        { count: contractsActive },
        { count: contractsExpiring },
        { data: parcelsData },
        { data: paymentsData },
      ] = await Promise.all([
        db.from('lessors').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        db.from('contracts').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        db.from('contracts').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE').lte('end_date', in30).gte('end_date', today),
        db.from('parcels').select('surface'),
        db.from('payments').select('amount, status').in('status', ['OVERDUE', 'PENDING']),
      ])
      const surfaceTotal = ((parcelsData ?? []) as any[]).reduce((s, p) => s + Number(p.surface ?? 0), 0).toFixed(2)
      const paymentsOverdue = (paymentsData ?? []).length
      const paymentsOverdueAmount = ((paymentsData ?? []) as any[]).reduce((s, p) => s + Number(p.amount ?? 0), 0).toFixed(2)
      setS({ lessorsTotal: lessorsTotal ?? 0, contractsActive: contractsActive ?? 0, contractsExpiring: contractsExpiring ?? 0, parcelsTotal: (parcelsData ?? []).length, surfaceTotal, paymentsOverdue, paymentsOverdueAmount })
      setLoading(false)
    }
    load()
  }, [])

  const links = [
    { label: 'Arendator nou', href: '/arendatori/nou' },
    { label: 'Contract nou', href: '/contracte/nou' },
    { label: 'Parcela noua', href: '/parcele/nou' },
    { label: 'Plati', href: '/plati' },
    { label: 'Rapoarte', href: '/rapoarte' },
  ]

  const dash = loading ? '—' : undefined

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Vizualizare generala platforma" />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard label="Arendatori activi" value={dash ?? s.lessorsTotal} icon={Users} />
        <StatCard label="Contracte active" value={dash ?? s.contractsActive} icon={FileText} />
        <StatCard label="Contracte ce expira (30 zile)" value={dash ?? s.contractsExpiring} icon={TrendingUp} variant={s.contractsExpiring > 0 ? 'warning' : 'default'} />
        <StatCard label="Parcele inregistrate" value={dash ?? s.parcelsTotal} icon={MapPin} sub={loading ? '' : `Suprafata totala: ${s.surfaceTotal} ha`} />
        <StatCard label="Plati neachitate" value={dash ?? s.paymentsOverdue} icon={AlertTriangle} sub={loading ? '' : `${s.paymentsOverdueAmount} RON`} variant={s.paymentsOverdue > 0 ? 'danger' : 'default'} />
        <StatCard label="Total restante (RON)" value={dash ?? s.paymentsOverdueAmount} icon={CreditCard} variant={parseFloat(s.paymentsOverdueAmount) > 0 ? 'danger' : 'default'} />
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="text-sm font-semibold text-gray-700 mb-3">Actiuni rapide</div>
        <div className="flex flex-wrap gap-2">
          {links.map(link => (
            <button key={link.href} onClick={() => router.push(link.href)} className="px-3 py-1.5 text-xs rounded-lg border border-brand-300 text-brand-600 hover:bg-brand-50 transition-colors font-medium">
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
