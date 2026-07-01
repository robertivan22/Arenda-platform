'use client'

export const runtime = 'edge'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Truck, Plus, Loader2, CheckCircle2, AlertTriangle, Clock,
  RefreshCw, Key, Ban, FileText, Eye, Settings,
  Copy, ArrowLeft, Trash2,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'

interface TokenStatus { connected: boolean; expired?: boolean; expires_at?: string; cif?: string }
interface Good { nc_code: string; name: string; quantity: string; uom: string; gross_weight_kg: string; value_ron: string }
interface Shipment {
  id: string; status: string; operation_type: string; uit_code: string | null
  transport_start_date: string; loading_location: string; unloading_location: string
  vehicle_no: string; carrier_name: string | null; anaf_upload_index: number | null
  machine_name?: string | null; created_at: string
}
interface ShipmentDetail extends Shipment {
  loading_country: string; unloading_country: string; trailer1_no: string | null
  carrier_cui: string | null; source_document_ref: string | null; notes: string | null
  validation_errors: string[] | null
  goods: Array<{ id: string; name: string; nc_code: string | null; quantity: number; uom: string; gross_weight_kg: number | null; value_ron: number | null }>
  logs: Array<{ id: string; request_type: string; http_status: number | null; anaf_status: string | null; cod_uit: string | null; error_message: string | null; created_at: string }>
}

const TIP_OPTIONS = [
  { value: 'national',       label: 'Transport național', desc: '5 zile valabilitate' },
  { value: 'import',         label: 'Import',             desc: '15 zile valabilitate' },
  { value: 'export',         label: 'Export',             desc: '15 zile valabilitate' },
  { value: 'intracomunitar', label: 'Intracomunitar',     desc: '15 zile valabilitate' },
]

const STATUS_META: Record<string, { label: string; color: string }> = {
  draft:             { label: 'Draft',           color: 'bg-gray-100 text-gray-600' },
  ready_to_submit:   { label: 'Gata de trimitere',color: 'bg-blue-50 text-blue-700' },
  validated:         { label: 'Validat',         color: 'bg-blue-50 text-blue-700' },
  validation_failed: { label: 'Eroare validare', color: 'bg-red-50 text-red-600' },
  submitted:         { label: 'Trimis ANAF',     color: 'bg-purple-50 text-purple-700' },
  processing:        { label: 'În procesare',    color: 'bg-yellow-50 text-yellow-700' },
  accepted:          { label: 'Acceptat',        color: 'bg-green-50 text-green-700' },
  rejected:          { label: 'Respins ANAF',    color: 'bg-red-50 text-red-600' },
  uit_generated:     { label: 'UIT Generat ✓',   color: 'bg-green-100 text-green-800' },
  deleted:           { label: 'Șters',           color: 'bg-gray-100 text-gray-500' },
}

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, color: 'bg-gray-100 text-gray-600' }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${m.color}`}>{m.label}</span>
}

function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s.length > 10 ? s : s + 'T00:00:00').toLocaleDateString('ro-RO')
}

function emptyGood(): Good {
  return { nc_code: '', name: '', quantity: '1', uom: 'C62', gross_weight_kg: '', value_ron: '' }
}

export default function ETransportPage() {
  const [tab,          setTab]          = useState<'list' | 'settings'>('list')
  const [token,        setToken]        = useState<TokenStatus | null>(null)
  const [tokenLoading, setTokenLoading] = useState(true)
  const [tokenInput,   setTokenInput]   = useState('')
  const [cifInput,     setCifInput]     = useState('')
  const [savingToken,  setSavingToken]  = useState(false)
  const [shipments,    setShipments]    = useState<Shipment[]>([])
  const [loading,      setLoading]      = useState(true)
  const [detail,       setDetail]       = useState<ShipmentDetail | null>(null)
  const [detailLoading,setDetailLoading]= useState(false)
  const [showWizard,   setShowWizard]   = useState(false)
  const [wizardStep,   setWizardStep]   = useState(1)
  const [saving,       setSaving]       = useState(false)
  const [filterStatus, setFilterStatus] = useState('all')
  const [search,       setSearch]       = useState('')
  const [submitting,   setSubmitting]   = useState<string | null>(null)
  const [polling,      setPolling]      = useState<string | null>(null)
  const [cancelling,   setCancelling]   = useState<string | null>(null)
  const [generating,   setGenerating]   = useState<string | null>(null)
  const [wForm, setWForm] = useState({
    operation_type: 'national', transport_start_date: new Date().toISOString().split('T')[0],
    loading_country: 'RO', loading_location: '', unloading_country: 'RO', unloading_location: '',
    vehicle_no: '', trailer1_no: '', carrier_name: '', carrier_cui: '', source_document_ref: '', notes: '',
  })
  const [goods, setGoods] = useState<Good[]>([emptyGood()])

  const loadToken = useCallback(async () => {
    setTokenLoading(true)
    try { setToken(await (await fetch('/api/efactura/token')).json() as TokenStatus) }
    finally { setTokenLoading(false) }
  }, [])

  const loadShipments = useCallback(async () => {
    setLoading(true)
    try {
      const d = await (await fetch('/api/etransport/shipments')).json() as { data?: any[] }
      setShipments((d.data ?? []).map((s: any) => ({ ...s, machine_name: s.machines?.name ?? null })))
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { void loadToken(); void loadShipments() }, [loadToken, loadShipments])

  async function saveToken(e: React.FormEvent) {
    e.preventDefault(); setSavingToken(true)
    try {
      const r = await fetch('/api/efactura/token', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: tokenInput.trim(), cif: cifInput.trim() || undefined }) })
      if (!r.ok) { toast.error((await r.json() as any).error ?? 'Eroare'); return }
      toast.success('Token salvat'); setTokenInput(''); void loadToken()
    } finally { setSavingToken(false) }
  }

  async function openDetail(id: string) {
    setDetail(null); setDetailLoading(true)
    const d = await (await fetch(`/api/etransport/shipments/${id}`)).json() as { data?: ShipmentDetail }
    setDetail(d.data ?? null); setDetailLoading(false)
  }

  async function doAction(id: string, action: string, setter: (v: string | null) => void) {
    setter(id)
    try {
      const r = await fetch(`/api/etransport/shipments/${id}`, { method: 'PATCH',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) })
      const d = await r.json() as any
      if (!r.ok) { toast.error(d.error ?? 'Eroare'); return }
      if (action === 'submit') toast.success(`Declarat! Cod UIT: ${d.cod_uit}`)
      else if (action === 'poll') toast.info(`Status ANAF: ${d.anaf_status} → ${d.status}`)
      else if (action === 'cancel') { toast.success('Transport anulat/șters'); setDetail(null) }
      void loadShipments()
      if (detail?.id === id) void openDetail(id)
    } finally { setter(null) }
  }

  async function generateUit(id: string) {
    setGenerating(id)
    try {
      const r = await fetch(`/api/etransport/shipments/${id}/generate-uit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const d = await r.json() as any
      if (!r.ok || d.status === 'validation_failed') {
        if (d.errors?.length) {
          toast.error(`Validare eșuată: ${d.errors[0]}${d.errors.length > 1 ? ` (+${d.errors.length-1} erori)` : ''}`)
        } else {
          toast.error(d.error ?? 'Eroare generare UIT')
        }
        void loadShipments()
        if (detail?.id === id) void openDetail(id)
        return
      }
      if (d.status === 'already_generated') {
        toast.info(`UIT deja generat: ${d.uitCode}`); return
      }
      toast.success(`✅ Cod UIT generat: ${d.uitCode}`)
      void loadShipments()
      if (detail?.id === id) void openDetail(id)
    } catch {
      toast.error('Eroare de rețea')
    } finally {
      setGenerating(null)
    }
  }

  async function handleWizardSubmit() {
    const validGoods = goods.filter(g => g.name.trim())
    if (!wForm.vehicle_no.trim() || !wForm.loading_location.trim() || !wForm.unloading_location.trim()) {
      toast.error('Completați vehicul, loc încărcare și loc descărcare'); return }
    if (validGoods.length === 0) { toast.error('Adăugați cel puțin un bun transportat'); return }
    setSaving(true)
    try {
      const r = await fetch('/api/etransport/shipments', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...wForm, vehicle_no: wForm.vehicle_no.trim().toUpperCase(),
          goods: validGoods.map(g => ({ nc_code: g.nc_code || null, name: g.name,
            quantity: Number(g.quantity) || 1, uom: g.uom || 'C62',
            gross_weight_kg: g.gross_weight_kg ? Number(g.gross_weight_kg) : null,
            value_ron: g.value_ron ? Number(g.value_ron) : null })) }) })
      const d = await r.json() as any
      if (!r.ok) { toast.error(d.error ?? 'Eroare creare'); return }
      toast.success('Transport creat')
      setShowWizard(false); setWizardStep(1)
      setWForm({ operation_type:'national', transport_start_date: new Date().toISOString().split('T')[0],
        loading_country:'RO', loading_location:'', unloading_country:'RO', unloading_location:'',
        vehicle_no:'', trailer1_no:'', carrier_name:'', carrier_cui:'', source_document_ref:'', notes:'' })
      setGoods([emptyGood()])
      void loadShipments()
    } finally { setSaving(false) }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return shipments.filter(s => {
      if (filterStatus !== 'all' && s.status !== filterStatus) return false
      if (!q) return true
      return (s.uit_code ?? '').toLowerCase().includes(q) || s.vehicle_no.toLowerCase().includes(q)
          || (s.machine_name ?? '').toLowerCase().includes(q) || s.loading_location.toLowerCase().includes(q)
    })
  }, [shipments, filterStatus, search])

  const stats = useMemo(() => ({
    total: shipments.length, draft: shipments.filter(s => s.status === 'draft').length,
    pending: shipments.filter(s => ['submitted','processing'].includes(s.status)).length,
    accepted: shipments.filter(s => s.status === 'accepted').length,
    rejected: shipments.filter(s => s.status === 'rejected').length,
  }), [shipments])

  const inp = 'w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500'
  const lbl = 'block text-xs font-semibold text-gray-700 mb-1'

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <PageHeader title="RO e-Transport" subtitle="Declarații transport ANAF — MVP 1" />
        <div className="flex items-center gap-2">
          <button onClick={() => setTab(tab === 'list' ? 'settings' : 'list')}
            className="p-2 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">
            <Settings className="w-4 h-4" />
          </button>
          <button onClick={() => { setShowWizard(true); setWizardStep(1) }}
            className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700">
            <Plus className="w-4 h-4" /> Adaugă transport
          </button>
        </div>
      </div>

      {!tokenLoading && (!token?.connected || token.expired) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 flex items-center gap-3 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Token ANAF lipsă sau expirat — declararea nu va funcționa.
            <button onClick={() => setTab('settings')} className="ml-1 underline font-semibold">Configurați tokenul →</button>
          </span>
        </div>
      )}

      {tab === 'settings' ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Key className="w-4 h-4 text-blue-600" /> Token ANAF SPV
          </h2>
          <div className="mb-3 text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
            <p className="font-semibold text-gray-700 mb-1">Cum obțineți tokenul:</p>
            <ol className="list-decimal list-inside space-y-0.5">
              <li>Accesați <strong>logincert.anaf.ro</strong> cu certificat digital calificat</li>
              <li>Navigați la <strong>Setări cont → Acces API / OAuth2</strong></li>
              <li>Generați un token de acces și copiați-l mai jos</li>
              <li>Același token funcționează pentru e-Factura și e-Transport</li>
            </ol>
          </div>
          {!tokenLoading && token?.connected && !token.expired ? (
            <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-sm text-green-800">
                <CheckCircle2 className="w-4 h-4 inline mr-1" />
                Conectat{token.cif ? ` · CIF: ${token.cif}` : ''} · Expiră: {token.expires_at ? fmtDate(token.expires_at.split('T')[0]) : '—'}
              </div>
              <button onClick={async () => { await fetch('/api/efactura/token', { method: 'DELETE' }); toast.success('Token revocat'); void loadToken() }}
                className="text-xs text-red-500 hover:text-red-700">Revocă</button>
            </div>
          ) : (
            <form onSubmit={e => void saveToken(e)} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input className={`sm:col-span-2 ${inp}`} placeholder="Bearer token ANAF" value={tokenInput} onChange={e => setTokenInput(e.target.value)} required />
                <input className={inp} placeholder="CIF firmă (ex: RO12345678)" value={cifInput} onChange={e => setCifInput(e.target.value)} />
              </div>
              <button type="submit" disabled={savingToken} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {savingToken ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />} Salvează token
              </button>
            </form>
          )}
          <p className="mt-4 text-xs text-gray-400">
            API endpoint: <code className="bg-gray-100 px-1 rounded">api.anaf.ro/test/ETRANSPORT/ws/v1/upload/ETRANSP/{'{cif}'}/2</code>
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-5">
            {[{l:'Total',v:stats.total,c:'text-gray-700'},{l:'Draft',v:stats.draft,c:'text-amber-600'},
              {l:'În procesare',v:stats.pending,c:'text-purple-600'},{l:'Acceptate',v:stats.accepted,c:'text-green-600'},
              {l:'Respinse',v:stats.rejected,c:'text-red-600'}].map(s => (
              <div key={s.l} className="bg-white border border-gray-200 rounded-xl p-3 text-center">
                <div className={`text-xl font-bold ${s.c}`}>{s.v}</div>
                <div className="text-xs text-gray-500">{s.l}</div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mb-4">
            <input className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Caută UIT, vehicul, localitate..." value={search} onChange={e => setSearch(e.target.value)} />
            <select className="px-3 py-2 text-sm border border-gray-300 rounded-lg" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
              <option value="all">Toate</option>
              {Object.entries(STATUS_META).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button onClick={() => void loadShipments()} className="p-2 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12 text-gray-400"><Loader2 className="w-5 h-5 animate-spin mr-2" />Se încarcă...</div>
          ) : filtered.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
              <Truck className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Niciun transport. Apăsați „Adaugă transport" pentru a crea primul.</p>
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[680px]">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Tip / Dată</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Rută</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Vehicul</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cod UIT</th>
                      <th className="px-4 py-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map(s => {
                      const canGenerate = !s.uit_code
                        && ['draft','ready_to_submit','validated','validation_failed','rejected'].includes(s.status)
                      const tokenOk = !!(token?.connected && !token.expired)
                      const canPoll   = ['submitted','processing'].includes(s.status) && !!s.anaf_upload_index
                      const canCancel = !['deleted','confirmed','uit_generated'].includes(s.status)
                      return (
                        <tr key={s.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="font-medium text-gray-800">{TIP_OPTIONS.find(t => t.value===s.operation_type)?.label ?? s.operation_type}</div>
                            <div className="text-xs text-gray-400">{fmtDate(s.transport_start_date)}</div>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            <div>{s.loading_location||'—'}</div>
                            <div className="text-gray-400">→ {s.unloading_location||'—'}</div>
                          </td>
                          <td className="px-4 py-3 text-gray-700 font-mono text-xs">{s.vehicle_no||'—'}</td>
                          <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                          <td className="px-4 py-3">
                            {s.uit_code ? (
                              <div className="flex items-center gap-1">
                                <span className="font-mono text-xs text-gray-700" title={s.uit_code}>{s.uit_code.slice(0,10)}…</span>
                                <button onClick={() => { void navigator.clipboard?.writeText(s.uit_code!); toast.success('Copiat!') }}>
                                  <Copy className="w-3 h-3 text-gray-400 hover:text-gray-600" />
                                </button>
                              </div>
                            ) : <span className="text-xs text-gray-400 italic">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={() => void openDetail(s.id)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100" title="Detalii">
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                              {canGenerate && (
                                <button
                                  onClick={() => tokenOk ? void generateUit(s.id) : toast.error('Configurați tokenul ANAF în tab Setări →')}
                                  disabled={generating===s.id}
                                  title={tokenOk ? 'Generează cod UIT via ANAF' : 'Token ANAF lipsă — configurați în Setări'}
                                  className={`flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                                    tokenOk
                                      ? 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-50'
                                      : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
                                  }`}>
                                  {generating===s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />} Generează UIT
                                </button>
                              )}
                              {canPoll && (
                                <button onClick={() => void doAction(s.id, 'poll', setPolling)} disabled={polling===s.id}
                                  className="p-1.5 text-purple-500 hover:text-purple-700 rounded hover:bg-purple-50" title="Verifică status">
                                  {polling===s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                </button>
                              )}
                              {canCancel && (
                                <button onClick={() => void doAction(s.id, 'cancel', setCancelling)} disabled={cancelling===s.id}
                                  className="p-1.5 text-red-400 hover:text-red-600 rounded hover:bg-red-50" title="Șterge">
                                  {cancelling===s.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
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
        </>
      )}

      {/* Detail panel */}
      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDetail(null)} />
          <div className="relative z-10 ml-auto bg-white w-full sm:w-[480px] h-full shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-sm font-semibold">Detalii transport</h2>
              <button onClick={() => setDetail(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <ArrowLeft className="w-4 h-4" />
              </button>
            </div>
            {detailLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
            ) : detail && (
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 text-sm">
                <div className="flex items-center gap-3 flex-wrap">
                  <StatusBadge status={detail.status} />
                  {detail.uit_code && (
                    <div className="flex items-center gap-1.5 bg-green-50 border border-green-300 px-3 py-1.5 rounded-lg">
                      <span className="text-xs font-semibold text-green-800">Cod UIT:</span>
                      <span className="font-mono text-xs font-bold text-green-900">{detail.uit_code}</span>
                      <button onClick={() => { void navigator.clipboard?.writeText(detail.uit_code!); toast.success('Copiat!') }} title="Copiază">
                        <Copy className="w-3.5 h-3.5 text-green-600" />
                      </button>
                    </div>
                  )}
                </div>
                {detail.validation_errors && detail.validation_errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <div className="text-xs font-semibold text-red-700 mb-1">Erori validare ({detail.validation_errors.length})</div>
                    <ul className="text-xs text-red-600 space-y-0.5 list-disc list-inside">
                      {detail.validation_errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-gray-500">Tip:</span> <strong>{detail.operation_type}</strong></div>
                  <div><span className="text-gray-500">Data:</span> <strong>{fmtDate(detail.transport_start_date)}</strong></div>
                  <div><span className="text-gray-500">Vehicul:</span> <strong>{detail.vehicle_no}</strong></div>
                  {detail.carrier_name && <div><span className="text-gray-500">Transportator:</span> <strong>{detail.carrier_name}</strong></div>}
                  <div className="col-span-2"><span className="text-gray-500">Rută:</span> <strong>{detail.loading_location} → {detail.unloading_location}</strong></div>
                  {detail.source_document_ref && <div className="col-span-2"><span className="text-gray-500">Ref. document:</span> <strong>{detail.source_document_ref}</strong></div>}
                </div>
                {detail.goods.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-700 mb-1">Bunuri ({detail.goods.length})</div>
                    <div className="space-y-1">
                      {detail.goods.map(g => (
                        <div key={g.id} className="flex justify-between text-xs bg-gray-50 rounded-lg px-3 py-1.5">
                          <span>{g.name}{g.nc_code && <span className="text-gray-400 ml-1">({g.nc_code})</span>}</span>
                          <span className="text-gray-500">{g.quantity} {g.uom}{g.gross_weight_kg ? ` · ${g.gross_weight_kg}kg` : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {detail.logs.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-700 mb-1">Log ANAF</div>
                    <div className="space-y-1">
                      {detail.logs.map(l => (
                        <div key={l.id} className={`text-xs rounded-lg px-3 py-1.5 flex justify-between ${l.error_message ? 'bg-red-50' : 'bg-gray-50'}`}>
                          <span className={l.error_message ? 'text-red-600' : 'text-gray-600'}>{l.request_type} · {l.http_status ?? '—'} · {l.anaf_status ?? '—'}{l.error_message ? ` · ${l.error_message.slice(0,40)}` : ''}</span>
                          <span className="text-gray-400">{fmtDate(l.created_at)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  {!detail.uit_code && ['draft','ready_to_submit','validated','validation_failed','rejected'].includes(detail.status) && (
                    <button
                      onClick={() => (token?.connected && !token.expired) ? void generateUit(detail.id) : toast.error('Configurați tokenul ANAF în tab Setări →')}
                      disabled={generating===detail.id}
                      title={(token?.connected && !token.expired) ? 'Trimite la ANAF și salvează UIT' : 'Token ANAF lipsă — configurați în tab Setări'}
                      className={`flex-1 flex items-center justify-center gap-1 py-2 text-sm font-semibold rounded-lg transition-colors ${
                        (token?.connected && !token.expired)
                          ? 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-50'
                          : 'bg-gray-100 text-gray-400 border border-gray-200'
                      }`}>
                      {generating===detail.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                      {generating===detail.id ? 'Se generează...' : 'Generează cod UIT'}
                    </button>
                  )}
                  {['submitted','processing'].includes(detail.status) && detail.anaf_upload_index && (
                    <button onClick={() => void doAction(detail.id, 'poll', setPolling)} disabled={polling===detail.id}
                      className="flex-1 flex items-center justify-center gap-1 py-2 border border-purple-300 text-purple-700 text-sm font-medium rounded-lg hover:bg-purple-50 disabled:opacity-50">
                      {polling===detail.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Verifică status
                    </button>
                  )}
                  {!['deleted','confirmed'].includes(detail.status) && (
                    <button onClick={() => void doAction(detail.id, 'cancel', setCancelling)} disabled={cancelling===detail.id}
                      className="py-2 px-3 border border-red-200 text-red-600 text-sm rounded-lg hover:bg-red-50 disabled:opacity-50">
                      {cancelling===detail.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Wizard */}
      {showWizard && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowWizard(false)} />
          <div className="relative z-10 bg-white w-full sm:max-w-[520px] sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[95vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <div>
                <h2 className="text-sm font-semibold">Adaugă transport RO e-Transport</h2>
                <div className="flex items-center gap-1 mt-1.5">
                  {[1,2,3,4].map(n => <div key={n} className={`h-1.5 w-10 rounded-full ${n<=wizardStep?'bg-brand-600':'bg-gray-200'}`} />)}
                  <span className="text-xs text-gray-400 ml-1">Pas {wizardStep}/4 · {['Tip & dată','Locații','Bunuri','Vehicul'][wizardStep-1]}</span>
                </div>
              </div>
              <button onClick={() => setShowWizard(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {wizardStep === 1 && <>
                <div>
                  <label className={lbl}>Tip operațiune *</label>
                  <div className="grid grid-cols-2 gap-2">
                    {TIP_OPTIONS.map(t => (
                      <button key={t.value} type="button" onClick={() => setWForm(f => ({...f,operation_type:t.value}))}
                        className={`px-3 py-2.5 text-left rounded-lg border text-sm transition-colors ${wForm.operation_type===t.value?'border-brand-500 bg-brand-50 text-brand-700':'border-gray-200 hover:border-gray-300'}`}>
                        <div className="font-medium">{t.label}</div>
                        <div className="text-xs text-gray-400">{t.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={lbl}>Dată început transport *</label>
                  <input type="date" className={inp} value={wForm.transport_start_date}
                    onChange={e => setWForm(f => ({...f,transport_start_date:e.target.value}))} />
                </div>
                <div>
                  <label className={lbl}>Document referință (factură, aviz...)</label>
                  <input className={inp} placeholder="ex: FCT-001/2026" value={wForm.source_document_ref}
                    onChange={e => setWForm(f => ({...f,source_document_ref:e.target.value}))} />
                </div>
              </>}

              {wizardStep === 2 && <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Țară încărcare</label>
                    <input className={inp} value={wForm.loading_country} maxLength={2}
                      onChange={e => setWForm(f => ({...f,loading_country:e.target.value.toUpperCase().slice(0,2)}))} />
                  </div>
                  <div>
                    <label className={lbl}>Localitate încărcare *</label>
                    <input className={inp} placeholder="ex: Cluj-Napoca, Cluj" value={wForm.loading_location}
                      onChange={e => setWForm(f => ({...f,loading_location:e.target.value}))} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Țară descărcare</label>
                    <input className={inp} value={wForm.unloading_country} maxLength={2}
                      onChange={e => setWForm(f => ({...f,unloading_country:e.target.value.toUpperCase().slice(0,2)}))} />
                  </div>
                  <div>
                    <label className={lbl}>Localitate descărcare *</label>
                    <input className={inp} placeholder="ex: București, B" value={wForm.unloading_location}
                      onChange={e => setWForm(f => ({...f,unloading_location:e.target.value}))} />
                  </div>
                </div>
              </>}

              {wizardStep === 3 && <>
                <p className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  Codul NC (primele 8 cifre TARIC) este obligatoriu pentru categorii cu risc fiscal ridicat (produse alimentare, combustibili, materiale de construcții, metale, etc.).
                </p>
                {goods.map((g, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-600">Bun {i+1}</span>
                      {goods.length > 1 && (
                        <button type="button" onClick={() => setGoods(gs => gs.filter((_,j) => j!==i))} className="text-red-400 hover:text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <input className={inp} placeholder="Denumire bun *" value={g.name}
                      onChange={e => setGoods(gs => gs.map((x,j) => j===i ? {...x,name:e.target.value} : x))} />
                    <div className="grid grid-cols-3 gap-2">
                      <input className={inp} placeholder="Cod NC (8 cif.)" value={g.nc_code} maxLength={8}
                        onChange={e => setGoods(gs => gs.map((x,j) => j===i ? {...x,nc_code:e.target.value} : x))} />
                      <input className={inp} placeholder="Cantitate" type="number" min="0" value={g.quantity}
                        onChange={e => setGoods(gs => gs.map((x,j) => j===i ? {...x,quantity:e.target.value} : x))} />
                      <select className={inp} value={g.uom}
                        onChange={e => setGoods(gs => gs.map((x,j) => j===i ? {...x,uom:e.target.value} : x))}>
                        <option value="C62">buc (C62)</option>
                        <option value="KGM">kg (KGM)</option>
                        <option value="TNE">tone (TNE)</option>
                        <option value="LTR">litri (LTR)</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input className={inp} placeholder="Greutate brută (kg)" type="number" min="0" value={g.gross_weight_kg}
                        onChange={e => setGoods(gs => gs.map((x,j) => j===i ? {...x,gross_weight_kg:e.target.value} : x))} />
                      <input className={inp} placeholder="Valoare RON (fără TVA)" type="number" min="0" value={g.value_ron}
                        onChange={e => setGoods(gs => gs.map((x,j) => j===i ? {...x,value_ron:e.target.value} : x))} />
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => setGoods(gs => [...gs, emptyGood()])}
                  className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-800">
                  <Plus className="w-4 h-4" /> Adaugă bun
                </button>
              </>}

              {wizardStep === 4 && <>
                <div>
                  <label className={lbl}>Nr. vehicul (fără spații) *</label>
                  <input className={inp} placeholder="ex: CJ01ABC" value={wForm.vehicle_no}
                    onChange={e => setWForm(f => ({...f,vehicle_no:e.target.value}))} required />
                </div>
                <div>
                  <label className={lbl}>Nr. remorcă (opțional)</label>
                  <input className={inp} placeholder="ex: CJ01REM" value={wForm.trailer1_no}
                    onChange={e => setWForm(f => ({...f,trailer1_no:e.target.value}))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Transportator (denumire)</label>
                    <input className={inp} placeholder="SC Transport SRL" value={wForm.carrier_name}
                      onChange={e => setWForm(f => ({...f,carrier_name:e.target.value}))} />
                  </div>
                  <div>
                    <label className={lbl}>CUI transportator</label>
                    <input className={inp} placeholder="RO12345678" value={wForm.carrier_cui}
                      onChange={e => setWForm(f => ({...f,carrier_cui:e.target.value}))} />
                  </div>
                </div>
                <div>
                  <label className={lbl}>Notițe</label>
                  <textarea className={`${inp} resize-none`} rows={2} value={wForm.notes}
                    onChange={e => setWForm(f => ({...f,notes:e.target.value}))} />
                </div>
              </>}
            </div>

            <div className="flex gap-2 px-5 pb-5 pt-3 border-t border-gray-100 flex-shrink-0">
              {wizardStep > 1 && (
                <button onClick={() => setWizardStep(s => s-1)}
                  className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50">
                  ← Înapoi
                </button>
              )}
              {wizardStep < 4 ? (
                <button onClick={() => setWizardStep(s => s+1)}
                  className="flex-1 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700">
                  Continuă →
                </button>
              ) : (
                <button onClick={() => void handleWizardSubmit()} disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-lg hover:bg-brand-700 disabled:opacity-50">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                  {saving ? 'Se salvează...' : 'Creează transport'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
