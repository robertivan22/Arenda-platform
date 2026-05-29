'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Users, FileText, MapPin, CreditCard, AlertTriangle, Clock, Plus, BarChart3 } from 'lucide-react'

export const runtime = 'edge'

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

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ElementType
  sub?: string
  iconBg: string
  iconColor: string
}

function StatCard({ label, value, icon: Icon, sub, iconBg, iconColor }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 flex items-start gap-4 shadow-sm">
      <div className={`p-2.5 rounded-xl flex-shrink-0 ${iconBg}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-gray-900 leading-none mb-1">{value}</div>
        <div className="text-sm text-gray-500">{label}</div>
        {sub && <div className="text-xs mt-0.5" style={{ color: '#2d6a4f' }}>{sub}</div>}
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
        { data: overdueData },
      ] = await Promise.all([
        db.from('lessors').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        db.from('contracts').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        db.from('contracts').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE').lte('end_date', in30).gte('end_date', today),
        db.from('parcels').select('surface').limit(5000),
        db.from('transactions').select('ron_net').eq('is_paid', false).eq('is_previzionata', false).limit(1000),
      ])
      const surfaceTotal = ((parcelsData ?? []) as any[]).reduce((acc, p) => acc + Number(p.surface ?? 0), 0).toFixed(2)
      const paymentsOverdue = (overdueData ?? []).length
      const paymentsOverdueAmount = ((overdueData ?? []) as any[]).reduce((acc, p) => acc + Number(p.ron_net ?? 0), 0).toFixed(2)
      setS({ lessorsTotal: lessorsTotal ?? 0, contractsActive: contractsActive ?? 0, contractsExpiring: contractsExpiring ?? 0, parcelsTotal: (parcelsData ?? []).length, surfaceTotal, paymentsOverdue, paymentsOverdueAmount })
      setLoading(false)
    }
    load()
  }, [])

  const dash = loading ? '—' : undefined

  return (
    <div>
      {/* Page title */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Vizualizare generală platformă</p>
      </div>

      {/* Hero banner */}
      <div className="rounded-2xl mb-6 overflow-hidden relative" style={{ minHeight: '200px' }}>
        {/* Background photo */}
        <img
          src="https://images.unsplash.com/photo-1717702576954-c07131c54169?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwzfHxhZ3JpY3VsdHVyYWwlMjB0cmFjdG9yJTIwZmllbGQlMjBnb2xkZW58ZW58MXx8fHwxNzc5OTY0ODI2fDA&ixlib=rb-4.1.0&q=80&w=1080"
          alt="Tractor pe câmp la apus"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Dark gradient overlay — text readable on left, fades right */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg, rgba(15,34,16,0.92) 0%, rgba(22,51,32,0.80) 50%, rgba(0,0,0,0.25) 100%)' }} />
        <div className="px-8 py-7 flex items-center relative z-10">
          <div>
            <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-2">Bun venit înapoi</p>
            <h2 className="text-2xl font-bold text-white mb-2">Platforma ta agricolă</h2>
            <p className="text-[#74c69d] text-sm mb-5 max-w-xs">
              Gestionează arendatorii, contractele și parcelele din un singur loc.
            </p>
            <button
              onClick={() => router.push('/arendatori/nou')}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Adaugă arendator
            </button>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard label="Arendatori activi"           value={dash ?? s.lessorsTotal}         icon={Users}          iconBg="bg-green-100"   iconColor="text-green-600" />
        <StatCard label="Contracte active"            value={dash ?? s.contractsActive}       icon={FileText}       iconBg="bg-blue-100"    iconColor="text-blue-600" />
        <StatCard label="Contracte ce expiră (30 zile)" value={dash ?? s.contractsExpiring}  icon={Clock}          iconBg="bg-amber-100"   iconColor="text-amber-600" />
        <StatCard label="Parcele înregistrate"        value={dash ?? s.parcelsTotal}          icon={MapPin}         iconBg="bg-violet-100"  iconColor="text-violet-600"
          sub={loading ? undefined : `Suprafață totală: ${s.surfaceTotal} ha`} />
        <StatCard label="Tranzacții neplătite"         value={dash ?? s.paymentsOverdue}       icon={AlertTriangle}  iconBg="bg-red-100"     iconColor="text-red-500"
          sub={loading ? undefined : `${s.paymentsOverdueAmount} RON total neplătit`} />
        <StatCard label="Valoare neplătită (RON)"       value={dash ?? s.paymentsOverdueAmount} icon={CreditCard}     iconBg="bg-sky-100"     iconColor="text-sky-600" />
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="text-sm font-semibold text-gray-700 mb-3">Acțiuni rapide</div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Arendator nou', href: '/arendatori/nou', icon: Users },
            { label: 'Contract nou', href: '/contracte/nou', icon: FileText },
            { label: 'Parcelă nouă', href: '/parcele/nou', icon: MapPin },
            { label: 'Tranzacții', href: '/plati', icon: AlertTriangle },
            { label: 'Rapoarte', href: '/rapoarte', icon: BarChart3 },
          ].map(({ label, href, icon: Icon }) => (
            <button
              key={href}
              onClick={() => router.push(href)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors font-medium"
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
