'use client'
export const runtime = 'edge'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from 'sonner'
import { Loader2, ArrowUpCircle, ArrowDownCircle, RefreshCw, ArrowRightLeft } from 'lucide-react'
import type { StockMovementType, InputCategory } from '@/lib/inventory-types'
import { MVT_TYPE_LABELS, INPUT_CATEGORY_LABELS, INPUT_CATEGORY_COLORS } from '@/lib/inventory-types'

interface MvtRow {
  id: string
  mvt_type: StockMovementType
  quantity: number
  mvt_date: string
  notes: string | null
  created_at: string
  product_name: string
  unit: string
  category: InputCategory
  supplier_name: string | null
}

const MVT_ICONS: Record<StockMovementType, React.ElementType> = {
  IN: ArrowDownCircle,
  OUT: ArrowUpCircle,
  TRANSFER: ArrowRightLeft,
  ADJUSTMENT: RefreshCw,
}

const MVT_COLORS: Record<StockMovementType, string> = {
  IN: 'text-green-600 bg-green-50',
  OUT: 'text-red-600 bg-red-50',
  TRANSFER: 'text-blue-600 bg-blue-50',
  ADJUSTMENT: 'text-gray-600 bg-gray-50',
}

export default function MiscariPage() {
  const [rows, setRows] = useState<MvtRow[]>([])
  const [loading, setLoading] = useState(true)
  const [yearFilter, setYearFilter] = useState<string>(String(new Date().getFullYear()))
  const [typeFilter, setTypeFilter] = useState<StockMovementType | 'ALL'>('ALL')

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await createClient()
      .from('input_stock_mvt')
      .select(`
        id, mvt_type, quantity, mvt_date, notes, created_at, campaign_id,
        input_lots(product_name, unit, category, suppliers(name))
      `)
      .order('mvt_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) { toast.error('Eroare la incarcare miscari.'); setLoading(false); return }
    setRows((data ?? []).map((r: any) => ({
      id: r.id,
      mvt_type: r.mvt_type,
      quantity: r.quantity,
      mvt_date: r.mvt_date,
      notes: r.notes,
      created_at: r.created_at,
      product_name: r.input_lots?.product_name ?? '—',
      unit: r.input_lots?.unit ?? '',
      category: r.input_lots?.category ?? 'OTHER',
      supplier_name: r.input_lots?.suppliers?.name ?? null,
    })))
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const years = [...new Set(rows.map(r => r.mvt_date.slice(0, 4)))].sort().reverse()

  const displayed = rows.filter(r => {
    if (yearFilter !== 'all' && !r.mvt_date.startsWith(yearFilter)) return false
    if (typeFilter !== 'ALL' && r.mvt_type !== typeFilter) return false
    return true
  })

  const totalOut = displayed.filter(r => r.mvt_type === 'OUT').reduce((s, r) => s + Number(r.quantity), 0)
  const totalIn = displayed.filter(r => r.mvt_type === 'IN').reduce((s, r) => s + Number(r.quantity), 0)

  const th = 'px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide'
  const td = 'px-4 py-3 text-sm'

  return (
    <div>
      <PageHeader
        title="Miscari Stoc"
        subtitle={`${displayed.length} miscari · ${totalOut.toFixed(2)} iesiri · ${totalIn.toFixed(2)} intrari`}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select value={yearFilter} onChange={e => setYearFilter(e.target.value)}
          className="px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500">
          <option value="all">Toti anii</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        {(['ALL', 'IN', 'OUT', 'TRANSFER', 'ADJUSTMENT'] as const).map(t => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${typeFilter === t ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t === 'ALL' ? 'Toate' : MVT_TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand-600" /></div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <ArrowRightLeft className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nicio miscare inregistrata</p>
          <p className="text-sm mt-1">Miscarile de stoc apar aici dupa ce inregistrezi iesiri sau intrari din pagina Loturi.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className={th}>Data</th>
                <th className={th}>Produs</th>
                <th className={th}>Tip</th>
                <th className={th}>Cantitate</th>
                <th className={th}>Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayed.map(r => {
                const Icon = MVT_ICONS[r.mvt_type]
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className={td}>
                      <span className="text-gray-700">{r.mvt_date}</span>
                    </td>
                    <td className={td}>
                      <div className="font-medium text-gray-900">{r.product_name}</div>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium mt-0.5 ${INPUT_CATEGORY_COLORS[r.category]}`}>
                        {INPUT_CATEGORY_LABELS[r.category]}
                      </span>
                    </td>
                    <td className={td}>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${MVT_COLORS[r.mvt_type]}`}>
                        <Icon className="w-3.5 h-3.5" />
                        {MVT_TYPE_LABELS[r.mvt_type]}
                      </span>
                    </td>
                    <td className={td}>
                      <span className={`font-semibold ${r.mvt_type === 'OUT' ? 'text-red-600' : r.mvt_type === 'IN' ? 'text-green-600' : 'text-gray-700'}`}>
                        {r.mvt_type === 'OUT' ? '−' : r.mvt_type === 'IN' ? '+' : ''}{Number(r.quantity).toFixed(3)} {r.unit}
                      </span>
                    </td>
                    <td className={td}>
                      <span className="text-gray-500 text-xs">{r.notes ?? '—'}</span>
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
