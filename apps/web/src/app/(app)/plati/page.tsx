'use client'
export const runtime = 'edge'

import { useState, useEffect, useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from 'sonner'
import { Loader2, Download, TrendingUp, TrendingDown, Minus } from 'lucide-react'

// ─── Recharts — dynamic import (edge/SSR safe) ────────────────────────────────
const AreaChart           = dynamic(() => import('recharts').then(m => m.AreaChart),           { ssr: false })
const Area                = dynamic(() => import('recharts').then(m => m.Area),                { ssr: false })
const Line                = dynamic(() => import('recharts').then(m => m.Line),                { ssr: false })
const XAxis               = dynamic(() => import('recharts').then(m => m.XAxis),               { ssr: false })
const YAxis               = dynamic(() => import('recharts').then(m => m.YAxis),               { ssr: false })
const CartesianGrid       = dynamic(() => import('recharts').then(m => m.CartesianGrid),       { ssr: false })
const Tooltip             = dynamic(() => import('recharts').then(m => m.Tooltip),             { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false })
const PieChart            = dynamic(() => import('recharts').then(m => m.PieChart),            { ssr: false })
const Pie                 = dynamic(() => import('recharts').then(m => m.Pie),                 { ssr: false })
const Cell                = dynamic(() => import('recharts').then(m => m.Cell),                { ssr: false })
const BarChart            = dynamic(() => import('recharts').then(m => m.BarChart),            { ssr: false })
const Bar                 = dynamic(() => import('recharts').then(m => m.Bar),                 { ssr: false })
const LabelList           = dynamic(() => import('recharts').then(m => m.LabelList),           { ssr: false })

// ─── Types ────────────────────────────────────────────────────────────────────
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
  is_paid: boolean
  impozit_aplicat: boolean
  notes: string | null
  lessor_name: string
  lessor_type: string
  contract_number: string | null
  contract_id: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PRODUCT_COLORS: Record<string, string> = {
  'Grâu':             'bg-amber-100 text-amber-700',
  'Porumb':           'bg-orange-100 text-orange-700',
  'Floarea-soarelui': 'bg-yellow-100 text-yellow-600',
  'Rapiță':           'bg-green-100 text-green-700',
  'Soia':             'bg-lime-100 text-lime-700',
  'Orz':              'bg-teal-100 text-teal-700',
  'Ovăz':             'bg-blue-100 text-blue-700',
}
const CHART_COLORS = ['#16a34a','#f59e0b','#ef4444','#3b82f6','#8b5cf6','#06b6d4','#ec4899']
const RO_MONTHS: Record<string, string> = {
  '01':'Ian','02':'Feb','03':'Mar','04':'Apr','05':'Mai','06':'Jun',
  '07':'Iul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec',
}
function productColor(name: string) { return PRODUCT_COLORS[name] ?? 'bg-gray-100 text-gray-600' }
function fmtRON(v: number) { return v.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }

// ─── Main component ───────────────────────────────────────────────────────────
export default function TranzactiiArendaPage() {
  const router = useRouter()
  const [rows, setRows]           = useState<TranzactieRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [view, setView]           = useState<'tabel' | 'grafice'>('tabel')
  const [yearFilter, setYearFilter] = useState<string>('all')
  const [search, setSearch]       = useState('')
  const [page, setPage]           = useState(1)
  const PAGE_SIZE = 10

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await createClient()
      .from('transactions')
      .select(`
        id, contract_id, transaction_date, campaign_year, product_name,
        kg_brut, kg_net, price_per_unit, ron_brut, ron_net, tax_amount,
        payment_type, pv_number, is_paid, impozit_aplicat, notes,
        lessors(first_name, last_name, company_name, type),
        contracts(contract_number)
      `)
      .order('transaction_date', { ascending: false })
      .limit(200)
    if (error) { toast.error('Eroare la incarcarea tranzactiilor.'); setLoading(false); return }
    setRows((data ?? []).map((t: any) => ({
      ...t,
      lessor_type: t.lessors?.type ?? 'NATURAL',
      lessor_name: t.lessors
        ? (t.lessors.type === 'LEGAL' ? t.lessors.company_name : `${t.lessors.last_name} ${t.lessors.first_name}`.trim())
        : '—',
      contract_number: t.contracts?.contract_number ?? null,
      contract_id: t.contract_id ?? null,
    })))
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  // ─── Derived data ──────────────────────────────────────────────────────────
  const years = useMemo(() =>
    [...new Set(rows.map(r => String(r.campaign_year)))].sort((a, b) => Number(b) - Number(a)), [rows])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return rows.filter(r => {
      if (yearFilter !== 'all' && String(r.campaign_year) !== yearFilter) return false
      if (q && !r.lessor_name.toLowerCase().includes(q) &&
               !r.product_name.toLowerCase().includes(q) &&
               !(r.contract_number ?? '').toLowerCase().includes(q)) return false
      return true
    })
  }, [rows, yearFilter, search])

  const totalNet     = filtered.reduce((s, r) => s + Number(r.ron_net  ?? 0), 0)
  const totalBrut    = filtered.reduce((s, r) => s + Number(r.ron_brut ?? 0), 0)
  const totalImpozit = filtered.reduce((s, r) => s + Number(r.tax_amount ?? 0), 0)
  const unpaidNet    = filtered.filter(r => !r.is_paid).reduce((s, r) => s + Number(r.ron_net ?? 0), 0)
  const unpaidCount  = filtered.filter(r => !r.is_paid).length
  const paidCount    = filtered.filter(r => r.is_paid).length
  const rataAchitare = filtered.length > 0 ? Math.round((paidCount / filtered.length) * 100) : 0

  // ─── Charts data ───────────────────────────────────────────────────────────
  const monthlyData = useMemo(() => {
    const map: Record<string, { month: string; net: number; brut: number }> = {}
    rows.forEach(r => {
      const key = r.transaction_date.slice(0, 7)
      const [y, m] = key.split('-')
      if (!map[key]) map[key] = { month: `${RO_MONTHS[m]} ${y.slice(2)}`, net: 0, brut: 0 }
      map[key].net  += Number(r.ron_net)
      map[key].brut += Number(r.ron_brut)
    })
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v)
  }, [rows])

  const productData = useMemo(() => {
    const map: Record<string, number> = {}
    filtered.forEach(r => { map[r.product_name] = (map[r.product_name] ?? 0) + Number(r.ron_net) })
    const total = Object.values(map).reduce((s, v) => s + v, 0)
    return Object.entries(map).sort(([, a], [, b]) => b - a)
      .map(([name, val]) => ({ name, value: val, pct: total > 0 ? Math.round((val / total) * 100) : 0 }))
  }, [filtered])

  const topLessors = useMemo(() => {
    const map: Record<string, number> = {}
    filtered.forEach(r => { map[r.lessor_name] = (map[r.lessor_name] ?? 0) + Number(r.ron_net) })
    return Object.entries(map).sort(([, a], [, b]) => b - a).slice(0, 5).map(([name, value]) => ({ name, value }))
  }, [filtered])

  // ─── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function exportCsv() {
    const header = 'Data,Arendator,Contract,Produs,Kg Brut,Kg Net,Pret/unit,RON Brut,RON Net,Impozit,Tip plata,Status'
    const csvRows = filtered.map(r =>
      [r.transaction_date, r.lessor_name, r.contract_number ?? '',
       r.product_name, r.kg_brut, r.kg_net, r.price_per_unit,
       r.ron_brut, r.ron_net, r.tax_amount, r.payment_type,
       r.is_paid ? 'Platit' : 'Neplatit'].join(','))
    const blob = new Blob([[header, ...csvRows].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'tranzactii-arenda.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // ─── KPI card ──────────────────────────────────────────────────────────────
  function KpiCard({ label, value, sub, accent, trend }: {
    label: string; value: string; sub?: string; accent?: string; trend?: 'up'|'down'|'neutral'
  }) {
    const Icon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
    const ic = trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-400' : 'text-gray-300'
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
          <span>{label}</span>
          {trend && <Icon className={`w-3.5 h-3.5 ${ic}`} />}
        </div>
        <div className={`text-2xl font-bold ${accent ?? 'text-gray-900'}`}>{value}</div>
        {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
      </div>
    )
  }

  const th = 'px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide'
  const td = 'px-4 py-3 text-sm'

  return (
    <div>
      {/* ─── Header + view toggle ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5">
        <PageHeader
          title="Tranzactii Arenda"
          subtitle={`${filtered.length} inregistrari · ${filtered.reduce((s,r) => s + Number(r.kg_net), 0).toLocaleString('ro-RO')} kg net`}
        />
        <div className="flex bg-gray-100 rounded-xl p-1 gap-1 mt-1">
          {(['tabel','grafice'] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg capitalize transition-colors ${view === v ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {v === 'tabel' ? 'Tabel' : 'Grafice'}
            </button>
          ))}
        </div>
      </div>

      {/* ─── KPI cards ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard label="RON Net Total"  value={`${fmtRON(totalNet)} RON`}   sub={`din ${fmtRON(totalBrut)} RON brut`} trend="up" />
        <KpiCard label="Neplatit"       value={`${fmtRON(unpaidNet)} RON`}  sub={`${unpaidCount} tranzactii neachitate`} accent="text-red-600" trend="down" />
        <KpiCard label="Impozit Retinut" value={`${fmtRON(totalImpozit)} RON`} sub="retinut la sursa" trend="neutral" />
        <KpiCard label="Rata Achitare"  value={`${rataAchitare}%`}          sub={`${paidCount} din ${filtered.length} platite`} accent="text-brand-700" trend="up" />
      </div>

      {view === 'tabel' ? (
        <>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 mb-4">
            <input
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 w-full sm:w-56"
              placeholder="Cauta arendator, contract, produs..."
              value={search} onChange={e => { setSearch(e.target.value); setPage(1) }} />
            <div className="flex flex-wrap gap-1">
              {['all', ...years].map(y => (
                <button key={y} onClick={() => { setYearFilter(y); setPage(1) }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${yearFilter === y ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {y === 'all' ? 'Toti' : y}
                </button>
              ))}
            </div>
            <div className="sm:ml-auto">
              <button onClick={exportCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-600">
                <Download className="w-3.5 h-3.5" /> Export
              </button>
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand-600" /></div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className={th}>Data</th>
                      <th className={th}>Arendator</th>
                      <th className={th}>Contract</th>
                      <th className={th}>Produs</th>
                      <th className={th + ' text-right'}>Kg Brut</th>
                      <th className={th + ' text-right'}>Kg Net</th>
                      <th className={th + ' text-right'}>RON Brut</th>
                      <th className={th + ' text-right'}>RON Net</th>
                      <th className={th + ' text-right'}>Impozit</th>
                      <th className={th}>Tip Plata</th>
                      <th className={th}>Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginated.length === 0 ? (
                      <tr><td colSpan={11} className="px-4 py-12 text-center text-gray-400">Nicio tranzactie gasita</td></tr>
                    ) : paginated.map(r => (
                      <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                        <td className={td + ' text-gray-500 whitespace-nowrap'}>{r.transaction_date}</td>
                        <td className={td}>
                          <div className="flex items-center gap-2">
                            <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0
                              ${r.lessor_type === 'LEGAL' ? 'bg-purple-100 text-purple-700'
                                : r.lessor_type === 'PFA' ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-600'}`}>
                              {r.lessor_type === 'LEGAL' ? 'F' : r.lessor_type === 'PFA' ? 'P' : 'R'}
                            </span>
                            <span className="font-medium text-gray-900">{r.lessor_name}</span>
                          </div>
                        </td>
                        <td className={td}>
                          {r.contract_number && r.contract_id
                            ? <button onClick={() => router.push(`/contracte/${r.contract_id}`)} className="text-brand-600 font-mono text-xs hover:underline cursor-pointer">#{r.contract_number}</button>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className={td}>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${productColor(r.product_name)}`}>
                            {r.product_name}
                          </span>
                        </td>
                        <td className={td + ' text-right text-gray-600'}>{Number(r.kg_brut).toLocaleString('ro-RO')}</td>
                        <td className={td + ' text-right font-medium text-gray-800'}>{Number(r.kg_net).toLocaleString('ro-RO')}</td>
                        <td className={td + ' text-right text-gray-600'}>{fmtRON(Number(r.ron_brut))}</td>
                        <td className={td + ' text-right font-semibold text-green-700'}>{fmtRON(Number(r.ron_net))}</td>
                        <td className={td + ' text-right text-red-500'}>{fmtRON(Number(r.tax_amount))}</td>
                        <td className={td + ' text-gray-600 whitespace-nowrap text-xs'}>
                          {r.payment_type}{r.pv_number ? ` #${r.pv_number}` : ''}
                        </td>
                        <td className={td}>
                          {r.is_paid
                            ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">Platit</span>
                            : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">Neplatit</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* ─── Total row — light ────────────────────────────────── */}
                  {filtered.length > 0 && (
                    <tfoot>
                      <tr className="bg-gray-50 border-t-2 border-gray-200">
                        <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                          Total ({filtered.length} inregistrari)
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                          {filtered.reduce((s, r) => s + Number(r.kg_brut), 0).toLocaleString('ro-RO')}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                          {filtered.reduce((s, r) => s + Number(r.kg_net), 0).toLocaleString('ro-RO')}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-700">{fmtRON(totalBrut)}</td>
                        <td className="px-4 py-3 text-right text-sm font-bold text-green-700">{fmtRON(totalNet)}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-red-500">{fmtRON(totalImpozit)}</td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden divide-y divide-gray-100">
                {paginated.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm">Nicio tranzactie gasita</div>
                ) : paginated.map(r => (
                  <div key={r.id} className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0
                          ${r.lessor_type === 'LEGAL' ? 'bg-purple-100 text-purple-700'
                            : r.lessor_type === 'PFA' ? 'bg-blue-100 text-blue-700'
                            : 'bg-gray-100 text-gray-600'}`}>
                          {r.lessor_type === 'LEGAL' ? 'F' : r.lessor_type === 'PFA' ? 'P' : 'R'}
                        </span>
                        <span className="font-medium text-gray-900 text-sm truncate">{r.lessor_name}</span>
                      </div>
                      {r.is_paid
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 flex-shrink-0">Platit</span>
                        : <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600 flex-shrink-0">Neplatit</span>}
                    </div>
                    <div className="flex items-center flex-wrap gap-2 mb-2">
                      <span className="text-xs text-gray-400">{r.transaction_date}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${productColor(r.product_name)}`}>
                        {r.product_name}
                      </span>
                      {r.contract_number && r.contract_id && (
                        <button onClick={() => router.push(`/contracte/${r.contract_id}`)} className="text-brand-600 font-mono text-xs hover:underline">
                          #{r.contract_number}
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-600">
                      <div><span className="text-gray-400">RON Net </span><span className="font-semibold text-green-700">{fmtRON(Number(r.ron_net))}</span></div>
                      <div><span className="text-gray-400">RON Brut </span>{fmtRON(Number(r.ron_brut))}</div>
                      <div><span className="text-gray-400">Kg Net </span>{Number(r.kg_net).toLocaleString('ro-RO')}</div>
                      <div><span className="text-gray-400">Impozit </span><span className="text-red-500">{fmtRON(Number(r.tax_amount))}</span></div>
                      <div className="col-span-2"><span className="text-gray-400">Tip plată </span>{r.payment_type}{r.pv_number ? ` #${r.pv_number}` : ''}</div>
                    </div>
                  </div>
                ))}
                {filtered.length > 0 && (
                  <div className="p-3 bg-gray-50 border-t-2 border-gray-200">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Total ({filtered.length})</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div><span className="text-gray-400">RON Net </span><span className="font-bold text-green-700">{fmtRON(totalNet)}</span></div>
                      <div><span className="text-gray-400">RON Brut </span>{fmtRON(totalBrut)}</div>
                      <div><span className="text-gray-400">Kg Net </span>{filtered.reduce((s, r) => s + Number(r.kg_net), 0).toLocaleString('ro-RO')}</div>
                      <div><span className="text-gray-400">Impozit </span><span className="text-red-500">{fmtRON(totalImpozit)}</span></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
                  <span>{(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, filtered.length)} din {filtered.length} inregistrari</span>
                  <div className="flex gap-1">
                    <button disabled={page===1} onClick={() => setPage(1)} className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40">«</button>
                    <button disabled={page===1} onClick={() => setPage(p => p-1)} className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40">&lt;</button>
                    {Array.from({length: Math.min(5, totalPages)}, (_, i) => {
                      const n = Math.max(1, Math.min(page - 2, totalPages - 4)) + i
                      return n <= totalPages ? (
                        <button key={n} onClick={() => setPage(n)}
                          className={`px-3 py-1 rounded border transition-colors ${page===n ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-200 hover:bg-gray-50'}`}>
                          {n}
                        </button>
                      ) : null
                    })}
                    <button disabled={page===totalPages} onClick={() => setPage(p => p+1)} className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40">&gt;</button>
                    <button disabled={page===totalPages} onClick={() => setPage(totalPages)} className="px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40">»</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* ─── Charts view ────────────────────────────────────────────────────── */
        <div className="space-y-6">
          {/* Line/area chart: Evolutie RON */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">Evolutie RON</h3>
                <p className="text-xs text-gray-400">Net vs. Brut pe luni</p>
              </div>
              <div className="flex gap-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 bg-green-600 rounded" /> RON Net</span>
                <span className="flex items-center gap-1.5"><span className="inline-block w-3 h-0.5 bg-gray-300 rounded" /> RON Brut</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={(v: number) => `${(v/1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: any) => [`${fmtRON(Number(v))} RON`, '']} labelStyle={{ fontWeight: 600 }} />
                <Area type="monotone" dataKey="net" name="RON Net" stroke="#16a34a" strokeWidth={2} fill="url(#gradNet)" dot={false} />
                <Line type="monotone" dataKey="brut" name="RON Brut" stroke="#d1d5db" strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Donut: Pe Produs */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-1">Pe Produs</h3>
              <p className="text-xs text-gray-400 mb-4">RON Net per cultura</p>
              <div className="flex flex-col sm:flex-row sm:items-center gap-6">
                <PieChart width={160} height={160}>
                  <Pie data={productData} cx={75} cy={75} innerRadius={46} outerRadius={70}
                    dataKey="value" paddingAngle={2} startAngle={90} endAngle={-270}>
                    {productData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => [`${fmtRON(Number(v))} RON`, '']} />
                </PieChart>
                <div className="flex-1 space-y-2">
                  {productData.map((p, i) => (
                    <div key={p.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <span className="text-gray-700">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-20 h-1 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-1 rounded-full"
                            style={{ width: `${p.pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        </div>
                        <span className="text-xs text-gray-500 w-8 text-right">{p.pct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Horizontal bar: Top Arendatori */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="font-semibold text-gray-900 mb-1">Top Arendatori</h3>
              <p className="text-xs text-gray-400 mb-4">RON Net — primii 5 dupa valoare</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={topLessors} layout="vertical" margin={{ top: 0, right: 50, left: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={(v: number) => `${(v/1000).toFixed(0)}K`} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: any) => [`${fmtRON(Number(v))} RON`, 'RON Net']} />
                  <Bar dataKey="value" fill="#16a34a" radius={[0, 4, 4, 0]} maxBarSize={22}>
                    <LabelList dataKey="value" position="right" style={{ fontSize: 10, fill: '#6b7280' }}
                      formatter={(v: any) => `${(Number(v)/1000).toFixed(1)}K`} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
