'use client'

export const runtime = 'edge'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Truck, Plus, Loader2, CheckCircle2, XCircle, AlertTriangle,
  Clock, RefreshCw, Key, Ban, FileText, ChevronRight,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import type { TransportUit } from '@/lib/fleet-types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TokenStatus {
  connected: boolean
  expired?: boolean
  expires_at?: string
  cif?: string
}

interface UitWithMachine extends TransportUit {
  machine_name?: string | null
  machine_plate?: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s + 'T00:00:00').toLocaleDateString('ro-RO')
}

function daysUntil(d: string): number {
  const t = new Date(d + 'T00:00:00Z')
  const n = new Date(); n.setUTCHours(0, 0, 0, 0)
  return Math.round((t.getTime() - n.getTime()) / 86400000)
}

const TIP_LABEL: Record<string, string> = {
  import: 'Import', export: 'Export', national: 'Național', intracomunitar: 'Intracomunitar',
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ uit }: { uit: UitWithMachine }) {
  const hasCod = !!uit.cod_uit
  if (uit.status === 'anulat') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500"><Ban className="w-3 h-3" /> Anulat</span>
  }
  if (uit.status === 'utilizat') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-600"><CheckCircle2 className="w-3 h-3" /> Utilizat</span>
  }
  if (!hasCod) {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-600"><Clock className="w-3 h-3" /> Nedeclarat ANAF</span>
  }
  if (uit.status === 'expirat') {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600"><AlertTriangle className="w-3 h-3" /> Expirat</span>
  }
  const days = daysUntil(uit.valabil_pana)
  if (days < 0) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600"><AlertTriangle className="w-3 h-3" /> Expirat</span>
  if (days <= 2) return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-600"><Clock className="w-3 h-3" /> Expiră în {days}z</span>
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-600"><CheckCircle2 className="w-3 h-3" /> Activ · {days}z</span>
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ETransportPage() {
  const [token,         setToken]         = useState<TokenStatus | null>(null)
  const [tokenLoading,  setTokenLoading]  = useState(true)
  const [tokenInput,    setTokenInput]    = useState('')
  const [cifInput,      setCifInput]      = useState('')
  const [savingToken,   setSavingToken]   = useState(false)

  const [records,       setRecords]       = useState<UitWithMachine[]>([])
  const [loading,       setLoading]       = useState(true)

  const [declaring,     setDeclaring]     = useState<string | null>(null)
  const [cancelling,    setCancelling]    = useState<string | null>(null)

  const [search,        setSearch]        = useState('')
  const [filterStatus,  setFilterStatus]  = useState('all')

  const env = process.env.NEXT_PUBLIC_ANAF_ENV ?? 'test'

  // ── Load token status ────────────────────────────────────────────────────

  const loadToken = useCallback(async () => {
    setTokenLoading(true)
    try {
      const r = await fetch('/api/efactura/token')   // reuse same token endpoint
      const d = await r.json() as TokenStatus
      setToken(d)
    } finally {
      setTokenLoading(false)
    }
  }, [])

  useEffect(() => { void loadToken() }, [loadToken])

  // ── Load records ─────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    const db = createClient()
    const { data, error } = await db
      .from('transporturi_uit')
      .select('*, machines(name, plate)')
      .order('data_declarare', { ascending: false })
      .limit(200)
    if (error) { toast.error('Eroare la încărcare'); setLoading(false); return }
    setRecords(((data ?? []) as any[]).map(r => ({
      ...r,
      machine_name:  r.machines?.name  ?? null,
      machine_plate: r.machines?.plate ?? null,
    })))
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  // ── Save token ────────────────────────────────────────────────────────────

  async function saveToken(e: React.FormEvent) {
    e.preventDefault()
    if (!tokenInput.trim()) return
    setSavingToken(true)
    try {
      const r = await fetch('/api/efactura/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: tokenInput.trim(), cif: cifInput.trim() || undefined }),
      })
      if (!r.ok) { const d = await r.json() as { error?: string }; toast.error(d.error ?? 'Eroare'); return }
      toast.success('Token salvat')
      setTokenInput('')
      void loadToken()
    } finally {
      setSavingToken(false)
    }
  }

  async function revokeToken() {
    await fetch('/api/efactura/token', { method: 'DELETE' })
    toast.success('Token revocat')
    void loadToken()
  }

  // ── Declare at ANAF ───────────────────────────────────────────────────────

  async function declareAtAnaf(uitId: string) {
    setDeclaring(uitId)
    try {
      const r = await fetch('/api/etransport/declare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uit_id: uitId, env }),
      })
      const d = await r.json() as { cod_uit?: string; error?: string }
      if (!r.ok) { toast.error(d.error ?? 'Eroare ANAF'); return }
      toast.success(`UIT declarat: ${d.cod_uit}`)
      void load()
    } catch {
      toast.error('Eroare de rețea')
    } finally {
      setDeclaring(null)
    }
  }

  // ── Cancel at ANAF ────────────────────────────────────────────────────────

  async function cancelAtAnaf(uitId: string) {
    setCancelling(uitId)
    try {
      const r = await fetch('/api/etransport/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uit_id: uitId, env }),
      })
      const d = await r.json() as { anulat?: boolean; error?: string }
      if (!r.ok) { toast.error(d.error ?? 'Eroare ANAF'); return }
      toast.success('UIT anulat la ANAF')
      setRecords(prev => prev.map(r2 => r2.id === uitId ? { ...r2, status: 'anulat' } : r2))
    } catch {
      toast.error('Eroare de rețea')
    } finally {
      setCancelling(null)
    }
  }

  // ── Filtered list ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return records.filter(r => {
      if (filterStatus !== 'all') {
        if (filterStatus === 'nedeclarat' && r.cod_uit) return false
        if (filterStatus !== 'nedeclarat' && r.status !== filterStatus) return false
      }
      if (!q) return true
      return (r.cod_uit ?? '').toLowerCase().includes(q)
          || (r.machine_name ?? '').toLowerCase().includes(q)
          || (r.machine_plate ?? '').toLowerCase().includes(q)
          || (r.loc_incarcare ?? '').toLowerCase().includes(q)
          || (r.loc_descarcare ?? '').toLowerCase().includes(q)
    })
  }, [records, search, filterStatus])

  const stats = useMemo(() => ({
    total:       records.length,
    nedeclarat:  records.filter(r => !r.cod_uit && r.status !== 'anulat').length,
    active:      records.filter(r => r.status === 'activ' && !!r.cod_uit).length,
    expiring:    records.filter(r => r.status === 'activ' && !!r.cod_uit && daysUntil(r.valabil_pana) <= 2).length,
  }), [records])

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <PageHeader
        title="RO e-Transport"
        subtitle="Declarații transport și coduri UIT — ANAF SPV"
      />

      {/* ─── Token card ──────────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
            <Key className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Token ANAF SPV</h2>
            <p className="text-xs text-gray-500">Același token ca e-Factura — obținut din portalul SPV ANAF</p>
          </div>
          {!tokenLoading && token && (
            <div className="ml-auto">
              {token.connected && !token.expired
                ? <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200"><CheckCircle2 className="w-3 h-3" /> Conectat</span>
                : <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600 border border-red-200"><XCircle className="w-3 h-3" /> {token.connected ? 'Expirat' : 'Neconectat'}</span>
              }
            </div>
          )}
        </div>

        {tokenLoading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400"><Loader2 className="w-4 h-4 animate-spin" /> Se verifică...</div>
        ) : token?.connected && !token.expired ? (
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-500">
              {token.cif && <span>CIF: <strong>{token.cif}</strong> · </span>}
              Expiră: {token.expires_at ? fmtDate(token.expires_at.split('T')[0]) : '—'}
            </div>
            <button onClick={() => void revokeToken()} className="text-xs text-red-500 hover:text-red-700">Revocă token</button>
          </div>
        ) : (
          <form onSubmit={e => void saveToken(e)} className="space-y-3">
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Tokenul se obține din <strong>SPV ANAF</strong> (<code>logincert.anaf.ro</code>) prin autentificare cu certificat digital calificat
              → <strong>Setări cont → Acces API / OAuth2</strong> → generați un token de acces.
              Același token funcționează atât pentru e-Factura cât și pentru e-Transport.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                className="sm:col-span-2 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Bearer token ANAF"
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                required
              />
              <input
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="CIF firmă (ex: RO12345678)"
                value={cifInput}
                onChange={e => setCifInput(e.target.value)}
              />
            </div>
            <button type="submit" disabled={savingToken}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {savingToken ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
              Salvează token
            </button>
          </form>
        )}
      </div>

      {/* ─── Stats ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total',        value: stats.total,      color: 'text-gray-700' },
          { label: 'Nedeclarate',  value: stats.nedeclarat, color: 'text-amber-600' },
          { label: 'Active ANAF',  value: stats.active,     color: 'text-green-600' },
          { label: 'Expiră ≤2z',  value: stats.expiring,   color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ─── Filters ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <input
          className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="Caută cod UIT, utilaj, localitate..."
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <select
          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
        >
          <option value="all">Toate statusurile</option>
          <option value="nedeclarat">Nedeclarat ANAF</option>
          <option value="activ">Activ</option>
          <option value="expirat">Expirat</option>
          <option value="utilizat">Utilizat</option>
          <option value="anulat">Anulat</option>
        </select>
        <button onClick={() => void load()} className="p-2 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ─── Table ───────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center py-12 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Se încarcă...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
          <Truck className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Niciun transport găsit</p>
          <p className="text-xs mt-1">Adăugați transporturi din pagina <strong>Utilaje → [Utilaj] → Transporturi</strong></p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Cod UIT</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Utilaj</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tip</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Rută</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Valabil până la</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Acțiuni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map(r => {
                  const canDeclare = !r.cod_uit && r.status !== 'anulat' && token?.connected && !token.expired
                  const canCancel  = r.status === 'activ'
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        {r.cod_uit
                          ? <span className="font-mono text-xs text-gray-700" title={r.cod_uit}>{r.cod_uit.slice(0, 12)}…</span>
                          : <span className="text-xs text-gray-400 italic">— nedeclarat</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        <div className="font-medium">{r.machine_name ?? '—'}</div>
                        {r.machine_plate && <div className="text-xs text-gray-400">{r.machine_plate}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{TIP_LABEL[r.tip_operatiune] ?? r.tip_operatiune}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {r.loc_incarcare && r.loc_descarcare
                          ? `${r.loc_incarcare} → ${r.loc_descarcare}`
                          : r.loc_incarcare ?? r.loc_descarcare ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{fmtDate(r.valabil_pana)}</td>
                      <td className="px-4 py-3"><StatusBadge uit={r} /></td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {canDeclare && (
                            <button
                              onClick={() => void declareAtAnaf(r.id)}
                              disabled={declaring === r.id}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                              {declaring === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                              Declară ANAF
                            </button>
                          )}
                          {canCancel && (
                            <button
                              onClick={() => void cancelAtAnaf(r.id)}
                              disabled={cancelling === r.id}
                              className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                            >
                              {cancelling === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />}
                              Anulează
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
        </div>
      )}

      {/* ─── Info box ─────────────────────────────────────────────────────── */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-800">
        <div className="font-semibold mb-1 flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" /> Cum funcționează RO e-Transport</div>
        <ul className="space-y-0.5 list-disc list-inside text-blue-700">
          <li>Adăugați un transport din <strong>Utilaje → [Utilaj] → Transporturi</strong></li>
          <li>Reveniți aici și apăsați <strong>Declară ANAF</strong> pentru a obține codul UIT</li>
          <li>ANAF generează codul UIT și îl stochează automat în înregistrare</li>
          <li>Transport național: valabilitate <strong>5 zile</strong> · Internațional/UE: <strong>15 zile</strong></li>
          <li>Mediu curent: <strong className="uppercase">{env}</strong></li>
        </ul>
      </div>
    </div>
  )
}
