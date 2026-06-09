'use client'

export const runtime = 'edge'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { CampaignSelector } from '@/components/CampaignSelector'
import { toast } from 'sonner'
import {
  Plus, Pencil, Check, X, ChevronDown, Wheat, Loader2,
  MapPin, TrendingUp, BarChart3, Leaf, ArrowDownToLine,
} from 'lucide-react'
import type { Campaign, CropPlan } from '@/lib/campaign-types'

// ─── Constants ────────────────────────────────────────────────────────────────

const CROP_OPTIONS = [
  'Grâu', 'Porumb', 'Floarea-soarelui', 'Rapiță', 'Soia',
  'Orz', 'Ovăz', 'Secară', 'Triticale', 'Sfeclă de zahăr',
  'Lucernă', 'Mazăre', 'Fasole', 'In', 'Cânepă', 'Alte culturi',
]

const STATUS_OPTS: { value: CropPlan['status']; label: string; cls: string }[] = [
  { value: 'PLANIFICAT',   label: 'Planificat',   cls: 'bg-blue-100 text-blue-700' },
  { value: 'IN_PRODUCTIE', label: 'În producție', cls: 'bg-amber-100 text-amber-700' },
  { value: 'RECOLTAT',     label: 'Recoltat',     cls: 'bg-green-100 text-green-700' },
  { value: 'ABANDONAT',    label: 'Abandonat',    cls: 'bg-red-100 text-red-500' },
]

const CROP_COLORS: Record<string, string> = {
  'Grâu':              'text-amber-700',
  'Porumb':            'text-yellow-600',
  'Floarea-soarelui':  'text-orange-600',
  'Rapiță':            'text-green-700',
  'Soia':              'text-lime-700',
  'Orz':               'text-teal-700',
  'Ovăz':              'text-blue-700',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Parcel {
  id: string
  bloc_fizic: string | null
  tarla_nr: string | null
  parcel_nr: string | null
  locality: string | null
  county: string | null
  surface: number
  status: string
  culture: string | null
}

interface HarvestLot {
  id: string
  parcel_id: string
  crop_plan_id: string | null
  crop: string
  harvested_date: string | null
  area_harvested_ha: number | null
  yield_t_ha: number | null
  total_quantity_t: number | null
  moisture_pct: number | null
  notes: string | null
}

interface Row extends Parcel {
  plan: CropPlan | null
  harvest: HarvestLot | null
}

interface EditState {
  parcel_id: string
  crop: string
  planned_area_ha: string
  seed_variety: string
  planned_yield_t_ha: string
  status: CropPlan['status']
  notes: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function CampaignTabs({ year }: { year: number }) {
  const pathname = usePathname()
  const isActivitati = pathname.endsWith('/activitati')
  return (
    <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
      <a
        href={`/campanie/${year}`}
        className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
          !isActivitati ? 'bg-white shadow text-brand-700 font-medium' : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        Planuri culturi
      </a>
      <a
        href={`/campanie/${year}/activitati`}
        className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
          isActivitati ? 'bg-white shadow text-brand-700 font-medium' : 'text-gray-500 hover:text-gray-700'
        }`}
      >
        Activități câmp
      </a>
    </div>
  )
}

function statusInfo(s: CropPlan['status']) {
  return STATUS_OPTS.find(o => o.value === s) ?? STATUS_OPTS[0]
}

function ha(n: number | null | undefined) {
  return n != null ? `${n.toFixed(2)} ha` : '—'
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CampaniePage() {
  const params = useParams()
  const router = useRouter()
  const yearParam = Number(params.year)

  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<EditState | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [harvesting, setHarvesting] = useState<string | null>(null)  // parcel_id being harvested
  const [harvestForm, setHarvestForm] = useState({ harvested_date: '', area_ha: '', yield_t_ha: '', notes: '' })
  const [savingHarvest, setSavingHarvest] = useState(false)

  // ── Load campaign for this year ──
  const loadCampaign = useCallback(async () => {
    const db = createClient()
    const { data } = await db
      .from('campaigns')
      .select('*')
      .eq('year', yearParam)
      .maybeSingle()
    if (data) setCampaign(data as Campaign)
    else {
      toast.error(`Nu există campania pentru anul ${yearParam}.`)
    }
  }, [yearParam])

  // ── Load parcels + their crop plans for this campaign ──
  const loadRows = useCallback(async (cam?: Campaign | null) => {
    const c = cam ?? campaign
    if (!c) return
    setLoading(true)
    const db = createClient()
    const [{ data: parcels }, { data: plans }, { data: harvests }] = await Promise.all([
      db.from('parcels').select('id,bloc_fizic,tarla_nr,parcel_nr,locality,county,surface,status,culture').eq('status', 'ACTIVE').order('bloc_fizic'),
      db.from('crop_plans').select('*').eq('campaign_id', c.id),
      db.from('harvest_lots').select('*').eq('campaign_id', c.id),
    ])
    const planMap    = new Map((plans    ?? []).map(p => [p.parcel_id, p as CropPlan]))
    const harvestMap = new Map((harvests ?? []).map(h => [h.parcel_id, h as HarvestLot]))
    setRows((parcels ?? []).map(p => ({
      ...(p as Parcel),
      plan:    planMap.get(p.id)    ?? null,
      harvest: harvestMap.get(p.id) ?? null,
    })))
    setLoading(false)
  }, [campaign])

  useEffect(() => {
    void loadCampaign().then(loadRows as any)
  }, [yearParam]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-load rows whenever campaign is set
  useEffect(() => {
    if (campaign) void loadRows(campaign)
  }, [campaign, loadRows])

  // ── KPIs ──
  const totalHa     = rows.reduce((s, r) => s + r.surface, 0)
  const plannedRows = rows.filter(r => r.plan)
  const plannedHa   = plannedRows.reduce((s, r) => s + (r.plan!.planned_area_ha ?? r.surface), 0)
  const recoltate   = rows.filter(r => r.harvest != null).length

  const filtered = rows.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      r.bloc_fizic?.toLowerCase().includes(q) ||
      r.locality?.toLowerCase().includes(q) ||
      r.plan?.crop?.toLowerCase().includes(q) ||
      false
    )
  })

  // ── Edit helpers ──
  function startEdit(row: Row) {
    setEditing({
      parcel_id: row.id,
      crop: row.plan?.crop ?? row.culture ?? CROP_OPTIONS[0],
      planned_area_ha: String(row.plan?.planned_area_ha ?? row.surface ?? ''),
      seed_variety: row.plan?.seed_variety ?? '',
      planned_yield_t_ha: String(row.plan?.planned_yield_t_ha ?? ''),
      status: row.plan?.status ?? 'PLANIFICAT',
      notes: row.plan?.notes ?? '',
    })
  }

  async function savePlan() {
    if (!editing || !campaign) return
    setSaving(true)
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) { toast.error('Neautentificat.'); setSaving(false); return }

    const payload = {
      user_id: user.id,
      campaign_id: campaign.id,
      parcel_id: editing.parcel_id,
      crop: editing.crop,
      planned_area_ha: editing.planned_area_ha ? parseFloat(editing.planned_area_ha) : null,
      seed_variety: editing.seed_variety || null,
      planned_yield_t_ha: editing.planned_yield_t_ha ? parseFloat(editing.planned_yield_t_ha) : null,
      status: editing.status,
      notes: editing.notes || null,
    }

    const { error } = await db
      .from('crop_plans')
      .upsert(payload, { onConflict: 'campaign_id,parcel_id' })

    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Plan de cultură salvat.')
    setEditing(null)
    void loadRows()
  }

  function startHarvest(row: Row) {
    setEditing(null)
    setHarvesting(row.id)
    setHarvestForm({
      harvested_date: new Date().toISOString().split('T')[0],
      area_ha: String(row.plan?.planned_area_ha ?? row.surface ?? ''),
      yield_t_ha: String(row.plan?.planned_yield_t_ha ?? ''),
      notes: '',
    })
  }

  async function saveHarvest(row: Row) {
    if (!campaign) return
    setSavingHarvest(true)
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) { toast.error('Neautentificat.'); setSavingHarvest(false); return }
    const payload = {
      user_id: user.id,
      campaign_id: campaign.id,
      parcel_id: row.id,
      crop_plan_id: row.plan?.id ?? null,
      crop: row.plan?.crop ?? row.culture ?? '',
      harvested_date: harvestForm.harvested_date || null,
      area_harvested_ha: harvestForm.area_ha ? parseFloat(harvestForm.area_ha) : null,
      yield_t_ha: harvestForm.yield_t_ha ? parseFloat(harvestForm.yield_t_ha) : null,
      moisture_pct: null,
      notes: harvestForm.notes || null,
    }
    const { error } = await db.from('harvest_lots').upsert(payload, { onConflict: 'campaign_id,parcel_id' })
    if (!error && row.plan) {
      await db.from('crop_plans').update({ status: 'RECOLTAT' }).eq('id', row.plan.id)
    }
    setSavingHarvest(false)
    if (error) { toast.error(error.message); return }
    toast.success('Recoltare înregistrată!')
    setHarvesting(null)
    void loadRows()
  }

  async function deletePlan(parcelId: string) {
    if (!campaign) return
    const { error } = await createClient()
      .from('crop_plans')
      .delete()
      .eq('campaign_id', campaign.id)
      .eq('parcel_id', parcelId)
    if (error) { toast.error(error.message); return }
    toast.success('Plan de cultură șters.')
    setRows(r => r.map(row => row.id === parcelId ? { ...row, plan: null } : row))
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <PageHeader
          title={campaign ? campaign.name : `Campania ${yearParam}`}
          subtitle={campaign
            ? `${campaign.start_date ? new Date(campaign.start_date).toLocaleDateString('ro-RO') : ''} — ${campaign.end_date ? new Date(campaign.end_date).toLocaleDateString('ro-RO') : ''}`
            : 'Plan de culturi per parcelă'}
        />
        <CampaignSelector
          className="mt-1"
          onChange={c => {
            if (c && c.year !== yearParam) {
              router.push(`/campanie/${c.year}`)
            }
          }}
        />
      </div>

      <CampaignTabs year={yearParam} />

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total parcele', value: rows.length, icon: MapPin, color: 'text-brand-600' },
          { label: 'Suprafață totală', value: `${totalHa.toFixed(2)} ha`, icon: Leaf, color: 'text-green-600' },
          { label: 'Parcele planificate', value: `${plannedRows.length} / ${rows.length}`, icon: Wheat, color: 'text-amber-600' },
          { label: 'Recoltat', value: recoltate, icon: TrendingUp, color: 'text-teal-600' },
        ].map(k => (
          <div key={k.label} className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-3">
            <k.icon className={`w-8 h-8 ${k.color}`} />
            <div>
              <div className="text-xl font-bold text-gray-800">{k.value}</div>
              <div className="text-xs text-gray-500">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + planned % bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <input
            className="w-full pl-3 pr-8 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="Caută parcelă, cultură..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {rows.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-brand-500 rounded-full transition-all"
                style={{ width: `${(plannedHa / totalHa) * 100}%` }}
              />
            </div>
            <span>{((plannedHa / totalHa) * 100 || 0).toFixed(0)}% planificat</span>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200 text-xs text-gray-500 font-medium uppercase tracking-wide">
              <th className="px-4 py-3 text-left">Parcelă</th>
              <th className="px-4 py-3 text-left">Localizare</th>
              <th className="px-4 py-3 text-right">Suprafață</th>
              <th className="px-4 py-3 text-left">Cultură planificată</th>
              <th className="px-4 py-3 text-left">Soi / Varietate</th>
              <th className="px-4 py-3 text-right">Plan / Recoltat</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Acțiuni</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin inline-block mr-2" />Încarcare...
              </td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                {rows.length === 0 ? 'Nu există parcele active în registru.' : 'Niciun rezultat pentru filtrul aplicat.'}
              </td></tr>
            )}
            {!loading && filtered.map(row => {
              const isEditing = editing?.parcel_id === row.id
              const st = row.plan ? statusInfo(row.plan.status) : null

              if (isEditing) {
                return (
                  <tr key={row.id} className="bg-brand-50">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      {row.bloc_fizic ?? row.id.slice(0, 8)}
                      {row.tarla_nr && <span className="text-xs text-gray-400 ml-1">T{row.tarla_nr}</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{row.locality}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{ha(row.surface)}</td>
                    <td className="px-4 py-2">
                      <select
                        className="w-full text-sm border border-brand-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        value={editing.crop}
                        onChange={e => setEditing(p => p && ({ ...p, crop: e.target.value }))}
                      >
                        {CROP_OPTIONS.map(c => <option key={c}>{c}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        placeholder="Soi / varietate"
                        value={editing.seed_variety}
                        onChange={e => setEditing(p => p && ({ ...p, seed_variety: e.target.value }))}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <input
                        className="w-24 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500 text-right"
                        type="number"
                        step="0.1"
                        placeholder="t/ha"
                        value={editing.planned_yield_t_ha}
                        onChange={e => setEditing(p => p && ({ ...p, planned_yield_t_ha: e.target.value }))}
                      />
                    </td>
                    <td className="px-4 py-2">
                      <select
                        className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        value={editing.status}
                        onChange={e => setEditing(p => p && ({ ...p, status: e.target.value as CropPlan['status'] }))}
                      >
                        {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => void savePlan()}
                          disabled={saving}
                          className="p-1.5 bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-50"
                          title="Salvează"
                        >
                          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="p-1.5 text-gray-500 hover:text-gray-700 border border-gray-300 rounded"
                          title="Anulează"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              }

              if (harvesting === row.id) {
                return (
                  <tr key={row.id + '_harvest'} className="bg-green-50">
                    <td colSpan={8} className="px-4 py-4">
                      <div className="flex flex-wrap items-end gap-3">
                        <div className="text-xs font-semibold text-green-700 w-full mb-1">
                          Înregistrează recoltare — {row.bloc_fizic ?? ''} {row.plan?.crop ? `· ${row.plan.crop}` : ''}
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Dată recoltare</label>
                          <input type="date" className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-500"
                            value={harvestForm.harvested_date}
                            onChange={e => setHarvestForm(f => ({ ...f, harvested_date: e.target.value }))} />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Suprafață recoltată (ha)</label>
                          <input type="number" step="0.01" min="0" className="w-24 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-500"
                            value={harvestForm.area_ha}
                            onChange={e => setHarvestForm(f => ({ ...f, area_ha: e.target.value }))} />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-600 mb-1">Producție reală (t/ha)</label>
                          <input type="number" step="0.1" min="0" className="w-24 text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-500"
                            value={harvestForm.yield_t_ha}
                            onChange={e => setHarvestForm(f => ({ ...f, yield_t_ha: e.target.value }))} />
                        </div>
                        <div className="flex-1 min-w-[140px]">
                          <label className="block text-xs text-gray-600 mb-1">Observații</label>
                          <input type="text" className="w-full text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-500"
                            placeholder="Opțional..."
                            value={harvestForm.notes}
                            onChange={e => setHarvestForm(f => ({ ...f, notes: e.target.value }))} />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => void saveHarvest(row)} disabled={savingHarvest}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50">
                            {savingHarvest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                            Salvează
                          </button>
                          <button onClick={() => setHarvesting(null)}
                            className="px-3 py-1.5 text-sm border border-gray-300 text-gray-600 rounded hover:bg-gray-50">
                            Anulează
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              }

              return (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {row.bloc_fizic ?? row.id.slice(0, 8)}
                    {row.tarla_nr && <span className="text-xs text-gray-400 ml-1">T{row.tarla_nr}</span>}
                    {row.parcel_nr && <span className="text-xs text-gray-400 ml-0.5">· P{row.parcel_nr}</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{[row.locality, row.county].filter(Boolean).join(', ')}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{ha(row.surface)}</td>
                  <td className="px-4 py-3">
                    {row.plan ? (
                      <span className={`font-medium ${CROP_COLORS[row.plan.crop] ?? 'text-gray-700'}`}>
                        {row.plan.crop}
                        {row.plan.planned_area_ha && row.plan.planned_area_ha !== row.surface && (
                          <span className="text-xs text-gray-400 ml-1">({ha(row.plan.planned_area_ha)})</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-gray-300 italic">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{row.plan?.seed_variety ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-xs">
                    {row.plan?.planned_yield_t_ha
                      ? <span className="text-gray-400">{row.plan.planned_yield_t_ha} t/ha</span>
                      : <span className="text-gray-300">—</span>}
                    {row.harvest?.yield_t_ha != null && (
                      <div className="text-green-600 font-medium">{row.harvest.yield_t_ha} t/ha ✓</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {st ? (
                      <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${st.cls}`}>{st.label}</span>
                    ) : (
                      <span className="text-gray-300 text-xs">Neplanificat</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => startEdit(row)}
                        className="p-1.5 text-gray-400 hover:text-brand-600 rounded transition-colors"
                        title="Editează plan"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {row.plan && (
                        <button
                          onClick={() => startHarvest(row)}
                          className="p-1.5 text-gray-400 hover:text-green-600 rounded transition-colors"
                          title="Înregistrează recoltare"
                        >
                          <ArrowDownToLine className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {row.plan && (
                        <button
                          onClick={() => void deletePlan(row.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                          title="Șterge plan"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Summary footer */}
      {!loading && rows.length > 0 && (
        <div className="mt-3 text-xs text-gray-400 text-right">
          {plannedRows.length} din {rows.length} parcele planificate · {plannedHa.toFixed(2)} ha din {totalHa.toFixed(2)} ha totale
        </div>
      )}
    </div>
  )
}
