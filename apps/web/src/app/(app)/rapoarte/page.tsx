'use client'

export const runtime = 'edge'

import { useState, useEffect } from 'react'
import { getDashboardStats, lessors, contracts, parcels, payments } from '@/lib/mockStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { BarChart3, Users, FileText, MapPin, CreditCard } from 'lucide-react'

export default function RapoartePage() {
  const [stats, setStats] = useState(getDashboardStats())
  const [counts, setCounts] = useState({ lessors: 0, contracts: 0, parcels: 0, payments: 0 })

  useEffect(() => {
    setStats(getDashboardStats())
    setCounts({
      lessors: lessors.list().length,
      contracts: contracts.list().length,
      parcels: parcels.list().length,
      payments: payments.list().length,
    })
  }, [])

  const sections = [
    { title: 'Arendatori', icon: Users, items: [
      { label: 'Total arendatori', value: counts.lessors },
      { label: 'Activi', value: stats.lessorsTotal },
      { label: 'Inactivi', value: counts.lessors - stats.lessorsTotal },
    ]},
    { title: 'Contracte', icon: FileText, items: [
      { label: 'Total contracte', value: counts.contracts },
      { label: 'Active', value: stats.contractsActive },
      { label: 'Expiră în 30 zile', value: stats.contractsExpiring },
    ]},
    { title: 'Parcele', icon: MapPin, items: [
      { label: 'Total parcele', value: stats.parcelsTotal },
      { label: 'Suprafață totală (ha)', value: stats.surfaceTotal },
    ]},
    { title: 'Plăți', icon: CreditCard, items: [
      { label: 'Total plăți', value: counts.payments },
      { label: 'Restante', value: stats.paymentsOverdue },
      { label: 'Valoare restanțe (RON)', value: stats.paymentsOverdueAmount },
    ]},
  ]

  return (
    <div>
      <PageHeader title="Rapoarte" subtitle="Situație generală" />
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
      <div className="mt-4 bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-2">
          <BarChart3 className="w-4 h-4 text-brand-500" />
          <span className="font-semibold text-gray-800 text-sm">Export date</span>
        </div>
        <p className="text-sm text-gray-500">Funcționalitate de export disponibilă după conectarea la baza de date.</p>
      </div>
    </div>
  )
}
