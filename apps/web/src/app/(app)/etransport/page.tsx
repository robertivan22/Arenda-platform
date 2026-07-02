'use client'

export const runtime = 'edge'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Truck, Plus, Loader2, CheckCircle2, AlertTriangle,
  RefreshCw, Key, FileText, Settings,
  Copy, Trash2, ExternalLink, ChevronDown, ChevronUp,
} from 'lucide-react'

interface TokenStatus { connected: boolean; expired?: boolean; expires_at?: string; cif?: string }
interface Good {
  nc_code: string; name: string; quantity: string; uom: string
  gross_weight_kg: string; value_ron: string
  nc_code_confirmed: boolean; nc_code_description: string
}
interface NcSuggestion {
  code: string; code_type: string; description_ro: string
  confidence: number; is_auto: boolean; warning: string | null; source_url: string
}
interface AnafErrorState {
  type: string; title: string; message: string; actions: string[]; technical: string
}
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

const STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  draft:             { label: 'Proiect',              color: 'bg-blue-50 text-blue-700',    dot: 'bg-blue-400' },
  ready_to_submit:   { label: 'Gata de trimitere',    color: 'bg-blue-50 text-blue-700',    dot: 'bg-blue-400' },
  validated:         { label: 'Validat',              color: 'bg-blue-50 text-blue-700',    dot: 'bg-blue-400' },
  validation_failed: { label: 'Eroare validare',      color: 'bg-red-50 text-red-600',      dot: 'bg-red-400' },
  submitted:         { label: 'Trimis ANAF',          color: 'bg-amber-50 text-amber-700',  dot: 'bg-amber-400' },
  processing:        { label: 'În transport',         color: 'bg-amber-50 text-amber-700',  dot: 'bg-amber-400' },
  accepted:          { label: 'Aprobat',              color: 'bg-green-50 text-green-700',  dot: 'bg-green-500' },
  rejected:          { label: 'Expirat',              color: 'bg-red-50 text-red-600',      dot: 'bg-red-400' },
  anaf_auth_error:   { label: 'Eroare ANAF',          color: 'bg-orange-50 text-orange-700',dot: 'bg-orange-400' },
  uit_generated:     { label: 'Aprobat',              color: 'bg-green-100 text-green-800', dot: 'bg-green-500' },
  deleted:           { label: 'Șters',                color: 'bg-gray-100 text-gray-500',   dot: 'bg-gray-300' },
}

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' }
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${m.color}`}>{m.label}</span>
}

function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s.length > 10 ? s : s + 'T00:00:00').toLocaleDateString('ro-RO')
}

function emptyGood(): Good {
  return { nc_code: '', name: '', quantity: '1', uom: 'C62', gross_weight_kg: '', value_ron: '', nc_code_confirmed: false, nc_code_description: '' }
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
  const [anafError,    setAnafError]    = useState<AnafErrorState | null>(null)
  const [showTechnical,setShowTechnical]= useState(false)
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
    machine_id: '',
  })
  const [goods, setGoods] = useState<Good[]>([emptyGood()])
  const [machines, setMachines] = useState<Array<{ id: string; name: string; plate: string | null; taric_code: string | null }>>([])
  // NC/TARIC suggestion state per good index
  const [ncSuggestions, setNcSuggestions] = useState<Record<number, NcSuggestion[]>>({})
  const [ncLoading,     setNcLoading]     = useState<Record<number, boolean>>({})
  const [ncDropdown,    setNcDropdown]    = useState<number | null>(null)

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

  // Load machines for auto-fill
  useEffect(() => {
    createClient().from('machines')
      .select('id, name, plate, taric_code')
      .eq('is_active', true).order('name').limit(100)
      .then(({ data }) => { if (data) setMachines(data as any[]) })
  }, [])

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
    setAnafError(null)
    try {
      const r = await fetch(`/api/etransport/shipments/${id}/generate-uit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const d = await r.json() as any
      if (d.status === 'already_generated') {
        toast.info(`UIT deja generat: ${d.uitCode}`); return
      }
      if (d.status === 'validation_failed') {
        toast.error(`Validare eșuată: ${d.errors?.[0] ?? 'Date lipsă'}`)
        void loadShipments(); if (detail?.id === id) void openDetail(id)
        return
      }
      if (d.error_type || d.title) {
        // Structured ANAF error — show in card
        setAnafError({ type: d.error_type ?? 'anaf_unknown', title: d.title, message: d.message, actions: d.actions ?? [], technical: d.technical ?? d.error ?? '' })
        void loadShipments(); if (detail?.id === id) void openDetail(id)
        return
      }
      if (!r.ok) {
        toast.error(d.error ?? 'Eroare generare UIT'); return
      }
      setAnafError(null)
      toast.success(`✅ Cod UIT generat: ${d.uitCode}`)
      void loadShipments()
      if (detail?.id === id) void openDetail(id)
    } catch {
      toast.error('Eroare de rețea')
    } finally {
      setGenerating(null)
    }
  }

  // NC/TARIC suggestion lookup (debounce handled by caller)
  async function fetchNcSuggestions(goodsIdx: number, name: string) {
    if (!name || name.length < 3) {
      setNcSuggestions(s => ({ ...s, [goodsIdx]: [] }))
      return
    }
    setNcLoading(l => ({ ...l, [goodsIdx]: true }))
    try {
      const r = await fetch(`/api/customs-codes/suggest?query=${encodeURIComponent(name)}`)
      const d = await r.json() as { suggestions?: NcSuggestion[] }
      const suggs = d.suggestions ?? []
      setNcSuggestions(s => ({ ...s, [goodsIdx]: suggs }))
      // Auto-fill if top suggestion has high confidence AND no code set yet
      if (suggs.length > 0 && suggs[0].is_auto && !goods[goodsIdx]?.nc_code) {
        setGoods(gs => gs.map((g, j) => j === goodsIdx
          ? { ...g, nc_code: suggs[0].code, nc_code_confirmed: false, nc_code_description: suggs[0].description_ro }
          : g))
      }
    } finally {
      setNcLoading(l => ({ ...l, [goodsIdx]: false }))
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
            value_ron: g.value_ron ? Number(g.value_ron) : null,
            nc_code_confirmed: g.nc_code_confirmed,
            nc_code_description: g.nc_code_description || null })) }) })
      const d = await r.json() as any
      if (!r.ok) { toast.error(d.error ?? 'Eroare creare'); return }
      toast.success('Transport creat')
      setShowWizard(false); setWizardStep(1)
      setWForm({ operation_type:'national', transport_start_date: new Date().toISOString().split('T')[0],
        loading_country:'RO', loading_location:'', unloading_country:'RO', unloading_location:'',
        vehicle_no:'', trailer1_no:'', carrier_name:'', carrier_cui:'', source_document_ref:'', notes:'', machine_id:'' })
      setGoods([emptyGood()])
      void loadShipments()
    } finally { setSaving(false) }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return shipments.filter(s => {
      const matchFilter = () => {
        if (filterStatus === 'all') return true
        if (filterStatus === 'proiect')   return ['draft','ready_to_submit','validated'].includes(s.status)
        if (filterStatus === 'aprobat')   return ['accepted','uit_generated'].includes(s.status)
        if (filterStatus === 'transport') return ['submitted','processing'].includes(s.status)
        if (filterStatus === 'expirat')   return ['rejected','validation_failed'].includes(s.status)
        return s.status === filterStatus
      }
      if (!matchFilter()) return false
      if (!q) return true
      return (s.uit_code ?? '').toLowerCase().includes(q) || s.vehicle_no.toLowerCase().includes(q)
          || (s.machine_name ?? '').toLowerCase().includes(q) || s.loading_location.toLowerCase().includes(q)
    })
  }, [shipments, filterStatus, search])

  const stats = useMemo(() => ({
    active:    shipments.filter(s => ['accepted','uit_generated'].includes(s.status)).length,
    transport: shipments.filter(s => ['submitted','processing'].includes(s.status)).length,
    proiecte:  shipments.filter(s => ['draft','ready_to_submit','validated'].includes(s.status)).length,
    expirate:  shipments.filter(s => ['rejected','validation_failed'].includes(s.status)).length,
  }), [shipments])

  const inp = 'w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500'
  const lbl = 'block text-xs font-semibold text-gray-700 mb-1'

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ─── Page Header ──────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest mb-0.5">E-TRANSPORT · ANAF</p>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Transport Mărfuri</h1>
            </div>
            <div className="flex items-center gap-2">
              <a href="https://etransport.anaf.ro" target="_blank" rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                <ExternalLink className="w-3.5 h-3.5" /> ANAF Portal
              </a>
              <button onClick={() => setTab(tab === 'list' ? 'settings' : 'list')}
                className={`p-2 border rounded-lg transition-colors ${tab === 'settings' ? 'border-brand-500 text-brand-600 bg-brand-50' : 'border-gray-200 text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}>
                <Settings className="w-4 h-4" />
              </button>
              <button onClick={() => { setShowWizard(true); setWizardStep(1) }}
                className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-orange-500 text-white text-sm font-semibold rounded-lg hover:bg-orange-600 transition-colors shadow-sm">
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Declarație nouă</span>
                <span className="sm:hidden">Adaugă</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">

      {!tokenLoading && (!token?.connected || token.expired) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 flex items-center gap-3 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Token ANAF lipsă sau expirat — declararea nu va funcționa.
            <button onClick={() => setTab('settings')} className="ml-1 underline font-semibold">Configurați tokenul →</button>
          </span>
        </div>
      )}

      {/* ─── ANAF Error Card ─────────────────────────────────────────────── */}
      {anafError && (
        <div className={`rounded-xl border p-5 mb-5 ${
          anafError.type === 'anaf_unauthorized' ? 'bg-orange-50 border-orange-300' :
          anafError.type === 'anaf_bad_request'  ? 'bg-yellow-50 border-yellow-300' :
          'bg-red-50 border-red-300'
        }`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                anafError.type === 'anaf_unauthorized' ? 'text-orange-600' : 'text-red-600'
              }`} />
              <div className="flex-1">
                <h3 className="text-sm font-bold text-gray-900 mb-1">{anafError.title}</h3>
                <p className="text-sm text-gray-700 mb-3">{anafError.message}</p>
                {anafError.actions.length > 0 && (
                  <div className="mb-3">
                    <p className="text-xs font-semibold text-gray-700 mb-1">Ce trebuie să faci:</p>
                    <ol className="text-xs text-gray-600 space-y-0.5 list-decimal list-inside">
                      {anafError.actions.map((a, i) => <li key={i}>{a}</li>)}
                    </ol>
                  </div>
                )}
                <button onClick={() => setShowTechnical(v => !v)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
                  {showTechnical ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {showTechnical ? 'Ascunde detalii tehnice' : 'Vezi detalii tehnice'}
                </button>
                {showTechnical && (
                  <pre className="mt-2 text-xs bg-gray-900 text-gray-100 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">{anafError.technical}</pre>
                )}
              </div>
            </div>
            <button onClick={() => { setAnafError(null); setShowTechnical(false) }} className="text-gray-400 hover:text-gray-600 flex-shrink-0">✕</button>
          </div>
          {anafError.type === 'anaf_unauthorized' && (
            <div className="mt-3 pt-3 border-t border-orange-200">
              <button onClick={() => setTab('settings')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white text-xs font-semibold rounded-lg hover:bg-orange-700">
                <Key className="w-3.5 h-3.5" /> Reconectează contul ANAF →
              </button>
            </div>
          )}
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
          {/* ─── Stats ────────────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {([
              { label: 'UIT-uri active', value: stats.active,    bg: 'bg-green-50',  border: 'border-green-200', num: 'text-green-800', sub: 'text-green-600', icon: <CheckCircle2 className="w-5 h-5 text-green-500" /> },
              { label: 'În transport',   value: stats.transport,  bg: 'bg-orange-50', border: 'border-orange-200',num: 'text-orange-800',sub: 'text-orange-600',icon: <Truck className="w-5 h-5 text-orange-400" /> },
              { label: 'Proiecte',       value: stats.proiecte,  bg: 'bg-blue-50',   border: 'border-blue-200',  num: 'text-blue-800',  sub: 'text-blue-600',  icon: <FileText className="w-5 h-5 text-blue-400" /> },
              { label: 'Expirate',       value: stats.expirate,  bg: 'bg-red-50',    border: 'border-red-200',   num: 'text-red-800',   sub: 'text-red-600',   icon: <AlertTriangle className="w-5 h-5 text-red-400" /> },
            ] as const).map(s => (
              <div key={s.label} className={`${s.bg} border ${s.border} rounded-xl p-4`}>
                <div className="flex items-start justify-between mb-3">{s.icon}</div>
                <div className={`text-2xl font-bold ${s.num}`}>{s.value}</div>
                <div className={`text-xs font-medium mt-0.5 ${s.sub}`}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* ─── List panel ──────────────────────────────────────────── */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            {/* Search + filter tabs */}
            <div className="px-4 pt-4 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <input
                  className="flex-1 min-w-0 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 bg-gray-50"
                  placeholder="Caută UIT, vehicul, localitate..."
                  value={search} onChange={e => setSearch(e.target.value)} />
                <button onClick={() => void loadShipments()} className="p-2 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg flex-shrink-0">
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-1 mt-3 overflow-x-auto pb-0.5 [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
                {([
                  { key: 'all',       label: 'Toate' },
                  { key: 'proiect',   label: 'Proiect' },
                  { key: 'aprobat',   label: 'Aprobat' },
                  { key: 'transport', label: 'În transport' },
                  { key: 'expirat',   label: 'Expirat' },
                ] as const).map(f => (
                  <button key={f.key} onClick={() => setFilterStatus(f.key)}
                    className={`flex-shrink-0 px-3 py-1.5 text-xs font-semibold rounded-full transition-colors ${
                      filterStatus === f.key
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                    }`}>
                    {f.label}
                  </button>
                ))}
                <span className="ml-auto pl-3 text-xs text-gray-400 flex-shrink-0">{filtered.length} declarații</span>
              </div>
            </div>

            {/* Cards */}
            {loading ? (
              <div className="flex justify-center items-center gap-2 py-14 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin" />Se încarcă...
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <Truck className="w-10 h-10 mx-auto mb-3 opacity-25" />
                <p className="text-sm">Niciun transport. Apăsați „Declarație nouă" pentru a crea primul.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filtered.map(s => {
                  const meta = STATUS_META[s.status] ?? { label: s.status, color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' }
                  const isSelected = detail?.id === s.id
                  const canGenerate = !s.uit_code && ['draft','ready_to_submit','validated','validation_failed','rejected'].includes(s.status)
                  const tokenOk = !!(token?.connected && !token.expired)
                  return (
                    <button key={s.id} onClick={() => void openDetail(s.id)}
                      className={`w-full text-left px-4 py-3.5 hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50/70' : ''}`}>
                      <div className="flex items-start gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0 ring-2 ring-white ring-offset-1 ${meta.dot}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${meta.color}`}>{meta.label}</span>
                            {s.uit_code && <span className="text-xs text-gray-400 font-mono truncate max-w-[160px] sm:max-w-none">{s.uit_code}</span>}
                          </div>
                          <p className="text-sm font-medium text-gray-900 truncate mb-1">
                            {s.loading_location || '—'} → {s.unloading_location || '—'}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-gray-500 flex-wrap">
                            <span className="font-mono font-semibold">{s.vehicle_no}</span>
                            <span>{fmtDate(s.transport_start_date)}</span>
                            {s.machine_name && <span className="text-gray-400 italic">{s.machine_name}</span>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                            {TIP_OPTIONS.find(t => t.value === s.operation_type)?.label ?? s.operation_type}
                          </span>
                          {canGenerate && (
                            <button
                              onClick={e => { e.stopPropagation(); tokenOk ? void generateUit(s.id) : toast.error('Configurați tokenul ANAF în tab Setări →') }}
                              disabled={generating === s.id}
                              className={`flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-lg transition-colors ${
                                tokenOk ? 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-50' : 'bg-gray-100 text-gray-400 border border-gray-200'
                              }`}>
                              {generating === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                              UIT
                            </button>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* ─── Help ─────────────────────────────────────────────────── */}
          <ETransportHelp />
        </>
      )}
      </div>

      {/* ─── Detail drawer ────────────────────────────────────────────────── */}
      {(detail || detailLoading) && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDetail(null)} />
          {/* Mobile: bottom sheet | Desktop: right drawer */}
          <div className="absolute inset-x-0 bottom-0 sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[460px] bg-white rounded-t-2xl sm:rounded-none shadow-2xl flex flex-col max-h-[90vh] sm:max-h-full">
            {/* Drag handle mobile */}
            <div className="sm:hidden flex justify-center pt-2.5 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-gray-200" />
            </div>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <h2 className="text-sm font-semibold text-gray-900">Detalii declarație</h2>
              <button onClick={() => setDetail(null)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 text-lg leading-none">✕</button>
            </div>
            {detailLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
            ) : detail && (
              <div className="flex-1 overflow-y-auto">
                {/* Status + UIT + Actions */}
                <div className="px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <StatusBadge status={detail.status} />
                    {detail.uit_code && (
                      <span className="font-mono text-xs bg-green-50 border border-green-200 text-green-800 px-2 py-0.5 rounded-lg font-semibold break-all">
                        {detail.uit_code}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mb-3">Creat: {fmtDate(detail.created_at)}</p>
                  <div className="flex gap-2 flex-wrap">
                    {detail.uit_code && (
                      <button onClick={() => { void navigator.clipboard?.writeText(detail.uit_code!); toast.success('Copiat!') }}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                        <Copy className="w-3 h-3" /> Copiază UIT
                      </button>
                    )}
                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                      🖨 Printează
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                      ↓ PDF
                    </button>
                  </div>
                </div>

                {/* Validation errors */}
                {detail.validation_errors && detail.validation_errors.length > 0 && (
                  <div className="mx-5 mt-4 bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="text-xs font-semibold text-red-700 mb-1">Erori validare ({detail.validation_errors.length})</p>
                    <ul className="text-xs text-red-600 space-y-0.5 list-disc list-inside">
                      {detail.validation_errors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </div>
                )}

                {/* PARTENERI */}
                <div className="px-5 pt-4 pb-3 border-b border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Parteneri</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Transportator</p>
                      <p className="text-sm font-semibold text-gray-900 leading-tight">{detail.carrier_name || '—'}</p>
                      {detail.carrier_cui && <p className="text-xs text-gray-400 mt-0.5">{detail.carrier_cui}</p>}
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-1">Tip operațiune</p>
                      <p className="text-sm font-semibold text-gray-900 leading-tight">{TIP_OPTIONS.find(t => t.value === detail.operation_type)?.label ?? detail.operation_type}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{fmtDate(detail.transport_start_date)}</p>
                    </div>
                  </div>
                </div>

                {/* BUNURI TRANSPORTATE */}
                {detail.goods.length > 0 && (
                  <div className="px-5 py-4 border-b border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Bunuri transportate</p>
                    <div className="space-y-2.5">
                      {detail.goods.map(g => (
                        <div key={g.id} className="flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{g.name}</p>
                            {g.nc_code && <p className="text-xs text-gray-400">CN: {g.nc_code}</p>}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className="text-sm font-semibold text-gray-900">{g.gross_weight_kg ? `${g.gross_weight_kg} kg` : `${g.quantity} ${g.uom}`}</p>
                            {g.value_ron && <p className="text-xs text-gray-500">{g.value_ron.toLocaleString('ro-RO')} RON</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                    {detail.goods.some(g => g.gross_weight_kg || g.value_ron) && (
                      <div className="flex justify-between items-center pt-3 mt-3 border-t border-gray-200">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Total</span>
                        <div className="flex items-center gap-3">
                          {detail.goods.some(g => g.gross_weight_kg) && (
                            <span className="text-sm font-bold text-gray-900">
                              {detail.goods.reduce((sum, g) => sum + (g.gross_weight_kg ?? 0), 0).toLocaleString('ro-RO')} kg
                            </span>
                          )}
                          {detail.goods.some(g => g.value_ron) && (
                            <span className="text-sm font-bold text-orange-600">
                              {detail.goods.reduce((sum, g) => sum + (g.value_ron ?? 0), 0).toLocaleString('ro-RO')} RON
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TRANSPORT */}
                <div className="px-5 py-4 border-b border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Transport</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Nr. înmatriculare</p>
                      <p className="text-sm font-bold text-gray-900 font-mono">{detail.vehicle_no}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Tip vehicul</p>
                      <p className="text-sm font-semibold text-gray-900">{detail.trailer1_no ? 'Camion + remorcă' : 'Camion'}</p>
                    </div>
                    {detail.trailer1_no && (
                      <div>
                        <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Remorcă</p>
                        <p className="text-sm font-semibold text-gray-900 font-mono">{detail.trailer1_no}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Data încărcare</p>
                      <p className="text-sm font-semibold text-gray-900">{fmtDate(detail.transport_start_date)}</p>
                    </div>
                  </div>
                </div>

                {/* LOCAȚII */}
                <div className="px-5 py-4 border-b border-gray-100">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Locații</p>
                  <div className="flex items-start gap-3 pb-2">
                    <div className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0 mt-0.5 ring-2 ring-green-200" />
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Punct încărcare</p>
                      <p className="text-sm text-gray-900">{detail.loading_location}</p>
                      {detail.loading_country !== 'RO' && <p className="text-xs text-gray-400">{detail.loading_country}</p>}
                    </div>
                  </div>
                  <div className="ml-1.5 w-px h-5 bg-gray-200" />
                  <div className="flex items-start gap-3 pt-2">
                    <div className="w-3 h-3 rounded-full border-2 border-orange-400 bg-white flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">Punct descărcare</p>
                      <p className="text-sm text-gray-900">{detail.unloading_location}</p>
                      {detail.unloading_country !== 'RO' && <p className="text-xs text-gray-400">{detail.unloading_country}</p>}
                    </div>
                  </div>
                </div>

                {/* ISTORIC STATUS */}
                {detail.logs.length > 0 && (
                  <div className="px-5 py-4 border-b border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Istoric status</p>
                    <div className="space-y-3">
                      {detail.logs.map(l => (
                        <div key={l.id} className="flex items-start gap-2.5">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${l.error_message ? 'bg-red-500' : 'bg-green-500'}`} />
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold ${l.error_message ? 'text-red-700' : 'text-gray-800'}`}>
                              {l.request_type}{l.anaf_status ? ` · ${l.anaf_status}` : l.http_status ? ` · HTTP ${l.http_status}` : ''}
                            </p>
                            {l.cod_uit && <p className="text-xs text-green-700 font-mono">UIT: {l.cod_uit}</p>}
                            {l.error_message && <p className="text-xs text-red-500 truncate">{l.error_message}</p>}
                            <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(l.created_at)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="px-5 py-4 space-y-2">
                  {!detail.uit_code && ['draft','ready_to_submit','validated','validation_failed','rejected'].includes(detail.status) && (
                    <button
                      onClick={() => (token?.connected && !token.expired) ? void generateUit(detail.id) : toast.error('Configurați tokenul ANAF în tab Setări →')}
                      disabled={generating === detail.id}
                      className={`w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold rounded-xl transition-colors ${
                        (token?.connected && !token.expired)
                          ? 'bg-green-600 text-white hover:bg-green-700 disabled:opacity-50'
                          : 'bg-gray-100 text-gray-400 border border-gray-200'
                      }`}>
                      {generating === detail.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                      {generating === detail.id ? 'Se generează...' : 'Generează cod UIT'}
                    </button>
                  )}
                  {['submitted','processing'].includes(detail.status) && detail.anaf_upload_index && (
                    <button onClick={() => void doAction(detail.id, 'poll', setPolling)} disabled={polling === detail.id}
                      className="w-full flex items-center justify-center gap-2 py-3 border border-purple-300 text-purple-700 text-sm font-semibold rounded-xl hover:bg-purple-50 disabled:opacity-50">
                      {polling === detail.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} Verifică status ANAF
                    </button>
                  )}
                  {!['deleted','confirmed'].includes(detail.status) && (
                    <button onClick={() => void doAction(detail.id, 'cancel', setCancelling)} disabled={cancelling === detail.id}
                      className="w-full flex items-center justify-center gap-2 py-3 border border-red-200 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-50 disabled:opacity-50">
                      {cancelling === detail.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      Anulează declarația
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
                <p className="text-xs text-gray-600 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                  Codul <strong>CN (8 cifre)</strong> sau <strong>TARIC (10 cifre)</strong> identifică tariful vamal al bunului.
                  Obligatoriu pentru declararea e-Transport la ANAF.
                  Aplicația sugerează automat codul pe baza denumirii —{' '}
                  <strong>confirmare obligatorie</strong> înainte de trimitere.
                </p>
                {goods.map((g, i) => {
                  const suggs = ncSuggestions[i] ?? []
                  const isNcLoading = ncLoading[i] ?? false
                  const hasConfirmed = g.nc_code && g.nc_code_confirmed
                  const hasSuggested = g.nc_code && !g.nc_code_confirmed
                  return (
                    <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-600">Bun {i+1}</span>
                        {goods.length > 1 && (
                          <button type="button" onClick={() => setGoods(gs => gs.filter((_,j) => j!==i))} className="text-red-400 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Denumire + trigger suggestion */}
                      <input className={inp} placeholder="Denumire bun *" value={g.name}
                        onChange={e => {
                          const name = e.target.value
                          setGoods(gs => gs.map((x,j) => j===i ? {...x, name, nc_code_confirmed: false} : x))
                          // Debounce suggestion fetch
                          clearTimeout((window as any)[`_nc_t_${i}`])
                          ;(window as any)[`_nc_t_${i}`] = setTimeout(() => void fetchNcSuggestions(i, name), 600)
                        }}
                      />

                      {/* NC/TARIC field with status indicator */}
                      <div className="relative">
                        <div className="flex gap-2 items-start">
                          <div className="flex-1 relative">
                            <div className="flex items-center gap-1">
                              <input
                                className={`${inp} pr-8 ${hasConfirmed ? 'border-green-400 bg-green-50' : hasSuggested ? 'border-amber-400 bg-amber-50' : ''}`}
                                placeholder="Cod NC/TARIC (8-10 cifre)"
                                value={g.nc_code} maxLength={10}
                                onChange={e => {
                                  setGoods(gs => gs.map((x,j) => j===i ? {...x, nc_code: e.target.value, nc_code_confirmed: false, nc_code_description: ''} : x))
                                  setNcDropdown(i)
                                }}
                                onFocus={() => { if (suggs.length > 0) setNcDropdown(i) }}
                              />
                              {isNcLoading && <Loader2 className="absolute right-2 top-2.5 w-4 h-4 animate-spin text-gray-400" />}
                            </div>

                            {/* Suggestion dropdown */}
                            {ncDropdown === i && suggs.length > 0 && (
                              <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                {suggs.map((s, si) => (
                                  <button key={si} type="button"
                                    className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-0"
                                    onClick={() => {
                                      setGoods(gs => gs.map((x,j) => j===i ? {...x, nc_code: s.code, nc_code_confirmed: false, nc_code_description: s.description_ro} : x))
                                      setNcDropdown(null)
                                    }}>
                                    <div className="flex items-center justify-between">
                                      <span className="font-mono text-sm font-bold text-gray-800">{s.code}</span>
                                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${s.confidence >= 0.85 ? 'bg-green-100 text-green-700' : s.confidence >= 0.70 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                                        {Math.round(s.confidence * 100)}% {s.code_type}
                                      </span>
                                    </div>
                                    <div className="text-xs text-gray-600 mt-0.5">{s.description_ro}</div>
                                    {s.warning && <div className="text-xs text-orange-600 mt-0.5">⚠ {s.warning}</div>}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Confirm / TARIC link buttons */}
                          {g.nc_code && !g.nc_code_confirmed && (
                            <button type="button"
                              onClick={() => setGoods(gs => gs.map((x,j) => j===i ? {...x, nc_code_confirmed: true} : x))}
                              className="flex-shrink-0 px-2.5 py-2.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700"
                              title="Confirmă codul NC/TARIC">
                              ✓ Confirmă
                            </button>
                          )}
                          {g.nc_code && (
                            <a href={`https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp?Lang=ro`}
                              target="_blank" rel="noopener noreferrer"
                              onClick={() => { void navigator.clipboard?.writeText(g.nc_code) }}
                              className="flex-shrink-0 p-2.5 border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50"
                              title="Codul a fost copiat. Verifică-l în pagina oficială TARIC.">
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>

                        {/* Status message */}
                        {hasConfirmed && (
                          <p className="text-xs text-green-700 mt-1 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Cod confirmat: {g.nc_code_description || g.nc_code}
                          </p>
                        )}
                        {hasSuggested && (
                          <p className="text-xs text-amber-700 mt-1">
                            ⚠ Cod sugerat automat — apasă <strong>✓ Confirmă</strong> după verificare sau alege alt cod din listă.
                          </p>
                        )}
                        {!g.nc_code && g.name.length >= 3 && suggs.length === 0 && !isNcLoading && (
                          <p className="text-xs text-gray-500 mt-1">
                            Nu am găsit cod NC/TARIC pentru „{g.name}".{' '}
                            <a href="https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp?Lang=ro"
                              target="_blank" rel="noopener noreferrer" className="underline text-blue-600">
                              Caută în TARIC <ExternalLink className="w-3 h-3 inline" />
                            </a>
                          </p>
                        )}
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <input className={inp} placeholder="Cantitate" type="number" min="0" value={g.quantity}
                          onChange={e => setGoods(gs => gs.map((x,j) => j===i ? {...x,quantity:e.target.value} : x))} />
                        <select className={inp} value={g.uom}
                          onChange={e => setGoods(gs => gs.map((x,j) => j===i ? {...x,uom:e.target.value} : x))}>
                          <option value="C62">buc (C62)</option>
                          <option value="KGM">kg (KGM)</option>
                          <option value="TNE">tone (TNE)</option>
                          <option value="LTR">litri (LTR)</option>
                        </select>
                        <input className={inp} placeholder="Greutate brută (kg)" type="number" min="0" value={g.gross_weight_kg}
                          onChange={e => setGoods(gs => gs.map((x,j) => j===i ? {...x,gross_weight_kg:e.target.value} : x))} />
                      </div>
                      <input className={inp} placeholder="Valoare RON (fără TVA)" type="number" min="0" value={g.value_ron}
                        onChange={e => setGoods(gs => gs.map((x,j) => j===i ? {...x,value_ron:e.target.value} : x))} />
                    </div>
                  )
                })}

                <button type="button" onClick={() => setGoods(gs => [...gs, emptyGood()])}
                  className="flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-800">
                  <Plus className="w-4 h-4" /> Adaugă bun
                </button>

                <p className="text-xs text-gray-400 border-t border-gray-100 pt-2">
                  Codul NC/TARIC este sugerat de ArendaPro pe baza nomenclatorului local și a denumirii bunului.
                  Verificarea finală aparține utilizatorului, brokerului vamal sau consultantului fiscal.
                </p>
              </>}

              {wizardStep === 4 && <>
                {/* Machine select with auto-fill */}
                <div>
                  <label className={lbl}>Utilaj din ArendaPro (opțional — autocomplează vehicul + cod TARIC)</label>
                  <select className={inp} value={wForm.machine_id}
                    onChange={e => {
                      const mid = e.target.value
                      const m = machines.find(x => x.id === mid)
                      setWForm(f => ({
                        ...f,
                        machine_id: mid,
                        vehicle_no: m?.plate ?? f.vehicle_no,
                      }))
                      // Auto-fill NC code on first good if machine has taric_code
                      if (m?.taric_code) {
                        setGoods(gs => gs.map((g, i) => i === 0 && !g.nc_code ? { ...g, nc_code: m.taric_code! } : g))
                      }
                    }}>
                    <option value="">Selectează utilaj (opțional)...</option>
                    {machines.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.name}{m.plate ? ` (${m.plate})` : ''}{m.taric_code ? ` — TARIC: ${m.taric_code}` : ''}
                      </option>
                    ))}
                  </select>
                  {wForm.machine_id && (() => {
                    const m = machines.find(x => x.id === wForm.machine_id)
                    return m && !m.taric_code ? (
                      <p className="mt-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                        Acest utilaj nu are cod TARIC/NC salvat. Completează codul în pasul Bunuri.
                      </p>
                    ) : null
                  })()}
                </div>
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

// ─── Help Panel ───────────────────────────────────────────────────────────────

function ETransportHelp() {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="mt-6 border border-blue-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-lg">📋</span>
          <span className="text-sm font-semibold text-blue-900">Ghid RO e-Transport — Tot ce trebuie să știi</span>
        </div>
        <span className="text-blue-600 text-xs">{open ? '▲ Ascunde' : '▼ Arată'}</span>
      </button>

      {open && (
        <div className="px-5 py-4 bg-white space-y-5 text-sm text-gray-700">

          {/* Ce este */}
          <section>
            <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">🚛 Ce este RO e-Transport?</h3>
            <p className="text-gray-600 text-xs leading-relaxed">
              <strong>RO e-Transport</strong> este sistemul informatic al ANAF (Agenția Națională de Administrare Fiscală) prin care se monitorizează transportul rutier de bunuri cu risc fiscal ridicat pe teritoriul României. Aplicat din 2023, sistemul impune declararea prealabilă a transporturilor și generarea unui <strong>cod UIT</strong> unic înainte de începerea transportului.
            </p>
          </section>

          {/* Ce este UIT */}
          <section>
            <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">🔑 Ce este Codul UIT?</h3>
            <div className="text-xs leading-relaxed space-y-2 text-gray-600">
              <p><strong>UIT</strong> (Unique Identifier of Transport) este un cod unic generat de <strong>ANAF</strong> după ce declarați transportul în sistemul RO e-Transport. <strong>ArendaPro nu generează local codul UIT</strong> — îl preia din răspunsul ANAF.</p>
              <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs text-gray-700">
                Exemplu UIT: <strong>RO2024ABC123456789XYZ012345678901</strong> (36 caractere alfanumerice)
              </div>
              <ul className="list-disc list-inside space-y-1">
                <li>Codul UIT trebuie comunicat șoferului înainte de plecarea în cursă</li>
                <li>Trebuie afișat la control la cererea organelor de inspecție fiscală</li>
                <li>Este unic per transport — nu se reutilizează</li>
              </ul>
            </div>
          </section>

          {/* Valabilitate */}
          <section>
            <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">⏱ Valabilitate coduri UIT</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {[
                { tip: 'Transport național', zile: '5 zile', color: 'bg-green-50 border-green-200 text-green-800' },
                { tip: 'Import (extra-UE)', zile: '15 zile', color: 'bg-blue-50 border-blue-200 text-blue-800' },
                { tip: 'Export (extra-UE)', zile: '15 zile', color: 'bg-blue-50 border-blue-200 text-blue-800' },
                { tip: 'Intracomunitar (UE)', zile: '15 zile', color: 'bg-purple-50 border-purple-200 text-purple-800' },
              ].map(v => (
                <div key={v.tip} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${v.color}`}>
                  <span>{v.tip}</span>
                  <strong>{v.zile}</strong>
                </div>
              ))}
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
              ⚠ Codul UIT trebuie generat înainte de <strong>ora de plecare</strong>. Odată expirat, nu mai poate fi folosit și trebuie generat un cod nou.
            </p>
          </section>

          {/* Când este obligatoriu */}
          <section>
            <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">📋 Când este obligatorie declararea?</h3>
            <div className="text-xs text-gray-600 space-y-1.5">
              <p className="font-semibold text-gray-700">Transport național — obligatoriu dacă:</p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li>Masa totală a mărfii depășește <strong>500 kg</strong> SAU valoarea depășește <strong>10.000 RON</strong></li>
                <li>Vehiculul are masa maximă autorizată ≥ <strong>3,5 tone</strong></li>
                <li>Bunurile aparțin categoriilor cu risc fiscal (cereale, uleiuri vegetale, materiale de construcții, metale, combustibili etc.)</li>
              </ul>
              <p className="font-semibold text-gray-700 mt-2">Transport internațional (import/export/intracomunitar) — obligatoriu pentru:</p>
              <ul className="list-disc list-inside ml-2 space-y-0.5">
                <li>Orice transport de bunuri care intră sau iese din România</li>
                <li>Indiferent de masă sau valoare</li>
              </ul>
            </div>
          </section>

          {/* Flux ArendaPro */}
          <section>
            <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">🔄 Cum generezi un cod UIT în ArendaPro</h3>
            <ol className="text-xs text-gray-600 space-y-2 list-decimal list-inside">
              <li><strong>Configurează tokenul ANAF</strong> — mergi la tab-ul ⚙ Setări și conectează contul ANAF via <code className="bg-gray-100 px-1 rounded">logincert.anaf.ro</code></li>
              <li><strong>Adaugă transport</strong> — apasă butonul verde „+ Adaugă transport" și completează wizard-ul în 4 pași</li>
              <li><strong>Completează bunurile</strong> — adaugă denumirea, codul NC/TARIC, cantitatea și greutatea (ArendaPro sugerează automat codul NC)</li>
              <li><strong>Confirmă codul NC/TARIC</strong> — apasă „✓ Confirmă" după verificare (obligatoriu)</li>
              <li><strong>Generează cod UIT</strong> — apasă butonul verde „Generează cod UIT" din lista de transporturi sau din panoul de detalii</li>
              <li><strong>Salvează și comunicați codul</strong> — codul UIT apare imediat, copiați-l și transmiteți-l șoferului</li>
            </ol>
          </section>

          {/* Cod NC/TARIC */}
          <section>
            <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">🏷 Codul NC/TARIC — explicat</h3>
            <div className="text-xs text-gray-600 space-y-2">
              <p><strong>CN (Combined Nomenclature)</strong> — 8 cifre, folosit în comerțul intracomunitar UE și pentru RO e-Transport</p>
              <p><strong>TARIC</strong> — 10 cifre, folosit pentru importuri/exporturi extra-UE (include taxe vamale specifice)</p>
              <p>Pentru <strong>RO e-Transport</strong>, codul CN de 8 cifre este suficient în marea majoritate a cazurilor.</p>
              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  <span className="font-mono text-gray-700">10059000</span><span>Porumb (boabe/furajer/consum)</span>
                  <span className="font-mono text-gray-700">10051000</span><span>Porumb pentru însămânțare</span>
                  <span className="font-mono text-gray-700">10011190</span><span>Grâu dur (consum)</span>
                  <span className="font-mono text-gray-700">12019090</span><span>Soia boabe</span>
                  <span className="font-mono text-gray-700">12060091</span><span>Floarea-soarelui (semințe)</span>
                  <span className="font-mono text-gray-700">87019300</span><span>Tractor 37–75 kW</span>
                </div>
              </div>
              <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                ⚠ <strong>Disclaimer:</strong> Codul NC/TARIC este sugerat de ArendaPro pe baza nomenclatorului local.
                Verificarea finală și responsabilitatea juridică aparțin utilizatorului, brokerului vamal sau consultantului fiscal.
                Consultați <a href="https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp?Lang=ro" target="_blank" rel="noopener noreferrer" className="underline text-blue-700">baza oficială TARIC EU</a> pentru confirmare.
              </p>
            </div>
          </section>

          {/* Sancțiuni */}
          <section>
            <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">⚠ Sancțiuni pentru nerespectare</h3>
            <div className="text-xs text-gray-600 space-y-1 bg-red-50 border border-red-200 rounded-lg p-3">
              <p>Transportul fără cod UIT valabil sau cu date incorecte în declarație poate atrage:</p>
              <ul className="list-disc list-inside space-y-0.5 ml-2">
                <li>Amenzi contravenționale conform OUG 41/2022 și reglementărilor ulterioare</li>
                <li>Reținerea vehiculului până la clarificarea situației</li>
                <li>Controale fiscale suplimentare la firmă</li>
              </ul>
            </div>
          </section>

          {/* Link-uri */}
          <section className="border-t border-gray-100 pt-3">
            <h3 className="font-bold text-gray-900 mb-2 text-xs">🔗 Resurse oficiale</h3>
            <div className="flex flex-wrap gap-2 text-xs">
              {[
                { label: 'Portal RO e-Transport ANAF', url: 'https://etransport.anaf.ro' },
                { label: 'Documentație tehnică ANAF', url: 'https://mfinante.gov.ro/ro/web/etransport/informatii-tehnice' },
                { label: 'Baza TARIC EU', url: 'https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp?Lang=ro' },
                { label: 'SPV ANAF (logare/token)', url: 'https://logincert.anaf.ro' },
              ].map(l => (
                <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-colors">
                  {l.label} <ExternalLink className="w-3 h-3 flex-shrink-0" />
                </a>
              ))}
            </div>
          </section>

        </div>
      )}
    </div>
  )
}
