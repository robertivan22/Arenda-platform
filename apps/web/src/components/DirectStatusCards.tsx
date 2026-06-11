'use client'

/**
 * DirectStatusCards
 * Always-visible panel that loads utilaje + tranzactii status DIRECTLY from the database.
 * NO Groq. NO AI. Pure deterministic computation from real DB rows.
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Wrench, ArrowLeftRight, AlertTriangle, CheckCircle,
  Loader2, ChevronRight, RefreshCw, ShieldAlert, ShieldCheck,
  ShieldOff, Clock, HelpCircle, Ban,
} from 'lucide-react'
import type { DocStatus, PaymentStatus, UtilajRow, TranzactieRow, DirectStatusResponse } from '@/app/api/direct-status/route'

// ─── Status display maps ──────────────────────────────────────────────────────

const DOC_STATUS_LABEL: Record<DocStatus, string> = {
  valid:              'Valid',
  expiring_soon:      'Expira curand',
  expiring_critical:  'Expira urgent',
  expired:            'Expirat',
  missing:            'Lipsa data',
  invalid_date:       'Data invalida',
}

const DOC_STATUS_COLOR: Record<DocStatus, string> = {
  valid:              'bg-green-100 text-green-700',
  expiring_soon:      'bg-orange-100 text-orange-700',
  expiring_critical:  'bg-red-100 text-red-700',
  expired:            'bg-red-100 text-red-700',
  missing:            'bg-gray-100 text-gray-500',
  invalid_date:       'bg-yellow-100 text-yellow-700',
}

const DOC_STATUS_DOT: Record<DocStatus, string> = {
  valid:              'bg-green-500',
  expiring_soon:      'bg-orange-400',
  expiring_critical:  'bg-red-500',
  expired:            'bg-red-500',
  missing:            'bg-gray-300',
  invalid_date:       'bg-yellow-400',
}

const PAY_STATUS_COLOR: Record<PaymentStatus, string> = {
  paid:           'bg-green-100 text-green-700',
  unpaid:         'bg-amber-100 text-amber-700',
  overdue_unpaid: 'bg-red-100 text-red-700',
}
const PAY_STATUS_LABEL: Record<PaymentStatus, string> = {
  paid:           'Platit',
  unpaid:         'Neplatit',
  overdue_unpaid: 'Restant',
}
const PAY_STATUS_DOT: Record<PaymentStatus, string> = {
  paid:           'bg-green-500',
  unpaid:         'bg-amber-400',
  overdue_unpaid: 'bg-red-500',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null): string {
  if (!d) return '—'
  try {
    const dt = new Date(d)
    if (isNaN(dt.getTime()) || dt.getFullYear() < 2000) return '—'
    return dt.toLocaleDateString('ro-RO')
  } catch { return '—' }
}

function fmtRON(v: number): string {
  return v.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function daysLabel(days: number | null, status: DocStatus): string {
  if (days === null) return ''
  if (status === 'expired') return `${Math.abs(days)} zile expirat`
  return `${days} zile`
}

// ─── Utilaj expandable row ────────────────────────────────────────────────────

function UtilajRowItem({ u }: { u: UtilajRow }) {
  const [open, setOpen] = useState(false)
  const docDot = DOC_STATUS_DOT[u.rca_status]

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-gray-50 transition-all"
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${docDot}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
          <p className="text-xs text-gray-400 truncate">{u.type}{u.plate ? ` · ${u.plate}` : ''}</p>
        </div>
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md flex-shrink-0 ${DOC_STATUS_COLOR[u.rca_status]}`}>
          RCA: {DOC_STATUS_LABEL[u.rca_status]}{u.rca_days !== null ? ` (${daysLabel(u.rca_days, u.rca_status)})` : ''}
        </span>
        <ChevronRight className={`w-3.5 h-3.5 text-gray-300 flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="mx-3 mb-2 p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-2 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-gray-400 uppercase tracking-wide font-medium mb-0.5">RCA</p>
              <p className={`font-semibold ${DOC_STATUS_COLOR[u.rca_status]} rounded px-1.5 py-0.5 inline-block`}>
                {DOC_STATUS_LABEL[u.rca_status]}
              </p>
              <p className="text-gray-500 mt-0.5">Expira: {fmtDate(u.rca_expiry_date)}</p>
            </div>
            {u.itp_due_date && (
              <div>
                <p className="text-gray-400 uppercase tracking-wide font-medium mb-0.5">ITP</p>
                <p className={`font-semibold ${u.itp_status ? DOC_STATUS_COLOR[u.itp_status] : 'bg-gray-100 text-gray-500'} rounded px-1.5 py-0.5 inline-block`}>
                  {u.itp_status ? DOC_STATUS_LABEL[u.itp_status] : '—'}
                </p>
                <p className="text-gray-500 mt-0.5">Scadent: {fmtDate(u.itp_due_date)}</p>
                {u.itp_task_title && <p className="text-gray-400">{u.itp_task_title}</p>}
              </div>
            )}
            {u.service_due_date && (
              <div>
                <p className="text-gray-400 uppercase tracking-wide font-medium mb-0.5">Service / Revizie</p>
                <p className={`font-semibold ${u.service_status ? DOC_STATUS_COLOR[u.service_status] : 'bg-gray-100 text-gray-500'} rounded px-1.5 py-0.5 inline-block`}>
                  {u.service_status ? DOC_STATUS_LABEL[u.service_status] : '—'}
                </p>
                <p className="text-gray-500 mt-0.5">Scadent: {fmtDate(u.service_due_date)}</p>
                {u.service_task_title && <p className="text-gray-400">{u.service_task_title}</p>}
              </div>
            )}
            <div>
              <p className="text-gray-400 uppercase tracking-wide font-medium mb-0.5">Fabricatie</p>
              <p className="text-gray-700">{[u.brand, u.model, u.year].filter(Boolean).join(' ') || '—'}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Transaction expandable row ───────────────────────────────────────────────

function TranzactieRowItem({ t, onNavigate }: { t: TranzactieRow; onNavigate: () => void }) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left hover:bg-gray-50 transition-all"
      >
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${PAY_STATUS_DOT[t.payment_status]}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{t.lessor_name} — {t.product_name}</p>
          <p className="text-xs text-gray-400">Camp. {t.campaign_year} · {fmtDate(t.transaction_date)}</p>
        </div>
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded-md flex-shrink-0 ${PAY_STATUS_COLOR[t.payment_status]}`}>
          {PAY_STATUS_LABEL[t.payment_status]}
        </span>
        <span className="text-xs font-semibold text-gray-700 flex-shrink-0 min-w-[70px] text-right">
          {fmtRON(t.ron_net)} RON
        </span>
        <ChevronRight className={`w-3.5 h-3.5 text-gray-300 flex-shrink-0 transition-transform duration-150 ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="mx-3 mb-2 p-3 bg-gray-50 rounded-xl border border-gray-100 space-y-2">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div><span className="text-gray-400">Status:</span> <span className={`font-semibold ${PAY_STATUS_COLOR[t.payment_status]} rounded px-1.5 py-0.5`}>{PAY_STATUS_LABEL[t.payment_status]}</span></div>
            <div><span className="text-gray-400">Valoare:</span> <span className="font-semibold text-gray-800">{fmtRON(t.ron_net)} RON</span></div>
            <div><span className="text-gray-400">Data tranzactie:</span> <span className="text-gray-700">{fmtDate(t.transaction_date)}</span></div>
            <div><span className="text-gray-400">Campanie:</span> <span className="text-gray-700">{t.campaign_year}</span></div>
            {t.is_overdue && <div className="col-span-2 text-red-600 font-semibold">⚠ Plata intarziata cu &gt;30 zile</div>}
          </div>
          {!t.is_paid && (
            <button
              onClick={(e) => { e.stopPropagation(); onNavigate() }}
              className="mt-1 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              Inregistreaza plata
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Card wrapper (same design as SectionCard) ────────────────────────────────

function StatusCard({ icon, title, count, critice, children, addHref, loading }: {
  icon: React.ReactNode
  title: string
  count: number
  critice: number
  children: React.ReactNode
  addHref: string
  loading: boolean
}) {
  const router = useRouter()
  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="text-brand-600">{icon}</div>
          <span className="font-semibold text-gray-900 text-sm">{title}</span>
          <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {loading ? '…' : count}
          </span>
        </div>
        {critice > 0 && (
          <span className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3" /> {critice} critice
          </span>
        )}
      </div>
      <div className="p-3 space-y-0.5">
        {loading ? (
          <div className="flex items-center justify-center py-6 text-gray-300 gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Se incarca din baza de date...</span>
          </div>
        ) : count === 0 ? (
          <div className="flex flex-col items-center justify-center gap-1 py-4 text-gray-300">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">Nicio inregistrare</span>
            <button
              onClick={() => router.push(addHref)}
              className="text-xs text-brand-500 hover:text-brand-700 font-medium mt-0.5 transition-colors"
            >
              Gestioneaza →
            </button>
          </div>
        ) : children}
      </div>
      {!loading && count > 0 && (
        <div className="px-4 py-2 border-t border-gray-50">
          <button
            onClick={() => router.push(addHref)}
            className="text-xs text-brand-500 hover:text-brand-700 font-medium transition-colors"
          >
            Vezi toate →
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function DirectStatusCards() {
  const router = useRouter()
  const [data, setData] = useState<DirectStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadedAt, setLoadedAt] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/direct-status', { cache: 'no-store' })
      const json: DirectStatusResponse = await res.json()
      if (!json.ok) {
        setError(json.error ?? 'Eroare la incarcarea datelor.')
      } else {
        setData(json)
        setLoadedAt(new Date().toLocaleTimeString('ro-RO'))
        if (json.errors?.length > 0) {
          console.warn('[DirectStatus] DB warnings:', json.errors)
        }
      }
    } catch (e) {
      setError('Nu s-a putut contacta baza de date.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const utilaje   = data?.utilaje   ?? []
  const tranzactii = data?.tranzactii ?? []
  const summary    = data?.summary

  const utilajeCritice = utilaje.filter(u => u.overall_priority === 'high').length
  const txUnpaid       = tranzactii.filter(t => !t.is_paid).length

  return (
    <div className="space-y-2">
      {/* DB source indicator */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          Date direct din baza de date — fara AI
          {loadedAt && <span> · actualizat {loadedAt}</span>}
          {data?.errors && data.errors.length > 0 && (
            <span className="text-amber-600 ml-2">⚠ {data.errors.length} avertisment(e) BD</span>
          )}
        </p>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-600 transition-colors disabled:opacity-40"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          Actualizeaza
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      {/* Summary strip (only when data loaded) */}
      {!loading && data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[
            { label: 'Utilaje active',    val: summary?.utilaje_total ?? 0,     color: 'text-gray-900' },
            { label: 'Utilaje cu alerte', val: utilajeCritice,                  color: utilajeCritice > 0 ? 'text-red-600' : 'text-green-600' },
            { label: 'Tranzactii neplatite', val: txUnpaid,                     color: txUnpaid > 0 ? 'text-amber-600' : 'text-green-600' },
            { label: 'Total neplatit',    val: `${(summary?.tranzactii_unpaid_ron ?? 0).toFixed(0)} RON`, color: txUnpaid > 0 ? 'text-red-700' : 'text-green-600' },
          ].map(({ label, val, color }) => (
            <div key={label} className="bg-white rounded-xl border border-gray-200 px-3 py-2">
              <p className="text-xs text-gray-400">{label}</p>
              <p className={`text-base font-bold ${color}`}>{val}</p>
            </div>
          ))}
        </div>
      )}

      {/* Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StatusCard
          icon={<Wrench className="w-4 h-4" />}
          title="Utilaje & RCA"
          count={utilaje.length}
          critice={utilajeCritice}
          addHref="/utilaje"
          loading={loading}
        >
          {utilaje.map(u => <UtilajRowItem key={u.id} u={u} />)}
        </StatusCard>

        <StatusCard
          icon={<ArrowLeftRight className="w-4 h-4" />}
          title="Tranzactii Arenda"
          count={tranzactii.length}
          critice={tranzactii.filter(t => t.is_overdue).length}
          addHref="/plati"
          loading={loading}
        >
          {tranzactii.map(t => (
            <TranzactieRowItem
              key={t.id}
              t={t}
              onNavigate={() => router.push('/plati')}
            />
          ))}
        </StatusCard>
      </div>
    </div>
  )
}
