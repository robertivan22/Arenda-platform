'use client'

export const runtime = 'edge'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  FolderOpen, Plus, ChevronRight, CheckCircle2, AlertCircle,
  Clock, Archive, Loader2, FileText, Wheat, BarChart3, RefreshCw, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import type { ApiaDossier } from '@/lib/apia/types'
import { DOSSIER_STATUS_CFG } from '@/lib/apia/interventions'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DossierRow extends ApiaDossier {
  parcel_count?: number
  real_declared_ha?: number
  intervention_count?: number
  doc_missing_count?: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2]

function StatusBadge({ status }: { status: string }) {
  const cfg = DOSSIER_STATUS_CFG[status] ?? DOSSIER_STATUS_CFG.DRAFT
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

function completenessColor(pct: number) {
  if (pct >= 90) return 'bg-green-500'
  if (pct >= 60) return 'bg-yellow-400'
  return 'bg-red-400'
}

// ─── Create dossier modal ─────────────────────────────────────────────────────

function CreateDossierModal({
  year,
  onClose,
  onCreated,
}: {
  year: number
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [agiNumber, setAgiNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [importParcels, setImportParcels] = useState(true)
  const [saving, setSaving] = useState(false)

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) { toast.error('Neautentificat'); setSaving(false); return }

    // Create dossier
    const { data: dossier, error } = await db
      .from('apia_dossiers')
      .insert({
        user_id: user.id,
        campaign_year: year,
        agi_dossier_number: agiNumber.trim() || null,
        notes: notes.trim() || null,
        status: 'DRAFT',
      })
      .select()
      .single()

    if (error || !dossier) {
      toast.error(error?.message ?? 'Eroare la creare dosar')
      setSaving(false)
      return
    }

    // Auto-import APIA-eligible parcels
    if (importParcels) {
      const { data: parcels } = await db
        .from('parcels')
        .select('id, tarla_nr, parcel_nr, bloc_fizic, surface, surface_rented, land_use_category, county, locality, siruta_code, contract_id')
        .eq('user_id', user.id)
        .eq('apia_eligible', true)

      if (parcels && parcels.length > 0) {
        const rows = parcels.map(p => ({
          user_id: user.id,
          dossier_id: dossier.id,
          parcel_id: p.id,
          lpis_block_code: (p as Record<string, unknown>).bloc_fizic as string ?? null,
          tarla_nr: (p as Record<string, unknown>).tarla_nr as string ?? null,
          parcel_nr: (p as Record<string, unknown>).parcel_nr as string ?? null,
          county: (p as Record<string, unknown>).county as string ?? null,
          locality: (p as Record<string, unknown>).locality as string ?? null,
          siruta_code: (p as Record<string, unknown>).siruta_code as string ?? null,
          declared_surface_ha: ((p as Record<string, unknown>).surface_rented ?? (p as Record<string, unknown>).surface ?? 0) as number,
          land_use_code: mapLandUseCategory((p as Record<string, unknown>).land_use_category as string),
        }))
        await db.from('apia_dossier_parcels').insert(rows)
      }
    }

    // Audit
    await db.from('apia_audit_log').insert({
      user_id: user.id,
      dossier_id: dossier.id,
      action: 'CREATE_DOSSIER',
      new_value: { campaign_year: year },
    })

    toast.success(`Dosar APIA ${year} creat${importParcels ? ' cu parcele importate automat' : ''}`)
    setSaving(false)
    onCreated(dossier.id)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">
          Creare Dosar APIA {year}
        </h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Nr. Dosar AGI Online <span className="text-gray-400">(opțional — completați după depunere)</span>
            </label>
            <input
              className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="ex. 2026/PH/12345"
              value={agiNumber}
              onChange={e => setAgiNumber(e.target.value)}
            />
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={importParcels}
                onChange={e => setImportParcels(e.target.checked)}
                className="rounded accent-brand-600"
              />
              <span>Importă automat parcelele APIA-eligibile din registru</span>
            </label>
            <p className="text-xs text-gray-400 mt-0.5 ml-5">
              Parcelele cu „Eligibil APIA" activ și bloc fizic completat
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Observații</label>
            <textarea
              className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded font-medium disabled:opacity-50"
            >
              {saving ? 'Se creează...' : 'Creează dosarul'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50"
            >
              Anulează
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Land use category mapper ────────────────────────────────────────────────

function mapLandUseCategory(cat: string | null | undefined): string {
  if (!cat) return 'AR'
  const lc = cat.toLowerCase()
  if (lc.includes('arabil')) return 'AR'
  if (lc.includes('pășune') || lc.includes('pasune')) return 'PS'
  if (lc.includes('fânețe') || lc.includes('fanete')) return 'FN'
  if (lc.includes('livadă') || lc.includes('livada')) return 'LV'
  if (lc.includes('vie')) return 'VI'
  return 'AL'
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ApiaPage() {
  const router = useRouter()
  const [year, setYear] = useState(CURRENT_YEAR)
  const [dossiers, setDossiers] = useState<DossierRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const loadDossiers = useCallback(async () => {
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return

    const { data } = await db
      .from('apia_dossiers')
      .select('*')
      .eq('user_id', user.id)
      .eq('campaign_year', year)
      .order('created_at', { ascending: false })

    if (!data) { setLoading(false); return }

    // Fetch counts per dossier
    const ids = data.map(d => d.id)
    const [parcelRes, interventionRes, docRes] = await Promise.all([
      ids.length
        ? db.from('apia_dossier_parcels').select('dossier_id, declared_surface_ha').in('dossier_id', ids)
        : { data: [] },
      ids.length
        ? db.from('apia_dossier_interventions').select('dossier_id', { count: 'exact', head: false }).in('dossier_id', ids)
        : { data: [] },
      ids.length
        ? db.from('apia_dossier_documents').select('dossier_id, status').in('dossier_id', ids)
        : { data: [] },
    ])

    const parcelCount = new Map<string, number>()
    const parcelHa = new Map<string, number>()
    const interventionCount = new Map<string, number>()
    const missingDocCount = new Map<string, number>()

    for (const r of (parcelRes.data ?? [])) {
      const rec = r as Record<string, unknown>
      const k = rec.dossier_id as string
      parcelCount.set(k, (parcelCount.get(k) ?? 0) + 1)
      parcelHa.set(k, (parcelHa.get(k) ?? 0) + (Number(rec.declared_surface_ha) || 0))
    }
    for (const r of (interventionRes.data ?? [])) {
      const k = (r as Record<string, unknown>).dossier_id as string
      interventionCount.set(k, (interventionCount.get(k) ?? 0) + 1)
    }
    for (const r of (docRes.data ?? [])) {
      const rec = r as Record<string, unknown>
      if (rec.status === 'MISSING') {
        const k = rec.dossier_id as string
        missingDocCount.set(k, (missingDocCount.get(k) ?? 0) + 1)
      }
    }

    setDossiers(
      data.map(d => ({
        ...(d as ApiaDossier),
        parcel_count: parcelCount.get(d.id) ?? 0,
        real_declared_ha: parcelHa.get(d.id) ?? 0,
        intervention_count: interventionCount.get(d.id) ?? 0,
        doc_missing_count: missingDocCount.get(d.id) ?? 0,
      })),
    )
    setLoading(false)
  }, [year])

  useEffect(() => { setLoading(true); loadDossiers() }, [loadDossiers])

  async function deleteDossier(id: string) {
    if (!confirm('Sterge dosarul si toate parcelele, interventiile si documentele asociate?\n\nAceasta actiune este ireversibila.')) return
    const db = createClient()
    const { error } = await db.from('apia_dossiers').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Dosar sters'); loadDossiers() }
  }

  // Stats
  const totalHa = dossiers.reduce((s, d) => s + (d.real_declared_ha ?? 0), 0)
  const readyCount = dossiers.filter(d => d.status === 'READY' || d.status === 'SUBMITTED' || d.status === 'ACCEPTED').length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl space-y-5">
      {showCreate && (
        <CreateDossierModal
          year={year}
          onClose={() => setShowCreate(false)}
          onCreated={id => { setShowCreate(false); router.push(`/apia/${id}`) }}
        />
      )}

      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="Dosar APIA"
          subtitle="Gestionarea cererii unice de plată și a dosarului de subvenții agricole"
        />
        <div className="flex items-center gap-2 mt-1">
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="text-sm border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            {YEARS.map(y => (
              <option key={y} value={y}>Campania {y}</option>
            ))}
          </select>
          <button
            onClick={loadDossiers}
            className="p-1.5 border border-gray-200 rounded text-gray-500 hover:text-gray-700"
            title="Reîncarcă"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Dosare', value: dossiers.length, icon: FolderOpen, color: 'text-brand-700' },
          { label: 'Ha declarate', value: totalHa.toFixed(2), icon: Wheat, color: 'text-green-700' },
          { label: 'Gata depunere', value: readyCount, icon: CheckCircle2, color: 'text-blue-700' },
          { label: 'An campanie', value: year, icon: BarChart3, color: 'text-gray-600' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-lg px-4 py-3">
            <div className="flex items-center gap-2">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-xs text-gray-500">{s.label}</span>
            </div>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Campaign info banner ───────────────────────────────────────────── */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-700">
        <strong>Campania {year}:</strong>{' '}
        Completați declarația de suprafețe în <strong>AGI Online</strong>, verificați parcelele față de <strong>LPIS</strong>, și asigurați-vă că documentele de utilizare a terenului sunt valabile la data depunerii.
        {' '}<a href="https://www.apia.org.ro" target="_blank" rel="noopener noreferrer" className="underline font-medium">apia.org.ro →</a>
      </div>

      {/* ── Dossier list ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-3">
          <FolderOpen className="w-4 h-4 text-brand-600" />
          <span className="font-semibold text-sm text-gray-800">
            Dosare campania {year} ({dossiers.length})
          </span>
          <button
            onClick={() => setShowCreate(true)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white rounded font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Dosar nou
          </button>
        </div>

        {dossiers.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <FolderOpen className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="text-sm text-gray-500">Nu există dosare pentru campania {year}.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded font-medium"
            >
              <Plus className="w-4 h-4" />
              Creează primul dosar {year}
            </button>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {dossiers.map(d => {
              const missCount = d.doc_missing_count ?? 0
              const hasWarning = missCount > 0 && d.status !== 'ARCHIVED'

              return (
                <div
                  key={d.id}
                  onClick={() => router.push(`/apia/${d.id}`)}
                  className="px-4 py-3.5 hover:bg-gray-50 cursor-pointer flex items-center gap-4"
                >
                  {/* Status icon */}
                  <div className="shrink-0">
                    {d.status === 'ACCEPTED' ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : d.status === 'ARCHIVED' ? (
                      <Archive className="w-5 h-5 text-gray-400" />
                    ) : hasWarning ? (
                      <AlertCircle className="w-5 h-5 text-yellow-500" />
                    ) : (
                      <Clock className="w-5 h-5 text-blue-500" />
                    )}
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm text-gray-800">
                        Dosar APIA {d.campaign_year}
                      </span>
                      {d.agi_dossier_number && (
                        <span className="text-xs text-gray-500 font-mono">#{d.agi_dossier_number}</span>
                      )}
                      <StatusBadge status={d.status} />
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                      <span><strong className="text-gray-700">{(d.real_declared_ha ?? 0).toFixed(2)}</strong> ha declarate</span>
                      <span><strong className="text-gray-700">{d.parcel_count ?? 0}</strong> parcele</span>
                      <span><strong className="text-gray-700">{d.intervention_count ?? 0}</strong> intervenții</span>
                      {missCount > 0 && (
                        <span className="text-yellow-600 font-medium">
                          <AlertCircle className="w-3 h-3 inline mr-0.5" />
                          {missCount} doc. lipsă
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Submission date */}
                  <div className="text-right shrink-0 hidden sm:block">
                    {d.submission_date ? (
                      <div className="text-xs text-gray-500">
                        <div className="font-medium text-gray-700">{d.submission_date}</div>
                        <div>depus</div>
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400">nedepus</div>
                    )}
                  </div>

                  {/* Delete */}
                  <button
                    onClick={e => { e.stopPropagation(); deleteDossier(d.id) }}
                    className="shrink-0 p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded"
                    title="Sterge dosarul"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Quick links ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            href: '/parcele',
            icon: FileText,
            title: 'Registru Parcele',
            desc: 'Verificați parcelele eligibile APIA și bloc fizic LPIS',
          },
          {
            href: '/parcele/harta',
            icon: FileText,
            title: 'Hartă Parcele',
            desc: 'Vizualizați și editați geometria parcelelor declarate',
          },
          {
            href: '/declaratii/apia',
            icon: FileText,
            title: 'Export CSV APIA',
            desc: 'Export clasic în format CSV pentru Cererea Unică de Plată',
          },
        ].map(l => (
          <a
            key={l.href}
            href={l.href}
            className="bg-white border border-gray-200 rounded-lg p-3 hover:border-brand-400 hover:bg-brand-50 transition-colors group"
          >
            <div className="flex items-center gap-2 mb-1">
              <l.icon className="w-4 h-4 text-brand-600" />
              <span className="text-sm font-medium text-gray-800 group-hover:text-brand-700">{l.title}</span>
            </div>
            <p className="text-xs text-gray-500">{l.desc}</p>
          </a>
        ))}
      </div>
    </div>
  )
}
