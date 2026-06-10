'use client'

export const runtime = 'edge'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { CampaignSelector } from '@/components/CampaignSelector'
import { toast } from 'sonner'
import { Download, Loader2, Package, TrendingDown, Wheat, Tractor } from 'lucide-react'
import * as XLSX from 'xlsx'
import type { Campaign } from '@/lib/campaign-types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface InputRow {
  work_order_id: string
  input_type: string
  product_name: string
  quantity: number
  unit: string
  cost_per_unit: number | null
  // enriched
  parcel_name: string | null
  operation_type: string | null
}

interface AggRow {
  input_type: string
  product_name: string
  unit: string
  total_qty: number
  total_cost: number
  avg_price: number | null
  parcel_count: number
}

const INPUT_TYPE_LABELS: Record<string, string> = {
  SAMANTA: 'Sămânță', INGRASAMANT: 'Îngrăşământ', ERBICID: 'Erbicid',
  FUNGICID: 'Fungicid', INSECTICID: 'Insecticid', CARBURANT: 'Carburant', ALTELE: 'Altele',
}

const INPUT_TYPE_COLORS: Record<string, string> = {
  SAMANTA:     'bg-green-100 text-green-700',
  INGRASAMANT: 'bg-lime-100 text-lime-700',
  ERBICID:     'bg-orange-100 text-orange-700',
  FUNGICID:    'bg-purple-100 text-purple-700',
  INSECTICID:  'bg-red-100 text-red-600',
  CARBURANT:   'bg-yellow-100 text-yellow-700',
  ALTELE:      'bg-gray-100 text-gray-600',
}

// ─── Shared campaign tab nav ───────────────────────────────────────────────────

function CampaignTabs({ year }: { year: number }) {
  const pathname = usePathname()
  const tabs = [
    { label: 'Planuri culturi', href: `/campanie/${year}` },
    { label: 'Activități câmp', href: `/campanie/${year}/activitati` },
    { label: 'Stocuri & Inputuri', href: `/campanie/${year}/stocuri` },
  ]
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
      {tabs.map(t => {
        const active = pathname === t.href || (t.href !== `/campanie/${year}` && pathname.startsWith(t.href))
        return (
          <a key={t.href} href={t.href}
            className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
              active ? 'bg-white shadow text-brand-700 font-medium' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </a>
        )
      })}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StocuriPage() {
  const params = useParams()
  const router = useRouter()
  const yearParam = Number(params.year)

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [rows, setRows] = useState<InputRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    createClient().from('campaigns').select('*').eq('year', yearParam).maybeSingle()
      .then(({ data }) => { if (data) setCampaign(data as Campaign) })
  }, [yearParam])

  const loadData = useCallback(async (cam?: Campaign | null) => {
    const c = cam ?? campaign
    if (!c) return
    setLoading(true)
    const db = createClient()
    const { data: workOrders } = await db
      .from('work_orders')
      .select('id,operation_type,parcel_id,parcels(bloc_fizic)')
      .eq('campaign_id', c.id)

    if (!workOrders || workOrders.length === 0) { setRows([]); setLoading(false); return }

    const woMap = new Map((workOrders as any[]).map(w => [w.id, w]))
    const woIds = (workOrders as any[]).map(w => w.id)

    const { data: inputs } = await db
      .from('work_order_inputs')
      .select('work_order_id,input_type,product_name,quantity,unit,cost_per_unit')
      .in('work_order_id', woIds)

    setRows((inputs ?? []).map((inp: any) => {
      const wo = woMap.get(inp.work_order_id)
      return {
        ...inp,
        parcel_name: (wo as any)?.parcels?.bloc_fizic ?? null,
        operation_type: (wo as any)?.operation_type ?? null,
      } as InputRow
    }))
    setLoading(false)
  }, [campaign])

  useEffect(() => { if (campaign) void loadData(campaign) }, [campaign, loadData])

  // ── Aggregate ──
  const aggMap = new Map<string, AggRow>()
  for (const r of rows) {
    const key = `${r.input_type}|||${r.product_name}|||${r.unit}`
    const existing = aggMap.get(key)
    const cost = r.cost_per_unit != null ? r.quantity * r.cost_per_unit : 0
    if (existing) {
      existing.total_qty  += r.quantity
      existing.total_cost += cost
      existing.parcel_count += 1
    } else {
      aggMap.set(key, {
        input_type: r.input_type,
        product_name: r.product_name,
        unit: r.unit,
        total_qty: r.quantity,
        total_cost: cost,
        avg_price: r.cost_per_unit,
        parcel_count: 1,
      })
    }
  }
  // Recalculate avg_price
  aggMap.forEach(row => {
    row.avg_price = row.total_qty > 0 && row.total_cost > 0
      ? row.total_cost / row.total_qty : null
  })

  const agg = Array.from(aggMap.values()).sort((a, b) => b.total_cost - a.total_cost)
  const totalCost = agg.reduce((s, r) => s + r.total_cost, 0)
  const byType = [...new Set(agg.map(r => r.input_type))]

  function exportData() {
    const out = agg.map(r => ({
      'Tip input': INPUT_TYPE_LABELS[r.input_type] ?? r.input_type,
      'Produs': r.product_name,
      'Cantitate totală': r.total_qty,
      'UM': r.unit,
      'Preț mediu (RON/UM)': r.avg_price?.toFixed(2) ?? '',
      'Cost total (RON)': r.total_cost.toFixed(2),
    }))
    const ws = XLSX.utils.json_to_sheet(out)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Stocuri')
    XLSX.writeFile(wb, `stocuri-${yearParam}.xlsx`)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <PageHeader
          title={campaign ? campaign.name : `Campania ${yearParam}`}
          subtitle="Stocuri & Inputuri — consum de materiale per campanie"
        />
        <CampaignSelector
          className="mt-1"
          onChange={c => { if (c && c.year !== yearParam) router.push(`/campanie/${c.year}/stocuri`) }}
        />
      </div>

      <CampaignTabs year={yearParam} />

      {/* Link to inventory */}
      <a href="/inventar/stoc"
        className="flex items-center gap-3 mb-5 px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
        <Package className="w-4 h-4 text-blue-600 flex-shrink-0" />
        <span className="text-sm text-blue-800"><strong>Inventar inputuri</strong> — stoc disponibil, loturi si miscari</span>
        <span className="ml-auto text-xs font-semibold text-blue-700">Deschide →</span>
      </a>
      {!loading && agg.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xl font-bold text-gray-800">{agg.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">Produse distincte</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xl font-bold text-gray-800">{rows.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">Înregistrări consum</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xl font-bold text-gray-800">{byType.length}</div>
            <div className="text-xs text-gray-500 mt-0.5">Categorii inputuri</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xl font-bold text-purple-700">{totalCost > 0 ? `${totalCost.toFixed(0)} RON` : '—'}</div>
            <div className="text-xs text-gray-500 mt-0.5">Cost total inputuri</div>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        {agg.length > 0 && (
          <button onClick={exportData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
            <Download className="w-3.5 h-3.5" /> Export Excel
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-gray-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Se încarcă...
        </div>
      ) : agg.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 flex items-center justify-center h-48 text-gray-400 text-sm">
          Niciun input înregistrat pentru această campanie.
          <a href={`/campanie/${yearParam}/activitati`} className="ml-2 text-brand-600 underline">
            Adaugă din Activități câmp →
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {byType.map(type => {
            const typeRows = agg.filter(r => r.input_type === type)
            const typeCost = typeRows.reduce((s, r) => s + r.total_cost, 0)
            const pct = totalCost > 0 ? (typeCost / totalCost) * 100 : 0
            const cls = INPUT_TYPE_COLORS[type] ?? 'bg-gray-100 text-gray-600'
            return (
              <div key={type} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {/* Section header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${cls}`}>
                      {INPUT_TYPE_LABELS[type] ?? type}
                    </span>
                    <span className="text-xs text-gray-500">{typeRows.length} produs{typeRows.length !== 1 ? 'e' : ''}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-gray-700">
                      {typeCost > 0 ? `${typeCost.toFixed(0)} RON` : '—'} ({pct.toFixed(0)}%)
                    </span>
                  </div>
                </div>

                {/* Rows */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 border-b border-gray-100">
                      <th className="px-4 py-2 text-left font-medium">Produs</th>
                      <th className="px-4 py-2 text-right font-medium">Cantitate totală</th>
                      <th className="px-4 py-2 text-right font-medium">Preț mediu / UM</th>
                      <th className="px-4 py-2 text-right font-medium">Cost total</th>
                      <th className="px-4 py-2 text-right font-medium">% din campanie</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {typeRows.map(r => {
                      const rowPct = totalCost > 0 ? (r.total_cost / totalCost) * 100 : 0
                      return (
                        <tr key={r.product_name + r.unit} className="hover:bg-gray-50">
                          <td className="px-4 py-2.5 font-medium text-gray-800">{r.product_name}</td>
                          <td className="px-4 py-2.5 text-right text-gray-700">
                            {r.total_qty % 1 === 0 ? r.total_qty : r.total_qty.toFixed(2)} {r.unit}
                          </td>
                          <td className="px-4 py-2.5 text-right text-gray-500 text-xs">
                            {r.avg_price != null ? `${r.avg_price.toFixed(2)} RON/${r.unit}` : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right font-semibold text-gray-800">
                            {r.total_cost > 0 ? `${r.total_cost.toFixed(2)} RON` : '—'}
                          </td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-purple-400 rounded-full" style={{ width: `${rowPct}%` }} />
                              </div>
                              <span className="text-xs text-gray-500 w-8 text-right">{rowPct.toFixed(0)}%</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })}

          {/* Grand total */}
          <div className="flex justify-end items-center gap-4 pr-4 pt-2 text-sm">
            <span className="text-gray-500">Cost total inputuri campanie:</span>
            <span className="font-bold text-lg text-purple-700">{totalCost.toFixed(2)} RON</span>
          </div>
        </div>
      )}
    </div>
  )
}
