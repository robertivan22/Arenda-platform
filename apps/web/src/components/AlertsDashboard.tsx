'use client'

import { useState, useCallback } from 'react'
import {
  AlertTriangle, CheckCircle, Clock, TrendingUp, TrendingDown,
  Loader2, RefreshCw, ChevronDown, ChevronRight, Zap,
  FileText, Tractor, Package, MessageSquare, Shield,
} from 'lucide-react'
import type { AnalysisResult, ContractAlert, FarmAlert, StockAlert, AssistantMode } from '@/lib/ai/types'

// ─── Priority / status helpers ────────────────────────────────────────────────

const PRIORITY_STYLES = {
  inalta:  { badge: 'bg-red-100 text-red-700 border-red-200',   dot: 'bg-red-500',    label: 'Înaltă' },
  medie:   { badge: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-400', label: 'Medie' },
  scazuta: { badge: 'bg-gray-100 text-gray-600 border-gray-200',  dot: 'bg-gray-400',   label: 'Scăzută' },
}

const CONTRACT_STATUS_STYLES = {
  expirat: 'bg-red-100 text-red-700',
  critic:  'bg-orange-100 text-orange-700',
  atentie: 'bg-amber-100 text-amber-700',
  ok:      'bg-green-100 text-green-700',
}
const CONTRACT_STATUS_LABELS = { expirat: 'Expirat', critic: 'Critic', atentie: 'Atenție', ok: 'OK' }

const STOCK_STATUS_STYLES = {
  critic: 'bg-red-100 text-red-700',
  scazut: 'bg-amber-100 text-amber-700',
  ok:     'bg-green-100 text-green-700',
}
const STOCK_STATUS_LABELS = { critic: 'Critic', scazut: 'Scăzut', ok: 'OK' }

// ─── Sub-components ───────────────────────────────────────────────────────────

function RiskGauge({ score }: { score: number }) {
  const clampedScore = Math.max(0, Math.min(100, score))
  const color = clampedScore >= 70 ? '#ef4444' : clampedScore >= 40 ? '#f59e0b' : '#16a34a'
  const circumference = 2 * Math.PI * 40
  const offset = circumference - (clampedScore / 100) * circumference
  return (
    <div className="flex flex-col items-center">
      <svg width="100" height="100" className="-rotate-90">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#f3f4f6" strokeWidth="10" />
        <circle cx="50" cy="50" r="40" fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <span className="text-2xl font-bold -mt-16" style={{ color }}>{clampedScore}</span>
      <span className="text-xs text-gray-400 mt-6">/ 100</span>
    </div>
  )
}

function AlertCard({ children, priority }: { children: React.ReactNode; priority: string }) {
  const p = PRIORITY_STYLES[priority as keyof typeof PRIORITY_STYLES] ?? PRIORITY_STYLES.scazuta
  return (
    <div className={`border rounded-xl p-4 ${p.badge} mb-2`}>
      {children}
    </div>
  )
}

function ContractAlertRow({ alert }: { alert: ContractAlert }) {
  const [open, setOpen] = useState(false)
  const p = PRIORITY_STYLES[alert.priority] ?? PRIORITY_STYLES.scazuta
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-2">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.dot}`} />
        <span className="font-semibold text-gray-900 flex-1">#{alert.contract_number} — {alert.lessor_name}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CONTRACT_STATUS_STYLES[alert.status]}`}>
          {CONTRACT_STATUS_LABELS[alert.status]}
        </span>
        {alert.days_until_expiry != null && (
          <span className="text-xs text-gray-400 ml-2">{alert.days_until_expiry >= 0 ? `${alert.days_until_expiry} zile` : 'expirat'}</span>
        )}
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-gray-100 pt-3">
          <p className="text-sm text-gray-700">{alert.mesaj}</p>
          <div className="flex items-start gap-2 mt-2">
            <Zap className="w-3.5 h-3.5 text-brand-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-brand-700">{alert.actiune_recomandata}</p>
          </div>
          {alert.suprafata_ha && <p className="text-xs text-gray-400">Suprafață: {alert.suprafata_ha} ha</p>}
          {alert.end_date && <p className="text-xs text-gray-400">Expiră: {alert.end_date}</p>}
        </div>
      )}
    </div>
  )
}

function FarmAlertRow({ alert }: { alert: FarmAlert }) {
  const [open, setOpen] = useState(false)
  const p = PRIORITY_STYLES[alert.priority] ?? PRIORITY_STYLES.scazuta
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-2">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.dot}`} />
        <span className="font-semibold text-gray-900 flex-1">{alert.activitate}{alert.parcela ? ` — ${alert.parcela}` : ''}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${p.badge}`}>{p.label}</span>
        {alert.intarziere_zile != null && alert.intarziere_zile > 0 && (
          <span className="text-xs text-red-500 ml-2">{alert.intarziere_zile}z întârziere</span>
        )}
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-gray-100 pt-3">
          <p className="text-sm text-gray-700">{alert.mesaj}</p>
          <div className="flex items-start gap-2 mt-2">
            <Zap className="w-3.5 h-3.5 text-brand-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-brand-700">{alert.actiune_recomandata}</p>
          </div>
          {alert.data_planificata && <p className="text-xs text-gray-400">Planificat: {alert.data_planificata}</p>}
        </div>
      )}
    </div>
  )
}

function StockAlertRow({ alert }: { alert: StockAlert }) {
  const [open, setOpen] = useState(false)
  const p = PRIORITY_STYLES[alert.priority] ?? PRIORITY_STYLES.scazuta
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-2">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${p.dot}`} />
        <span className="font-semibold text-gray-900 flex-1">{alert.produs}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STOCK_STATUS_STYLES[alert.status]}`}>
          {STOCK_STATUS_LABELS[alert.status]}
        </span>
        <span className="text-xs text-gray-500 ml-2">{alert.cantitate_disponibila} {alert.unitate}</span>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-2 border-t border-gray-100 pt-3">
          <p className="text-sm text-gray-700">{alert.mesaj}</p>
          <div className="flex items-start gap-2 mt-2">
            <Zap className="w-3.5 h-3.5 text-brand-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-brand-700">{alert.actiune_recomandata}</p>
          </div>
          {alert.valoare_estimata != null && (
            <p className="text-xs text-gray-400">Valoare estimată: {alert.valoare_estimata.toFixed(0)} RON</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ icon, title, count, high, children }: {
  icon: React.ReactNode; title: string; count: number; high: number; children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="text-brand-600">{icon}</div>
          <span className="font-semibold text-gray-900">{title}</span>
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
          ? <p className="text-sm text-gray-400 text-center py-4">Nicio alertă în această categorie.</p>
          : children}
      </div>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const MODE_OPTIONS: { mode: AssistantMode; label: string; icon: React.ElementType }[] = [
  { mode: 'full_analysis',     label: 'Analiză completă', icon: Shield },
  { mode: 'contract_alerts',   label: 'Contracte',        icon: FileText },
  { mode: 'farm_alerts',       label: 'Fermă',            icon: Tractor },
  { mode: 'inventory_alerts',  label: 'Stocuri',          icon: Package },
]

export default function AlertsDashboard() {
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<AssistantMode>('full_analysis')
  const [model, setModel] = useState<string>('')
  const [tokens, setTokens] = useState<number>(0)
  const [lastRun, setLastRun] = useState<Date | null>(null)

  const run = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      })
      const json = await res.json()
      if (!json.ok) { setError(json.error ?? 'Eroare necunoscută.'); return }
      setResult(json.result)
      setModel(json.model ?? '')
      setTokens(json.tokens_used ?? 0)
      setLastRun(new Date())
    } catch {
      setError('Nu s-a putut contacta serverul AI.')
    } finally {
      setLoading(false)
    }
  }, [mode])

  const highContracts = result?.contracte.filter(c => c.priority === 'inalta').length ?? 0
  const highFarm      = result?.ferma.filter(f => f.priority === 'inalta').length ?? 0
  const highStock     = result?.stocuri.filter(s => s.priority === 'inalta').length ?? 0
  const totalHigh     = highContracts + highFarm + highStock

  return (
    <div className="space-y-6">
      {/* Header + controls */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alerte &amp; Analiză AI</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Monitorizare inteligentă — contracte, operațiuni, stocuri
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Mode selector */}
          <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
            {MODE_OPTIONS.map(({ mode: m, label, icon: Icon }) => (
              <button key={m} onClick={() => setMode(m)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  mode === m ? 'bg-white shadow text-brand-700' : 'text-gray-500 hover:text-gray-700'
                }`}>
                <Icon className="w-3.5 h-3.5" /> {label}
              </button>
            ))}
          </div>
          <button onClick={run} disabled={loading}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-xl disabled:opacity-60 transition-colors">
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Analizez...</>
              : <><RefreshCw className="w-4 h-4" /> Rulează analiza</>}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-brand-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Asistentul AI este pregătit</h2>
          <p className="text-sm text-gray-400 max-w-md">
            Alege modul de analiză și apasă <strong>Rulează analiza</strong> pentru a primi alerte și recomandări personalizate.
          </p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-brand-600 mb-4" />
          <p className="text-sm text-gray-500">Analizez datele fermei tale...</p>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            {/* Risk gauge */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col items-center justify-center gap-1">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Scor risc global</p>
              <RiskGauge score={result.scor_risc} />
            </div>

            {/* KPIs */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col justify-center">
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Alerte critice
              </div>
              <div className={`text-3xl font-bold ${totalHigh > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {totalHigh}
              </div>
              <p className="text-xs text-gray-400 mt-1">din {(result.contracte.length + result.ferma.length + result.stocuri.length)} total</p>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col justify-center">
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                <FileText className="w-3.5 h-3.5" /> Contracte monitorizate
              </div>
              <div className="text-3xl font-bold text-gray-800">{result.contracte.length}</div>
              {highContracts > 0 && <p className="text-xs text-red-500 mt-1">{highContracts} necesită atenție</p>}
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col justify-center">
              {result.scor_risc < 40
                ? <><CheckCircle className="w-6 h-6 text-green-500 mb-1" /><p className="text-sm font-semibold text-green-700">Situație bună</p></>
                : result.scor_risc < 70
                ? <><Clock className="w-6 h-6 text-amber-500 mb-1" /><p className="text-sm font-semibold text-amber-700">Necesită atenție</p></>
                : <><TrendingDown className="w-6 h-6 text-red-500 mb-1" /><p className="text-sm font-semibold text-red-700">Risc ridicat</p></>}
              <p className="text-xs text-gray-400 mt-1">
                {lastRun ? `Generat: ${lastRun.toLocaleTimeString('ro-RO')}` : ''}
              </p>
            </div>
          </div>

          {/* Summary text */}
          <div className="bg-brand-50 border border-brand-100 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-brand-600" />
              <span className="text-sm font-semibold text-brand-700">Sumar executiv</span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{result.sumar}</p>
          </div>

          {/* Alert sections */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <Section icon={<FileText className="w-5 h-5" />} title="Contracte" count={result.contracte.length} high={highContracts}>
              {result.contracte.map((c, i) => <ContractAlertRow key={i} alert={c} />)}
            </Section>
            <Section icon={<Tractor className="w-5 h-5" />} title="Activități Fermă" count={result.ferma.length} high={highFarm}>
              {result.ferma.map((f, i) => <FarmAlertRow key={i} alert={f} />)}
            </Section>
            <Section icon={<Package className="w-5 h-5" />} title="Stocuri" count={result.stocuri.length} high={highStock}>
              {result.stocuri.map((s, i) => <StockAlertRow key={i} alert={s} />)}
            </Section>
          </div>

          {/* Footer metadata */}
          <p className="text-xs text-gray-300 text-right">
            Model: {model} · {tokens} tokens · {new Date(result.generat_la).toLocaleString('ro-RO')}
          </p>
        </>
      )}
    </div>
  )
}
