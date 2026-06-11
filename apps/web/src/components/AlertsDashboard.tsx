'use client'

/**
 * AlertsDashboard — 100% database-driven operational alert dashboard.
 * NO Groq. NO AI. NO LLM. NO model names. NO token counts.
 * All alerts, statuses, scores, and summaries are computed deterministically
 * from real DB records via GET /api/alerte.
 */

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, CheckCircle, Clock, TrendingDown,
  Loader2, RefreshCw, ChevronRight,
  FileText, Tractor, Package, Wrench, ArrowLeftRight,
  Shield, ShieldAlert, ShieldCheck,
} from 'lucide-react'
import type {
  AlerteResponse, ContractAlerta, FermaAlerta, StocAlerta,
  UtilajeAlerta, TranzactieAlerta, AlertaInsight,
  AlertPriority, DocStatus, AlertPaymentStatus, StocStatus,
} from '@/lib/alerte/types'

// Status display maps
const DOC_LABEL: Record<DocStatus, string> = {
  valid: 'Valid', expiring_soon: 'Expira curand', expiring_critical: 'Expira urgent',
  expired: 'Expirat', missing: 'Data lipsa', invalid_date: 'Data invalida',
}
const DOC_CLS: Record<DocStatus, string> = {
  valid: 'bg-green-100 text-green-700', expiring_soon: 'bg-orange-100 text-orange-700',
  expiring_critical: 'bg-red-100 text-red-700', expired: 'bg-red-100 text-red-700',
  missing: 'bg-gray-100 text-gray-500', invalid_date: 'bg-yellow-100 text-yellow-700',
}
const DOC_DOT: Record<DocStatus, string> = {
  valid: 'bg-green-500', expiring_soon: 'bg-orange-400', expiring_critical: 'bg-red-500',
  expired: 'bg-red-600', missing: 'bg-gray-300', invalid_date: 'bg-yellow-400',
}
const PAY_LABEL: Record<AlertPaymentStatus, string> = {
  paid: 'Platit', unpaid: 'Neplatit', overdue_unpaid: 'Restant',
}
const PAY_CLS: Record<AlertPaymentStatus, string> = {
  paid: 'bg-green-100 text-green-700', unpaid: 'bg-amber-100 text-amber-700',
  overdue_unpaid: 'bg-red-100 text-red-700',
}
const PAY_DOT: Record<AlertPaymentStatus, string> = {
  paid: 'bg-green-500', unpaid: 'bg-amber-400', overdue_unpaid: 'bg-red-500',
}
const STOC_LABEL: Record<StocStatus, string> = {
  epuizat: 'Epuizat', critic: 'Critic (<5%)', scazut: 'Scazut (<25%)', ok: 'OK',
}
const STOC_CLS: Record<StocStatus, string> = {
  epuizat: 'bg-red-100 text-red-700', critic: 'bg-red-100 text-red-700',
  scazut: 'bg-amber-100 text-amber-700', ok: 'bg-green-100 text-green-700',
}
const PRIORITY_DOT: Record<AlertPriority, string> = {
  inalta: 'bg-red-500', medie: 'bg-amber-400', scazuta: 'bg-gray-300',
}

// Helpers
function fmtDate(d: string | null): string {
  if (!d) return 'Lipseste'
  try {
    const dt = new Date(d)
    if (isNaN(dt.getTime()) || dt.getFullYear() < 2000) return 'Data invalida'
    return dt.toLocaleDateString('ro-RO')
  } catch { return 'Data invalida' }
}
function fmtRON(v: number): string {
  return v.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtTime(iso: string): string {
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
  } catch { return '' }
}

// Expandable rows
function ContractRow({ c, onOpen }: { c: ContractAlerta; onOpen: () => void }) {
  const [open, setOpen] = useState(false)
  const daysLabel = c.days_until_expiry === null ? '' :
    c.days_until_expiry < 0 ? `${Math.abs(c.days_until_expiry)}z expirat` : `${c.days_until_expiry} zile`
  return (
    <div>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-gray-50 transition-all">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${DOC_DOT[c.doc_status]}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">#{c.contract_number} — {c.lessor_name}</p>
          <p className="text-xs text-gray-400 truncate">{c.end_date ? `Expira: ${fmtDate(c.end_date)}` : 'Data expirare lipsa'}</p>
        </div>
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md flex-shrink-0 ${DOC_CLS[c.doc_status]}`}>
          {daysLabel || DOC_LABEL[c.doc_status]}
        </span>
        <ChevronRight className={`w-3.5 h-3.5 text-gray-300 flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="mx-3 mb-2 p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div><span className="text-gray-400">Status BD:</span> <span className="font-medium text-gray-700">{c.status_db}</span></div>
            <div><span className="text-gray-400">Data expirare:</span> <span className="font-medium text-gray-700">{fmtDate(c.end_date)}</span></div>
            <div><span className="text-gray-400">Arenda anuala:</span> <span className="font-medium text-gray-700">{fmtRON(c.annual_rent)} RON</span></div>
            <div><span className="text-gray-400">Prioritate:</span> <span className={`font-medium ${c.priority === 'inalta' ? 'text-red-600' : c.priority === 'medie' ? 'text-amber-600' : 'text-gray-600'}`}>{c.priority}</span></div>
          </div>
          <button onClick={onOpen}
            className="mt-1 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg transition-colors">
            Vezi contract
          </button>
        </div>
      )}
    </div>
  )
}

function FermaRow({ f, onOpen }: { f: FermaAlerta; onOpen: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-gray-50 transition-all">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[f.priority]}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{f.operation_type}{f.parcel_code ? ` — ${f.parcel_code}` : ''}</p>
          <p className="text-xs text-gray-400 truncate">Planificat: {fmtDate(f.planned_date)} · {f.status_db}</p>
        </div>
        {f.is_overdue && f.overdue_days !== null && (
          <span className="text-xs font-medium px-1.5 py-0.5 rounded-md flex-shrink-0 bg-red-100 text-red-700">
            {f.overdue_days}z intarziere
          </span>
        )}
        <ChevronRight className={`w-3.5 h-3.5 text-gray-300 flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="mx-3 mb-2 p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs space-y-1">
          <div className="grid grid-cols-2 gap-1">
            <span className="text-gray-400">Operatie:</span><span className="text-gray-700">{f.operation_type}</span>
            <span className="text-gray-400">Status:</span><span className="text-gray-700">{f.status_db}</span>
            <span className="text-gray-400">Data planificata:</span><span className="text-gray-700">{fmtDate(f.planned_date)}</span>
            {f.is_overdue && <><span className="text-gray-400">Intarziere:</span><span className="text-red-600 font-medium">{f.overdue_days} zile</span></>}
          </div>
          <button onClick={onOpen}
            className="mt-1 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg transition-colors">
            Vezi activitate
          </button>
        </div>
      )}
    </div>
  )
}

function StocRow({ s, onOpen }: { s: StocAlerta; onOpen: () => void }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-gray-50 transition-all">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.stock_status === 'ok' ? 'bg-green-500' : s.stock_status === 'scazut' ? 'bg-amber-400' : 'bg-red-500'}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{s.product_name}</p>
          <p className="text-xs text-gray-400 truncate">{s.category} · {s.quantity_available} {s.unit} disponibil</p>
        </div>
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md flex-shrink-0 ${STOC_CLS[s.stock_status]}`}>
          {STOC_LABEL[s.stock_status]} ({s.pct_remaining}%)
        </span>
        <ChevronRight className={`w-3.5 h-3.5 text-gray-300 flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="mx-3 mb-2 p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs space-y-1">
          <div className="grid grid-cols-2 gap-1">
            <span className="text-gray-400">Disponibil:</span><span className="font-medium text-gray-700">{s.quantity_available} {s.unit}</span>
            <span className="text-gray-400">Initial:</span><span className="text-gray-700">{s.quantity_original} {s.unit}</span>
            <span className="text-gray-400">Procent ramas:</span><span className={`font-medium ${s.pct_remaining < 5 ? 'text-red-600' : s.pct_remaining < 25 ? 'text-amber-600' : 'text-green-600'}`}>{s.pct_remaining}%</span>
            <span className="text-gray-400">Expirare lot:</span><span className="text-gray-700">{fmtDate(s.expiry_date)}</span>
          </div>
          <button onClick={onOpen}
            className="mt-1 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg transition-colors">
            Gestioneaza stoc
          </button>
        </div>
      )}
    </div>
  )
}

function UtilajRow({ u, onOpen }: { u: UtilajeAlerta; onOpen: () => void }) {
  const [open, setOpen] = useState(false)
  const daysLabel = u.rca_days === null ? '' :
    u.rca_days < 0 ? `${Math.abs(u.rca_days)}z expirat` : `${u.rca_days}z`
  return (
    <div>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-gray-50 transition-all">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${DOC_DOT[u.rca_status]}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
          <p className="text-xs text-gray-400 truncate">{u.type}{u.plate ? ` · ${u.plate}` : ''}</p>
        </div>
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md flex-shrink-0 ${DOC_CLS[u.rca_status]}`}>
          RCA{daysLabel ? `: ${daysLabel}` : ` — ${DOC_LABEL[u.rca_status]}`}
        </span>
        <ChevronRight className={`w-3.5 h-3.5 text-gray-300 flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="mx-3 mb-2 p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
            <div>
              <p className="text-gray-400 mb-0.5 font-medium">RCA</p>
              <span className={`font-semibold ${DOC_CLS[u.rca_status]} rounded px-1.5 py-0.5 inline-block text-[11px]`}>{DOC_LABEL[u.rca_status]}</span>
              <p className="text-gray-500 mt-0.5">Expira: {fmtDate(u.rca_expiry_date)}</p>
            </div>
            {u.itp_due_date && (
              <div>
                <p className="text-gray-400 mb-0.5 font-medium">ITP</p>
                <span className={`font-semibold ${u.itp_status ? DOC_CLS[u.itp_status] : 'bg-gray-100 text-gray-500'} rounded px-1.5 py-0.5 inline-block text-[11px]`}>{u.itp_status ? DOC_LABEL[u.itp_status] : 'Necunoscut'}</span>
                <p className="text-gray-500 mt-0.5">Scadent: {fmtDate(u.itp_due_date)}</p>
              </div>
            )}
            {u.service_due_date && (
              <div>
                <p className="text-gray-400 mb-0.5 font-medium">Service</p>
                <span className={`font-semibold ${u.service_status ? DOC_CLS[u.service_status] : 'bg-gray-100 text-gray-500'} rounded px-1.5 py-0.5 inline-block text-[11px]`}>{u.service_status ? DOC_LABEL[u.service_status] : 'Necunoscut'}</span>
                <p className="text-gray-500 mt-0.5">Scadent: {fmtDate(u.service_due_date)}</p>
                {u.service_task_title && <p className="text-gray-400">{u.service_task_title}</p>}
              </div>
            )}
            <div>
              <p className="text-gray-400 mb-0.5 font-medium">Fabricatie</p>
              <p className="text-gray-700">{[u.brand, u.model, u.year].filter(Boolean).join(' ') || '—'}</p>
            </div>
          </div>
          <button onClick={onOpen}
            className="mt-1 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg transition-colors">
            Vezi utilaj
          </button>
        </div>
      )}
    </div>
  )
}

function TranzactieRow({ t, onPay }: { t: TranzactieAlerta; onPay: () => void }) {
  const [open, setOpen] = useState(false)
  if (t.is_paid) return null  // ONLY unpaid transactions shown in this card
  return (
    <div>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-gray-50 transition-all">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PAY_DOT[t.payment_status]}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{t.lessor_name} — {t.product_name}</p>
          <p className="text-xs text-gray-400 truncate">Camp. {t.campaign_year}{t.contract_number ? ` · #${t.contract_number}` : ''}</p>
        </div>
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md flex-shrink-0 ${PAY_CLS[t.payment_status]}`}>
          {PAY_LABEL[t.payment_status]}
        </span>
        <span className="text-xs font-semibold text-gray-700 flex-shrink-0 min-w-[64px] text-right">
          {fmtRON(t.ron_net)} RON
        </span>
        <ChevronRight className={`w-3.5 h-3.5 text-gray-300 flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="mx-3 mb-2 p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <span className="text-gray-400">Arendator:</span><span className="text-gray-700">{t.lessor_name}</span>
            <span className="text-gray-400">Produs:</span><span className="text-gray-700">{t.product_name}</span>
            <span className="text-gray-400">Campanie:</span><span className="text-gray-700">{t.campaign_year}</span>
            <span className="text-gray-400">Data tranzactie:</span><span className="text-gray-700">{fmtDate(t.transaction_date)}</span>
            <span className="text-gray-400">Valoare:</span><span className="font-semibold text-gray-900">{fmtRON(t.ron_net)} RON</span>
            <span className="text-gray-400">Status:</span>
            <span className={`font-semibold ${PAY_CLS[t.payment_status]} rounded px-1 inline-block text-[11px]`}>{PAY_LABEL[t.payment_status]}</span>
            {t.is_overdue && (
              <span className="col-span-2 text-red-600 font-semibold">Plata intarziata cu &gt;30 zile</span>
            )}
            {t.contract_id && (
              <><span className="text-gray-400">Contract:</span><span className="text-gray-700">#{t.contract_number ?? t.contract_id.slice(0, 8)}</span></>
            )}
          </div>
          {/* Navigate to contract dashboard for payment registration */}
          <button onClick={onPay}
            className="mt-1 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg transition-colors">
            Inregistreaza plata
          </button>
        </div>
      )}
    </div>
  )
}

// Section card
function SectionCard({
  icon, title, count, critice, addHref, children,
}: {
  icon: React.ReactNode; title: string; count: number; critice: number
  addHref: string; children: React.ReactNode
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
        {critice > 0 && (
          <span className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3" /> {critice} critice
          </span>
        )}
      </div>
      <div className="p-3 space-y-0.5">
        {count === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 py-4 text-gray-300">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">Situatie buna — nicio alerta</span>
            <button onClick={() => router.push(addHref)}
              className="text-xs text-brand-500 hover:text-brand-700 font-medium mt-0.5 transition-colors">
              Gestioneaza &rarr;
            </button>
          </div>
        ) : children}
      </div>
      {count > 0 && (
        <div className="px-4 py-2 border-t border-gray-50">
          <button onClick={() => router.push(addHref)}
            className="text-xs text-brand-500 hover:text-brand-700 font-medium transition-colors">
            Vezi toate &rarr;
          </button>
        </div>
      )}
    </div>
  )
}

// Risk gauge
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
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <span className="text-2xl font-bold -mt-16" style={{ color }}>{s}</span>
      <span className="text-xs text-gray-400 mt-6">/ 100</span>
      <span className="text-xs font-semibold mt-1" style={{ color }}>{label}</span>
    </div>
  )
}

// Insights panel (DB-computed, not AI)
function InsightsPanel({ insights }: { insights: AlertaInsight[] }) {
  if (insights.length === 0) return null
  const impactCls = (impact: string) =>
    impact === 'mare' ? 'bg-red-900 text-red-300' :
    impact === 'mediu' ? 'bg-amber-900 text-amber-300' : 'bg-gray-700 text-gray-300'
  return (
    <div className="bg-gray-900 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-700">
        <ShieldAlert className="w-4 h-4 text-red-400" />
        <span className="font-semibold text-white text-sm">Alerte prioritare</span>
        <span className="text-xs bg-brand-600 text-white px-1.5 py-0.5 rounded-full ml-auto">Top {insights.length}</span>
      </div>
      <div className="p-3 space-y-3">
        {insights.map((ins, i) => (
          <div key={i} className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${impactCls(ins.impact)}`}>
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

// Main dashboard
type FilterTab = 'toate' | 'critice' | 'atentie'

export default function AlertsDashboard() {
  const router = useRouter()
  const [data, setData]       = useState<AlerteResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterTab>('toate')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch('/api/alerte', { cache: 'no-store' })
      const json: AlerteResponse = await res.json()
      if (!json.ok) { setError(json.error ?? 'Eroare la incarcarea alertelor.') }
      else { setData(json); setUpdatedAt(fmtTime(json.generat_la)) }
    } catch { setError('Nu s-a putut contacta baza de date.') }
    finally  { setLoading(false) }
  }, [])

  useEffect(() => { void load() }, [load])

  const d = data

  // Counts
  const contracteCritice = (d?.contracte ?? []).filter(c => c.priority === 'inalta').length
  const contracteMedii   = (d?.contracte ?? []).filter(c => c.priority === 'medie').length
  const fermaCritice     = (d?.ferma     ?? []).filter(f => f.priority === 'inalta').length
  const fermaMedii       = (d?.ferma     ?? []).filter(f => f.priority === 'medie').length
  const stocuriCritice   = (d?.stocuri   ?? []).filter(s => s.priority === 'inalta').length
  const stocuriMedii     = (d?.stocuri   ?? []).filter(s => s.priority === 'medie').length
  const utilajeCritice   = (d?.utilaje   ?? []).filter(u => u.overall_priority === 'high').length
  const utilajeMedii     = (d?.utilaje   ?? []).filter(u => u.overall_priority === 'medium').length
  const txUnpaid         = (d?.tranzactii ?? []).filter(t => !t.is_paid)
  const txCritice        = txUnpaid.filter(t => t.is_overdue).length
  const txMedii          = txUnpaid.filter(t => !t.is_overdue).length

  const totalCritice = contracteCritice + fermaCritice + stocuriCritice + utilajeCritice + txCritice
  const totalMedii   = contracteMedii   + fermaMedii   + stocuriMedii   + utilajeMedii   + txMedii
  const totalAlerte  = totalCritice + totalMedii

  // Filtered sections
  function filterPriority<T extends { priority: AlertPriority }>(arr: T[]): T[] {
    return activeFilter === 'critice' ? arr.filter(x => x.priority === 'inalta')
         : activeFilter === 'atentie' ? arr.filter(x => x.priority === 'medie')
         : arr
  }
  const showContracte  = filterPriority(d?.contracte ?? [])
  const showFerma      = filterPriority(d?.ferma     ?? [])
  const showStocuri    = filterPriority(d?.stocuri   ?? [])
  const showUtilaje    = activeFilter === 'critice'
    ? (d?.utilaje ?? []).filter(u => u.overall_priority === 'high')
    : activeFilter === 'atentie'
    ? (d?.utilaje ?? []).filter(u => u.overall_priority === 'medium')
    : d?.utilaje ?? []
  // Transactions: always show only unpaid, filter doesn't apply to is_paid
  const showTranzactii = (d?.tranzactii ?? []).filter(t => !t.is_paid)

  const TABS: { key: FilterTab; label: string; count: number }[] = [
    { key: 'toate',   label: 'Toate',   count: totalAlerte },
    { key: 'critice', label: 'Critice', count: totalCritice },
    { key: 'atentie', label: 'Atentie', count: totalMedii },
  ]

  const toContract = (c: ContractAlerta)    => router.push(`/contracte/${c.id}`)
  const toActivity = ()                     => router.push('/campanie/activitati')
  const toStock    = ()                     => router.push('/campanie/stocuri')
  const toUtilaj   = ()                     => router.push('/utilaje')
  const toPayment  = (t: TranzactieAlerta) =>
    router.push(t.contract_id ? `/contracte/${t.contract_id}` : '/plati')

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alerte Operationale</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Situatia exacta a fermei din baza de date{updatedAt && <span className="ml-1 text-gray-400">· actualizat {updatedAt}</span>}
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-xl disabled:opacity-50 transition-colors">
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Incarc...</>
            : <><RefreshCw className="w-4 h-4" /> Actualizeaza</>}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* DB warnings (non-fatal) */}
      {d && d.errors.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-xs font-semibold text-amber-700 mb-1">Avertismente baza de date:</p>
          <ul className="text-xs text-amber-600 list-disc list-inside space-y-0.5">
            {d.errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* Loading */}
      {loading && !d && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-brand-600 mb-4" />
          <p className="text-sm text-gray-500">Incarc situatia fermei din baza de date...</p>
        </div>
      )}

      {/* Dashboard */}
      {d && !loading && (
        <>
          <InsightsPanel insights={d.insights} />

          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col items-center justify-center">
              <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-2">Scor risc global</p>
              <RiskGauge score={d.scor_risc} />
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col justify-center">
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Alerte critice
              </div>
              <div className={`text-3xl font-bold ${totalCritice > 0 ? 'text-red-600' : 'text-green-600'}`}>{totalCritice}</div>
              <p className="text-xs text-gray-400 mt-1">din {totalAlerte} total</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col justify-center">
              <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                <ArrowLeftRight className="w-3.5 h-3.5" /> Arendasi afectati
              </div>
              <div className={`text-3xl font-bold ${d.sumar.arendasi_afectati > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                {d.sumar.arendasi_afectati}
              </div>
              <p className="text-xs text-gray-400 mt-1">{d.sumar.contracte_active} contracte active</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col justify-center">
              {d.scor_risc < 20
                ? <><ShieldCheck className="w-6 h-6 text-green-500 mb-1" /><p className="text-sm font-semibold text-green-700">Situatie buna</p><p className="text-xs text-gray-400 mt-0.5">Fara alerte critice</p></>
                : d.scor_risc < 50
                ? <><Clock className="w-6 h-6 text-amber-500 mb-1" /><p className="text-sm font-semibold text-amber-700">Necesita atentie</p><p className="text-xs text-gray-400 mt-0.5">{totalMedii} alerte medii</p></>
                : <><TrendingDown className="w-6 h-6 text-red-500 mb-1" /><p className="text-sm font-semibold text-red-700">Risc {d.scor_tier}</p><p className="text-xs text-gray-400 mt-0.5">{totalCritice} alerte critice</p></>}
            </div>
          </div>

          {/* Sumar executiv — template-based, DB-driven, no AI */}
          <div className="bg-brand-50 border border-brand-100 rounded-2xl p-5">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-brand-600" />
              <span className="text-sm font-semibold text-brand-700">Sumar executiv</span>
              <span className="ml-auto text-xs text-brand-400">Date din baza de date · {updatedAt ?? '—'}</span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{d.sumar_text}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
              {[
                { label: 'Contracte active',    val: d.sumar.contracte_active,                              warn: d.sumar.contracte_expirate > 0 || d.sumar.contracte_expira_curand > 0 },
                { label: 'Tranzactii neplatite', val: d.sumar.tranzactii_neplatite,                          warn: d.sumar.tranzactii_neplatite > 0 },
                { label: 'Utilaje cu alerte',   val: d.sumar.utilaje_cu_alerte,                             warn: d.sumar.utilaje_cu_alerte > 0 },
                { label: 'Stocuri cu probleme', val: d.sumar.stocuri_epuizate + d.sumar.stocuri_scazute,    warn: d.sumar.stocuri_epuizate > 0 },
              ].map(({ label, val, warn }) => (
                <div key={label} className="bg-white rounded-xl border border-brand-100 px-3 py-2">
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className={`text-lg font-bold ${warn && val > 0 ? 'text-red-600' : 'text-gray-900'}`}>{val}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Filter tabs — no model/token display */}
          <div className="flex flex-wrap items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
            {TABS.map(tab => (
              <button key={tab.key} onClick={() => setActiveFilter(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  activeFilter === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {tab.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  activeFilter === tab.key ? 'bg-brand-100 text-brand-700' : 'bg-gray-200 text-gray-500'
                }`}>{tab.count}</span>
              </button>
            ))}
          </div>

          {/* Alert section cards */}
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <SectionCard icon={<FileText className="w-4 h-4" />} title="Contracte"
                count={showContracte.length} critice={showContracte.filter(c => c.priority === 'inalta').length}
                addHref="/contracte">
                {showContracte.map(c => <ContractRow key={c.id} c={c} onOpen={() => toContract(c)} />)}
              </SectionCard>
              <SectionCard icon={<Tractor className="w-4 h-4" />} title="Activitati Ferma"
                count={showFerma.length} critice={showFerma.filter(f => f.priority === 'inalta').length}
                addHref="/campanie/activitati">
                {showFerma.map(f => <FermaRow key={f.id} f={f} onOpen={toActivity} />)}
              </SectionCard>
              <SectionCard icon={<Package className="w-4 h-4" />} title="Stocuri & Inputuri"
                count={showStocuri.length} critice={showStocuri.filter(s => s.priority === 'inalta').length}
                addHref="/campanie/stocuri">
                {showStocuri.map(s => <StocRow key={s.id} s={s} onOpen={toStock} />)}
              </SectionCard>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <SectionCard icon={<Wrench className="w-4 h-4" />} title="Utilaje & RCA"
                count={showUtilaje.length} critice={showUtilaje.filter(u => u.overall_priority === 'high').length}
                addHref="/utilaje">
                {showUtilaje.map(u => <UtilajRow key={u.id} u={u} onOpen={toUtilaj} />)}
              </SectionCard>
              <SectionCard icon={<ArrowLeftRight className="w-4 h-4" />} title="Tranzactii Neplatite"
                count={showTranzactii.length} critice={showTranzactii.filter(t => t.is_overdue).length}
                addHref="/plati">
                {showTranzactii.map(t => <TranzactieRow key={t.id} t={t} onPay={() => toPayment(t)} />)}
              </SectionCard>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
