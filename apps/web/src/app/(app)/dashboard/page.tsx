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
        { data: paymentsData },
      ] = await Promise.all([
        db.from('lessors').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        db.from('contracts').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        db.from('contracts').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE').lte('end_date', in30).gte('end_date', today),
        db.from('parcels').select('surface'),
        db.from('payments').select('amount, status').in('status', ['OVERDUE', 'PENDING']),
      ])
      const surfaceTotal = ((parcelsData ?? []) as any[]).reduce((acc, p) => acc + Number(p.surface ?? 0), 0).toFixed(2)
      const paymentsOverdue = (paymentsData ?? []).length
      const paymentsOverdueAmount = ((paymentsData ?? []) as any[]).reduce((acc, p) => acc + Number(p.amount ?? 0), 0).toFixed(2)
      setS({ lessorsTotal: lessorsTotal ?? 0, contractsActive: contractsActive ?? 0, contractsExpiring: contractsExpiring ?? 0, parcelsTotal: (parcelsData ?? []).length, surfaceTotal, paymentsOverdue, paymentsOverdueAmount })
      setLoading(false)
    }
    load()
  }, [])

  const dash = loading ? 'â€”' : undefined

  return (
    <div>
      {/* Page title */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Vizualizare generalÄƒ platformÄƒ</p>
      </div>

      {/* Hero banner */}
      <div className="rounded-2xl mb-6 overflow-hidden relative" style={{ background: 'linear-gradient(135deg, #1e3a22 0%, #2d6a4f 100%)' }}>
        <div className="px-8 py-7 flex items-center justify-between">
          <div className="relative z-10">
            <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-2">Bun venit Ã®napoi</p>
            <h2 className="text-2xl font-bold text-white mb-2">Platforma ta agricolÄƒ</h2>
            <p className="text-[#74c69d] text-sm mb-5 max-w-xs">
              GestioneazÄƒ arendatorii, contractele È™i parcelele din un singur loc.
            </p>
            <button
              onClick={() => router.push('/arendatori/nou')}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              AdaugÄƒ arendator
            </button>
          </div>
          {/* Tractor illustration */}
          <div className="hidden sm:block flex-shrink-0 mr-4 opacity-90">
            <svg viewBox="0 0 260 160" className="w-56 h-auto" xmlns="http://www.w3.org/2000/svg">
              <rect x="60" y="65" width="110" height="58" rx="6" fill="#2d6a4f"/>
              <rect x="125" y="38" width="62" height="42" rx="5" fill="#1b4332"/>
              <rect x="132" y="45" width="45" height="26" rx="3" fill="#74c69d" opacity="0.35"/>
              <rect x="60" y="74" width="68" height="34" rx="3" fill="#1b4332"/>
              <rect x="108" y="28" width="7" height="18" rx="3.5" fill="#1b4332"/>
              <ellipse cx="111" cy="27" rx="5" ry="3.5" fill="#333" opacity="0.5"/>
              <circle cx="90" cy="128" r="35" fill="#1a1a1a"/>
              <circle cx="90" cy="128" r="28" fill="#2d2d2d"/>
              <circle cx="90" cy="128" r="19" fill="#1a1a1a"/>
              <circle cx="90" cy="128" r="8" fill="#555"/>
              {[0,45,90,135,180,225,270,315].map((a,i) => (
                <line key={i} x1="90" y1="128"
                  x2={90 + 23*Math.cos(a*Math.PI/180)}
                  y2={128 + 23*Math.sin(a*Math.PI/180)}
                  stroke="#555" strokeWidth="2.5"/>
              ))}
              <circle cx="188" cy="135" r="20" fill="#1a1a1a"/>
              <circle cx="188" cy="135" r="15" fill="#2d2d2d"/>
              <circle cx="188" cy="135" r="9" fill="#1a1a1a"/>
              <circle cx="188" cy="135" r="4" fill="#555"/>
              <line x1="30" y1="163" x2="240" y2="163" stroke="#2d6a4f" strokeWidth="2" opacity="0.5"/>
              {[22,35,215,228].map((x,i) => (
                <g key={i}>
                  <line x1={x} y1="163" x2={x} y2="140" stroke="#52b788" strokeWidth="1.5"/>
                  <ellipse cx={x} cy="137" rx="4" ry="7" fill="#52b788" opacity="0.7"/>
                </g>
              ))}
            </svg>
          </div>
        </div>
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10 pointer-events-none" style={{ background: '#74c69d', transform: 'translate(30%, -30%)' }}/>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard label="Arendatori activi"           value={dash ?? s.lessorsTotal}         icon={Users}          iconBg="bg-green-100"   iconColor="text-green-600" />
        <StatCard label="Contracte active"            value={dash ?? s.contractsActive}       icon={FileText}       iconBg="bg-blue-100"    iconColor="text-blue-600" />
        <StatCard label="Contracte ce expirÄƒ (30 zile)" value={dash ?? s.contractsExpiring}  icon={Clock}          iconBg="bg-amber-100"   iconColor="text-amber-600" />
        <StatCard label="Parcele Ã®nregistrate"        value={dash ?? s.parcelsTotal}          icon={MapPin}         iconBg="bg-violet-100"  iconColor="text-violet-600"
          sub={loading ? undefined : `SuprafaÈ›Äƒ totalÄƒ: ${s.surfaceTotal} ha`} />
        <StatCard label="PlÄƒÈ›i restante"              value={dash ?? s.paymentsOverdue}       icon={AlertTriangle}  iconBg="bg-red-100"     iconColor="text-red-500"
          sub={loading ? undefined : `${s.paymentsOverdueAmount} RON`} />
        <StatCard label="Total restanÈ›e (RON)"        value={dash ?? s.paymentsOverdueAmount} icon={CreditCard}     iconBg="bg-sky-100"     iconColor="text-sky-600" />
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="text-sm font-semibold text-gray-700 mb-3">AcÈ›iuni rapide</div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Arendator nou', href: '/arendatori/nou', icon: Users },
            { label: 'Contract nou', href: '/contracte/nou', icon: FileText },
            { label: 'ParcelÄƒ nouÄƒ', href: '/parcele/nou', icon: MapPin },
            { label: 'PlÄƒÈ›i restante', href: '/plati', icon: AlertTriangle },
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
