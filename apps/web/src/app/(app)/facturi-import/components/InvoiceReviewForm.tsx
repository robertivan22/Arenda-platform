'use client'

import { useState } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, Plus, RefreshCw } from 'lucide-react'
import { clsx } from 'clsx'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import type { ImportRecord, InvoiceItem } from '../page'

interface Props {
  invoice: ImportRecord
  onUpdated: (inv: ImportRecord) => void
  onApproved: () => void
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  uploaded:       { label: 'Incarcat',         cls: 'bg-gray-100 text-gray-700' },
  processing:     { label: 'Procesare OCR...',  cls: 'bg-blue-100 text-blue-700' },
  ocr_completed:  { label: 'OCR complet',       cls: 'bg-blue-100 text-blue-700' },
  needs_review:   { label: 'Necesita revizie',  cls: 'bg-amber-100 text-amber-700' },
  approved:       { label: 'Aprobat',           cls: 'bg-green-100 text-green-700' },
  posted_to_stock:{ label: 'Postat in stoc',    cls: 'bg-green-200 text-green-800' },
  failed:         { label: 'Eroare',            cls: 'bg-red-100 text-red-700' },
}

const MATCH_BADGE: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  matched:     { label: 'Mapat',      cls: 'text-green-700', icon: <CheckCircle2 className="w-4 h-4" /> },
  unmatched:   { label: 'Nemapat',    cls: 'text-amber-600', icon: <AlertTriangle className="w-4 h-4" /> },
  new_product: { label: 'Produs nou', cls: 'text-blue-600',  icon: <Plus className="w-4 h-4" /> },
  ignored:     { label: 'Ignorat',    cls: 'text-gray-400',  icon: <XCircle className="w-4 h-4" /> },
}

export function InvoiceReviewForm({ invoice, onUpdated, onApproved }: Props) {
  const [form, setForm] = useState({
    supplier_name:   invoice.supplier_name ?? '',
    supplier_tax_id: invoice.supplier_tax_id ?? '',
    invoice_number:  invoice.invoice_number ?? '',
    invoice_date:    invoice.invoice_date ?? '',
    currency:        invoice.currency ?? 'RON',
    subtotal:        invoice.subtotal?.toString() ?? '',
    vat_total:       invoice.vat_total?.toString() ?? '',
    total:           invoice.total?.toString() ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)

  const db = createClient()
  const warnings = invoice.raw_ocr_json?.validation?.warnings ?? []
  const isPosted = invoice.status === 'posted_to_stock'

  const saveChanges = async () => {
    setSaving(true)
    try {
      const { data, error } = await db
        .from('purchase_invoices')
        .update({
          supplier_name:   form.supplier_name || null,
          supplier_tax_id: form.supplier_tax_id || null,
          invoice_number:  form.invoice_number || null,
          invoice_date:    form.invoice_date || null,
          currency:        form.currency,
          subtotal:        form.subtotal ? parseFloat(form.subtotal) : null,
          vat_total:       form.vat_total ? parseFloat(form.vat_total) : null,
          total:           form.total ? parseFloat(form.total) : null,
          status:          'needs_review',
        })
        .eq('id', invoice.id)
        .select('*, purchase_invoice_items(*)')
        .single()
      if (error) throw new Error(error.message)
      onUpdated(data as unknown as ImportRecord)
      toast.success('Modificari salvate')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const approve = async () => {
    if (warnings.length > 0) {
      const ok = window.confirm(
        `Exista ${warnings.length} avertisment(e). Continui cu confirmarea?\n\n${warnings.join('\n')}`,
      )
      if (!ok) return
    }
    setApproving(true)
    try {
      const { data: session } = await db.auth.getSession()
      const userId = session.session?.user.id
      if (!userId) throw new Error('Sesiune expirata')

      const matched = invoice.items.filter(i => i.match_status === 'matched' && i.product_id)
      if (matched.length > 0) {
        const movements = matched.map(item => ({
          user_id:       userId,
          product_id:    item.product_id!,
          source_type:   'purchase_invoice',
          source_id:     invoice.id,
          movement_type: 'in' as const,
          quantity:      item.quantity ?? 0,
          unit_cost:     item.unit_price,
        }))
        const { error: movErr } = await db.from('stock_movements').insert(movements)
        if (movErr) throw new Error(movErr.message)
      }

      const { data, error } = await db
        .from('purchase_invoices')
        .update({ status: 'posted_to_stock', posted_at: new Date().toISOString() })
        .eq('id', invoice.id)
        .select('*, purchase_invoice_items(*)')
        .single()
      if (error) throw new Error(error.message)
      toast.success('Factura confirmata si stocul actualizat!')
      onUpdated(data as unknown as ImportRecord)
      onApproved()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setApproving(false)
    }
  }

  const ignoreItem = async (item: InvoiceItem) => {
    const { error } = await db
      .from('purchase_invoice_items')
      .update({ match_status: 'ignored' })
      .eq('id', item.id)
    if (error) { toast.error(error.message); return }
    onUpdated({
      ...invoice,
      items: invoice.items.map(i => i.id === item.id ? { ...i, match_status: 'ignored' } : i),
    })
  }

  const statusBadge = STATUS_BADGE[invoice.status] ?? { label: invoice.status, cls: 'bg-gray-100 text-gray-600' }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <span className={clsx('px-3 py-1 rounded-full text-sm font-medium', statusBadge.cls)}>
          {statusBadge.label}
          {(invoice.status === 'processing' || invoice.status === 'ocr_completed') && (
            <RefreshCw className="inline w-3 h-3 ml-1 animate-spin" />
          )}
        </span>
        {invoice.status === 'failed' && (
          <span className="text-sm text-red-600">{invoice.error_message ?? 'OCR esuat'}</span>
        )}
      </div>

      {warnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-1">
          <p className="font-semibold text-amber-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Avertismente OCR
          </p>
          {warnings.map((w, i) => <p key={i} className="text-sm text-amber-700">&bull; {w}</p>)}
        </div>
      )}

      <div className="bg-white rounded-xl border p-5 space-y-4">
        <h3 className="font-semibold text-gray-800">Furnizor &amp; Factura</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {([
            ['supplier_name',  'Furnizor'],
            ['supplier_tax_id','CUI / CIF'],
            ['invoice_number', 'Numar factura'],
            ['invoice_date',   'Data factura'],
            ['currency',       'Moneda'],
            ['subtotal',       'Subtotal'],
            ['vat_total',      'TVA'],
            ['total',          'Total'],
          ] as [keyof typeof form, string][]).map(([key, label]) => (
            <label key={key} className="block">
              <span className="text-xs text-gray-500 font-medium">{label}</span>
              <input
                type={['subtotal', 'vat_total', 'total'].includes(key) ? 'number' : 'text'}
                value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                disabled={isPosted}
                className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50 disabled:text-gray-400"
              />
            </label>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-gray-800">Linii produse ({invoice.items.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left">Denumire extrasa</th>
                <th className="px-3 py-2 text-right">Cant.</th>
                <th className="px-3 py-2 text-left">UM</th>
                <th className="px-3 py-2 text-right">Pret unit.</th>
                <th className="px-3 py-2 text-right">TVA%</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-center">Status</th>
                {!isPosted && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y">
              {invoice.items.map(item => {
                const match = MATCH_BADGE[item.match_status] ?? MATCH_BADGE.unmatched
                return (
                  <tr key={item.id} className={clsx(item.match_status === 'ignored' && 'opacity-40')}>
                    <td className="px-3 py-2 max-w-[200px]">
                      <span className="line-clamp-2" title={item.extracted_name}>{item.extracted_name}</span>
                      {item.confidence !== null && (
                        <span className="text-xs text-gray-400 block">conf. {item.confidence}%</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{item.quantity ?? '---'}</td>
                    <td className="px-3 py-2">{item.unit ?? '---'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{item.unit_price?.toFixed(2) ?? '---'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{item.vat_rate ?? '---'}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">{item.line_total?.toFixed(2) ?? '---'}</td>
                    <td className="px-3 py-2">
                      <span className={clsx('flex items-center justify-center gap-1 text-xs font-medium', match.cls)}>
                        {match.icon} {match.label}
                      </span>
                    </td>
                    {!isPosted && (
                      <td className="px-3 py-2">
                        {item.match_status !== 'ignored' && (
                          <button
                            onClick={() => ignoreItem(item)}
                            className="text-xs text-gray-400 hover:text-red-500 transition-colors"
                            title="Ignora linia"
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
                    Nicio linie de produs extrasa.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {!isPosted && (
        <div className="flex flex-wrap gap-3 justify-end">
          <button
            onClick={saveChanges}
            disabled={saving}
            className="px-4 py-2 border rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {saving ? 'Se salveaza...' : 'Salveaza draft'}
          </button>
          <button
            onClick={approve}
            disabled={approving || invoice.status === 'processing'}
            className="px-5 py-2 bg-green-700 text-white rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-50"
          >
            {approving ? 'Se confirma...' : 'Confirma si actualizeaza stocul'}
          </button>
        </div>
      )}

      {isPosted && (
        <div className="flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium">Factura confirmata. Stocul actualizat.</span>
        </div>
      )}
    </div>
  )
}