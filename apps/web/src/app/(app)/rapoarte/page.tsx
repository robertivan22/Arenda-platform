'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { BarChart3, Users, FileText, MapPin, CreditCard } from 'lucide-react'

interface ReportStats {
  lessorsTotal: number; lessorsActive: number; lessorsInactive: number
  contractsTotal: number; contractsActive: number; contractsExpiring: number
  parcelsTotal: number; surfaceTotal: string
  paymentsTotal: number; paymentsOverdue: number; paymentsOverdueAmount: string
}

const EMPTY: ReportStats = {
  lessorsTotal: 0, lessorsActive: 0, lessorsInactive: 0,
  contractsTotal: 0, contractsActive: 0, contractsExpiring: 0,
  parcelsTotal: 0, surfaceTotal: '0.00',
  paymentsTotal: 0, paymentsOverdue: 0, paymentsOverdueAmount: '0.00',
}

export default function RapoartePage() {
  const [stats, setStats] = useState<ReportStats>(EMPTY)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const db = createClient()
      const now = new Date()
      const in30 = new Date(now.getTime() + 30 * 86400000).toISOString().split('T')[0]
      const today = now.toISOString().split('T')[0]
      const [
        { count: lessorsTotal },
        { count: lessorsActive },
        { count: contractsTotal },
        { count: contractsActive },
        { count: contractsExpiring },
        { data: parcelsData },
        { count: paymentsTotal },
        { data: overdueData },
      ] = await Promise.all([
        db.from('lessors').select('id', { count: 'exact', head: true }),
        db.from('lessors').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        db.from('contracts').select('id', { count: 'exact', head: true }),
        db.from('contracts').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        db.from('contracts').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE').lte('end_date', in30).gte('end_date', today),
        db.from('parcels').select('surface'),
        db.from('payments').select('id', { count: 'exact', head: true }),
        db.from('payments').select('amount').in('status', ['OVERDUE', 'PENDING']),
      ])
      const surfaceTotal = ((parcelsData ?? []) as any[]).reduce((s, p) => s + Number(p.surface ?? 0), 0).toFixed(2)
      const paymentsOverdue = (overdueData ?? []).length
      const paymentsOverdueAmount = ((overdueData ?? []) as any[]).reduce((s, p) => s + Number(p.amount ?? 0), 0).toFixed(2)
      setStats({
        lessorsTotal: lessorsTotal ?? 0, lessorsActive: lessorsActive ?? 0,
        lessorsInactive: (lessorsTotal ?? 0) - (lessorsActive ?? 0),
        contractsTotal: contractsTotal ?? 0, contractsActive: contractsActive ?? 0,
        contractsExpiring: contractsExpiring ?? 0,
        parcelsTotal: (parcelsData ?? []).length, surfaceTotal,
        paymentsTotal: paymentsTotal ?? 0, paymentsOverdue, paymentsOverdueAmount,
      })
      setLoading(false)
    }
    load()
  }, [])

  const sections = [
    { title: 'Arendatori', icon: Users, items: [
      { label: 'Total arendatori', value: stats.lessorsTotal },
      { label: 'Activi', value: stats.lessorsActive },
      { label: 'Inactivi', value: stats.lessorsInactive },
    ]},
    { title: 'Contracte', icon: FileText, items: [
      { label: 'Total contracte', value: stats.contractsTotal },
      { label: 'Active', value: stats.contractsActive },
      { label: 'Expiră în 30 zile', value: stats.contractsExpiring },
    ]},
    { title: 'Parcele', icon: MapPin, items: [
      { label: 'Total parcele', value: stats.parcelsTotal },
      { label: 'Suprafață totală (ha)', value: stats.surfaceTotal },
    ]},
    { title: 'Plăți', icon: CreditCard, items: [
      { label: 'Total plăți', value: stats.paymentsTotal },
      { label: 'Restante', value: stats.paymentsOverdue },
      { label: 'Valoare restanțe (RON)', value: stats.paymentsOverdueAmount },
    ]},
  ]

  return (
    <div>
      <PageHeader title="Rapoarte" subtitle="Situație generală" />
      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Se încarcă...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sections.map(sec => (
            <div key={sec.title} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-3">
                <sec.icon className="w-4 h-4 text-brand-500" />
                <span className="font-semibold text-gray-800 text-sm">{sec.title}</span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {sec.items.map(item => (
                    <tr key={item.label} className="border-b border-gray-100 last:border-0">
                      <td className="py-1.5 text-gray-600">{item.label}</td>
                      <td className="py-1.5 text-right font-semibold text-gray-900">{item.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
      <div className="mt-4 bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-4 h-4 text-brand-500" />
          <span className="font-semibold text-gray-800 text-sm">Export date</span>
        </div>
        <p className="text-sm text-gray-500">Folosiți paginile Declarații → D112 sau APIA pentru export CSV/XML.</p>
      </div>
    </div>
  )
}
