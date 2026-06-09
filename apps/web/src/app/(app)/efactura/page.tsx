'use client'

export const runtime = 'edge'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  FileCheck2, FileX2, Clock, Upload, RefreshCw, Eye, Download,
  AlertCircle, CheckCircle2, XCircle, Loader2, Key, Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lessor {
  id: string
  first_name: string
  last_name: string
  company_name: string | null
  type: string
}
interface Invoice {
  id: string
  invoice_number: string
  invoice_series: string | null
  invoice_date: string
  total_ron: number
  tva_amount: number
  doc_type: string
  status: string
  lessor_id: string
  efactura_status: string | null
  efactura_upload_id: string | null
  efactura_download_id: string | null
  efactura_submitted_at: string | null
  efactura_rejection_reason: string | null
  lessors?: Lessor | null
}
interface TokenStatus {
  connected: boolean
  expires_at?: string
  expired?: boolean
  cif?: string | null
  updated_at?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function lessorName(l: Lessor | null | undefined) {
  if (!l) return '—'
  return l.type === 'LEGAL' ? (l.company_name ?? '—') : `${l.last_name} ${l.first_name}`.trim()
}

const EF_STATUS_CFG: Record<
  string,
  { label: string; color: string; icon: React.ElementType }
> = {
  NOT_SUBMITTED: { label: 'Netrimisă', color: 'bg-gray-100 text-gray-500 border-gray-200', icon: Clock },
  SUBMITTED: { label: 'Trimisă', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: Upload },
  PROCESSING: { label: 'În procesare', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Clock },
  ACCEPTED: { label: 'Acceptată', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle2 },
  REJECTED: { label: 'Respinsă', color: 'bg-red-100 text-red-700 border-red-200', icon: XCircle },
  ERROR: { label: 'Eroare', color: 'bg-red-100 text-red-600 border-red-200', icon: AlertCircle },
}

function EfStatusBadge({ status }: { status: string | null }) {
  const cfg = EF_STATUS_CFG[status ?? 'NOT_SUBMITTED'] ?? EF_STATUS_CFG.NOT_SUBMITTED
  const Icon = cfg.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  )
}

// ─── Token Config Panel ───────────────────────────────────────────────────────

function TokenPanel({
  tokenStatus,
  onSave,
  onRevoke,
}: {
  tokenStatus: TokenStatus | null
  onSave: (token: string, expiresAt: string) => Promise<void>
  onRevoke: () => Promise<void>
}) {
  const [token, setToken] = useState('')
  const [expiresAt, setExpiresAt] = useState(() => {
    const d = new Date()
    d.setHours(d.getHours() + 1)
    return d.toISOString().slice(0, 16)
  })
  const [saving, setSaving] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!token.trim()) { toast.error('Introduceți token-ul ANAF'); return }
    setSaving(true)
    await onSave(token.trim(), new Date(expiresAt).toISOString())
    setSaving(false)
    setToken('')
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Key className="w-4 h-4 text-brand-600" />
        <h3 className="font-semibold text-sm text-gray-800">Token ANAF SPV</h3>
        {tokenStatus?.connected && (
          <span
            className={`ml-auto inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border font-medium ${
              tokenStatus.expired
                ? 'bg-red-50 text-red-600 border-red-200'
                : 'bg-green-50 text-green-700 border-green-200'
            }`}
          >
            {tokenStatus.expired ? <XCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
            {tokenStatus.expired ? 'Expirat' : 'Activ'}
          </span>
        )}
      </div>

      {tokenStatus?.connected && !tokenStatus.expired && (
        <div className="mb-3 text-xs text-gray-500 space-y-0.5">
          {tokenStatus.cif && <p>CIF autorizat: <span className="font-medium text-gray-700">{tokenStatus.cif}</span></p>}
          <p>Expiră: <span className="font-medium">{new Date(tokenStatus.expires_at!).toLocaleString('ro-RO')}</span></p>
        </div>
      )}

      <p className="text-xs text-gray-500 mb-3">
        Obțineți token-ul de pe{' '}
        <a href="https://efactura.mfinante.gov.ro" target="_blank" rel="noopener noreferrer"
          className="text-brand-600 underline">efactura.mfinante.gov.ro</a>{' '}
        (secțiunea SPV → Autorizare API) și lipiți-l mai jos.
      </p>

      <form onSubmit={handleSave} className="space-y-2">
        <textarea
          className="w-full px-2.5 py-2 text-xs font-mono border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          rows={3}
          placeholder="eyJ..."
          value={token}
          onChange={e => setToken(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600 whitespace-nowrap">Expiră la:</label>
          <input
            type="datetime-local"
            className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-400"
            value={expiresAt}
            onChange={e => setExpiresAt(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-1.5 text-xs bg-brand-600 hover:bg-brand-700 text-white rounded font-medium disabled:opacity-50"
          >
            {saving ? 'Se salvează...' : tokenStatus?.connected ? 'Actualizează Token' : 'Salvează Token'}
          </button>
          {tokenStatus?.connected && (
            <button
              type="button"
              onClick={onRevoke}
              className="px-3 py-1.5 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50"
            >
              <Trash2 className="w-3 h-3 inline mr-1" />Revocă
            </button>
          )}
        </div>
      </form>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EFacturaPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [env, setEnv] = useState<'test' | 'prod'>('test')
  const [filterStatus, setFilterStatus] = useState('')
  const [actionInProgress, setActionInProgress] = useState<string | null>(null) // invoice id

  // ── Load data ────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return

    const [{ data: invData }, tokenRes] = await Promise.all([
      db
        .from('invoices')
        .select('id, invoice_number, invoice_series, invoice_date, total_ron, tva_amount, doc_type, status, lessor_id, efactura_status, efactura_upload_id, efactura_download_id, efactura_submitted_at, efactura_rejection_reason, lessors(id, first_name, last_name, company_name, type)')
        .eq('user_id', user.id)
        .eq('doc_type', 'FACTURA')
        .order('invoice_date', { ascending: false }),
      fetch('/api/efactura/token'),
    ])

    setInvoices(
      (invData ?? []).map(inv => ({
        ...inv,
        lessors: Array.isArray(inv.lessors) ? (inv.lessors[0] ?? null) : (inv.lessors ?? null),
      })) as unknown as Invoice[],
    )
    if (tokenRes.ok) {
      const t = (await tokenRes.json()) as TokenStatus
      setTokenStatus(t)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Token actions ─────────────────────────────────────────────────────────
  async function saveToken(token: string, expiresAt: string) {
    const res = await fetch('/api/efactura/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_token: token, expires_at: expiresAt }),
    })
    if (res.ok) {
      toast.success('Token ANAF salvat')
      await loadData()
    } else {
      const e = await res.json() as { error?: string }
      toast.error(e.error ?? 'Eroare la salvarea token-ului')
    }
  }

  async function revokeToken() {
    await fetch('/api/efactura/token', { method: 'DELETE' })
    toast.success('Token revocat')
    await loadData()
  }

  // ── Invoice actions ───────────────────────────────────────────────────────
  async function submitInvoice(inv: Invoice) {
    if (!tokenStatus?.connected || tokenStatus.expired) {
      toast.error('Configurați un token ANAF valid înainte de a trimite factura')
      return
    }
    setActionInProgress(inv.id)
    const res = await fetch('/api/efactura/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice_id: inv.id, env }),
    })
    const data = await res.json() as { ok?: boolean; upload_id?: string; error?: string; errors?: { field: string; message: string }[] }
    setActionInProgress(null)

    if (res.ok && data.ok) {
      toast.success(`Factura trimisă la ANAF (id: ${data.upload_id})`)
      await loadData()
    } else if (data.errors) {
      toast.error(`Validare eșuată: ${data.errors.map(e => e.message).join('; ')}`, { duration: 8000 })
    } else {
      toast.error(data.error ?? 'Eroare la trimitere')
    }
  }

  async function checkStatus(inv: Invoice) {
    setActionInProgress(inv.id)
    const res = await fetch(`/api/efactura/status?invoice_id=${inv.id}&env=${env}`)
    const data = await res.json() as { status?: string; errors?: string[]; error?: string }
    setActionInProgress(null)

    if (res.ok) {
      toast.info(`Status actualizat: ${data.status}`)
      if (data.errors?.length) {
        toast.error(`Erori ANAF: ${data.errors.join('; ')}`, { duration: 8000 })
      }
      await loadData()
    } else {
      toast.error(data.error ?? 'Eroare la verificarea statusului')
    }
  }

  async function previewXml(inv: Invoice) {
    window.open(`/api/efactura/xml-preview?invoice_id=${inv.id}&format=xml`, '_blank')
  }

  async function validateInvoice(inv: Invoice) {
    setActionInProgress(inv.id)
    const res = await fetch(`/api/efactura/xml-preview?invoice_id=${inv.id}`)
    const data = await res.json() as { valid?: boolean; validation_errors?: { field: string; message: string }[]; error?: string }
    setActionInProgress(null)

    if (!res.ok) {
      toast.error(data.error ?? 'Eroare la validare')
      return
    }
    if (data.valid) {
      toast.success('Factura este validă pentru e-Factura ✓')
    } else {
      const msgs = (data.validation_errors ?? []).map(e => `• ${e.message}`).join('\n')
      toast.error(`Erori validare:\n${msgs}`, { duration: 10000 })
    }
  }

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = invoices.filter(i =>
    !filterStatus || (i.efactura_status ?? 'NOT_SUBMITTED') === filterStatus,
  )

  const stats = {
    total: invoices.length,
    accepted: invoices.filter(i => i.efactura_status === 'ACCEPTED').length,
    pending: invoices.filter(i =>
      i.efactura_status === 'SUBMITTED' || i.efactura_status === 'PROCESSING',
    ).length,
    notSent: invoices.filter(i => !i.efactura_status || i.efactura_status === 'NOT_SUBMITTED').length,
    rejected: invoices.filter(i => i.efactura_status === 'REJECTED' || i.efactura_status === 'ERROR').length,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
      </div>
    )
  }

  return (
    <div className="max-w-6xl space-y-5">
      <PageHeader
        title="e-Factura ANAF"
        subtitle="Trimitere electronică facturi către ANAF conform RO_CIUS / UBL 2.1"
      />

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total facturi', value: stats.total, color: 'text-gray-700' },
          { label: 'Acceptate', value: stats.accepted, color: 'text-green-700' },
          { label: 'Netrimise', value: stats.notSent, color: 'text-gray-500' },
          { label: 'Respinse/Erori', value: stats.rejected, color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-lg px-4 py-3 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Left: Token config ──────────────────────────────────────────── */}
        <div className="space-y-3">
          <TokenPanel tokenStatus={tokenStatus} onSave={saveToken} onRevoke={revokeToken} />

          {/* Environment selector */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-semibold text-sm text-gray-800 mb-2">Mediu ANAF</h3>
            <div className="flex gap-2">
              {(['test', 'prod'] as const).map(e => (
                <button
                  key={e}
                  onClick={() => setEnv(e)}
                  className={`flex-1 py-1.5 text-xs font-medium rounded border transition-colors ${
                    env === e
                      ? e === 'prod'
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {e === 'test' ? '🧪 Test' : '🚀 Producție'}
                </button>
              ))}
            </div>
            {env === 'prod' && (
              <p className="mt-2 text-xs text-red-600 font-medium">
                ⚠ Mediul de producție trimite facturi reale la ANAF!
              </p>
            )}
          </div>
        </div>

        {/* ── Right: Invoice table ─────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-3 flex-wrap">
              <FileCheck2 className="w-4 h-4 text-brand-600" />
              <span className="font-semibold text-sm">Facturi ({filtered.length})</span>
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="text-xs border border-gray-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-400"
              >
                <option value="">Toate statusurile e-Factura</option>
                {Object.entries(EF_STATUS_CFG).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
              <button
                onClick={loadData}
                className="ml-auto p-1.5 text-gray-500 hover:text-gray-700 border border-gray-200 rounded"
                title="Reîncarcă"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase bg-gray-50">Nr.</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase bg-gray-50">Data</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase bg-gray-50">Arendaș</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase bg-gray-50">Total RON</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase bg-gray-50">e-Factura</th>
                    <th className="px-3 py-2 bg-gray-50"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(inv => {
                    const busy = actionInProgress === inv.id
                    const efStatus = inv.efactura_status ?? 'NOT_SUBMITTED'
                    const canSubmit = efStatus === 'NOT_SUBMITTED' || efStatus === 'ERROR' || efStatus === 'REJECTED'
                    const canCheckStatus = efStatus === 'SUBMITTED' || efStatus === 'PROCESSING'
                    const hasDownload = !!inv.efactura_download_id

                    return (
                      <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-800">
                          {inv.invoice_series ?? ''}{inv.invoice_number}
                        </td>
                        <td className="px-3 py-2 text-gray-600">{inv.invoice_date}</td>
                        <td className="px-3 py-2 text-gray-700 max-w-[150px] truncate">
                          {lessorName(inv.lessors)}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-green-700">
                          {inv.total_ron.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-col gap-0.5">
                            <EfStatusBadge status={efStatus} />
                            {efStatus === 'REJECTED' && inv.efactura_rejection_reason && (
                              <span className="text-xs text-red-500 max-w-[160px] truncate" title={inv.efactura_rejection_reason}>
                                {inv.efactura_rejection_reason}
                              </span>
                            )}
                            {inv.efactura_submitted_at && (
                              <span className="text-xs text-gray-400">
                                {new Date(inv.efactura_submitted_at).toLocaleDateString('ro-RO')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-1 justify-end">
                            {busy && <Loader2 className="w-4 h-4 animate-spin text-brand-600" />}

                            {/* Validate XML */}
                            {!busy && (
                              <button
                                onClick={() => validateInvoice(inv)}
                                className="p-1.5 text-gray-400 hover:text-brand-600 transition-colors rounded"
                                title="Validează XML"
                              >
                                <FileCheck2 className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Preview XML */}
                            {!busy && (
                              <button
                                onClick={() => previewXml(inv)}
                                className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors rounded"
                                title="Descarcă XML"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Submit */}
                            {!busy && canSubmit && (
                              <button
                                onClick={() => submitInvoice(inv)}
                                className="px-2.5 py-1 text-xs bg-brand-600 hover:bg-brand-700 text-white rounded font-medium flex items-center gap-1"
                                title="Trimite la ANAF"
                              >
                                <Upload className="w-3 h-3" />
                                Trimite
                              </button>
                            )}

                            {/* Check status */}
                            {!busy && canCheckStatus && (
                              <button
                                onClick={() => checkStatus(inv)}
                                className="px-2.5 py-1 text-xs bg-yellow-500 hover:bg-yellow-600 text-white rounded font-medium flex items-center gap-1"
                                title="Verifică status ANAF"
                              >
                                <RefreshCw className="w-3 h-3" />
                                Status
                              </button>
                            )}

                            {/* Download signed artifact */}
                            {!busy && hasDownload && (
                              <a
                                href={`/api/efactura/status?invoice_id=${inv.id}&env=${env}`}
                                className="p-1.5 text-green-600 hover:text-green-700 transition-colors rounded"
                                title="Descarcă artifact semnat"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-sm text-gray-400">
                        {invoices.length === 0
                          ? 'Nu există facturi create. Creați facturi din pagina Contracte → Tranzacții.'
                          : 'Nicio factură cu statusul selectat.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Help info */}
          <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-700">
            <strong>Flux e-Factura:</strong>{' '}
            1. Configurați token-ul ANAF SPV → 2. Validați XML-ul → 3. Trimiteți factura → 4. Verificați statusul după 5-15 minute → 5. Descărcați artifact-ul semnat.
            <br />
            Standardul utilizat: <strong>RO_CIUS / UBL 2.1</strong> (urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.1)
          </div>
        </div>
      </div>
    </div>
  )
}
