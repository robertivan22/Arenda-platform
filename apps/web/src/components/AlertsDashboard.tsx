'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  AlertTriangle, CheckCircle, Clock, TrendingUp, TrendingDown,
  Loader2, RefreshCw, ChevronDown, ChevronRight, Zap,
  FileText, Tractor, Package, Shield, Wrench, Receipt, Leaf, Users,
} from 'lucide-react'
import type {
  AnalysisResult, ContractAlert, FarmAlert, StockAlert,
  UtilajeAlert, FacturaAlert, ApiaAlert, FitosanitarAlert,
} from '@/lib/ai/types'

const LS_KEY = 'arenda_ai_analysis'

// â”€â”€â”€ Priority / status helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const P = {
  inalta:  { badge: 'bg-red-100 text-red-700 border-red-200',     dot: 'bg-red-500',    label: 'Inalta' },
  medie:   { badge: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-400',  label: 'Medie' },
  scazuta: { badge: 'bg-gray-100 text-gray-600 border-gray-200',   dot: 'bg-gray-400',   label: 'Scazuta' },
}

const CONTRACT_STATUS_STYLE: Record<string, string> = {
  expirat: 'bg-red-100 text-red-700',
  critic:  'bg-orange-100 text-orange-700',
  atentie: 'bg-amber-100 text-amber-700',
  ok:      'bg-green-100 text-green-700',
  draft:   'bg-blue-100 text-blue-700',
}
const CONTRACT_STATUS_LABEL: Record<string, string> = { expirat: 'Expirat', critic: 'Critic', atentie: 'Atentie', ok: 'OK', draft: 'Draft' }

const STOCK_STATUS_STYLE: Record<string, string> = {
  critic: 'bg-red-100 text-red-700',
  scazut: 'bg-amber-100 text-amber-700',
  ok:     'bg-green-100 text-green-700',
}
const STOCK_STATUS_LABEL: Record<string, string> = { critic: 'Critic', scazut: 'Scazut', ok: 'OK' }

const UTILAJ_STATUS_STYLE: Record<string, string> = {
  critic:     'bg-red-100 text-red-700',
  atentie:    'bg-amber-100 text-amber-700',
  ok:         'bg-green-100 text-green-700',
  necunoscut: 'bg-gray-100 text-gray-600',
}
const UTILAJ_STATUS_LABEL: Record<string, string> = { critic: 'Critic', atentie: 'Atentie', ok: 'OK', necunoscut: 'Necunoscut' }

// â”€â”€â”€ Risk gauge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function RiskGauge({ score }: { score: number }) {
  const s = Math.max(0, Math.min(100, score))
  const color = s >= 70 ? '#ef4444' : s >= 40 ? '#f59e0b' : '#16a34a'
  const circ = 2 * Math.PI * 40
  const offset = circ - (s / 100) * circ
  return (
    <div className="flex flex-col items-center">
      <svg width="100" height="100" className="-rotate-90">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" strokeWidth="10" />
        <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <span className="text-2xl font-bold -mt-16" style={{ color }}>{s}</span>
      <span className="text-xs text-gray-400 mt-6">/ 100</span>
    </div>
  )
}

// â”€â”€â”€ Generic expandable row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function AlertRow({ priority, label, badge, children }: {
  priority: string; label: string; badge: React.ReactNode; children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const p = P[priority as keyof typeof P] ?? P.scazuta
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-2">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.dot}`} />
        <span className="font-semibold text-gray-900 flex-1 text-sm">{label}</span>
        {badge}
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-2">
          {children}
        </div>
      )}
    </div>
  )
}

function AlertDetail({ mesaj, actiune }: { mesaj: string; actiune: string }) {
  return (
    <>
      <p className="text-sm text-gray-700">{mesaj}</p>
      <div className="flex items-start gap-2">
        <Zap className="w-3.5 h-3.5 text-brand-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm font-medium text-brand-700">{actiune}</p>
      </div>
    </>
  )
}

// â”€â”€â”€ Typed rows â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ContractRow({ a }: { a: ContractAlert }) {
  const statusKey = String(a.status ?? '').toLowerCase()
  return (
    <AlertRow priority={a.priority}
      label={`#${a.contract_number} \u2014 ${a.lessor_name}`}
      badge={
        <>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONTRACT_STATUS_STYLE[statusKey] ?? 'bg-gray-100 text-gray-600'}`}>
            {CONTRACT_STATUS_LABEL[statusKey] ?? a.status}
          </span>
          {a.days_until_expiry != null && (
            <span className="text-xs text-gray-400">{a.days_until_expiry >= 0 ? `${a.days_until_expiry} zile` : 'expirat'}</span>
          )}
        </>
      }>
      <AlertDetail mesaj={a.mesaj} actiune={a.actiune_recomandata} />
      {a.suprafata_ha != null && <p className="text-xs text-gray-400">Suprafata: {a.suprafata_ha} ha</p>}
      {a.end_date && <p className="text-xs text-gray-400">Expira: {a.end_date}</p>}
    </AlertRow>
  )
}

function FarmRow({ a }: { a: FarmAlert }) {
  return (
    <AlertRow priority={a.priority}
      label={`${a.activitate}${a.parcela ? ` \u2014 ${a.parcela}` : ''}`}
      badge={
        <>
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${P[a.priority as keyof typeof P]?.badge ?? ''}`}>
            {P[a.priority as keyof typeof P]?.label ?? a.priority}
          </span>
          {a.intarziere_zile != null && a.intarziere_zile > 0 && (
            <span className="text-xs text-red-500">{a.intarziere_zile}z intarziere</span>
          )}
        </>
      }>
      <AlertDetail mesaj={a.mesaj} actiune={a.actiune_recomandata} />
      {a.data_planificata && <p className="text-xs text-gray-400">Planificat: {a.data_planificata}</p>}
    </AlertRow>
  )
}

function StockRow({ a }: { a: StockAlert }) {
  return (
    <AlertRow priority={a.priority}
      label={a.produs}
      badge={
        <>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STOCK_STATUS_STYLE[a.status] ?? ''}`}>
            {STOCK_STATUS_LABEL[a.status] ?? a.status}
          </span>
          <span className="text-xs text-gray-500">{a.cantitate_disponibila} {a.unitate}</span>
        </>
      }>
      <AlertDetail mesaj={a.mesaj} actiune={a.actiune_recomandata} />
      {a.valoare_estimata != null && <p className="text-xs text-gray-400">Valoare: {a.valoare_estimata.toFixed(0)} RON</p>}
    </AlertRow>
  )
}

function UtilajeRow({ a }: { a: UtilajeAlert }) {
  const statusKey = String(a.status ?? '').toLowerCase()
  return (
    <AlertRow priority={a.priority}
      label={`${a.utilaj}${a.tip ? ` (${a.tip})` : ''}`}
      badge={
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${UTILAJ_STATUS_STYLE[statusKey] ?? 'bg-gray-100 text-gray-600'}`}>
          {UTILAJ_STATUS_LABEL[statusKey] ?? a.status}
        </span>
      }>
      <AlertDetail mesaj={a.mesaj} actiune={a.actiune_recomandata} />
      {a.rca_expiry && <p className="text-xs text-gray-400">RCA expira: {a.rca_expiry}</p>}
    </AlertRow>
  )
}

function FacturaRow({ a }: { a: FacturaAlert }) {
  return (
    <AlertRow priority={a.priority}
      label={`Factura ${a.invoice_number}`}
      badge={
        <>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            a.status === 'PAID' ? 'bg-green-100 text-green-700' :
            a.status === 'OVERDUE' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
          }`}>{a.status}</span>
          <span className="text-xs text-gray-500">{a.total_amount?.toFixed(0)} RON</span>
        </>
      }>
      <AlertDetail mesaj={a.mesaj} actiune={a.actiune_recomandata} />
      {a.due_date && <p className="text-xs text-gray-400">Scadenta: {a.due_date}</p>}
    </AlertRow>
  )
}

function ApiaRow({ a }: { a: ApiaAlert }) {
  return (
    <AlertRow priority={a.priority}
      label={`Dosar APIA ${a.campaign_year}`}
      badge={
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          a.status === 'SUBMITTED' || a.status === 'ACCEPTED' ? 'bg-green-100 text-green-700' :
          a.status === 'DRAFT' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
        }`}>{a.status}</span>
      }>
      <AlertDetail mesaj={a.mesaj} actiune={a.actiune_recomandata} />
      <p className="text-xs text-gray-400">{a.total_declared_ha} ha declarate</p>
    </AlertRow>
  )
}

function FitosanitarRow({ a }: { a: FitosanitarAlert }) {
  return (
    <AlertRow priority={a.priority}
      label={`${a.produs}${a.parcela ? ` \u2014 ${a.parcela}` : ''}`}
      badge={
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${P[a.priority as keyof typeof P]?.badge ?? ''}`}>
          {P[a.priority as keyof typeof P]?.label ?? a.priority}
        </span>
      }>
      <AlertDetail mesaj={a.mesaj} actiune={a.actiune_recomandata} />
      {a.data_aplicarii && <p className="text-xs text-gray-400">Aplicat: {a.data_aplicarii}</p>}
    </AlertRow>
  )
}

// â”€â”€â”€ Section wrapper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Section({ icon, title, count, high, children }: {
  icon: React.ReactNode; title: string; count: number; high: number; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="text-brand-600">{icon}</div>
          <span className="font-semibold text-gray-900 text-sm">{title}</span>
          <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{count}</span>
        </div>
        {high > 0 && (
          <span className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3" /> {high} critice
          </span>
        )}
      </div>
      <div className="p-4">
        {count === 0
          ? <p className="text-sm text-gray-400 text-center py-3">Nicio alerta.</p>
          : children}
      </div>
    </div>
  )
}

// â”€â”€â”€ Main Dashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface Saved { result: AnalysisResult; model: string; tokens: number }

export default function AlertsDashboard() {
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [model, setModel] = useState('')
  const [tokens, setTokens] = useState(0)
  const [dataErrors, setDataErrors] = useState<string[]>([])

  // Load persisted analysis on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) {
        const saved: Saved = JSON.parse(raw)
        setResult(saved.result)
        setModel(saved.model)
        setTokens(saved.tokens)
      }
    } catch { /* ignore */ }
  }, [])

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'full_analysis' }),
      })
      const json = await res.json()
      if (!json.ok) { setError(json.error ?? 'Eroare necunoscuta.'); return }
      setResult(json.result)
      setModel(json.model ?? '')
      setTokens(json.tokens_used ?? 0)
      setDataErrors(json.data_errors ?? [])
      // Persist to localStorage
      localStorage.setItem(LS_KEY, JSON.stringify({ result: json.result, model: json.model ?? '', tokens: json.tokens_used ?? 0 }))
    } catch {
      setError('Nu s-a putut contacta serverul AI.')
    } finally {
      setLoading(false)
    }
  }, [])

  const totalHigh = [
    ...(result?.contracte ?? []),
    ...(result?.ferma ?? []),
    ...(result?.stocuri ?? []),
    ...(result?.utilaje ?? []),
    ...(result?.facturi ?? []),
    ...(result?.apia ?? []),
    ...(result?.fitosanitar ?? []),
  ].filter(a => a.priority === 'inalta').length

  const highOf = (arr?: { priority: string }[]) => (arr ?? []).filter(a => a.priority === 'inalta').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alerte &amp; Analiza AI</h1>
          <p className="text-sm text-gray-500 mt-0.5">Monitorizare inteligenta &mdash; toata ferma ta</p>
        </div>
        <button onClick={run} disabled={loading}
          className="flex items-center gap-1.5 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl disabled:opacity-60 transition-colors">
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Analizez...</>
            : <><RefreshCw className="w-4 h-4" /> Ruleaza analiza</>}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {dataErrors.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-sm font-semibold text-amber-700 mb-1">Avertisment: unele tabele nu au putut fi incarcate din baza de date:</p>
          <ul className="text-sm text-amber-600 list-disc list-inside space-y-0.5">
            {dataErrors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
          <p className="text-xs text-amber-500 mt-2">Verifica daca migrarile SQL au fost rulate in Supabase Dashboard.</p>
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-brand-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Asistentul AI este pregatit</h2>
          <p className="text-sm text-gray-400 max-w-md">
            Apasa <strong>Ruleaza analiza</strong> pentru a primi o analiza completa a fermei &mdash; contracte, utilaje, stocuri, facturi, APIA si fitosanitar.
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="w-10 h-10 animate-spin text-brand-600 mb-4" />
          <p className="text-sm text-gray-500">Analizez toate datele fermei tale...</p>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col items-center justify-center">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Scor risc global</p>
              <RiskGauge score={result.scor_risc} />
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col justify-center">
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Alerte critice
              </div>
              <div className={`text-3xl font-bold ${totalHigh > 0 ? 'text-red-600' : 'text-green-600'}`}>{totalHigh}</div>
              <p className="text-xs text-gray-400 mt-1">din {
                (result.contracte?.length ?? 0) + (result.ferma?.length ?? 0) + (result.stocuri?.length ?? 0) +
                (result.utilaje?.length ?? 0) + (result.facturi?.length ?? 0) + (result.apia?.length ?? 0) + (result.fitosanitar?.length ?? 0)
              } total</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col justify-center">
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                <Users className="w-3.5 h-3.5" /> Arendasi
              </div>
              <div className="text-3xl font-bold text-gray-800">{result.arendasi_sumar?.total ?? '—'}</div>
              <p className="text-xs text-gray-400 mt-1">{(result.arendasi_sumar?.total_suprafata_ha ?? 0).toFixed(0)} ha total</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col justify-center">
              {result.scor_risc < 40
                ? <><CheckCircle className="w-6 h-6 text-green-500 mb-1" /><p className="text-sm font-semibold text-green-700">Situatie buna</p></>
                : result.scor_risc < 70
                ? <><Clock className="w-6 h-6 text-amber-500 mb-1" /><p className="text-sm font-semibold text-amber-700">Necesita atentie</p></>
                : <><TrendingDown className="w-6 h-6 text-red-500 mb-1" /><p className="text-sm font-semibold text-red-700">Risc ridicat</p></>}
              <p className="text-xs text-gray-400 mt-1">{new Date(result.generat_la).toLocaleString('ro-RO')}</p>
            </div>
          </div>

          {/* Sumar */}
          <div className="bg-brand-50 border border-brand-100 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-brand-600" />
              <span className="text-sm font-semibold text-brand-700">Sumar executiv</span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{result.sumar}</p>
          </div>

          {/* Alert grid row 1 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Section icon={<FileText className="w-5 h-5" />} title="Contracte" count={result.contracte?.length ?? 0} high={highOf(result.contracte)}>
              {result.contracte?.map((a, i) => <ContractRow key={i} a={a} />)}
            </Section>
            <Section icon={<Tractor className="w-5 h-5" />} title="Activitati Ferma" count={result.ferma?.length ?? 0} high={highOf(result.ferma)}>
              {result.ferma?.map((a, i) => <FarmRow key={i} a={a} />)}
            </Section>
            <Section icon={<Package className="w-5 h-5" />} title="Stocuri" count={result.stocuri?.length ?? 0} high={highOf(result.stocuri)}>
              {result.stocuri?.map((a, i) => <StockRow key={i} a={a} />)}
            </Section>
          </div>

          {/* Alert grid row 2 */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
            <Section icon={<Wrench className="w-5 h-5" />} title="Utilaje" count={result.utilaje?.length ?? 0} high={highOf(result.utilaje)}>
              {result.utilaje?.map((a, i) => <UtilajeRow key={i} a={a} />)}
            </Section>
            <Section icon={<Receipt className="w-5 h-5" />} title="Facturi" count={result.facturi?.length ?? 0} high={highOf(result.facturi)}>
              {result.facturi?.map((a, i) => <FacturaRow key={i} a={a} />)}
            </Section>
            <Section icon={<Shield className="w-5 h-5" />} title="APIA" count={result.apia?.length ?? 0} high={highOf(result.apia)}>
              {result.apia?.map((a, i) => <ApiaRow key={i} a={a} />)}
            </Section>
            <Section icon={<Leaf className="w-5 h-5" />} title="Fitosanitar" count={result.fitosanitar?.length ?? 0} high={highOf(result.fitosanitar)}>
              {result.fitosanitar?.map((a, i) => <FitosanitarRow key={i} a={a} />)}
            </Section>
          </div>

          <p className="text-xs text-gray-300 text-right">
            Model: {model} · {tokens} tokens · {new Date(result.generat_la).toLocaleString('ro-RO')}
          </p>
        </>
      )}
    </div>
  )
}

// â”€â”€â”€ Priority / status helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
