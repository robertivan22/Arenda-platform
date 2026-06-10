'use client'
export const runtime = 'edge'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from 'sonner'
import { Loader2, Package, AlertTriangle, TrendingDown, Wheat } from 'lucide-react'
import type { InputCategory } from '@/lib/inventory-types'
import { INPUT_CATEGORY_LABELS, INPUT_CATEGORY_COLORS } from '@/lib/inventory-types'

interface StockRow {
  id: string
  category: InputCategory
  product_name: string
  unit: string
  quantity_available: number
  quantity: number
  unit_price: number | null
  batch_number: string | null
  expiry_date: string | null
  received_date: string
  supplier_name: string | null
}

const CATEGORIES: InputCategory[] = ['SEED', 'FERTILIZER', 'PPP', 'FUEL', 'OTHER']

export default function StocPage() {
  const [rows, setRows] = useState<StockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [catFilter, setCatFilter] = useState<InputCategory | 'ALL'>('ALL')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await createClient()
      .from('input_lots')
      .select('id, category, product_name, unit, quantity, quantity_available, unit_price, batch_number, expiry_date, received_date, suppliers(name)')
      .gt('quantity_available', 0)
      .order('category')
      .order('product_name')
    if (error) { toast.error('Eroare la incarcare stoc.'); setLoading(false); return }
    setRows((data ?? []).map((r: any) => ({ ...r, supplier_name: r.suppliers?.name ?? null })))
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const all = rows.filter(r => catFilter === 'ALL' || r.category === catFilter)
  const totalValue = all.reduce((s, r) => s + r.quantity_available * (r.unit_price ?? 0), 0)
  const expiredCount = all.filter(r => r.expiry_date && new Date(r.expiry_date) < new Date()).length
  const lowCount = all.filter(r => r.quantity_available < r.quantity * 0.1).length

  // Group by category for summary cards
  const byCategory = CATEGORIES.map(cat => {
    const items = rows.filter(r => r.category === cat)
    const value = items.reduce((s, r) => s + r.quantity_available * (r.unit_price ?? 0), 0)
    return { cat, count: items.length, value }
  }).filter(g => g.count > 0)

  const th = 'px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide'
  const td = 'px-4 py-3 text-sm'

  return (
    <div>
      <PageHeader
        title="Stoc Curent"
        subtitle={`${all.length} produse in stoc · ${totalValue.toFixed(0)} RON valoare estimata`}
      />

      {/* Link to campaign usage */}
      <a href="/campanie/stocuri"
        className="flex items-center gap-3 mb-5 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors">
        <Wheat className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <span className="text-sm text-amber-800"><strong>Stocuri campanie</strong> — vezi consumul de inputuri per activitate agricola</span>
        <span className="ml-auto text-xs font-semibold text-amber-700">Deschide →</span>
      </a>

      {/* Category summary cards */}
      {!loading && byCategory.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
          {byCategory.map(({ cat, count, value }) => (
            <button key={cat} onClick={() => setCatFilter(catFilter === cat ? 'ALL' : cat)}
              className={`text-left p-3 rounded-xl border transition-all ${catFilter === cat ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium mb-2 ${INPUT_CATEGORY_COLORS[cat]}`}>
                {INPUT_CATEGORY_LABELS[cat]}
              </span>
              <p className="text-xl font-bold text-gray-900">{count}</p>
              <p className="text-xs text-gray-400">{value > 0 ? `${value.toFixed(0)} RON` : 'fara pret'}</p>
            </button>
          ))}
        </div>
      )}

      {/* Alerts */}
      {(expiredCount > 0 || lowCount > 0) && (
        <div className="flex flex-wrap gap-3 mb-4">
          {expiredCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertTriangle className="w-4 h-4" />
              {expiredCount} produs{expiredCount > 1 ? 'e' : ''} expirat{expiredCount > 1 ? 'e' : ''}
            </div>
          )}
          {lowCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              <TrendingDown className="w-4 h-4" />
              {lowCount} produs{lowCount > 1 ? 'e' : ''} cu stoc redus
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand-600" /></div>
      ) : all.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Stoc gol</p>
          <p className="text-sm mt-1">Inregistreaza un lot nou in sectiunea Loturi Inputuri.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className={th}>Produs</th>
                <th className={th}>Categorie</th>
                <th className={th}>Furnizor</th>
                <th className={th}>Disponibil</th>
                <th className={th}>Pret unit.</th>
                <th className={th}>Valoare</th>
                <th className={th}>Expirare</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {all.map(r => {
                const pct = r.quantity > 0 ? (r.quantity_available / r.quantity) * 100 : 100
                const isLow = pct < 10
                const isExpired = r.expiry_date ? new Date(r.expiry_date) < new Date() : false
                const value = r.quantity_available * (r.unit_price ?? 0)
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className={td}>
                      <div className="flex items-center gap-1.5 font-medium text-gray-900">
                        {(isLow || isExpired) && <AlertTriangle className={`w-3.5 h-3.5 flex-shrink-0 ${isExpired ? 'text-red-500' : 'text-amber-500'}`} />}
                        {r.product_name}
                      </div>
                      {r.batch_number && <div className="text-xs text-gray-400">Lot: {r.batch_number}</div>}
                    </td>
                    <td className={td}>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${INPUT_CATEGORY_COLORS[r.category]}`}>
                        {INPUT_CATEGORY_LABELS[r.category]}
                      </span>
                    </td>
                    <td className={td}>
                      <span className="text-gray-600 text-xs">{r.supplier_name ?? '—'}</span>
                    </td>
                    <td className={td}>
                      <span className={`font-semibold ${isLow ? 'text-amber-600' : 'text-gray-900'}`}>
                        {Number(r.quantity_available).toFixed(2)} {r.unit}
                      </span>
                      <div className="mt-1 h-1 rounded-full bg-gray-200 w-20">
                        <div className={`h-1 rounded-full ${isLow ? 'bg-amber-400' : 'bg-brand-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    </td>
                    <td className={td}>
                      {r.unit_price ? <span className="text-gray-700">{Number(r.unit_price).toFixed(2)} RON/{r.unit}</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={td}>
                      {value > 0 ? <span className="font-medium text-gray-700">{value.toFixed(2)} RON</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={td}>
                      {r.expiry_date ? (
                        <span className={`text-xs ${isExpired ? 'text-red-600 font-semibold' : 'text-gray-500'}`}>
                          {r.expiry_date}{isExpired ? ' !' : ''}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
