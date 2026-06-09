'use client'

export const runtime = 'edge'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  ArrowLeft, Loader2, Save, Plus, Trash2, CheckCircle2, AlertCircle,
  FileText, MapPin, Layers, FilePlus, History, ChevronDown, ExternalLink,
  Edit2, X, CheckCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import type {
  ApiaDossier, ApiaDossierParcel, ApiaDossierIntervention, ApiaDossierDocument,
  ApiaChangeRequest, ApiaAuditLog, ApiaIntervention,
} from '@/lib/apia/types'
import {
  DOSSIER_STATUS_CFG, CHANGE_FORM_META, LAND_USE_LABELS, LAND_RIGHT_LABELS,
  getRequiredDocuments,
} from '@/lib/apia/interventions'

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = DOSSIER_STATUS_CFG[status] ?? DOSSIER_STATUS_CFG.DRAFT
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

function DocStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    MISSING:        'bg-red-100 text-red-600',
    UPLOADED:       'bg-blue-100 text-blue-700',
    VERIFIED:       'bg-green-100 text-green-700',
    EXPIRED:        'bg-orange-100 text-orange-700',
    NOT_APPLICABLE: 'bg-gray-100 text-gray-400',
  }
  const labelMap: Record<string, string> = {
    MISSING: 'Lipsă', UPLOADED: 'Încărcat', VERIFIED: 'Verificat',
    EXPIRED: 'Expirat', NOT_APPLICABLE: 'N/A',
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? map.MISSING}`}>
      {labelMap[status] ?? status}
    </span>
  )
}

// ─── Tab IDs ─────────────────────────────────────────────────────────────────

type TabId = 'sumar' | 'parcele' | 'interventii' | 'documente' | 'modificari' | 'audit'

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'sumar',       label: 'Sumar',        icon: Layers },
  { id: 'parcele',     label: 'Parcele',       icon: MapPin },
  { id: 'interventii', label: 'Intervenții',   icon: CheckCheck },
  { id: 'documente',   label: 'Documente',     icon: FileText },
  { id: 'modificari',  label: 'Modificări',    icon: FilePlus },
  { id: 'audit',       label: 'Audit',         icon: History },
]

// ─── Parcele tab ─────────────────────────────────────────────────────────────

function ParceleTab({
  dossierId,
  userId,
  editable,
}: { dossierId: string; userId: string; editable: boolean }) {
  const [parcels, setParcels] = useState<ApiaDossierParcel[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  const db = createClient()

  const load = useCallback(async () => {
    const { data } = await db
      .from('apia_dossier_parcels')
      .select('*')
      .eq('dossier_id', dossierId)
      .order('created_at')
    setParcels((data ?? []) as ApiaDossierParcel[])
    setLoading(false)
  }, [dossierId, db])

  useEffect(() => { load() }, [load])

  async function removeParcel(id: string) {
    if (!confirm('Șterge parcela din dosar?')) return
    const { error } = await db.from('apia_dossier_parcels').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Parcelă eliminată'); load() }
  }

  const totalHa = parcels.reduce((s, p) => s + p.declared_surface_ha, 0)

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          <strong className="text-gray-800">{parcels.length}</strong> parcele •{' '}
          <strong className="text-gray-800">{totalHa.toFixed(4)}</strong> ha declarate
        </p>
        {editable && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white rounded font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Adaugă parcelă
          </button>
        )}
      </div>

      {showAdd && (
        <AddParcelForm
          dossierId={dossierId}
          userId={userId}
          onClose={() => setShowAdd(false)}
          onAdded={() => { setShowAdd(false); load() }}
        />
      )}

      {parcels.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">
          Nu există parcele adăugate în acest dosar.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-left">
                {['Bloc LPIS', 'Tarlă', 'Parcelă', 'Județ / Localitate', 'Ha declarate', 'Folosință', 'Drept utilizare', 'Valabil până', 'Eligibil', ''].map(h => (
                  <th key={h} className="px-3 py-2 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {parcels.map(p => (
                <tr key={p.id} className={`${p.eligible ? '' : 'bg-red-50'}`}>
                  <td className="px-3 py-2 font-mono">{p.lpis_block_code ?? '—'}</td>
                  <td className="px-3 py-2">{p.tarla_nr ?? '—'}</td>
                  <td className="px-3 py-2">{p.parcel_nr ?? '—'}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {p.county}{p.locality ? ` / ${p.locality}` : ''}
                  </td>
                  <td className="px-3 py-2 font-medium">{Number(p.declared_surface_ha).toFixed(4)}</td>
                  <td className="px-3 py-2">{LAND_USE_LABELS[p.land_use_code ?? ''] ?? p.land_use_code ?? '—'}</td>
                  <td className="px-3 py-2">{LAND_RIGHT_LABELS[p.land_right_type ?? ''] ?? '—'}</td>
                  {(() => {
                    const expired = p.land_right_valid_until
                      ? new Date(p.land_right_valid_until) < new Date()
                      : false
                    return (
                      <td className={`px-3 py-2 ${expired ? 'text-red-600 font-medium' : ''}`}>
                        {p.land_right_valid_until ?? '—'}
                        {expired && ' ⚠️'}
                      </td>
                    )
                  })()}
                  <td className="px-3 py-2">
                    {p.eligible
                      ? <CheckCircle2 className="w-4 h-4 text-green-600" />
                      : <span title={p.ineligible_reason ?? ''}><AlertCircle className="w-4 h-4 text-red-500" /></span>}
                  </td>
                  <td className="px-3 py-2">
                    {editable && (
                      <button onClick={() => removeParcel(p.id)}>
                        <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function AddParcelForm({
  dossierId, userId, onClose, onAdded,
}: { dossierId: string; userId: string; onClose: () => void; onAdded: () => void }) {
  const db = createClient()
  const [parcels, setParcels] = useState<Array<{ id: string; label: string; surface: number }>>([])
  const [selected, setSelected] = useState('')
  const [surfaceHa, setSurfaceHa] = useState('')
  const [landUse, setLandUse] = useState('AR')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    db.from('parcels')
      .select('id, bloc_fizic, tarla_nr, parcel_nr, county, locality, surface, surface_rented, land_use_category')
      .eq('user_id', userId)
      .then(({ data }) => {
        if (!data) return
        setParcels(data.map(p => ({
          id: p.id,
          label: [
            (p as Record<string, unknown>).bloc_fizic,
            `Tarla ${(p as Record<string, unknown>).tarla_nr ?? '?'}`,
            `Parcelă ${(p as Record<string, unknown>).parcel_nr ?? '?'}`,
            (p as Record<string, unknown>).county,
            (p as Record<string, unknown>).locality,
          ].filter(Boolean).join(' | '),
          surface: ((p as Record<string, unknown>).surface_rented ?? (p as Record<string, unknown>).surface ?? 0) as number,
        })))
      })
  }, [db, userId])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setSaving(true)
    const { error } = await db.from('apia_dossier_parcels').insert({
      user_id: userId,
      dossier_id: dossierId,
      parcel_id: selected,
      declared_surface_ha: Number(surfaceHa),
      land_use_code: landUse,
    })
    if (error) toast.error(error.message)
    else { toast.success('Parcelă adăugată'); onAdded() }
    setSaving(false)
  }

  return (
    <form onSubmit={save} className="bg-gray-50 border border-gray-200 rounded p-3 space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Parcelă din registru</label>
        <select
          className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400"
          value={selected}
          onChange={e => {
            setSelected(e.target.value)
            const p = parcels.find(x => x.id === e.target.value)
            if (p) setSurfaceHa(String(p.surface))
          }}
          required
        >
          <option value="">Selectați parcela...</option>
          {parcels.map(p => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
      </div>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">Ha declarate</label>
          <input
            type="number" step="0.0001" min="0"
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400"
            value={surfaceHa}
            onChange={e => setSurfaceHa(e.target.value)}
            required
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-700 mb-1">Folosință</label>
          <select
            className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400"
            value={landUse}
            onChange={e => setLandUse(e.target.value)}
          >
            {Object.entries(LAND_USE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={saving}
          className="px-4 py-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white rounded disabled:opacity-50">
          {saving ? 'Se salvează...' : 'Adaugă'}
        </button>
        <button type="button" onClick={onClose}
          className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-100">
          Anulează
        </button>
      </div>
    </form>
  )
}

// ─── Intervenții tab ─────────────────────────────────────────────────────────

function InterventiiTab({
  dossierId, userId, editable, onInterventionsChange,
}: { dossierId: string; userId: string; editable: boolean; onInterventionsChange: (codes: string[]) => void }) {
  const db = createClient()
  const [catalog, setCatalog] = useState<ApiaIntervention[]>([])
  const [selected, setSelected] = useState<ApiaDossierIntervention[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [catRes, selRes] = await Promise.all([
      db.from('apia_interventions').select('*').eq('is_active', true).order('sort_order'),
      db.from('apia_dossier_interventions')
        .select('*, apia_interventions(*)')
        .eq('dossier_id', dossierId),
    ])
    setCatalog((catRes.data ?? []) as ApiaIntervention[])
    const sel = (selRes.data ?? []) as ApiaDossierIntervention[]
    setSelected(sel)
    onInterventionsChange(
      sel.map(s => (s.apia_interventions as ApiaIntervention)?.code ?? '').filter(Boolean)
    )
    setLoading(false)
  }, [dossierId, db, onInterventionsChange])

  useEffect(() => { load() }, [load])

  const selectedIds = new Set(selected.map(s => s.intervention_id))

  async function toggle(intervention: ApiaIntervention) {
    if (!editable) return
    if (selectedIds.has(intervention.id)) {
      const row = selected.find(s => s.intervention_id === intervention.id)
      if (!row) return
      const { error } = await db.from('apia_dossier_interventions').delete().eq('id', row.id)
      if (error) toast.error(error.message)
      else load()
    } else {
      const { error } = await db.from('apia_dossier_interventions').insert({
        user_id: userId,
        dossier_id: dossierId,
        intervention_id: intervention.id,
      })
      if (error) toast.error(error.message)
      else load()
    }
  }

  if (loading) return <LoadingSpinner />

  const grouped = catalog.reduce<Record<string, ApiaIntervention[]>>((acc, i) => {
    const g = i.subcategory ?? i.category
    ;(acc[g] = acc[g] ?? []).push(i)
    return acc
  }, {})

  return (
    <div className="space-y-5">
      <p className="text-xs text-gray-500">
        {editable
          ? 'Bifați intervențiile solicitate. Documentele necesare se vor actualiza automat în tabul Documente.'
          : 'Intervențiile selectate în acest dosar.'}
      </p>
      {Object.entries(grouped).map(([group, items]) => (
        <div key={group}>
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{group}</h3>
          <div className="space-y-1">
            {items.map(item => {
              const isChecked = selectedIds.has(item.id)
              return (
                <label
                  key={item.id}
                  className={`flex items-start gap-3 px-3 py-2.5 rounded border cursor-pointer transition-colors ${
                    isChecked
                      ? 'bg-brand-50 border-brand-300'
                      : 'bg-white border-gray-200 hover:border-gray-300'
                  } ${!editable ? 'cursor-default' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggle(item)}
                    className="mt-0.5 rounded accent-brand-600"
                    disabled={!editable}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold text-brand-700">{item.code}</span>
                      <span className="text-sm text-gray-800">{item.name}</span>
                    </div>
                    {item.description && (
                      <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                    )}
                  </div>
                </label>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Documente tab ────────────────────────────────────────────────────────────

function DocumenteTab({
  dossierId, userId, editable, interventionCodes,
}: { dossierId: string; userId: string; editable: boolean; interventionCodes: string[] }) {
  const db = createClient()
  const [docs, setDocs] = useState<ApiaDossierDocument[]>([])
  const [loading, setLoading] = useState(true)

  const requiredDocs = getRequiredDocuments(interventionCodes)

  const load = useCallback(async () => {
    const { data } = await db
      .from('apia_dossier_documents')
      .select('*')
      .eq('dossier_id', dossierId)
      .order('created_at')
    setDocs((data ?? []) as ApiaDossierDocument[])
    setLoading(false)
  }, [dossierId, db])

  useEffect(() => { load() }, [load])

  // Sync required docs into the DB (create missing entries)
  async function syncDocs() {
    const existingTypes = new Set(docs.map(d => d.document_type))
    const missing = requiredDocs.filter(r => !existingTypes.has(r.type))
    if (missing.length === 0) { toast.info('Documentele sunt deja sincronizate'); return }
    const rows = missing.map(r => ({
      user_id: userId,
      dossier_id: dossierId,
      document_type: r.type,
      document_label: r.label,
      status: 'MISSING',
    }))
    const { error } = await db.from('apia_dossier_documents').insert(rows)
    if (error) toast.error(error.message)
    else { toast.success(`${missing.length} document(e) adăugate`); load() }
  }

  async function updateStatus(id: string, status: string) {
    const { error } = await db.from('apia_dossier_documents').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) toast.error(error.message)
    else load()
  }

  if (loading) return <LoadingSpinner />

  // Merge required with uploaded
  const allDocs = [
    ...docs,
    ...requiredDocs
      .filter(r => !docs.some(d => d.document_type === r.type))
      .map(r => ({
        id: `__req_${r.type}`,
        user_id: userId,
        dossier_id: dossierId,
        intervention_id: null,
        document_type: r.type,
        document_label: r.label,
        file_url: null,
        reference_number: null,
        issue_date: null,
        valid_until: null,
        status: 'MISSING' as const,
        notes: r.notes ?? null,
        created_at: '',
        updated_at: '',
        _virtual: true,
      })),
  ]

  const mandatoryMissingCount = requiredDocs.filter(
    r => r.mandatory && !docs.some(d => d.document_type === r.type && (d.status === 'UPLOADED' || d.status === 'VERIFIED'))
  ).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          {mandatoryMissingCount > 0
            ? <span className="text-red-600 font-medium">⚠️ {mandatoryMissingCount} documente obligatorii lipsesc</span>
            : <span className="text-green-600 font-medium">✓ Toate documentele obligatorii sunt prezente</span>}
        </p>
        {editable && (
          <button
            onClick={syncDocs}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
          >
            <Plus className="w-3.5 h-3.5" />
            Sincronizează lista de documente
          </button>
        )}
      </div>

      {allDocs.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">
          Selectați mai întâi intervențiile pentru a vedea documentele necesare.
        </p>
      ) : (
        <div className="space-y-2">
          {allDocs.map(doc => {
            const req = requiredDocs.find(r => r.type === doc.document_type)
            const isVirtual = (doc as unknown as Record<string, unknown>)._virtual === true
            return (
              <div
                key={doc.id}
                className={`flex items-start gap-3 px-3 py-2.5 rounded border ${
                  doc.status === 'MISSING' && req?.mandatory
                    ? 'border-red-200 bg-red-50'
                    : doc.status === 'VERIFIED'
                    ? 'border-green-200 bg-green-50'
                    : 'border-gray-200 bg-white'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-800">{doc.document_label}</span>
                    {req?.mandatory
                      ? <span className="text-xs text-red-500 font-medium">obligatoriu</span>
                      : <span className="text-xs text-gray-400">recomandat</span>}
                    <DocStatusBadge status={doc.status} />
                  </div>
                  {doc.reference_number && (
                    <p className="text-xs text-gray-500 mt-0.5">Ref: {doc.reference_number}</p>
                  )}
                  {doc.valid_until && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      Valabil până: <strong>{doc.valid_until}</strong>
                    </p>
                  )}
                  {req?.notes && (
                    <p className="text-xs text-gray-400 italic mt-0.5">{req.notes}</p>
                  )}
                </div>
                {editable && !isVirtual && (
                  <select
                    value={doc.status}
                    onChange={e => updateStatus(doc.id, e.target.value)}
                    className="text-xs border border-gray-300 rounded px-1.5 py-1 focus:outline-none"
                  >
                    <option value="MISSING">Lipsă</option>
                    <option value="UPLOADED">Încărcat</option>
                    <option value="VERIFIED">Verificat</option>
                    <option value="EXPIRED">Expirat</option>
                    <option value="NOT_APPLICABLE">N/A</option>
                  </select>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Modificări tab ───────────────────────────────────────────────────────────

function ModificariTab({
  dossierId, userId, editable,
}: { dossierId: string; userId: string; editable: boolean }) {
  const db = createClient()
  const [requests, setRequests] = useState<ApiaChangeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [formType, setFormType] = useState('M1')
  const [description, setDescription] = useState('')
  const [submissionDate, setSubmissionDate] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data } = await db
      .from('apia_change_requests')
      .select('*')
      .eq('dossier_id', dossierId)
      .order('created_at', { ascending: false })
    setRequests((data ?? []) as ApiaChangeRequest[])
    setLoading(false)
  }, [dossierId, db])

  useEffect(() => { load() }, [load])

  async function addRequest(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await db.from('apia_change_requests').insert({
      user_id: userId,
      dossier_id: dossierId,
      form_type: formType,
      description: description.trim() || null,
      submission_date: submissionDate || null,
      status: 'DRAFT',
    })
    if (error) toast.error(error.message)
    else { toast.success('Formular adăugat'); setShowAdd(false); setDescription(''); setSubmissionDate(''); load() }
    setSaving(false)
  }

  async function updateStatus(id: string, status: string) {
    await db.from('apia_change_requests').update({ status }).eq('id', id)
    load()
  }

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500">
          Formulare M1–M4 de modificare/completare a dosarului după depunerea inițială.
        </p>
        {editable && (
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white rounded font-medium"
          >
            <Plus className="w-3.5 h-3.5" />
            Adaugă formular
          </button>
        )}
      </div>

      {showAdd && (
        <form onSubmit={addRequest} className="bg-gray-50 border border-gray-200 rounded p-3 space-y-3">
          <div className="flex gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Tip formular</label>
              <select
                value={formType}
                onChange={e => setFormType(e.target.value)}
                className="text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                {Object.entries(CHANGE_FORM_META).map(([k, v]) => (
                  <option key={k} value={k}>{k} – {v.description}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Data depunere</label>
              <input
                type="date"
                value={submissionDate}
                onChange={e => setSubmissionDate(e.target.value)}
                className="text-sm border border-gray-300 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Descriere modificări</label>
            <textarea
              rows={2}
              className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-brand-400"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ce s-a modificat prin acest formular..."
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving}
              className="px-4 py-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white rounded disabled:opacity-50">
              {saving ? 'Se salvează...' : 'Salvează'}
            </button>
            <button type="button" onClick={() => setShowAdd(false)}
              className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-100">
              Anulează
            </button>
          </div>
        </form>
      )}

      {requests.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">
          Nu există formulare de modificare înregistrate.
        </p>
      ) : (
        <div className="space-y-2">
          {requests.map(r => {
            const meta = CHANGE_FORM_META[r.form_type] ?? { label: r.form_type, description: '', color: 'bg-gray-100 text-gray-600' }
            return (
              <div key={r.id} className="flex items-start gap-3 px-3 py-2.5 border border-gray-200 rounded bg-white">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${meta.color}`}>
                  {meta.label}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 font-medium">{meta.description}</p>
                  {r.description && <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>}
                  {r.submission_date && (
                    <p className="text-xs text-gray-400 mt-0.5">Depus: {r.submission_date}</p>
                  )}
                </div>
                {editable && (
                  <select
                    value={r.status}
                    onChange={e => updateStatus(r.id, e.target.value)}
                    className="text-xs border border-gray-300 rounded px-1.5 py-1"
                  >
                    <option value="DRAFT">Ciornă</option>
                    <option value="SUBMITTED">Depus</option>
                    <option value="PROCESSED">Procesat</option>
                    <option value="REJECTED">Respins</option>
                  </select>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Audit tab ────────────────────────────────────────────────────────────────

function AuditTab({ dossierId }: { dossierId: string }) {
  const db = createClient()
  const [logs, setLogs] = useState<ApiaAuditLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    db.from('apia_audit_log')
      .select('*')
      .eq('dossier_id', dossierId)
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => { setLogs((data ?? []) as ApiaAuditLog[]); setLoading(false) })
  }, [dossierId, db])

  if (loading) return <LoadingSpinner />

  return (
    <div>
      {logs.length === 0 ? (
        <p className="text-sm text-gray-400 py-8 text-center">Nu există înregistrări audit.</p>
      ) : (
        <ul className="space-y-2">
          {logs.map(l => (
            <li key={l.id} className="flex items-start gap-3 text-xs">
              <div className="w-32 shrink-0 text-gray-400 pt-0.5">{new Date(l.created_at).toLocaleString('ro-RO')}</div>
              <div>
                <span className="font-semibold text-gray-700">{l.action}</span>
                {l.entity_type && <span className="text-gray-500"> • {l.entity_type}</span>}
                {l.notes && <p className="text-gray-500 mt-0.5">{l.notes}</p>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ─── Loading helper ───────────────────────────────────────────────────────────

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-5 h-5 animate-spin text-brand-600" />
    </div>
  )
}

// ─── Status flow helpers ───────────────────────────────────────────────────────

const STATUS_FLOW: Record<string, string[]> = {
  DRAFT:        ['CHECKING', 'ARCHIVED'],
  CHECKING:     ['READY', 'DRAFT'],
  READY:        ['SUBMITTED', 'CHECKING'],
  SUBMITTED:    ['UNDER_REVIEW', 'CORRECTED'],
  UNDER_REVIEW: ['ACCEPTED', 'CORRECTED'],
  ACCEPTED:     ['ARCHIVED'],
  CORRECTED:    ['UNDER_REVIEW'],
  ARCHIVED:     [],
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ApiaDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const db = createClient()

  const [dossier, setDossier] = useState<ApiaDossier | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabId>('sumar')
  const [interventionCodes, setInterventionCodes] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string>('')

  // Editable summary fields
  const [agiNumber, setAgiNumber] = useState('')
  const [exploitationCode, setExploitationCode] = useState('')
  const [notes, setNotes] = useState('')
  const [submissionDate, setSubmissionDate] = useState('')
  const [editingSumar, setEditingSumar] = useState(false)

  const editable = dossier?.status !== 'ARCHIVED' && dossier?.status !== 'ACCEPTED'

  const loadDossier = useCallback(async () => {
    const { data: { user } } = await db.auth.getUser()
    if (user) setUserId(user.id)

    const { data } = await db
      .from('apia_dossiers')
      .select('*')
      .eq('id', id)
      .single()
    if (!data) { setLoading(false); return }
    const d = data as ApiaDossier
    setDossier(d)
    setAgiNumber(d.agi_dossier_number ?? '')
    setExploitationCode(d.exploitation_code ?? '')
    setNotes(d.notes ?? '')
    setSubmissionDate(d.submission_date ?? '')
    setLoading(false)
  }, [id, db])

  useEffect(() => { loadDossier() }, [loadDossier])

  async function saveSumar() {
    setSaving(true)
    const { error } = await db
      .from('apia_dossiers')
      .update({
        agi_dossier_number: agiNumber.trim() || null,
        exploitation_code: exploitationCode.trim() || null,
        notes: notes.trim() || null,
        submission_date: submissionDate || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('Dosar actualizat'); setEditingSumar(false); loadDossier() }
    setSaving(false)
  }

  async function changeStatus(newStatus: string) {
    if (!confirm(`Schimbați statusul dosarului la "${DOSSIER_STATUS_CFG[newStatus]?.label}"?`)) return
    const { error } = await db
      .from('apia_dossiers')
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) toast.error(error.message)
    else {
      await db.from('apia_audit_log').insert({
        user_id: userId,
        dossier_id: id,
        action: 'STATUS_CHANGE',
        new_value: { status: newStatus },
      })
      toast.success('Status actualizat')
      loadDossier()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
      </div>
    )
  }

  if (!dossier) {
    return (
      <div className="text-center py-16 text-gray-500">
        Dosarul nu a fost găsit.
        <br />
        <button onClick={() => router.push('/apia')} className="mt-2 text-brand-600 underline text-sm">
          Înapoi la APIA
        </button>
      </div>
    )
  }

  const nextStatuses = STATUS_FLOW[dossier.status] ?? []

  return (
    <div className="max-w-5xl space-y-5">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <button onClick={() => router.push('/apia')} className="mt-1 p-1 hover:bg-gray-100 rounded">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-lg font-bold text-gray-900">
              Dosar APIA {dossier.campaign_year}
            </h1>
            {dossier.agi_dossier_number && (
              <span className="text-sm font-mono text-gray-500">#{dossier.agi_dossier_number}</span>
            )}
            <StatusBadge status={dossier.status} />
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {Number(dossier.total_declared_ha).toFixed(4)} ha declarate •{' '}
            creat {new Date(dossier.created_at).toLocaleDateString('ro-RO')}
          </p>
        </div>

        {/* Status transition buttons */}
        {nextStatuses.length > 0 && (
          <div className="flex items-center gap-2 shrink-0">
            {nextStatuses.map(s => (
              <button
                key={s}
                onClick={() => changeStatus(s)}
                className={`px-3 py-1.5 text-xs rounded font-medium border ${
                  s === 'ARCHIVED' || s === 'CORRECTED'
                    ? 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    : 'border-brand-500 text-brand-600 hover:bg-brand-50'
                }`}
              >
                → {DOSSIER_STATUS_CFG[s]?.label ?? s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Tabs ────────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-200">
        <div className="flex gap-0 -mb-px overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm whitespace-nowrap border-b-2 font-medium transition-colors ${
                tab === t.id
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">

        {/* SUMAR */}
        {tab === 'sumar' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm text-gray-800">Informații dosar</h2>
              {!editingSumar && editable && (
                <button
                  onClick={() => setEditingSumar(true)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-brand-600"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  Editează
                </button>
              )}
            </div>

            {editingSumar ? (
              <div className="space-y-3 max-w-md">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Nr. Dosar AGI Online</label>
                  <input
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-400"
                    value={agiNumber}
                    onChange={e => setAgiNumber(e.target.value)}
                    placeholder="ex. 2026/PH/12345"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Cod exploatație ANSVSA</label>
                  <input
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-400"
                    value={exploitationCode}
                    onChange={e => setExploitationCode(e.target.value)}
                    placeholder="ex. RO123456789012"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Data depunere la APIA</label>
                  <input
                    type="date"
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-400"
                    value={submissionDate}
                    onChange={e => setSubmissionDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Observații</label>
                  <textarea
                    rows={3}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded resize-none focus:outline-none focus:ring-2 focus:ring-brand-400"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={saveSumar}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white rounded disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {saving ? 'Se salvează...' : 'Salvează'}
                  </button>
                  <button
                    onClick={() => setEditingSumar(false)}
                    className="px-3 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50"
                  >
                    Anulează
                  </button>
                </div>
              </div>
            ) : (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {[
                  ['An campanie', dossier.campaign_year],
                  ['Status', <StatusBadge key="s" status={dossier.status} />],
                  ['Nr. dosar AGI Online', dossier.agi_dossier_number ?? <span className="text-gray-400">necompletat</span>],
                  ['Cod exploatație ANSVSA', dossier.exploitation_code ?? <span className="text-gray-400">necompletat</span>],
                  ['Ha declarate', Number(dossier.total_declared_ha).toFixed(4)],
                  ['Ha eligibile', Number(dossier.total_eligible_ha).toFixed(4)],
                  ['Data depunere', dossier.submission_date ?? <span className="text-gray-400">nedepus</span>],
                  ['Data acceptare', dossier.accepted_date ?? <span className="text-gray-400">—</span>],
                ].map(([k, v]) => (
                  <div key={String(k)}>
                    <dt className="text-xs font-medium text-gray-500">{k}</dt>
                    <dd className="text-gray-800 mt-0.5">{v}</dd>
                  </div>
                ))}
                {dossier.notes && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium text-gray-500">Observații</dt>
                    <dd className="text-gray-700 mt-0.5 whitespace-pre-line">{dossier.notes}</dd>
                  </div>
                )}
              </dl>
            )}

            {/* AGI Online quick link */}
            <div className="pt-2 border-t border-gray-100">
              <a
                href="https://agi.apia.org.ro"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-brand-600 hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Deschide AGI Online APIA
              </a>
            </div>
          </div>
        )}

        {/* PARCELE */}
        {tab === 'parcele' && (
          <ParceleTab dossierId={id} userId={userId} editable={editable} />
        )}

        {/* INTERVENȚII */}
        {tab === 'interventii' && (
          <InterventiiTab
            dossierId={id}
            userId={userId}
            editable={editable}
            onInterventionsChange={setInterventionCodes}
          />
        )}

        {/* DOCUMENTE */}
        {tab === 'documente' && (
          <DocumenteTab
            dossierId={id}
            userId={userId}
            editable={editable}
            interventionCodes={interventionCodes}
          />
        )}

        {/* MODIFICĂRI */}
        {tab === 'modificari' && (
          <ModificariTab dossierId={id} userId={userId} editable={editable} />
        )}

        {/* AUDIT */}
        {tab === 'audit' && <AuditTab dossierId={id} />}
      </div>
    </div>
  )
}
