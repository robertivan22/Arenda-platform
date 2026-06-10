'use client'

export const runtime = 'edge'

import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { CampaignSelector } from '@/components/CampaignSelector'
import { toast } from 'sonner'
import {
  Plus, X, Check, Pencil, Loader2, Tractor, Filter,
  Calendar, MapPin, ChevronDown, ChevronRight,
} from 'lucide-react'
import type { Campaign } from '@/lib/campaign-types'

// ─── Constants ────────────────────────────────────────────────────────────────

const OPERATION_TYPES = [
  { value: 'ARAT',        label: 'Arat' },
  { value: 'DISCUIT',     label: 'Discuit' },
  { value: 'GRAPAT',      label: 'Grăpat' },
  { value: 'SEMANAT',     label: 'Semănat' },
  { value: 'FERTILIZAT',  label: 'Fertilizat' },
  { value: 'ERBICIDAT',   label: 'Erbicidat' },
  { value: 'FUNGICIDAT',  label: 'Fungicidat' },
  { value: 'INSECTICID',  label: 'Insecticid' },
  { value: 'IRIGAT',      label: 'Irigat' },
  { value: 'RECOLTAT',    label: 'Recoltat' },
  { value: 'TRANSPORT',   label: 'Transport' },
  { value: 'ALTELE',      label: 'Altele' },
]

const STATUS_OPTS = [
  { value: 'PLANIFICAT',   label: 'Planificat',    cls: 'bg-blue-100 text-blue-700' },
  { value: 'IN_EXECUTIE',  label: 'În execuție',   cls: 'bg-amber-100 text-amber-700' },
  { value: 'FINALIZAT',    label: 'Finalizat',     cls: 'bg-green-100 text-green-700' },
  { value: 'ANULAT',       label: 'Anulat',        cls: 'bg-red-100 text-red-500' },
]

const OP_COLORS: Record<string, string> = {
  ARAT:       'bg-stone-100 text-stone-700',
  DISCUIT:    'bg-stone-100 text-stone-600',
  GRAPAT:     'bg-yellow-50 text-yellow-700',
  SEMANAT:    'bg-green-100 text-green-700',
  FERTILIZAT: 'bg-lime-100 text-lime-700',
  ERBICIDAT:  'bg-orange-100 text-orange-700',
  FUNGICIDAT: 'bg-purple-100 text-purple-700',
  INSECTICID: 'bg-red-100 text-red-600',
  IRIGAT:     'bg-blue-100 text-blue-700',
  RECOLTAT:   'bg-amber-100 text-amber-700',
  TRANSPORT:  'bg-gray-100 text-gray-700',
  ALTELE:     'bg-gray-100 text-gray-500',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Machine { id: string; name: string; type: string }

interface WorkOrder {
  id: string
  campaign_id: string
  parcel_id: string | null
  crop_plan_id: string | null
  machine_id: string | null
  operation_type: string
  planned_date: string | null
  executed_date: string | null
  area_ha: number | null
  status: 'PLANIFICAT' | 'IN_EXECUTIE' | 'FINALIZAT' | 'ANULAT'
  notes: string | null
  created_at: string
  // joined
  parcel_name?: string | null
  parcel_surface?: number | null
  machine_name?: string | null
}

interface Parcel {
  id: string
  bloc_fizic: string | null
  locality: string | null
  surface: number
}

interface WorkOrderInput {
  id: string
  work_order_id: string
  input_type: string
  product_name: string
  quantity: number
  unit: string
  cost_per_unit: number | null
  notes: string | null
  lot_id: string | null
}

const INPUT_TYPES = [
  { value: 'SAMANTA',     label: 'Sămânță' },
  { value: 'INGRASAMANT', label: 'Îngrăşământ' },
  { value: 'ERBICID',     label: 'Erbicid' },
  { value: 'FUNGICID',    label: 'Fungicid' },
  { value: 'INSECTICID',  label: 'Insecticid' },
  { value: 'CARBURANT',   label: 'Carburant' },
  { value: 'ALTELE',      label: 'Altele' },
]

type FormState = Omit<WorkOrder, 'id' | 'campaign_id' | 'created_at' | 'parcel_name' | 'parcel_surface' | 'machine_name' | 'area_ha'> & {
  parcel_id: string
  area_ha: string
}

const EMPTY_FORM = (): FormState => ({
  parcel_id: '',
  crop_plan_id: null,
  machine_id: null,
  operation_type: 'SEMANAT',
  planned_date: null,
  executed_date: null,
  area_ha: '',
  status: 'PLANIFICAT',
  notes: null,
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusInfo(s: string) {
  return STATUS_OPTS.find(o => o.value === s) ?? STATUS_OPTS[0]
}

function opLabel(type: string) {
  return OPERATION_TYPES.find(o => o.value === type)?.label ?? type
}

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CampaignTabs({ year }: { year: number }) {
  const pathname = usePathname()
  const isActivitati = pathname.endsWith('/activitati')
  const isStocuri = pathname.endsWith('/stocuri')
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
      {[
        { label: 'Planuri culturi', href: `/campanie/${year}` },
        { label: 'Activități câmp', href: `/campanie/${year}/activitati` },
        { label: 'Stocuri & Inputuri', href: `/campanie/${year}/stocuri` },
      ].map(t => {
        const active = (isActivitati && t.href.endsWith('activitati')) || (isStocuri && t.href.endsWith('stocuri')) || (!isActivitati && !isStocuri && t.href === `/campanie/${year}`)
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

export default function ActivitatiPage() {
  const params = useParams()
  const router = useRouter()
  const yearParam = Number(params.year)

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [parcels, setParcels] = useState<Parcel[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [orders, setOrders] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM())
  const [editId, setEditId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [inputsCache, setInputsCache] = useState<Map<string, WorkOrderInput[]>>(new Map())
  const [addInputForm, setAddInputForm] = useState({ input_type: 'SAMANTA', product_name: '', quantity: '', unit: 'kg', cost_per_unit: '', notes: '', lot_id: '' })
  const [savingInput, setSavingInput] = useState(false)
  const [inventoryLots, setInventoryLots] = useState<{id:string;product_name:string;unit:string;category:string;quantity_available:number;unit_price:number|null}[]>([])

  // Filters
  const [filterOp, setFilterOp] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterParcel, setFilterParcel] = useState('')

  // ── Load campaign ──
  useEffect(() => {
    const db = createClient()
    db.from('campaigns').select('*').eq('year', yearParam).maybeSingle().then(({ data }) => {
      if (data) setCampaign(data as Campaign)
      else toast.error(`Nu există campania ${yearParam}.`)
    })
  }, [yearParam])

  // ── Load parcels (for select) ──
  useEffect(() => {
    createClient()
      .from('parcels')
      .select('id,bloc_fizic,locality,surface')
      .eq('status', 'ACTIVE')
      .order('bloc_fizic')
      .then(({ data }) => { if (data) setParcels(data as Parcel[]) })
  }, [])

  // ── Load machines ──
  useEffect(() => {
    createClient()
      .from('machines')
      .select('id,name,type')
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => { if (data) setMachines(data as Machine[]) })
  }, [])

  // ── Load inventory lots (for input linkage) ──
  useEffect(() => {
    createClient()
      .from('input_lots')
      .select('id,product_name,unit,category,quantity_available,unit_price')
      .gt('quantity_available', 0)
      .order('product_name')
      .then(({ data }) => { if (data) setInventoryLots(data as any[]) })
  }, [])

  // ── Load work orders ──
  async function loadOrders(cam?: Campaign | null) {
    const c = cam ?? campaign
    if (!c) return
    setLoading(true)
    const db = createClient()
    const { data } = await db
      .from('work_orders')
      .select('*, parcels(bloc_fizic, locality, surface)')
      .eq('campaign_id', c.id)
      .order('planned_date', { ascending: true })
    if (data) {
      const machineMap = new Map(machines.map(m => [m.id, m.name]))
      setOrders(data.map((r: any) => ({
        ...r,
        parcel_name: r.parcels?.bloc_fizic ?? null,
        parcel_surface: r.parcels?.surface ?? null,
        machine_name: r.machine_id ? (machineMap.get(r.machine_id) ?? null) : null,
      })))
    }
    setLoading(false)
  }

  async function toggleExpand(workOrderId: string) {
    if (expandedId === workOrderId) { setExpandedId(null); return }
    setExpandedId(workOrderId)
    if (inputsCache.has(workOrderId)) return
    const { data } = await createClient().from('work_order_inputs').select('*').eq('work_order_id', workOrderId).order('created_at')
    setInputsCache(m => new Map(m).set(workOrderId, (data ?? []) as WorkOrderInput[]))
  }

  async function saveInput(workOrderId: string) {
    if (!addInputForm.product_name.trim() || !addInputForm.quantity) return
    setSavingInput(true)
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) { setSavingInput(false); return }
    const { data, error } = await db.from('work_order_inputs').insert({
      user_id: user.id,
      work_order_id: workOrderId,
      input_type: addInputForm.input_type,
      product_name: addInputForm.product_name.trim(),
      quantity: parseFloat(addInputForm.quantity),
      unit: addInputForm.unit,
      cost_per_unit: addInputForm.cost_per_unit ? parseFloat(addInputForm.cost_per_unit) : null,
      notes: addInputForm.notes || null,
      lot_id: addInputForm.lot_id || null,
    }).select().single()
    if (error) { toast.error(error.message); setSavingInput(false); return }

    // If a lot was selected, create an OUT stock movement (deducts quantity_available)
    if (addInputForm.lot_id) {
      const mvtErr = await db.from('input_stock_mvt').insert({
        user_id: user.id,
        lot_id: addInputForm.lot_id,
        work_order_id: workOrderId,
        campaign_id: campaign?.id ?? null,
        mvt_type: 'OUT',
        quantity: parseFloat(addInputForm.quantity),
        mvt_date: new Date().toISOString().split('T')[0],
        notes: `Consum campanie: ${addInputForm.product_name.trim()}`,
      }).then(r => r.error)
      if (mvtErr) toast.error(`Input salvat, dar eroare la miscare stoc: ${mvtErr.message}`)
      else {
        // Refresh inventory lots so balances stay up to date
        createClient().from('input_lots').select('id,product_name,unit,category,quantity_available,unit_price').gt('quantity_available', 0).order('product_name')
          .then(({ data: ld }) => { if (ld) setInventoryLots(ld as any[]) })
      }
    }

    setSavingInput(false)
    setInputsCache(m => {
      const n = new Map(m)
      n.set(workOrderId, [...(n.get(workOrderId) ?? []), data as WorkOrderInput])
      return n
    })
    setAddInputForm({ input_type: 'SAMANTA', product_name: '', quantity: '', unit: 'kg', cost_per_unit: '', notes: '', lot_id: '' })
    toast.success('Input adăugat.')
  }

  async function deleteInput(workOrderId: string, inputId: string) {
    // If linked to a lot, insert a reversal IN movement to restore stock
    const cached = inputsCache.get(workOrderId) ?? []
    const inp = cached.find(x => x.id === inputId)
    if (inp?.lot_id) {
      const db = createClient()
      const { data: { user } } = await db.auth.getUser()
      if (user) {
        await db.from('input_stock_mvt').insert({
          user_id: user.id,
          lot_id: inp.lot_id,
          work_order_id: workOrderId,
          campaign_id: campaign?.id ?? null,
          mvt_type: 'IN',
          quantity: inp.quantity,
          mvt_date: new Date().toISOString().split('T')[0],
          notes: `Revenire stoc: stergere input campanie`,
        })
        createClient().from('input_lots').select('id,product_name,unit,category,quantity_available,unit_price').gt('quantity_available', 0).order('product_name')
          .then(({ data: ld }) => { if (ld) setInventoryLots(ld as any[]) })
      }
    }
    const { error } = await createClient().from('work_order_inputs').delete().eq('id', inputId)
    if (error) { toast.error(error.message); return }
    setInputsCache(m => {
      const n = new Map(m)
      n.set(workOrderId, (n.get(workOrderId) ?? []).filter(x => x.id !== inputId))
      return n
    })
  }

  useEffect(() => { if (campaign) void loadOrders(campaign) }, [campaign])

  // ── Auto-fill area when parcel changes ──
  useEffect(() => {
    if (form.parcel_id && !editId) {
      const p = parcels.find(x => x.id === form.parcel_id)
      if (p) setForm(f => ({ ...f, area_ha: String(p.surface) }))
    }
  }, [form.parcel_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── KPIs ──
  const total     = orders.length
  const finalizat = orders.filter(o => o.status === 'FINALIZAT').length
  const planificat = orders.filter(o => o.status === 'PLANIFICAT').length
  const areaWorked = orders
    .filter(o => o.status === 'FINALIZAT' || o.status === 'IN_EXECUTIE')
    .reduce((s, o) => s + (o.area_ha ?? 0), 0)

  // ── Filtered rows ──
  const filtered = orders.filter(o => {
    if (filterOp && o.operation_type !== filterOp) return false
    if (filterStatus && o.status !== filterStatus) return false
    if (filterParcel && o.parcel_id !== filterParcel) return false
    return true
  })

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!campaign) return
    setSaving(true)
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) { toast.error('Neautentificat.'); setSaving(false); return }

    const payload = {
      user_id: user.id,
      campaign_id: campaign.id,
      parcel_id: form.parcel_id || null,
      machine_id: form.machine_id || null,
      operation_type: form.operation_type,
      planned_date: form.planned_date || null,
      executed_date: form.executed_date || null,
      area_ha: form.area_ha ? parseFloat(form.area_ha) : null,
      status: form.status,
      notes: form.notes || null,
    }

    let error
    if (editId) {
      ;({ error } = await db.from('work_orders').update(payload).eq('id', editId))
    } else {
      ;({ error } = await db.from('work_orders').insert(payload))
    }

    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success(editId ? 'Activitate actualizată.' : 'Activitate adăugată.')
    setShowForm(false)
    setEditId(null)
    setForm(EMPTY_FORM())
    void loadOrders()
  }

  function startEdit(o: WorkOrder) {
    setForm({
      parcel_id: o.parcel_id ?? '',
      crop_plan_id: o.crop_plan_id,
      machine_id: o.machine_id,
      operation_type: o.operation_type,
      planned_date: o.planned_date,
      executed_date: o.executed_date,
      area_ha: String(o.area_ha ?? ''),
      status: o.status,
      notes: o.notes,
    })
    setEditId(o.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleDelete(id: string) {
    const { error } = await createClient().from('work_orders').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Activitate ștearsă.')
    setOrders(o => o.filter(x => x.id !== id))
  }

  const inputCls = 'w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500'
  const labelCls = 'block text-xs font-medium text-gray-700 mb-1'

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <PageHeader
          title={campaign ? campaign.name : `Campania ${yearParam}`}
          subtitle="Activități câmp — lucrări planificate și executate"
        />
        <CampaignSelector
          className="mt-1"
          onChange={c => { if (c && c.year !== yearParam) router.push(`/campanie/${c.year}/activitati`) }}
        />
      </div>

      <CampaignTabs year={yearParam} />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total activități', value: total },
          { label: 'Finalizate', value: finalizat },
          { label: 'Planificate', value: planificat },
          { label: 'Ha lucrate', value: `${areaWorked.toFixed(2)} ha` },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xl font-bold text-gray-800">{k.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <form onSubmit={e => void handleSave(e)} className="bg-white rounded-lg border border-brand-200 p-5 mb-5 space-y-4">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-gray-700">
              {editId ? 'Editează activitate' : 'Activitate nouă'}
            </p>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY_FORM()) }}
              className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Parcelă</label>
              <select className={inputCls} value={form.parcel_id}
                onChange={e => setForm(f => ({ ...f, parcel_id: e.target.value }))}>
                <option value="">— Toate parcelele —</option>
                {parcels.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.bloc_fizic ?? p.id.slice(0, 8)}{p.locality ? ` — ${p.locality}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Utilaj</label>
              <select className={inputCls} value={form.machine_id ?? ''}
                onChange={e => setForm(f => ({ ...f, machine_id: e.target.value || null }))}>
                <option value="">— Fără utilaj —</option>
                {machines.map(m => <option key={m.id} value={m.id}>{m.name} ({m.type})</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Tip operație *</label>
              <select className={inputCls} required value={form.operation_type}
                onChange={e => setForm(f => ({ ...f, operation_type: e.target.value }))}>
                {OPERATION_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Status *</label>
              <select className={inputCls} value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as WorkOrder['status'] }))}>
                {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Dată planificată</label>
              <input className={inputCls} type="date" value={form.planned_date ?? ''}
                onChange={e => setForm(f => ({ ...f, planned_date: e.target.value || null }))} />
            </div>
            <div>
              <label className={labelCls}>Dată executată</label>
              <input className={inputCls} type="date" value={form.executed_date ?? ''}
                onChange={e => setForm(f => ({ ...f, executed_date: e.target.value || null }))} />
            </div>
            <div>
              <label className={labelCls}>Suprafață lucrată (ha)</label>
              <input className={inputCls} type="number" step="0.01" min="0" placeholder="ha"
                value={form.area_ha}
                onChange={e => setForm(f => ({ ...f, area_ha: e.target.value }))} />
            </div>
            <div className="col-span-2 md:col-span-3">
              <label className={labelCls}>Observații</label>
              <input className={inputCls} placeholder="Observații opționale..." value={form.notes ?? ''}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value || null }))} />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-sm bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-50">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              {editId ? 'Actualizează' : 'Salvează'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY_FORM()) }}
              className="px-4 py-2 text-sm border border-gray-300 text-gray-600 rounded hover:bg-gray-50">
              Anulează
            </button>
          </div>
        </form>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {!showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-600 text-white rounded-lg hover:bg-brand-700">
            <Plus className="w-4 h-4" /> Activitate nouă
          </button>
        )}
        <select className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={filterOp} onChange={e => setFilterOp(e.target.value)}>
          <option value="">Toate operațiile</option>
          {OPERATION_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Toate statusurile</option>
          {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={filterParcel} onChange={e => setFilterParcel(e.target.value)}>
          <option value="">Toate parcelele</option>
          {parcels.map(p => (
            <option key={p.id} value={p.id}>{p.bloc_fizic ?? p.id.slice(0, 8)}</option>
          ))}
        </select>
        {(filterOp || filterStatus || filterParcel) && (
          <button onClick={() => { setFilterOp(''); setFilterStatus(''); setFilterParcel('') }}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 px-2">
            <X className="w-3 h-3" /> Resetează filtre
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-medium uppercase tracking-wide">
              <th className="px-4 py-3 text-left">Operație</th>
              <th className="px-4 py-3 text-left">Parcelă</th>
              <th className="px-4 py-3 text-left">Utilaj</th>
              <th className="px-4 py-3 text-left">Dată planif.</th>
              <th className="px-4 py-3 text-left">Dată exec.</th>
              <th className="px-4 py-3 text-right">Suprafață</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-left">Observații</th>
              <th className="px-4 py-3 text-center">Acțiuni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />Încărcare...
              </td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                {orders.length === 0 ? 'Nicio activitate înregistrată pentru această campanie.' : 'Niciun rezultat pentru filtrele aplicate.'}
              </td></tr>
            )}
            {!loading && filtered.map(o => {
              const st = statusInfo(o.status)
              const opCls = OP_COLORS[o.operation_type] ?? 'bg-gray-100 text-gray-600'
              return (
                <React.Fragment key={o.id}>
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${opCls}`}>
                      {opLabel(o.operation_type)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {o.parcel_name ?? <span className="text-gray-400 italic">—</span>}
                    {o.parcel_surface && (
                      <span className="text-xs text-gray-400 ml-1">({o.parcel_surface} ha)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {o.machine_name ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(o.planned_date)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{fmtDate(o.executed_date)}</td>
                  <td className="px-4 py-3 text-right text-gray-700">
                    {o.area_ha != null ? `${o.area_ha} ha` : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${st.cls}`}>{st.label}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[180px] truncate" title={o.notes ?? ''}>
                    {o.notes || '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => void toggleExpand(o.id)}
                        className={`p-1.5 rounded transition-colors ${expandedId === o.id ? 'text-brand-600 bg-brand-50' : 'text-gray-400 hover:text-brand-600'}`}
                        title="Inputuri / materiale">
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${expandedId === o.id ? 'rotate-90' : ''}`} />
                      </button>
                      <button onClick={() => startEdit(o)}
                        className="p-1.5 text-gray-400 hover:text-brand-600 rounded" title="Editează">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => void handleDelete(o.id)}
                        className="p-1.5 text-gray-400 hover:text-red-500 rounded" title="Șterge">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>

                {/* ── Inputs sub-row ── */}
                {expandedId === o.id && (
                  <tr key={o.id + '_inputs'} className="bg-gray-50">
                    <td colSpan={9} className="px-6 py-3">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Materiale / Inputuri consumate</div>
                      {(inputsCache.get(o.id) ?? []).length > 0 && (
                        <table className="w-full text-xs mb-3">
                          <thead>
                            <tr className="text-gray-400 border-b border-gray-200">
                              <th className="text-left py-1 pr-3">Tip</th>
                              <th className="text-left py-1 pr-3">Produs</th>
                              <th className="text-right py-1 pr-3">Cantitate</th>
                              <th className="text-right py-1 pr-3">Preț/UM</th>
                              <th className="text-right py-1 pr-3">Total</th>
                              <th className="py-1"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {(inputsCache.get(o.id) ?? []).map(inp => (
                              <tr key={inp.id} className="border-b border-gray-100">
                                <td className="py-1 pr-3 text-gray-500">{INPUT_TYPES.find(t => t.value === inp.input_type)?.label ?? inp.input_type}</td>
                                <td className="py-1 pr-3 font-medium text-gray-700">
                                  {inp.product_name}
                                  {inp.lot_id && <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">stoc</span>}
                                </td>
                                <td className="py-1 pr-3 text-right">{inp.quantity} {inp.unit}</td>
                                <td className="py-1 pr-3 text-right">{inp.cost_per_unit != null ? `${inp.cost_per_unit} RON/${inp.unit}` : '—'}</td>
                                <td className="py-1 pr-3 text-right font-semibold">
                                  {inp.cost_per_unit != null ? `${(inp.quantity * inp.cost_per_unit).toFixed(2)} RON` : '—'}
                                </td>
                                <td className="py-1">
                                  <button onClick={() => void deleteInput(o.id, inp.id)} className="text-gray-300 hover:text-red-500"><X className="w-3 h-3" /></button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      {/* Add input form */}
                      <div className="flex flex-wrap items-end gap-2 pt-1">
                        {/* Lot selector — picks from inventory */}
                        {inventoryLots.length > 0 && (
                          <select
                            className="text-xs border border-brand-300 rounded px-2 py-1 bg-brand-50 text-brand-700 min-w-[140px]"
                            value={addInputForm.lot_id}
                            onChange={e => {
                              const lot = inventoryLots.find(l => l.id === e.target.value)
                              if (lot) {
                                const catToType: Record<string,string> = { SEED:'SAMANTA', FERTILIZER:'INGRASAMANT', PPP:'ERBICID', FUEL:'CARBURANT', OTHER:'ALTELE' }
                                setAddInputForm(f => ({ ...f, lot_id: lot.id, product_name: lot.product_name, unit: lot.unit, input_type: catToType[lot.category] ?? 'ALTELE', cost_per_unit: lot.unit_price != null ? String(lot.unit_price) : f.cost_per_unit }))
                              } else {
                                setAddInputForm(f => ({ ...f, lot_id: '' }))
                              }
                            }}>
                            <option value="">+ Din inventar</option>
                            {inventoryLots.map(l => (
                              <option key={l.id} value={l.id}>{l.product_name} ({l.quantity_available} {l.unit})</option>
                            ))}
                          </select>
                        )}
                        <select className="text-xs border border-gray-300 rounded px-2 py-1"
                          value={addInputForm.input_type} onChange={e => setAddInputForm(f => ({ ...f, input_type: e.target.value }))}>
                          {INPUT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                        <input className="text-xs border border-gray-300 rounded px-2 py-1 w-32" placeholder="Produs *"
                          value={addInputForm.product_name} onChange={e => setAddInputForm(f => ({ ...f, product_name: e.target.value }))} />
                        <input className="text-xs border border-gray-300 rounded px-2 py-1 w-16" placeholder="Cant. *" type="number" step="0.01"
                          value={addInputForm.quantity} onChange={e => setAddInputForm(f => ({ ...f, quantity: e.target.value }))} />
                        <select className="text-xs border border-gray-300 rounded px-2 py-1"
                          value={addInputForm.unit} onChange={e => setAddInputForm(f => ({ ...f, unit: e.target.value }))}>
                          {['kg','L','t','buc'].map(u => <option key={u}>{u}</option>)}
                        </select>
                        <input className="text-xs border border-gray-300 rounded px-2 py-1 w-24" placeholder="Pret/UM (RON)" type="number" step="0.01"
                          value={addInputForm.cost_per_unit} onChange={e => setAddInputForm(f => ({ ...f, cost_per_unit: e.target.value }))} />
                        <button onClick={() => void saveInput(o.id)} disabled={savingInput}
                          className="flex items-center gap-1 text-xs px-2.5 py-1 bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-50">
                          {savingInput ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />} Adauga
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {!loading && orders.length > 0 && (
        <div className="mt-3 text-xs text-gray-400 text-right">
          {filtered.length} activități{filtered.length !== orders.length ? ` (din ${orders.length} total)` : ''}
        </div>
      )}
    </div>
  )
}
