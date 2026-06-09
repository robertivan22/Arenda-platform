'use client'

export const runtime = 'edge'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import * as XLSX from 'xlsx'
import { Download, ChevronDown, ChevronRight, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ───────────────────────────────────────────────────────────────────
interface Lessor {
  id: string; first_name: string; last_name: string; company_name: string | null
  type: string; status: string
}
interface Contract {
  id: string; contract_number: string; status: string
  start_date: string; end_date: string; lessor_id: string
  localities: string | null
  lessors?: Lessor | null
}
interface Transaction {
  id: string; contract_id: string; lessor_id: string
  product_name: string; kg_net: number; ron_net: number
  campaign_year: number; transaction_date: string; invoice_id: string | null
  contracts?: { contract_number: string; lessors?: Lessor | null } | null
}
interface Invoice {
  id: string; invoice_number: string; invoice_date: string
  total_ron: number; doc_type: string; status: string; lessor_id: string
  lessors?: Lessor | null
}
interface Parcel {
  id: string; parcel_nr: string | null; tarla_nr: string | null
  surface: number; contract_id: string
  contracts?: { contract_number: string; lessors?: Lessor | null } | null
}
interface CampaignReport { id: string; name: string; year: number }
interface CropPlanRow {
  parcel_id: string; bloc_fizic: string | null; locality: string | null; surface: number
  crop: string; planned_area_ha: number | null; planned_yield_t_ha: number | null; status: string
  actual_yield_t_ha: number | null; actual_area_ha: number | null; total_cost: number
}

// ─── Constants ───────────────────────────────────────────────────────────────
const TABS = ['Dashboard', 'Arendași', 'Contracte', 'Tranzacții', 'Facturi & Avize', 'Produse', 'Parcele', 'Campanie']
const COLORS = ['#2d6a4f', '#52b788', '#f59e0b', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899']
const MONTHS = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active', EXPIRED: 'Expirate', PENDING: 'În așteptare', TERMINATED: 'Reziliate',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function lessorName(l: Lessor | null | undefined) {
  if (!l) return '—'
  return l.type === 'LEGAL' ? (l.company_name ?? '—') : `${l.last_name} ${l.first_name}`.trim()
}
function exportXlsx(rows: Record<string, unknown>[], filename: string) {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Date')
  XLSX.writeFile(wb, `${filename}.xlsx`)
}
const thCls = 'px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50'
const tdCls = 'px-3 py-2 text-sm text-gray-800'
const selCls = 'text-sm border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400'

// ─── Component ───────────────────────────────────────────────────────────────
export default function RapoartePage() {
  const [tab, setTab] = useState(0)
  const [lessors, setLessors] = useState<Lessor[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [parcels, setParcels] = useState<Parcel[]>([])
  const [loading, setLoading] = useState(true)

  // Dashboard filters
  const [period, setPeriod] = useState<'luna' | 'trimestru' | 'an'>('an')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  // Tab filters
  const [txnYear, setTxnYear] = useState('')
  const [txnProduct, setTxnProduct] = useState('')
  const [invType, setInvType] = useState('')
  const [invStatus, setInvStatus] = useState('')
  const [contractStatus, setContractStatus] = useState('')
  const [expandedLessors, setExpandedLessors] = useState<Set<string>>(new Set())
  const [campaignList, setCampaignList] = useState<CampaignReport[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>('')
  const [cropPlanRows, setCropPlanRows] = useState<CropPlanRow[]>([])
  const [loadingCampaign, setLoadingCampaign] = useState(false)

  useEffect(() => {
    const db = createClient()
    Promise.all([
      db.from('lessors').select('*').order('last_name').limit(500),
      db.from('contracts')
        .select('id, contract_number, status, start_date, end_date, lessor_id, localities, lessors(id, first_name, last_name, company_name, type, status)')
        .order('sign_date', { ascending: false }).limit(500),
      db.from('transactions')
        .select('id, contract_id, lessor_id, product_name, kg_net, ron_net, campaign_year, transaction_date, invoice_id, contracts(contract_number, lessors(id, first_name, last_name, company_name, type, status))')
        .order('transaction_date', { ascending: false }).limit(1000),
      db.from('invoices')
        .select('id, invoice_number, invoice_date, total_ron, doc_type, status, lessor_id, lessors(id, first_name, last_name, company_name, type, status)')
        .order('invoice_date', { ascending: false }).limit(500),
      db.from('parcels')
        .select('id, parcel_nr, tarla_nr, surface, contract_id, contracts(contract_number, lessors(id, first_name, last_name, company_name, type, status))')
        .order('parcel_nr').limit(1000),
    ]).then(async ([{ data: ls, error: e1 }, { data: cs, error: e2 }, { data: ts, error: e3 }, { data: is, error: e4 }, { data: ps, error: e5 }]) => {
      if (e1 || e2 || e3 || e4 || e5) { toast.error('Eroare la încărcarea datelor.'); setLoading(false); return }
      setLessors((ls ?? []) as Lessor[])
      setContracts((cs ?? []) as unknown as Contract[])
      setTransactions((ts ?? []) as unknown as Transaction[])
      setInvoices((is ?? []) as unknown as Invoice[])
      setParcels((ps ?? []) as unknown as Parcel[])
      setLoading(false)
      // Load campaigns list for the Campanie tab
      const db2 = createClient()
      const { data: camps } = await db2.from('campaigns').select('id,name,year').order('year', { ascending: false })
      if (camps && camps.length > 0) {
        setCampaignList(camps as CampaignReport[])
        setSelectedCampaignId((camps[0] as CampaignReport).id)
      }
    })
  }, [])

  function setPeriodRange(p: 'luna' | 'trimestru' | 'an') {
    setPeriod(p)
    const now = new Date()
    const to = now.toISOString().split('T')[0]
    const d = new Date(now)
    if (p === 'luna') d.setMonth(d.getMonth() - 1)
    else if (p === 'trimestru') d.setMonth(d.getMonth() - 3)
    else d.setFullYear(d.getFullYear() - 1)
    setFilterFrom(d.toISOString().split('T')[0])
    setFilterTo(to)
  }

  const filteredTxns = useMemo(() => {
    let txns = transactions
    if (filterFrom) txns = txns.filter(t => t.transaction_date >= filterFrom)
    if (filterTo) txns = txns.filter(t => t.transaction_date <= filterTo)
    return txns
  }, [transactions, filterFrom, filterTo])

  const monthlyRevenue = useMemo(() => {
    const map: Record<string, number> = {}
    filteredTxns.forEach(t => {
      const m = MONTHS[new Date(t.transaction_date).getMonth()]
      map[m] = (map[m] ?? 0) + t.ron_net
    })
    return MONTHS.map(m => ({ month: m, valoare: Math.round((map[m] ?? 0) * 100) / 100 }))
  }, [filteredTxns])

  const contractsByStatus = useMemo(() => {
    const map: Record<string, number> = {}
    contracts.forEach(c => { map[c.status] = (map[c.status] ?? 0) + 1 })
    return Object.entries(map).map(([k, v]) => ({ name: STATUS_LABEL[k] ?? k, value: v }))
  }, [contracts])

  const topLessors = useMemo(() => {
    const map: Record<string, { name: string; total: number }> = {}
    filteredTxns.forEach(t => {
      const id = t.lessor_id ?? 'unknown'
      const l = lessors.find(x => x.id === id)
      if (!map[id]) map[id] = { name: lessorName(l), total: 0 }
      map[id].total += t.ron_net
    })
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5)
  }, [filteredTxns, lessors])

  const productChart = useMemo(() => {
    const map: Record<string, number> = {}
    filteredTxns.forEach(t => { map[t.product_name] = (map[t.product_name] ?? 0) + t.ron_net })
    return Object.entries(map).map(([name, ron]) => ({ name, ron: Math.round(ron * 100) / 100 })).sort((a, b) => b.ron - a.ron)
  }, [filteredTxns])

  async function loadCampaignReport(campaignId: string) {
    if (!campaignId) return
    setLoadingCampaign(true)
    const db = createClient()
    const [{ data: plans }, { data: harvests }, { data: workOrders }] = await Promise.all([
      db.from('crop_plans').select('parcel_id,crop,planned_area_ha,planned_yield_t_ha,status').eq('campaign_id', campaignId),
      db.from('harvest_lots').select('parcel_id,yield_t_ha,area_harvested_ha').eq('campaign_id', campaignId),
      db.from('work_orders').select('id,parcel_id').eq('campaign_id', campaignId),
    ])
    const woIds = (workOrders ?? []).map((w: any) => w.id)
    let costByParcel = new Map<string, number>()
    if (woIds.length > 0) {
      const { data: inputs } = await db.from('work_order_inputs').select('work_order_id,quantity,cost_per_unit').in('work_order_id', woIds)
      const woParcelMap = new Map((workOrders ?? []).map((w: any) => [w.id, w.parcel_id as string]))
      for (const inp of (inputs ?? []) as any[]) {
        if (!inp.cost_per_unit) continue
        const pid = woParcelMap.get(inp.work_order_id)
        if (pid) costByParcel.set(pid, (costByParcel.get(pid) ?? 0) + inp.quantity * inp.cost_per_unit)
      }
    }
    const { data: parcelsData } = await db.from('parcels').select('id,bloc_fizic,locality,surface')
      .in('id', (plans ?? []).map((p: any) => p.parcel_id))
    const parcelMeta = new Map((parcelsData ?? []).map((p: any) => [p.id, p]))
    const harvestMap = new Map((harvests ?? []).map((h: any) => [h.parcel_id, h]))
    setCropPlanRows(
      (plans ?? []).map((p: any) => {
        const meta: any = parcelMeta.get(p.parcel_id) ?? {}
        const h: any = harvestMap.get(p.parcel_id)
        return {
          parcel_id: p.parcel_id,
          bloc_fizic: meta.bloc_fizic ?? null,
          locality: meta.locality ?? null,
          surface: meta.surface ?? 0,
          crop: p.crop,
          planned_area_ha: p.planned_area_ha,
          planned_yield_t_ha: p.planned_yield_t_ha,
          status: p.status,
          actual_yield_t_ha: h?.yield_t_ha ?? null,
          actual_area_ha: h?.area_harvested_ha ?? null,
          total_cost: costByParcel.get(p.parcel_id) ?? 0,
        } as CropPlanRow
      })
    )
    setLoadingCampaign(false)
  }

  useEffect(() => { if (selectedCampaignId) void loadCampaignReport(selectedCampaignId) }, [selectedCampaignId])

  function toggleLessor(id: string) {
    setExpandedLessors(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function updateInvoiceStatus(invId: string, status: string) {
    const { error } = await createClient().from('invoices').update({ status }).eq('id', invId)
    if (error) { toast.error(error.message); return }
    setInvoices(prev => prev.map(i => i.id === invId ? { ...i, status } : i))
    toast.success('Status actualizat.')
  }

  async function deleteInvoice(invId: string) {
    if (!confirm('Stergi acest document? Actiunea nu poate fi anulata.')) return
    const { error } = await createClient().from('invoices').delete().eq('id', invId)
    if (error) { toast.error(error.message); return }
    setInvoices(prev => prev.filter(i => i.id !== invId))
    toast.success('Document sters.')
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Se încarcă...</div>

  const totalRonDash = filteredTxns.reduce((s, t) => s + t.ron_net, 0)
  const totalKgDash = filteredTxns.reduce((s, t) => s + t.kg_net, 0)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Rapoarte</h1>
        <p className="text-sm text-gray-500">Analize și rapoarte financiare</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-0 border-b border-gray-200 overflow-x-auto">
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              tab === i ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >{t}</button>
        ))}
      </div>

      {/* ── DASHBOARD ─────────────────────────────────────────────────────── */}
      {tab === 0 && (
        <div className="space-y-4">
          {/* Period filter */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex rounded-lg overflow-hidden border border-gray-200 bg-white">
              {(['luna', 'trimestru', 'an'] as const).map(p => (
                <button key={p} onClick={() => setPeriodRange(p)}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${period === p ? 'bg-brand-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
                >{p === 'luna' ? 'Lună' : p === 'trimestru' ? 'Trimestru' : 'An'}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className={selCls} />
              <span className="text-gray-400 text-sm">—</span>
              <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className={selCls} />
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Total RON', value: totalRonDash.toLocaleString('ro-RO', { minimumFractionDigits: 2 }), color: 'text-green-700', sub: 'tranzacții filtrate' },
              { label: 'Total kg', value: totalKgDash.toLocaleString('ro-RO'), color: 'text-blue-700', sub: 'cantitate netă' },
              { label: 'Contracte active', value: contracts.filter(c => c.status === 'ACTIVE').length, color: 'text-amber-700', sub: `din ${contracts.length} total` },
              { label: 'Arendași', value: lessors.length, color: 'text-purple-700', sub: `${lessors.filter(l => l.status === 'ACTIVE').length} activi` },
            ].map(k => (
              <div key={k.label} className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-xs text-gray-500 mb-1">{k.label}</p>
                <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                <p className="text-xs text-gray-400 mt-1">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Charts row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Venituri lunare (RON)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={monthlyRevenue} barSize={24} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} width={52} axisLine={false} tickLine={false}
                    tickFormatter={v => v === 0 ? '0' : `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: unknown) => [`${Number(v).toLocaleString('ro-RO')} RON`, 'Valoare']}
                    contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                  <Bar dataKey="valoare" fill="#2d6a4f" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Status contracte</h3>
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="55%" height={180}>
                  <PieChart>
                    <Pie data={contractsByStatus} cx="50%" cy="50%" innerRadius={48} outerRadius={72} dataKey="value" paddingAngle={2}>
                      {contractsByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2">
                  {contractsByStatus.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-2 text-xs">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-gray-600">{item.name}</span>
                      <span className="font-bold ml-auto pl-3">
                        {contracts.length > 0 ? Math.round(item.value / contracts.length * 100) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Charts row 2 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Top 5 arendași după venituri</h3>
              <div className="space-y-3">
                {topLessors.map((l, i) => (
                  <div key={l.name} className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline text-sm mb-1">
                        <span className="font-medium truncate">{l.name}</span>
                        <span className="text-green-700 font-semibold ml-2 whitespace-nowrap">{l.total.toLocaleString('ro-RO', { minimumFractionDigits: 0 })} RON</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-500 rounded-full" style={{ width: `${Math.min(100, (l.total / (topLessors[0]?.total || 1)) * 100)}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
                {topLessors.length === 0 && <p className="text-sm text-gray-400 text-center py-8">Fără tranzacții în perioada selectată</p>}
              </div>
            </div>
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Venituri pe produse (RON)</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={productChart} layout="vertical" barSize={20} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                    tickFormatter={v => v === 0 ? '0' : `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={96} axisLine={false} tickLine={false} />
                  <Tooltip formatter={(v: unknown) => [`${Number(v).toLocaleString('ro-RO')} RON`, 'Valoare']}
                    contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                  <Bar dataKey="ron" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── ARENDAȘI ──────────────────────────────────────────────────────── */}
      {tab === 1 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <span className="font-semibold text-sm">Arendași ({lessors.length})</span>
            <button onClick={() => exportXlsx(lessors.map(l => ({
              Nume: lessorName(l), Tip: l.type === 'LEGAL' ? 'Persoană juridică' : 'Persoană fizică',
              Status: l.status === 'ACTIVE' ? 'Activ' : 'Inactiv',
              Contracte: contracts.filter(c => c.lessor_id === l.id).length,
              'Ha total': parcels.filter(p => contracts.filter(c => c.lessor_id === l.id).some(c => c.id === p.contract_id)).reduce((s, p) => s + Number(p.surface ?? 0), 0).toFixed(4),
              'Tranzacții': transactions.filter(t => t.lessor_id === l.id).length,
              'Total RON': transactions.filter(t => t.lessor_id === l.id).reduce((s, t) => s + t.ron_net, 0).toFixed(2),
            })), 'arendasi')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded font-medium">
              <Download className="w-3 h-3" /> Export Excel
            </button>
          </div>
          <table className="min-w-full">
            <thead><tr>
              <th className={`${thCls} w-8`}></th>
              <th className={thCls}>Arendaș</th><th className={thCls}>Tip</th>
              <th className={`${thCls} text-right`}>Contracte</th>
              <th className={`${thCls} text-right`}>Ha total</th>
              <th className={`${thCls} text-right`}>Tranzacții</th>
              <th className={`${thCls} text-right`}>Total RON</th>
              <th className={thCls}>Status</th>
            </tr></thead>
            <tbody>
              {lessors.map(l => {
                const lContracts = contracts.filter(c => c.lessor_id === l.id)
                const lTxns = transactions.filter(t => t.lessor_id === l.id)
                const lHa = parcels.filter(p => lContracts.some(c => c.id === p.contract_id)).reduce((s, p) => s + Number(p.surface ?? 0), 0)
                const lRon = lTxns.reduce((s, t) => s + t.ron_net, 0)
                const isExp = expandedLessors.has(l.id)
                return (
                  <>
                    <tr key={l.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => toggleLessor(l.id)}>
                      <td className={tdCls}>{isExp ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}</td>
                      <td className={`${tdCls} font-medium`}>{lessorName(l)}</td>
                      <td className={tdCls}>{l.type === 'LEGAL' ? 'Juridic' : 'Fizic'}</td>
                      <td className={`${tdCls} text-right`}>{lContracts.length}</td>
                      <td className={`${tdCls} text-right`}>{lHa.toFixed(2)}</td>
                      <td className={`${tdCls} text-right`}>{lTxns.length}</td>
                      <td className={`${tdCls} text-right font-semibold text-green-700`}>{lRon.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}</td>
                      <td className={tdCls}>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${l.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {l.status === 'ACTIVE' ? 'Activ' : 'Inactiv'}
                        </span>
                      </td>
                    </tr>
                    {isExp && (
                      <tr key={`${l.id}-exp`}><td colSpan={8} className="bg-gray-50 px-8 py-4 border-b border-gray-200">
                        <p className="text-xs font-bold text-gray-500 uppercase mb-2">Contracte</p>
                        <table className="min-w-full mb-4 text-xs border border-gray-200 rounded overflow-hidden">
                          <thead><tr className="bg-gray-100">
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-600">Nr.</th>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-600">Status</th>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-600">Start</th>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-600">Sfârșit</th>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-600">Localitate</th>
                          </tr></thead>
                          <tbody>
                            {lContracts.map(c => (
                              <tr key={c.id} className="border-t border-gray-200">
                                <td className="px-2 py-1 font-medium">{c.contract_number}</td>
                                <td className="px-2 py-1">{STATUS_LABEL[c.status] ?? c.status}</td>
                                <td className="px-2 py-1">{c.start_date}</td>
                                <td className="px-2 py-1">{c.end_date}</td>
                                <td className="px-2 py-1">{c.localities ?? '—'}</td>
                              </tr>
                            ))}
                            {lContracts.length === 0 && <tr><td colSpan={5} className="px-2 py-2 text-gray-400 text-center">Fără contracte</td></tr>}
                          </tbody>
                        </table>
                        <p className="text-xs font-bold text-gray-500 uppercase mb-2">Tranzacții</p>
                        <table className="min-w-full text-xs border border-gray-200 rounded overflow-hidden">
                          <thead><tr className="bg-gray-100">
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-600">Data</th>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-600">Produs</th>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-600">An camp.</th>
                            <th className="px-2 py-1.5 text-right font-semibold text-gray-600">Kg net</th>
                            <th className="px-2 py-1.5 text-right font-semibold text-gray-600">RON net</th>
                            <th className="px-2 py-1.5 text-left font-semibold text-gray-600">Facturat</th>
                          </tr></thead>
                          <tbody>
                            {lTxns.map(t => (
                              <tr key={t.id} className="border-t border-gray-200">
                                <td className="px-2 py-1">{t.transaction_date}</td>
                                <td className="px-2 py-1">{t.product_name}</td>
                                <td className="px-2 py-1">{t.campaign_year}</td>
                                <td className="px-2 py-1 text-right">{t.kg_net.toLocaleString('ro-RO')}</td>
                                <td className="px-2 py-1 text-right font-semibold text-green-700">{t.ron_net.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}</td>
                                <td className="px-2 py-1">{t.invoice_id ? <span className="text-green-600 font-medium">Da</span> : <span className="text-gray-400">—</span>}</td>
                              </tr>
                            ))}
                            {lTxns.length === 0 && <tr><td colSpan={6} className="px-2 py-2 text-gray-400 text-center">Fără tranzacții</td></tr>}
                          </tbody>
                        </table>
                      </td></tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── CONTRACTE ─────────────────────────────────────────────────────── */}
      {tab === 2 && (() => {
        const filtered = contracts.filter(c => !contractStatus || c.status === contractStatus)
        return (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-3 flex-wrap">
              <span className="font-semibold text-sm">Contracte ({filtered.length})</span>
              <select value={contractStatus} onChange={e => setContractStatus(e.target.value)} className={selCls}>
                <option value="">Toate statusurile</option>
                <option value="ACTIVE">Active</option><option value="EXPIRED">Expirate</option>
                <option value="PENDING">În așteptare</option><option value="TERMINATED">Reziliate</option>
              </select>
              <button onClick={() => exportXlsx(filtered.map(c => ({
                'Nr. contract': c.contract_number, Arendaș: lessorName(c.lessors),
                Status: STATUS_LABEL[c.status] ?? c.status, 'Data start': c.start_date,
                'Data sfârșit': c.end_date, Localitate: c.localities ?? '',
                'Nr. parcele': parcels.filter(p => p.contract_id === c.id).length,
                'Ha total': parcels.filter(p => p.contract_id === c.id).reduce((s, p) => s + Number(p.surface ?? 0), 0).toFixed(4),
              })), 'contracte')}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded font-medium">
                <Download className="w-3 h-3" /> Export Excel
              </button>
            </div>
            <table className="min-w-full">
              <thead><tr>
                <th className={thCls}>Nr.</th><th className={thCls}>Arendaș</th><th className={thCls}>Status</th>
                <th className={thCls}>Start</th><th className={thCls}>Sfârșit</th><th className={thCls}>Localitate</th>
                <th className={`${thCls} text-right`}>Parcele</th><th className={`${thCls} text-right`}>Ha</th>
              </tr></thead>
              <tbody>
                {filtered.map(c => {
                  const cParcels = parcels.filter(p => p.contract_id === c.id)
                  const cHa = cParcels.reduce((s, p) => s + Number(p.surface ?? 0), 0)
                  return (
                    <tr key={c.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className={`${tdCls} font-medium`}>{c.contract_number}</td>
                      <td className={tdCls}>{lessorName(c.lessors)}</td>
                      <td className={tdCls}>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          c.status === 'ACTIVE' ? 'bg-green-100 text-green-700'
                            : c.status === 'EXPIRED' ? 'bg-red-100 text-red-600'
                            : c.status === 'PENDING' ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>{STATUS_LABEL[c.status] ?? c.status}</span>
                      </td>
                      <td className={tdCls}>{c.start_date}</td><td className={tdCls}>{c.end_date}</td>
                      <td className={tdCls}>{c.localities ?? '—'}</td>
                      <td className={`${tdCls} text-right`}>{cParcels.length}</td>
                      <td className={`${tdCls} text-right font-semibold`}>{cHa.toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      })()}

      {/* ── TRANZACȚII ────────────────────────────────────────────────────── */}
      {tab === 3 && (() => {
        const years = [...new Set(transactions.map(t => t.campaign_year))].sort((a, b) => b - a)
        const products = [...new Set(transactions.map(t => t.product_name))].sort()
        const filtered = transactions.filter(t =>
          (!txnYear || String(t.campaign_year) === txnYear) &&
          (!txnProduct || t.product_name === txnProduct)
        )
        const totRon = filtered.reduce((s, t) => s + t.ron_net, 0)
        const totKg = filtered.reduce((s, t) => s + t.kg_net, 0)
        return (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-3 flex-wrap">
              <span className="font-semibold text-sm">Tranzacții ({filtered.length})</span>
              <select value={txnYear} onChange={e => setTxnYear(e.target.value)} className={selCls}>
                <option value="">Toți anii</option>
                {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
              </select>
              <select value={txnProduct} onChange={e => setTxnProduct(e.target.value)} className={selCls}>
                <option value="">Toate produsele</option>
                {products.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <div className="text-xs text-gray-500">
                Total: <span className="font-bold text-green-700">{totRon.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON</span>
                {' · '}<span className="font-bold text-blue-700">{totKg.toLocaleString('ro-RO')} kg</span>
              </div>
              <button onClick={() => exportXlsx(filtered.map(t => ({
                Data: t.transaction_date, Arendaș: lessorName(lessors.find(l => l.id === t.lessor_id)),
                Contract: t.contracts?.contract_number ?? '', Produs: t.product_name,
                'An campanie': t.campaign_year, 'Kg net': t.kg_net, 'RON net': t.ron_net.toFixed(2),
                Facturat: t.invoice_id ? 'Da' : 'Nu',
              })), 'tranzactii')}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded font-medium">
                <Download className="w-3 h-3" /> Export Excel
              </button>
            </div>
            <table className="min-w-full">
              <thead><tr>
                <th className={thCls}>Data</th><th className={thCls}>Arendaș</th><th className={thCls}>Contract</th>
                <th className={thCls}>Produs</th><th className={`${thCls} text-right`}>An camp.</th>
                <th className={`${thCls} text-right`}>Kg net</th><th className={`${thCls} text-right`}>RON net</th>
                <th className={thCls}>Facturat</th>
              </tr></thead>
              <tbody>
                {filtered.map(t => (
                  <tr key={t.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className={tdCls}>{t.transaction_date}</td>
                    <td className={tdCls}>{lessorName(lessors.find(l => l.id === t.lessor_id))}</td>
                    <td className={`${tdCls} font-mono text-xs`}>{t.contracts?.contract_number ?? '—'}</td>
                    <td className={tdCls}>{t.product_name}</td>
                    <td className={`${tdCls} text-right`}>{t.campaign_year}</td>
                    <td className={`${tdCls} text-right`}>{t.kg_net.toLocaleString('ro-RO')}</td>
                    <td className={`${tdCls} text-right font-semibold text-green-700`}>{t.ron_net.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}</td>
                    <td className={tdCls}>{t.invoice_id ? <span className="text-xs font-medium text-green-600">Da</span> : <span className="text-xs text-gray-400">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      })()}

      {/* ── FACTURI & AVIZE ───────────────────────────────────────────────── */}
      {tab === 4 && (() => {
        const filtered = invoices.filter(i =>
          (!invType || i.doc_type === invType) &&
          (!invStatus || i.status === invStatus)
        )
        const totRon = filtered.reduce((s, i) => s + i.total_ron, 0)
        const statusCls = (s: string) =>
          s === 'PLATITA' ? 'border-green-300 bg-green-50 text-green-700'
            : s === 'EMISA' ? 'border-blue-300 bg-blue-50 text-blue-700'
            : s === 'STORNATA' ? 'border-red-300 bg-red-50 text-red-600'
            : 'border-gray-300 bg-gray-50 text-gray-600'
        return (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-3 flex-wrap">
              <span className="font-semibold text-sm">Facturi & Avize ({filtered.length})</span>
              <select value={invType} onChange={e => setInvType(e.target.value)} className={selCls}>
                <option value="">Toate tipurile</option>
                <option value="FACTURA">Facturi</option><option value="AVIZ">Avize</option>
              </select>
              <select value={invStatus} onChange={e => setInvStatus(e.target.value)} className={selCls}>
                <option value="">Toate statusurile</option>
                <option value="DRAFT">Draft</option>
                <option value="EMISA">Emisă</option>
                <option value="PLATITA">Plătită</option>
                <option value="STORNATA">Stornată</option>
              </select>
              <div className="text-xs text-gray-500">
                Total: <span className="font-bold text-green-700">{totRon.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON</span>
              </div>
              <button onClick={() => exportXlsx(filtered.map(i => ({
                'Nr.': i.invoice_number, Data: i.invoice_date, 'Arendaș': lessorName(i.lessors),
                Tip: i.doc_type, 'Total RON': i.total_ron.toFixed(2), Status: i.status,
              })), 'facturi-avize')}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded font-medium">
                <Download className="w-3 h-3" /> Export Excel
              </button>
            </div>
            <table className="min-w-full">
              <thead><tr>
                <th className={thCls}>Nr.</th><th className={thCls}>Data</th><th className={thCls}>Arendaș</th>
                <th className={thCls}>Tip</th><th className={`${thCls} text-right`}>Total RON</th>
                <th className={thCls}>Status</th><th className={thCls}></th>
              </tr></thead>
              <tbody>
                {filtered.map(i => (
                  <tr key={i.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className={`${tdCls} font-medium`}>{i.invoice_number}</td>
                    <td className={tdCls}>{i.invoice_date}</td>
                    <td className={tdCls}>{lessorName(i.lessors)}</td>
                    <td className={tdCls}>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${i.doc_type === 'FACTURA' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {i.doc_type === 'FACTURA' ? 'Factură' : 'Aviz'}
                      </span>
                    </td>
                    <td className={`${tdCls} text-right font-semibold text-green-700`}>{i.total_ron.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}</td>
                    <td className={tdCls}>
                      <select
                        value={i.status}
                        onChange={e => updateInvoiceStatus(i.id, e.target.value)}
                        className={`text-xs border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-brand-400 ${statusCls(i.status)}`}
                      >
                        <option value="DRAFT">Draft</option>
                        <option value="EMISA">Emisă</option>
                        <option value="PLATITA">Plătită</option>
                        <option value="STORNATA">Stornată</option>
                      </select>
                    </td>
                    <td className={tdCls}>
                      <button onClick={() => deleteInvoice(i.id)}
                        className="p-1 text-gray-400 hover:text-red-600 transition-colors" title="Șterge">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-sm text-gray-400">Nicio înregistrare</td></tr>}
              </tbody>
            </table>
          </div>
        )
      })()}

      {/* ── PRODUSE ───────────────────────────────────────────────────────── */}
      {tab === 5 && (() => {
        const grouped: Record<string, { kg: number; ron: number; txns: number; years: Set<number> }> = {}
        transactions.forEach(t => {
          if (!grouped[t.product_name]) grouped[t.product_name] = { kg: 0, ron: 0, txns: 0, years: new Set() }
          grouped[t.product_name].kg += t.kg_net
          grouped[t.product_name].ron += t.ron_net
          grouped[t.product_name].txns++
          grouped[t.product_name].years.add(t.campaign_year)
        })
        const rows = Object.entries(grouped).map(([name, v]) => ({
          name, kg: v.kg, ron: v.ron, txns: v.txns,
          avgPrice: v.kg > 0 ? v.ron / v.kg : 0, years: [...v.years].sort().join(', '),
        })).sort((a, b) => b.ron - a.ron)
        return (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <span className="font-semibold text-sm">Raport produse</span>
              <button onClick={() => exportXlsx(rows.map(r => ({
                Produs: r.name, 'Total kg': r.kg.toFixed(4), 'Total RON': r.ron.toFixed(2),
                'Preț mediu (RON/kg)': r.avgPrice.toFixed(4), 'Nr. tranzacții': r.txns, 'Ani campanie': r.years,
              })), 'produse')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded font-medium">
                <Download className="w-3 h-3" /> Export Excel
              </button>
            </div>
            {rows.length > 0 && (
              <div className="p-4 border-b border-gray-100">
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={rows} barSize={40} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10 }} width={52} axisLine={false} tickLine={false}
                      tickFormatter={v => v === 0 ? '0' : `${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v: unknown) => [`${Number(v).toLocaleString('ro-RO')} RON`, 'Valoare']}
                      contentStyle={{ fontSize: 12, borderRadius: 6 }} />
                    <Bar dataKey="ron" fill="#2d6a4f" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            <table className="min-w-full">
              <thead><tr>
                <th className={thCls}>Produs</th>
                <th className={`${thCls} text-right`}>Total kg</th>
                <th className={`${thCls} text-right`}>Total RON</th>
                <th className={`${thCls} text-right`}>Preț mediu (RON/kg)</th>
                <th className={`${thCls} text-right`}>Nr. tranzacții</th>
                <th className={thCls}>Ani campanie</th>
              </tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.name} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className={`${tdCls} font-medium`}>{r.name}</td>
                    <td className={`${tdCls} text-right`}>{r.kg.toLocaleString('ro-RO', { minimumFractionDigits: 4 })}</td>
                    <td className={`${tdCls} text-right font-semibold text-green-700`}>{r.ron.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}</td>
                    <td className={`${tdCls} text-right`}>{r.avgPrice.toFixed(4)}</td>
                    <td className={`${tdCls} text-right`}>{r.txns}</td>
                    <td className={tdCls}>{r.years}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-sm text-gray-400">Fără tranzacții</td></tr>}
              </tbody>
            </table>
          </div>
        )
      })()}

      {/* ── PARCELE ───────────────────────────────────────────────────────── */}
      {tab === 6 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <span className="font-semibold text-sm">
              Parcele ({parcels.length}) · {parcels.reduce((s, p) => s + Number(p.surface ?? 0), 0).toFixed(2)} ha total
            </span>
            <button onClick={() => exportXlsx(parcels.map(p => ({
              'Nr. parcelă': p.parcel_nr ?? '', Tarla: p.tarla_nr ?? '',
              'Suprafață (ha)': Number(p.surface).toFixed(4),
              Arendaș: lessorName(p.contracts?.lessors), Contract: p.contracts?.contract_number ?? '',
            })), 'parcele')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded font-medium">
              <Download className="w-3 h-3" /> Export Excel
            </button>
          </div>
          <table className="min-w-full">
            <thead><tr>
              <th className={thCls}>Nr. parcelă</th><th className={thCls}>Tarla</th>
              <th className={`${thCls} text-right`}>Suprafață (ha)</th>
              <th className={thCls}>Arendaș</th><th className={thCls}>Contract</th>
            </tr></thead>
            <tbody>
              {parcels.map(p => (
                <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className={tdCls}>{p.parcel_nr ?? '—'}</td>
                  <td className={tdCls}>{p.tarla_nr ?? '—'}</td>
                  <td className={`${tdCls} text-right font-semibold`}>{Number(p.surface).toFixed(4)}</td>
                  <td className={tdCls}>{lessorName(p.contracts?.lessors)}</td>
                  <td className={`${tdCls} font-mono text-xs`}>{p.contracts?.contract_number ?? '—'}</td>
                </tr>
              ))}
              {parcels.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-sm text-gray-400">Fără parcele</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {/* ── CAMPANIE ────────────────────────────────────────────────────────────────── */}
      {tab === 7 && (
        <div className="space-y-4">
          {campaignList.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">Nu există campanii. Creează prima campanie în Setări → Campanii.</div>
          ) : (
            <>
              {/* Campaign selector */}
              <div className="flex items-center gap-3">
                <select className={selCls} value={selectedCampaignId} onChange={e => setSelectedCampaignId(e.target.value)}>
                  {campaignList.map(c => <option key={c.id} value={c.id}>{c.name} ({c.year})</option>)}
                </select>
                <button onClick={() => void loadCampaignReport(selectedCampaignId)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">
                  Reîncarcă
                </button>
                {cropPlanRows.length > 0 && (
                  <button onClick={() => exportXlsx(cropPlanRows.map(r => ({
                    Parcelă: r.bloc_fizic, Localitate: r.locality, 'Suprafață (ha)': r.surface,
                    Cultură: r.crop, 'Plan ha': r.planned_area_ha, 'Plan t/ha': r.planned_yield_t_ha,
                    'Real ha': r.actual_area_ha, 'Real t/ha': r.actual_yield_t_ha,
                    Status: r.status, 'Cost total (RON)': r.total_cost,
                    'Cost/ha (RON)': r.surface > 0 ? (r.total_cost / r.surface).toFixed(2) : '',
                  })), 'campanie-' + (campaignList.find(c => c.id === selectedCampaignId)?.year ?? ''))}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">
                    <Download className="w-3.5 h-3.5" /> Export Excel
                  </button>
                )}
              </div>

              {loadingCampaign ? (
                <div className="py-12 text-center text-sm text-gray-400">Se încarcă...</div>
              ) : cropPlanRows.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">Niciun plan de cultură înregistrat pentru această campanie.</div>
              ) : (
                <>
                  {/* KPI summary */}
                  {(() => {
                    const totalHa = cropPlanRows.reduce((s, r) => s + (r.planned_area_ha ?? r.surface), 0)
                    const actualHa = cropPlanRows.reduce((s, r) => s + (r.actual_area_ha ?? 0), 0)
                    const totalPlannedT = cropPlanRows.reduce((s, r) => s + ((r.planned_area_ha ?? r.surface) * (r.planned_yield_t_ha ?? 0)), 0)
                    const totalActualT = cropPlanRows.reduce((s, r) => s + ((r.actual_area_ha ?? 0) * (r.actual_yield_t_ha ?? 0)), 0)
                    const totalCost = cropPlanRows.reduce((s, r) => s + r.total_cost, 0)
                    return (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { label: 'Parcele planificate', value: cropPlanRows.length },
                          { label: 'Ha totale planificate', value: `${totalHa.toFixed(2)} ha` },
                          { label: 'Producție planificată', value: totalPlannedT > 0 ? `${totalPlannedT.toFixed(1)} t` : '—' },
                          { label: 'Producție reală', value: totalActualT > 0 ? `${totalActualT.toFixed(1)} t` : '—' },
                          { label: 'Cost total inputuri', value: totalCost > 0 ? `${totalCost.toFixed(0)} RON` : '—' },
                          { label: 'Cost mediu / ha', value: totalHa > 0 && totalCost > 0 ? `${(totalCost / totalHa).toFixed(0)} RON/ha` : '—' },
                          { label: 'Recoltat', value: `${cropPlanRows.filter(r => r.status === 'RECOLTAT').length} / ${cropPlanRows.length}` },
                          { label: 'Producție medie reală', value: actualHa > 0 ? `${(totalActualT / actualHa).toFixed(2)} t/ha` : '—' },
                        ].map(k => (
                          <div key={k.label} className="bg-white rounded-lg border border-gray-100 p-3 shadow-sm">
                            <div className="text-lg font-bold text-gray-800">{k.value}</div>
                            <div className="text-xs text-gray-500 mt-0.5">{k.label}</div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}

                  {/* Per-crop summary */}
                  {(() => {
                    const byCrop: Record<string, { planned_ha: number; actual_ha: number; planned_t: number; actual_t: number; cost: number; count: number }> = {}
                    cropPlanRows.forEach(r => {
                      if (!byCrop[r.crop]) byCrop[r.crop] = { planned_ha: 0, actual_ha: 0, planned_t: 0, actual_t: 0, cost: 0, count: 0 }
                      const c = byCrop[r.crop]
                      c.count++
                      c.planned_ha += r.planned_area_ha ?? r.surface
                      c.actual_ha  += r.actual_area_ha ?? 0
                      c.planned_t  += (r.planned_area_ha ?? r.surface) * (r.planned_yield_t_ha ?? 0)
                      c.actual_t   += (r.actual_area_ha ?? 0) * (r.actual_yield_t_ha ?? 0)
                      c.cost       += r.total_cost
                    })
                    return (
                      <div className="bg-white rounded-lg border border-gray-100 overflow-hidden shadow-sm">
                        <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-700">Sumar pe culturi</div>
                        <table className="w-full text-sm">
                          <thead><tr>
                            <th className={thCls}>Cultură</th>
                            <th className={`${thCls} text-right`}>Parcele</th>
                            <th className={`${thCls} text-right`}>Ha planif.</th>
                            <th className={`${thCls} text-right`}>Ha recoltat</th>
                            <th className={`${thCls} text-right`}>Prod. planif. (t)</th>
                            <th className={`${thCls} text-right`}>Prod. reală (t)</th>
                            <th className={`${thCls} text-right`}>Cost (RON)</th>
                            <th className={`${thCls} text-right`}>RON/ha</th>
                          </tr></thead>
                          <tbody>
                            {Object.entries(byCrop).sort((a,b) => b[1].planned_ha - a[1].planned_ha).map(([crop, v]) => (
                              <tr key={crop} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className={tdCls + ' font-medium'}>{crop}</td>
                                <td className={tdCls + ' text-right'}>{v.count}</td>
                                <td className={tdCls + ' text-right'}>{v.planned_ha.toFixed(2)}</td>
                                <td className={tdCls + ' text-right'}>{v.actual_ha > 0 ? v.actual_ha.toFixed(2) : '—'}</td>
                                <td className={tdCls + ' text-right'}>{v.planned_t > 0 ? v.planned_t.toFixed(1) : '—'}</td>
                                <td className={`${tdCls} text-right font-medium ${v.actual_t > 0 ? 'text-green-700' : ''}`}>
                                  {v.actual_t > 0 ? v.actual_t.toFixed(1) : '—'}
                                </td>
                                <td className={tdCls + ' text-right'}>{v.cost > 0 ? v.cost.toFixed(0) : '—'}</td>
                                <td className={tdCls + ' text-right'}>{v.planned_ha > 0 && v.cost > 0 ? (v.cost / v.planned_ha).toFixed(0) : '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  })()}

                  {/* Per-parcel detail */}
                  <div className="bg-white rounded-lg border border-gray-100 overflow-hidden shadow-sm">
                    <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-700">Detaliu per parcelă</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead><tr>
                          <th className={thCls}>Parcelă</th>
                          <th className={thCls}>Localitate</th>
                          <th className={`${thCls} text-right`}>Ha</th>
                          <th className={thCls}>Cultură</th>
                          <th className={`${thCls} text-right`}>Plan t/ha</th>
                          <th className={`${thCls} text-right`}>Real t/ha</th>
                          <th className={`${thCls} text-right`}>Δ t/ha</th>
                          <th className={`${thCls} text-right`}>Cost (RON)</th>
                          <th className={`${thCls} text-right`}>RON/ha</th>
                          <th className={thCls}>Status</th>
                        </tr></thead>
                        <tbody>
                          {cropPlanRows.map(r => {
                            const delta = r.actual_yield_t_ha != null && r.planned_yield_t_ha != null
                              ? r.actual_yield_t_ha - r.planned_yield_t_ha : null
                            return (
                              <tr key={r.parcel_id} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className={tdCls + ' font-medium'}>{r.bloc_fizic ?? r.parcel_id.slice(0,8)}</td>
                                <td className={tdCls + ' text-gray-500 text-xs'}>{r.locality ?? '—'}</td>
                                <td className={tdCls + ' text-right'}>{(r.planned_area_ha ?? r.surface).toFixed(2)}</td>
                                <td className={tdCls}>{r.crop}</td>
                                <td className={tdCls + ' text-right text-gray-500'}>{r.planned_yield_t_ha ?? '—'}</td>
                                <td className={`${tdCls} text-right font-medium ${r.actual_yield_t_ha ? 'text-green-700' : ''}`}>
                                  {r.actual_yield_t_ha ?? '—'}
                                </td>
                                <td className={`${tdCls} text-right text-xs font-medium ${delta != null ? (delta >= 0 ? 'text-green-600' : 'text-red-500') : ''}`}>
                                  {delta != null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}` : '—'}
                                </td>
                                <td className={tdCls + ' text-right'}>{r.total_cost > 0 ? r.total_cost.toFixed(0) : '—'}</td>
                                <td className={tdCls + ' text-right'}>{r.surface > 0 && r.total_cost > 0 ? (r.total_cost / r.surface).toFixed(0) : '—'}</td>
                                <td className={tdCls}>
                                  <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium ${
                                    r.status === 'RECOLTAT' ? 'bg-green-100 text-green-700' :
                                    r.status === 'IN_PRODUCTIE' ? 'bg-amber-100 text-amber-700' :
                                    r.status === 'ABANDONAT' ? 'bg-red-100 text-red-500' :
                                    'bg-blue-100 text-blue-700'}`}>{r.status}</span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
