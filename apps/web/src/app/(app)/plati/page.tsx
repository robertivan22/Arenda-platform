'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'

interface TranzactieRow {
  id: string
  transaction_date: string
  campaign_year: number
  product_name: string
  kg_brut: number
  kg_net: number
  price_per_unit: number
  ron_brut: number
  ron_net: number
  tax_amount: number
  payment_type: string
  pv_number: string | null
  is_previzionata: boolean
  impozit_aplicat: boolean
  notes: string | null
  lessor_name: string
  contract_number: string | null
}
export default function TranzactiiPage() {
  const [rows, setRows] = useState<TranzactieRow[]>([])
  const [loading, setLoading] = useState(true)
  const [yearFilter, setYearFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'definitiva' | 'previzionata'>('all')

  const reload = useCallback(async () => {
    setLoading(true)
    const db = createClient()
    const { data } = await db
      .from('transactions')
      .select(`
        id, transaction_date, campaign_year, product_name,
        kg_brut, kg_net, price_per_unit, ron_brut, ron_net, tax_amount,
        payment_type, pv_number, is_previzionata, impozit_aplicat, notes,
        lessors(first_name, last_name, company_name, type),
        contracts(contract_number)
      `)
      .order('transaction_date', { ascending: false })
    if (data) {
      setRows((data as any[]).map(t => ({
        ...t,
        lessor_name: t.lessors
          ? (t.lessors.type === 'LEGAL'
              ? t.lessors.company_name
              : `${t.lessors.last_name} ${t.lessors.first_name}`.trim())
          : 'â€”',
        contract_number: t.contracts?.contract_number ?? null,
      })))
    }
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  const years = [...new Set(rows.map(r => String(r.campaign_year)))].sort((a, b) => Number(b) - Number(a))

  const filtered = rows.filter(r => {
    if (yearFilter !== 'all' && String(r.campaign_year) !== yearFilter) return false
    if (typeFilter === 'definitiva' && r.is_previzionata) return false
    if (typeFilter === 'previzionata' && !r.is_previzionata) return false
    return true
  })

  const totalBrut = filtered.reduce((s, r) => s + Number(r.ron_brut ?? 0), 0)
  const totalNet = filtered.reduce((s, r) => s + Number(r.ron_net ?? 0), 0)
  const totalImpozit = filtered.reduce((s, r) => s + Number(r.tax_amount ?? 0), 0)

  const thCls = 'px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide'
  const tdCls = 'px-3 py-2 text-sm'

  return (
    <div>
      <PageHeader
        title="Tranzacții"
        subtitle={`${filtered.length} înregistrări · ${totalBrut.toFixed(2)} RON brut`}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={yearFilter}
          onChange={e => setYearFilter(e.target.value)}
          className="px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="all">Toți anii</option>
          {years.map(y => <option key={y} value={y}>An {y}</option>)}
        </select>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value as typeof typeFilter)}
          className="px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="all">Toate tipurile</option>
          <option value="definitiva">Definitive</option>
          <option value="previzionata">Previzionate</option>
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'RON Brut', value: totalBrut.toFixed(2) },
          { label: 'RON Net', value: totalNet.toFixed(2) },
          { label: 'Impozit reținut', value: totalImpozit.toFixed(2) },
        ].map(c => (
          <div key={c.label} className="bg-white border border-gray-200 rounded-lg p-3">
            <div className="text-lg font-semibold text-gray-900">{c.value}</div>
            <div className="text-xs text-gray-500">{c.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['Dată', 'Arendator', 'Contract', 'Produs', 'Kg Brut', 'Preț/unit', 'RON Brut', 'RON Net', 'Impozit', 'Tip plată', 'Tip'].map(h => (
                <th key={h} className={thCls}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-gray-400">Se încarcă...</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={11} className="px-3 py-8 text-center text-gray-400">Nicio tranzacție înregistrată</td></tr>
            )}
            {filtered.map(row => (
              <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className={tdCls}>{row.transaction_date}</td>
                <td className={`${tdCls} font-medium`}>{row.lessor_name}</td>
                <td className={tdCls}>{row.contract_number ?? '—'}</td>
                <td className={tdCls}>{row.product_name}</td>
                <td className={`${tdCls} text-right`}>{Number(row.kg_brut).toFixed(2)}</td>
                <td className={`${tdCls} text-right`}>{Number(row.price_per_unit).toFixed(4)}</td>
                <td className={`${tdCls} text-right font-medium`}>{Number(row.ron_brut).toFixed(2)}</td>
                <td className={`${tdCls} text-right text-green-700 font-medium`}>{Number(row.ron_net).toFixed(2)}</td>
                <td className={`${tdCls} text-right text-orange-600`}>{Number(row.tax_amount).toFixed(2)}</td>
                <td className={tdCls}>{row.payment_type}{row.pv_number ? ` #${row.pv_number}` : ''}</td>
                <td className={tdCls}>
                  {row.is_previzionata
                    ? <span className="px-1.5 py-0.5 text-xs rounded bg-yellow-100 text-yellow-700">Previz.</span>
                    : <span className="px-1.5 py-0.5 text-xs rounded bg-green-100 text-green-700">Definitiv</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
