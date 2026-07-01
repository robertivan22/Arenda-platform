'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Loader2, X, Truck, AlertTriangle, CheckCircle2, Clock, Ban } from 'lucide-react'
import type { Machine, TransportUit } from '@/lib/fleet-types'

// ─── Constants ────────────────────────────────────────────────────────────────

const TIP_OPTIONS = [
  { value: 'import',         label: 'Import (extra-UE / intracomunitar)' },
  { value: 'export',         label: 'Export' },
  { value: 'national',       label: 'Național' },
  { value: 'intracomunitar', label: 'Intracomunitar' },
]

const VALIDITY_DAYS: Record<string, number> = {
  national: 5, import: 15, export: 15, intracomunitar: 15,
}

const TIP_LABEL: Record<string, string> = {
  import: 'Import', export: 'Export', national: 'Național', intracomunitar: 'Intracomunitar',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().split('T')[0]
}

function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s + 'T00:00:00').toLocaleDateString('ro-RO')
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr + 'T00:00:00Z')
  const now    = new Date()
  now.setUTCHours(0, 0, 0, 0)
  return Math.round((target.getTime() - now.getTime()) / 86400000)
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ uit }: { uit: TransportUit }) {
  if (uit.status === 'anulat') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">
        <Ban className="w-3 h-3" /> Anulat
      </span>
    )
  }
  if (uit.status === 'utilizat') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600">
        <CheckCircle2 className="w-3 h-3" /> Utilizat
      </span>
    )
  }
  if (uit.status === 'expirat') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600">
        <AlertTriangle className="w-3 h-3" /> Expirat
      </span>
    )
  }
  // activ — check days remaining
  const days = daysUntil(uit.valabil_pana)
  if (days < 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600">
        <AlertTriangle className="w-3 h-3" /> Expirat ({Math.abs(days)}z)
      </span>
    )
  }
  if (days <= 2) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-600">
        <Clock className="w-3 h-3" /> Expiră în {days}z
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-600">
      <CheckCircle2 className="w-3 h-3" /> Activ · {days}z
    </span>
  )
}

// ─── Empty form ───────────────────────────────────────────────────────────────

function emptyForm() {
  const today = new Date().toISOString().split('T')[0]
  return {
    cod_uit:            '',
    tip_operatiune:     'national' as string,
    data_declarare:     today,
    valabil_de:         today,
    valabil_pana:       addDays(today, VALIDITY_DAYS['national']),
    loc_incarcare:      '',
    loc_descarcare:     '',
    greutate_kg:        '',
    valoare_ron:        '',
    document_referinta: '',
    notes:              '',
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TransporturiUitPage() {
  const { id }   = useParams<{ id: string }>()
  const router   = useRouter()

  const [machine,  setMachine]  = useState<Machine | null>(null)
  const [records,  setRecords]  = useState<TransportUit[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showSheet, setShowSheet] = useState(false)
  const [saving,   setSaving]   = useState(false)
  const [form,     setForm]     = useState(emptyForm())
  const [cancelling, setCancelling] = useState<string | null>(null)

  // ── Load ─────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    const db = createClient()
    const [{ data: m }, { data: r }] = await Promise.all([
      db.from('machines').select('*').eq('id', id).single(),
      db.from('transporturi_uit')
        .select('*')
        .eq('machine_id', id)
        .order('data_declarare', { ascending: false })
        .limit(100),
    ])
    if (!m) { toast.error('Utilaj negăsit'); router.push('/utilaje'); return }
    setMachine(m as Machine)
    setRecords((r ?? []) as TransportUit[])
    setLoading(false)
  }, [id, router])

  useEffect(() => { void load() }, [load])

  // ── Auto-compute valabil_pana when tip or valabil_de changes ─────────────

  function handleFormChange(field: string, value: string) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      if (field === 'tip_operatiune' || field === 'valabil_de') {
        const base = field === 'valabil_de' ? value : prev.valabil_de
        const tip  = field === 'tip_operatiune' ? value : prev.tip_operatiune
        next.valabil_pana = addDays(base, VALIDITY_DAYS[tip] ?? 15)
      }
      return next
    })
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.cod_uit.length !== 36 || !/^[A-Za-z0-9]{36}$/.test(form.cod_uit)) {
      toast.error('Codul UIT trebuie să aibă exact 36 caractere alfanumerice')
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/utilaje/${id}/transporturi-uit`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          cod_uit:            form.cod_uit.trim(),
          tip_operatiune:     form.tip_operatiune,
          data_declarare:     form.data_declarare,
          valabil_de:         form.valabil_de,
          valabil_pana:       form.valabil_pana,
          loc_incarcare:      form.loc_incarcare      || null,
          loc_descarcare:     form.loc_descarcare     || null,
          greutate_kg:        form.greutate_kg        ? Number(form.greutate_kg)  : null,
          valoare_ron:        form.valoare_ron        ? Number(form.valoare_ron)  : null,
          document_referinta: form.document_referinta || null,
          notes:              form.notes              || null,
        }),
      })
      const json = await res.json() as { data?: TransportUit; error?: string }
      if (!res.ok) { toast.error(json.error ?? 'Eroare la salvare'); setSaving(false); return }
      toast.success('UIT înregistrat')
      setShowSheet(false)
      setForm(emptyForm())
      void load()
    } catch {
      toast.error('Eroare de rețea')
    } finally {
      setSaving(false)
    }
  }

  // ── Cancel UIT ───────────────────────────────────────────────────────────

  async function cancelUit(uitId: string) {
    setCancelling(uitId)
    try {
      const res = await fetch(`/api/transporturi-uit/${uitId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: 'anulat' }),
      })
      if (!res.ok) { toast.error('Eroare la anulare'); return }
      toast.success('UIT anulat')
      setRecords(prev => prev.map(r => r.id === uitId ? { ...r, status: 'anulat' } : r))
    } catch {
      toast.error('Eroare de rețea')
    } finally {
      setCancelling(null)
    }
  }

  // ── Stats ────────────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    total:   records.length,
    active:  records.filter(r => r.status === 'activ').length,
    expiring: records.filter(r => r.status === 'activ' && daysUntil(r.valabil_pana) <= 2).length,
    expired: records.filter(r => r.status === 'expirat' || (r.status === 'activ' && daysUntil(r.valabil_pana) < 0)).length,
  }), [records])

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mr-2" /> Se încarcă...
      </div>
    )
  }

  const inputCls  = 'w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500'
  const labelCls  = 'block text-xs font-semibold text-gray-700 mb-1'

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">

      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.push(`/utilaje/${id}`)}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Truck className="w-5 h-5 text-brand-600" />
            Transporturi UIT — {machine?.name}
          </h1>
          <p className="text-sm text-gray-500">{machine?.plate ?? '—'} · {machine?.type}</p>
        </div>
        <button
          onClick={() => { setForm(emptyForm()); setShowSheet(true) }}
          className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Adaugă UIT
        </button>
      </div>

      {/* ─── Stats cards ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total',      value: stats.total,    color: 'text-gray-700' },
          { label: 'Active',     value: stats.active,   color: 'text-green-600' },
          { label: 'Expiră ≤2z', value: stats.expiring, color: 'text-amber-600' },
          { label: 'Expirate',   value: stats.expired,  color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ─── Table ──────────────────────────────────────────────────────── */}
      {records.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
          <Truck className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Niciun transport UIT înregistrat</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Cod UIT</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tip</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Declarat</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Valabil până la</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Rută</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 max-w-[160px] truncate" title={r.cod_uit}>
                      {r.cod_uit.slice(0, 12)}…
                    </td>
                    <td className="px-4 py-3 text-gray-700">{TIP_LABEL[r.tip_operatiune] ?? r.tip_operatiune}</td>
                    <td className="px-4 py-3 text-gray-500">{fmtDate(r.data_declarare)}</td>
                    <td className="px-4 py-3 text-gray-700">{fmtDate(r.valabil_pana)}</td>
                    <td className="px-4 py-3"><StatusBadge uit={r} /></td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {r.loc_incarcare && r.loc_descarcare
                        ? `${r.loc_incarcare} → ${r.loc_descarcare}`
                        : r.loc_incarcare ?? r.loc_descarcare ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {r.status === 'activ' && (
                        <button
                          onClick={() => void cancelUit(r.id)}
                          disabled={cancelling === r.id}
                          className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          {cancelling === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Anulează'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Add UIT Sheet ──────────────────────────────────────────────── */}
      {showSheet && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowSheet(false)}
          />
          {/* Panel */}
          <div className="relative z-10 bg-white w-full sm:w-[440px] h-full sm:h-auto sm:max-h-[95vh] sm:rounded-l-2xl shadow-2xl flex flex-col">
            {/* Sheet header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="text-sm font-semibold text-gray-800">Adaugă Cod UIT</h2>
                <p className="text-xs text-gray-500">RO e-Transport — cod generat în SPV ANAF</p>
              </div>
              <button onClick={() => setShowSheet(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Sheet body */}
            <form onSubmit={e => void handleSubmit(e)} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

              <div>
                <label className={labelCls}>Cod UIT <span className="text-red-500">*</span></label>
                <input
                  className={inputCls + (form.cod_uit.length > 0 && form.cod_uit.length !== 36 ? ' border-red-400' : '')}
                  placeholder="36 caractere alfanumerice din SPV ANAF"
                  value={form.cod_uit}
                  onChange={e => handleFormChange('cod_uit', e.target.value.trim())}
                  maxLength={36}
                  required
                />
                <p className="text-xs text-gray-400 mt-0.5">{form.cod_uit.length}/36 caractere</p>
              </div>

              <div>
                <label className={labelCls}>Tip operațiune <span className="text-red-500">*</span></label>
                <select
                  className={inputCls}
                  value={form.tip_operatiune}
                  onChange={e => handleFormChange('tip_operatiune', e.target.value)}
                  required
                >
                  {TIP_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Data declarare</label>
                  <input type="date" className={inputCls} value={form.data_declarare}
                    onChange={e => handleFormChange('data_declarare', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Valabil de</label>
                  <input type="date" className={inputCls} value={form.valabil_de}
                    onChange={e => handleFormChange('valabil_de', e.target.value)} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Valabil până la</label>
                <input type="date" className={inputCls} value={form.valabil_pana}
                  onChange={e => setForm(f => ({ ...f, valabil_pana: e.target.value }))} />
                <p className="text-xs text-gray-400 mt-0.5">
                  Calculat automat: {VALIDITY_DAYS[form.tip_operatiune] ?? 15} zile ({form.tip_operatiune === 'national' ? 'național' : 'internațional'})
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Loc încărcare</label>
                  <input className={inputCls} placeholder="Localitate / județ"
                    value={form.loc_incarcare} onChange={e => handleFormChange('loc_incarcare', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Loc descărcare</label>
                  <input className={inputCls} placeholder="Localitate / județ"
                    value={form.loc_descarcare} onChange={e => handleFormChange('loc_descarcare', e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Greutate (kg)</label>
                  <input type="number" min="0" step="0.001" className={inputCls} placeholder="0"
                    value={form.greutate_kg} onChange={e => handleFormChange('greutate_kg', e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Valoare (RON)</label>
                  <input type="number" min="0" step="0.01" className={inputCls} placeholder="0.00"
                    value={form.valoare_ron} onChange={e => handleFormChange('valoare_ron', e.target.value)} />
                </div>
              </div>

              <div>
                <label className={labelCls}>Document referință</label>
                <input className={inputCls} placeholder="Nr. factură / contract / DVI"
                  value={form.document_referinta} onChange={e => handleFormChange('document_referinta', e.target.value)} />
              </div>

              <div>
                <label className={labelCls}>Notițe</label>
                <textarea className={inputCls + ' resize-none'} rows={2}
                  value={form.notes} onChange={e => handleFormChange('notes', e.target.value)} />
              </div>

              <div className="pt-1 pb-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {saving ? 'Se salvează...' : 'Înregistrează UIT'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
