'use client'

import { useState } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, Link2, Plus, Eye } from 'lucide-react'
import { clsx } from 'clsx'
import { toast } from 'sonner'

interface InvoiceItem {
  id: string
  lineNo: number
  extractedName: string
  quantity: number | null
  unit: string | null
  unitPrice: number | null
  vatRate: number | null
  lineTotal: number | null
  matchStatus: 'MATCHED' | 'UNMATCHED' | 'NEW_PRODUCT' | 'IGNORED'
  productId: string | null
  confidence: number | null
}

interface InvoiceData {
  id: string
  supplierName: string | null
  supplierTaxId: string | null
  invoiceNumber: string | null
  invoiceDate: string | null
  currency: string | null
  subtotal: number | null
  vatTotal: number | null
  total: number | null
  status: string
  rawOcrJson: { validation?: { warnings?: string[] } } | null
  items: InvoiceItem[]
}

interface Props {
  invoice: InvoiceData
  apiBase: string
  token: string
  onUpdated: (inv: InvoiceData) => void
  onApproved: () => void
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  UPLOADED:       { label: 'Încărcat',         cls: 'bg-gray-100 text-gray-700' },
  PROCESSING:     { label: 'Procesare OCR…',   cls: 'bg-blue-100 text-blue-700' },
  OCR_COMPLETED:  { label: 'OCR complet',      cls: 'bg-blue-100 text-blue-700' },
  NEEDS_REVIEW:   { label: 'Necesită revizie', cls: 'bg-amber-100 text-amber-700' },
  APPROVED:       { label: 'Aprobat',          cls: 'bg-green-100 text-green-700' },
  POSTED_TO_STOCK:{ label: 'Postat în stoc',   cls: 'bg-green-200 text-green-800' },
  FAILED:         { label: 'Eroare',           cls: 'bg-red-100 text-red-700' },
}

const MATCH_BADGE: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  MATCHED:     { label: 'Mapat',      cls: 'text-green-700', icon: <CheckCircle2 className="w-4 h-4" /> },
  UNMATCHED:   { label: 'Nemapat',    cls: 'text-amber-600', icon: <AlertTriangle className="w-4 h-4" /> },
  NEW_PRODUCT: { label: 'Produs nou', cls: 'text-blue-600',  icon: <Plus className="w-4 h-4" /> },
  IGNORED:     { label: 'Ignorat',    cls: 'text-gray-400',  icon: <XCircle className="w-4 h-4" /> },
}

export function InvoiceReviewForm({ invoice, apiBase, token, onUpdated, onApproved }: Props) {
  const [form, setForm] = useState({
    supplierName: invoice.supplierName ?? '',
    supplierTaxId: invoice.supplierTaxId ?? '',
    invoiceNumber: invoice.invoiceNumber ?? '',
    invoiceDate: invoice.invoiceDate ?? '',
    currency: invoice.currency ?? 'RON',
    subtotal: invoice.subtotal?.toString() ?? '',
    vatTotal: invoice.vatTotal?.toString() ?? '',
    total: invoice.total?.toString() ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [retrying, setRetrying] = useState(false)

  const warnings = invoice.rawOcrJson?.validation?.warnings ?? []

  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  }

  const saveChanges = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${apiBase}/api/v1/invoices/import/${invoice.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          supplierName: form.supplierName || null,
          supplierTaxId: form.supplierTaxId || null,
          invoiceNumber: form.invoiceNumber || null,
          invoiceDate: form.invoiceDate || null,
          currency: form.currency,
          subtotal: form.subtotal ? parseFloat(form.subtotal) : null,
          vatTotal: form.vatTotal ? parseFloat(form.vatTotal) : null,
          total: form.total ? parseFloat(form.total) : null,
        }),
      })
      if (!res.ok) throw new Error(await res.text())
      const updated = await res.json()
      onUpdated(updated)
      toast.success('Modificări salvate')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const approve = async () => {
    if (warnings.length > 0) {
      const ok = window.confirm(
        `Există ${warnings.length} avertisment(e). Continui cu confirmarea?\n\n${warnings.join('\n')}`,
      )
      if (!ok) return
    }
    setApproving(true)
    try {
      const res = await fetch(`${apiBase}/api/v1/invoices/import/${invoice.id}/approve`, {
        method: 'POST',
        headers,
      })
      if (!res.ok) throw new Error(await res.text())
      toast.success('Factura a fost confirmată și stocul actualizat!')
      onApproved()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setApproving(false)
    }
  }

  const retryOcr = async () => {
    setRetrying(true)
    try {
      await fetch(`${apiBase}/api/v1/invoices/import/${invoice.id}/retry-ocr`, {
        method: 'POST',
        headers,
      })
      toast.success('OCR repornit. Pagina se va actualiza în câteva secunde.')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setRetrying(false)
    }
  }

  const ignoreItem = async (itemId: string) => {
    await fetch(`${apiBase}/api/v1/invoices/import/${invoice.id}/items/${itemId}/ignore`, {
      method: 'POST', headers,
    })
    onUpdated({
      ...invoice,
      items: invoice.items.map(i => i.id === itemId ? { ...i, matchStatus: 'IGNORED' } : i),
    })
  }

  const statusBadge = STATUS_BADGE[invoice.status] ?? { label: invoice.status, cls: 'bg-gray-100 text-gray-600' }
  const isPosted = invoice.status === 'POSTED_TO_STOCK'

  return (
    <div className="space-y-6">
      {/* Status */}
      <div className="flex items-center gap-3">
        <span className={clsx('px-3 py-1 rounded-full text-sm font-medium', statusBadge.cls)}>
          {statusBadge.label}
        </span>
        {invoice.status === 'FAILED' && (
          <span className="text-sm text-red-600">OCR eșuat — verifică fișierul</span>
        )}
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-1">
          <p className="font-semibold text-amber-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Avertismente
          </p>
          {warnings.map((w, i) => <p key={i} className="text-sm text-amber-700">• {w}</p>)}
        </div>
      )}

      {/* Supplier + Invoice header */}
      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h3 className="font-semibold text-gray-800">Furnizor & Factură</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {([
            ['supplierName', 'Furnizor'],
            ['supplierTaxId', 'CUI / CIF'],
            ['invoiceNumber', 'Număr factură'],
            ['invoiceDate', 'Dată factură'],
            ['currency', 'Monedă'],
            ['subtotal', 'Subtotal'],
            ['vatTotal', 'TVA'],
            ['total', 'Total'],
          ] as [keyof typeof form, string][]).map(([key, label]) => (
            <label key={key} className="block">
              <span className="text-xs text-gray-500 font-medium">{label}</span>
              <input
                type={['subtotal', 'vatTotal', 'total'].includes(key) ? 'number' : 'text'}
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                disabled={isPosted}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </label>
          ))}
        </div>
      </div>

      {/* Product lines */}
      <div className="bg-white rounded-xl border">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-gray-800">Linii produse ({invoice.items.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Denumire extrasă</th>
                <th className="px-3 py-2 text-right">Cant.</th>
                <th className="px-3 py-2 text-left">UM</th>
                <th className="px-3 py-2 text-right">Preț unit.</th>
                <th className="px-3 py-2 text-right">TVA%</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-center">Status</th>
                {!isPosted && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoice.items.map(item => {
                const match = MATCH_BADGE[item.matchStatus] ?? MATCH_BADGE.UNMATCHED
                return (
                  <tr key={item.id} className={clsx(
                    item.matchStatus === 'IGNORED' && 'opacity-40',
                  )}>
                    <td className="px-3 py-2 max-w-[200px]">
                      <span className="line-clamp-2" title={item.extractedName}>{item.extractedName}</span>
                      {item.confidence !== null && (
                        <span className="text-xs text-gray-400 block">conf. {item.confidence}%</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{item.quantity ?? '—'}</td>
                    <td className="px-3 py-2">{item.unit ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {item.unitPrice?.toFixed(2) ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{item.vatRate ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {item.lineTotal?.toFixed(2) ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      <span className={clsx('flex items-center justify-center gap-1 text-xs font-medium', match.cls)}>
                        {match.icon} {match.label}
                      </span>
                    </td>
                    {!isPosted && (
                      <td className="px-3 py-2">
                        {item.matchStatus !== 'IGNORED' && (
                          <button
                            onClick={() => ignoreItem(item.id)}
                            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                            title="Ignoră linia"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
              {invoice.items.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-gray-400">
                    Nicio linie de produs extrasă. Verifică manual factura.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions */}
      {!isPosted && (
        <div className="flex flex-wrap gap-3 justify-end">
          <button
            onClick={retryOcr}
            disabled={retrying}
            className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {retrying ? 'Se reprocesează…' : 'Reprocesează OCR'}
          </button>
          <button
            onClick={saveChanges}
            disabled={saving}
            className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {saving ? 'Se salvează…' : 'Salvează draft'}
          </button>
          <button
            onClick={approve}
            disabled={approving || invoice.status === 'PROCESSING'}
            className="px-5 py-2 bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-50"
          >
            {approving ? 'Se confirmă…' : 'Confirmă și actualizează stocul'}
          </button>
        </div>
      )}

      {isPosted && (
        <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium">Factura a fost confirmată și stocul actualizat.</span>
        </div>
      )}
    </div>
  )
}
