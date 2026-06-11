'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, CheckCircle, Clock, TrendingDown,
  Loader2, RefreshCw, ChevronRight, Zap, ArrowLeftRight,
  FileText, Tractor, Package, Shield, Wrench,
  Sparkles, X,
} from 'lucide-react'
import type {
  AnalysisResult, AlertInsight,
} from '@/lib/ai/types'

const LS_KEY = 'arenda_ai_analysis'

// â”€â”€â”€ Priority / status helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// --- Alert item shape -------------------------------------------------------

interface AlertItem {
  id: string
  priority: string
  category: string
  label: string
  sublabel?: string
  badgeText?: string
  badgeColor?: string
  qtyText?: string
  qtyColor?: string
  mesaj: string
  actiune: string
}

function flattenAlerts(r: AnalysisResult): AlertItem[] {
  const items: AlertItem[] = []
  r.contracte?.forEach((a, i) => {
    const z = a.days_until_expiry
    items.push({
      id: `c-${i}`, priority: a.priority, category: 'Contracte',
      label: `#${a.contract_number} \u2014 ${a.lessor_name}`,
      sublabel: z != null && z < 0 ? `Expirat acum ${Math.abs(z)} zile` : (a.end_date ?? undefined),
      badgeText: z == null ? (a.status ?? '?') : z < 0 ? 'Expirat' : `${z} zile`,
      badgeColor: z != null && z < 0 ? 'bg-red-100 text-red-700' : z != null && z < 30 ? 'bg-orange-100 text-orange-700' : 'bg-green-50 text-green-700',
      mesaj: a.mesaj, actiune: a.actiune_recomandata,
    })
  })
  r.ferma?.forEach((a, i) => items.push({
    id: `f-${i}`, priority: a.priority, category: 'Activitati',
    label: `${a.activitate}${a.parcela ? ` \u2014 ${a.parcela}` : ''}`,
    sublabel: a.intarziere_zile && a.intarziere_zile > 0 ? `${a.intarziere_zile} zile intarziere` : (a.status ?? undefined),
    badgeText: a.priority === 'inalta' ? 'Critica' : a.priority === 'medie' ? 'Medie' : 'Scazuta',
    badgeColor: a.priority === 'inalta' ? 'bg-red-100 text-red-700' : a.priority === 'medie' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600',
    mesaj: a.mesaj, actiune: a.actiune_recomandata,
  }))
  r.stocuri?.forEach((a, i) => items.push({
    id: `s-${i}`, priority: a.priority, category: 'Stocuri',
    label: a.produs,
    sublabel: a.status === 'critic' ? 'Stoc epuizat' : a.status === 'scazut' ? 'Sub pragul minim' : 'Stoc OK',
    qtyText: `${a.cantitate_disponibila} ${a.unitate}`,
    qtyColor: a.status === 'critic' ? 'bg-red-50 text-red-700' : a.status === 'scazut' ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700',
    mesaj: a.mesaj, actiune: a.actiune_recomandata,
  }))
  r.utilaje?.forEach((a, i) => items.push({
    id: `u-${i}`, priority: a.priority, category: 'Utilaje',
    label: `${a.utilaj} (${a.tip})`,
    sublabel: a.mentenanta_pending ?? (a.rca_expiry ? `RCA: ${a.rca_expiry}` : undefined),
    badgeText: a.status === 'critic' ? 'RCA Expirat' : a.status === 'atentie' ? 'Atentie RCA' : a.status === 'necunoscut' ? 'Neverificat' : 'OK',
    badgeColor: a.status === 'critic' ? 'bg-red-100 text-red-700' : a.status === 'atentie' ? 'bg-amber-100 text-amber-700' : a.status === 'necunoscut' ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700',
    mesaj: a.mesaj, actiune: a.actiune_recomandata,
  }))
  r.tranzactii?.forEach((a, i) => items.push({
    id: `t-${i}`, priority: a.priority, category: 'Tranzactii',
    label: `${a.lessor_name} \u2014 ${a.produs}`,
    sublabel: `Campanie ${a.campanie}`,
    qtyText: `${a.suma_ron?.toFixed(0)} RON`, qtyColor: 'bg-amber-50 text-amber-700',
    badgeText: 'Neplatita', badgeColor: 'bg-red-100 text-red-700',
    mesaj: a.mesaj, actiune: a.actiune_recomandata,
  }))
  return items
}

const DOT: Record<string, string> = { inalta: 'bg-red-500', medie: 'bg-amber-400', scazuta: 'bg-gray-300' }

const ACTION_COLORS = [
  'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
  'bg-pink-50 text-pink-700 border-pink-200 hover:bg-pink-100',
  'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
  'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
]

// â”€â”€â”€ Risk gauge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function RiskGauge({ score }: { score: number }) {
  const s = Math.max(0, Math.min(100, score))
  const color = s >= 70 ? '#ef4444' : s >= 40 ? '#f59e0b' : '#16a34a'
  const label = s >= 70 ? 'Risc ridicat' : s >= 40 ? 'Risc moderat' : 'Risc scazut'
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
      <span className="text-xs font-semibold mt-1" style={{ color }}>{label}</span>
    </div>
  )
}

// â”€â”€â”€ Generic expandable row â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

// --- AlertItemRow -----------------------------------------------------------

function AlertItemRow({ item, selected, onClick }: { item: AlertItem; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
        selected ? 'bg-brand-50 border border-brand-200' : 'hover:bg-gray-50'
      }`}
    >
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${DOT[item.priority] ?? 'bg-gray-300'}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{item.label}</p>
        {item.sublabel && <p className="text-xs text-gray-400 truncate">{item.sublabel}</p>}
      </div>
      {item.qtyText && (
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md flex-shrink-0 ${item.qtyColor ?? 'bg-gray-100 text-gray-600'}`}>
          {item.qtyText}
        </span>
      )}
      {item.badgeText && (
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md flex-shrink-0 ${item.badgeColor ?? 'bg-gray-100 text-gray-600'}`}>
          {item.badgeText}
        </span>
      )}
      <ChevronRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
    </button>
  )
}

// --- SectionCard -------------------------------------------------------------

function SectionCard({ icon, title, count, high, items, selectedId, onSelect, addHref }: {
  icon: React.ReactNode; title: string; count: number; high: number
  items: AlertItem[]; selectedId: string | null; onSelect: (item: AlertItem) => void
  addHref?: string
}) {
  const router = useRouter()
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
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
      <div className="p-3 space-y-0.5">
        {count === 0
          ? (
            <div className="flex flex-col items-center justify-center gap-1 py-4 text-gray-300">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm">Nicio alerta</span>
              {addHref && (
                <button onClick={() => router.push(addHref)}
                  className="text-xs text-brand-500 hover:text-brand-700 font-medium mt-0.5 transition-colors">
                  Gestioneaza &rarr;
                </button>
              )}
            </div>
          )
          : items.map(item => (
            <AlertItemRow key={item.id} item={item} selected={selectedId === item.id} onClick={() => onSelect(item)} />
          ))
        }
      </div>
    </div>
  )
}

// --- Category routes --------------------------------------------------------

const CATEGORY_ROUTES: Record<string, string> = {
  Contracte:  '/contracte',
  Activitati: '/ferma',
  Stocuri:    '/inventar/stoc',
  Utilaje:    '/utilaje',
  Tranzactii: '/plati',
}

// --- AlertDetailPanel --------------------------------------------------------

function AlertDetailPanel({ item, onClose }: { item: AlertItem | null; onClose: () => void }) {
  const router = useRouter()
  if (!item) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
        <ChevronRight className="w-8 h-8 mx-auto mb-2 text-gray-200" />
        <p className="text-sm text-gray-300">Selecteaza o alerta pentru detalii</p>
      </div>
    )
  }
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${DOT[item.priority] ?? 'bg-gray-300'}`} />
          <span className="font-semibold text-gray-900 text-sm">Detaliu alerta</span>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4 space-y-4">
        <div>
          <span className="text-xs font-medium uppercase tracking-wide text-gray-400 block mb-1">Alerta</span>
          <p className="text-sm font-semibold text-gray-900">{item.label}</p>
          {item.sublabel && <p className="text-xs text-gray-500 mt-0.5">{item.sublabel}</p>}
          <span className="inline-block mt-1.5 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{item.category}</span>
        </div>
        <div>
          <span className="text-xs font-medium uppercase tracking-wide text-gray-400 block mb-1">Rationament</span>
          <p className="text-sm text-gray-700 leading-relaxed">{item.mesaj}</p>
        </div>
        <div>
          <span className="text-xs font-medium uppercase tracking-wide text-gray-400 block mb-1">Actiune recomandata</span>
          <div className="flex items-start gap-2">
            <Zap className="w-3.5 h-3.5 text-brand-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-brand-700">{item.actiune}</p>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => { router.push(CATEGORY_ROUTES[item.category] ?? '/alerte'); onClose() }}
            className="flex-1 py-2 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg transition-colors">
            Aplica actiunea
          </button>
          <button onClick={onClose} className="px-3 py-2 text-xs font-semibold text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg transition-colors">
            Ignora
          </button>
        </div>
      </div>
    </div>
  )
}

// --- InsightsPanel -----------------------------------------------------------

function InsightsPanel({ insights }: { insights: AlertInsight[] }) {
  if (insights.length === 0) return null
  const impactColor = (impact: string) =>
    impact === 'mare' ? 'bg-red-900 text-red-300' : impact === 'mediu' ? 'bg-amber-900 text-amber-300' : 'bg-gray-700 text-gray-300'
  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-700">
        <Sparkles className="w-4 h-4 text-brand-400" />
        <span className="font-semibold text-white text-sm">Insights prioritare</span>
        <span className="text-xs bg-brand-600 text-white px-1.5 py-0.5 rounded-full ml-auto">Top {insights.length}</span>
      </div>
      <div className="p-3 space-y-3">
        {insights.map((ins, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${impactColor(ins.impact)}`}>
                {ins.impact.toUpperCase()}
              </span>
              <span className="text-xs text-gray-400">{ins.categorie}</span>
            </div>
            <p className="text-sm font-semibold text-white">{ins.titlu}</p>
            <p className="text-xs text-gray-400 leading-relaxed">{ins.descriere}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// â”€â”€â”€ Typed rows â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€


// â”€â”€â”€ Main Dashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface Saved { result: AnalysisResult; model: string; tokens: number }
type FilterTab = 'toate' | 'critice' | 'atentie' | 'ok'

export default function AlertsDashboard() {
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [model, setModel] = useState('')
  const [tokens, setTokens] = useState(0)
  const [dataErrors, setDataErrors] = useState<string[]>([])
  const [selectedItem, setSelectedItem] = useState<AlertItem | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterTab>('toate')

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
    setSelectedItem(null)
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
      localStorage.setItem(LS_KEY, JSON.stringify({ result: json.result, model: json.model ?? '', tokens: json.tokens_used ?? 0 }))
    } catch {
      setError('Nu s-a putut contacta serverul AI.')
    } finally {
      setLoading(false)
    }
  }, [])

  const allItems = result ? flattenAlerts(result) : []
  const totalHigh = allItems.filter(a => a.priority === 'inalta').length
  const totalMed  = allItems.filter(a => a.priority === 'medie').length
  const totalOk   = allItems.filter(a => a.priority === 'scazuta').length

  const filteredIds = new Set(
    activeFilter === 'critice' ? allItems.filter(a => a.priority === 'inalta').map(a => a.id)
    : activeFilter === 'atentie' ? allItems.filter(a => a.priority === 'medie').map(a => a.id)
    : activeFilter === 'ok' ? allItems.filter(a => a.priority === 'scazuta').map(a => a.id)
    : allItems.map(a => a.id)
  )

  const sectionItems = (cat: string) => allItems.filter(a => a.category === cat && filteredIds.has(a.id))
  const highOf = (arr?: { priority: string }[]) => (arr ?? []).filter(a => a.priority === 'inalta').length

  const TABS: { key: FilterTab; label: string; count: number }[] = [
    { key: 'toate',   label: 'Toate',   count: allItems.length },
    { key: 'critice', label: 'Critice', count: totalHigh },
    { key: 'atentie', label: 'Atentie', count: totalMed },
    { key: 'ok',      label: 'OK',      count: totalOk },
  ]

  return (
    <div className="space-y-5">
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

      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {dataErrors.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-sm font-semibold text-amber-700 mb-1">Avertisment date:</p>
          <ul className="text-sm text-amber-600 list-disc list-inside space-y-0.5">
            {dataErrors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {!result && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-brand-50 rounded-2xl flex items-center justify-center mb-4">
            <Shield className="w-8 h-8 text-brand-600" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Asistentul AI este pregatit</h2>
          <p className="text-sm text-gray-400 max-w-md">
            Apasa <strong>Ruleaza analiza</strong> pentru a primi o analiza completa a fermei.
          </p>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="w-10 h-10 animate-spin text-brand-600 mb-4" />
          <p className="text-sm text-gray-500">Analizez toate datele fermei tale...</p>
        </div>
      )}

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
              <p className="text-xs text-gray-400 mt-1">din {allItems.length} total</p>
              {totalHigh > 0 && <p className="text-xs text-red-500 font-medium mt-0.5">+{totalHigh} azi</p>}
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col justify-center">
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                <ArrowLeftRight className="w-3.5 h-3.5" /> Arendasi afectati
              </div>
              <div className={`text-3xl font-bold ${(result.tranzactii?.length ?? 0) > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {result.tranzactii?.length ?? 0}
              </div>
              <p className="text-xs text-gray-400 mt-1">{result.contracte?.length ?? 0} contracte active</p>
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

          {/* Sumar executiv */}
          <div className="bg-brand-50 border border-brand-100 rounded-2xl p-5">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-brand-600" />
              <span className="text-sm font-semibold text-brand-700">Sumar executiv</span>
              <span className="text-xs bg-brand-600 text-white px-2 py-0.5 rounded-full font-medium">Generat de AI</span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed mb-3">{result.sumar}</p>
            {(result.actiuni ?? []).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {(result.actiuni ?? []).map((act, i) => (
                  <button key={i} className={`text-xs font-medium px-3 py-1 rounded-full border transition-colors ${ACTION_COLORS[i % ACTION_COLORS.length]}`}>
                    {act}
                  </button>
                ))}
                <button className="text-xs font-medium px-3 py-1 rounded-full border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition-colors">
                  Salveaza raport
                </button>
              </div>
            )}
          </div>

          {/* Filter tabs */}
          <div className="flex flex-wrap items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveFilter(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeFilter === tab.key
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}>
                {tab.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  activeFilter === tab.key ? 'bg-brand-100 text-brand-700' : 'bg-gray-200 text-gray-500'
                }`}>{tab.count}</span>
              </button>
            ))}
            <span className="ml-4 text-xs text-gray-400 hidden sm:block">{model} · {tokens.toLocaleString()} tokens</span>
          </div>

          {/* Main content: left grid + right sidebar */}
          <div className="flex gap-5 items-start">
            {/* Alert grid */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4">
              <SectionCard icon={<FileText className="w-4 h-4" />} title="Contracte"
                count={sectionItems('Contracte').length} high={highOf(result.contracte)}
                items={sectionItems('Contracte')} selectedId={selectedItem?.id ?? null} onSelect={setSelectedItem}
                addHref="/contracte" />
              <SectionCard icon={<Tractor className="w-4 h-4" />} title="Activitati Ferma"
                count={sectionItems('Activitati').length} high={highOf(result.ferma)}
                items={sectionItems('Activitati')} selectedId={selectedItem?.id ?? null} onSelect={setSelectedItem}
                addHref="/ferma" />
              <SectionCard icon={<Package className="w-4 h-4" />} title="Stocuri"
                count={sectionItems('Stocuri').length} high={highOf(result.stocuri)}
                items={sectionItems('Stocuri')} selectedId={selectedItem?.id ?? null} onSelect={setSelectedItem}
                addHref="/inventar/stoc" />
              <SectionCard icon={<Wrench className="w-4 h-4" />} title="Utilaje &amp; RCA"
                count={sectionItems('Utilaje').length} high={highOf(result.utilaje)}
                items={sectionItems('Utilaje')} selectedId={selectedItem?.id ?? null} onSelect={setSelectedItem}
                addHref="/utilaje" />
              <SectionCard icon={<ArrowLeftRight className="w-4 h-4" />} title="Tranzactii Arenda"
                count={sectionItems('Tranzactii').length} high={highOf(result.tranzactii)}
                items={sectionItems('Tranzactii')} selectedId={selectedItem?.id ?? null} onSelect={setSelectedItem}
                addHref="/plati" />
              {/* Insights in grid, 3rd col row 2 */}
              <InsightsPanel insights={result.insights ?? []} />
            </div>

            {/* Right sidebar — detail panel only */}
            <div className="w-72 flex-shrink-0">
              <AlertDetailPanel item={selectedItem} onClose={() => setSelectedItem(null)} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// â”€â”€â”€ Priority / status helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
