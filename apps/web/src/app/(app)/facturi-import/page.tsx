'use client'
export const runtime = 'edge'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { ScanLine, FileText, CheckCircle2, Clock, AlertTriangle, Loader2 } from 'lucide-react'
import { InvoiceImportModal } from '@/app/(app)/inventar/loturi/components/InvoiceImportModal'
import type { Supplier } from '@/lib/inventory-types'

interface ImportRow {
  id: string
  supplier_name: string | null
  invoice_number: string | null
  invoice_date: string | null
  total: number | null
  status: string
  created_at: string
}

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  lots_created: { label: 'Loturi create', color: 'text-green-700 bg-green-50' },
  draft:        { label: 'Draft',         color: 'text-gray-600 bg-gray-100' },
  confirmed:    { label: 'Confirmat',     color: 'text-blue-700 bg-blue-50' },
  failed:       { label: 'Eroare',        color: 'text-red-700 bg-red-50' },
}

export default function FacturiImportPage() {
  const [showModal, setShowModal] = useState(false)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [imports, setImports] = useState<ImportRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const db = createClient()
    const [{ data: supData }, { data: impData }] = await Promise.all([
      db.from('suppliers').select('id, name').eq('is_active', true).order('name'),
      db.from('input_invoice_imports')
        .select('id, supplier_name, invoice_number, invoice_date, total, status, created_at')
        .order('created_at', { ascending: false })
        .limit(50),
    ])
    setSuppliers((supData ?? []) as Supplier[])
    setImports((impData ?? []) as ImportRow[])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <div>
      <PageHeader
        title="Import factură"
        subtitle={`${imports.length} importuri`}
        actions={
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <ScanLine className="w-4 h-4" />
            Scanează factură (OCR)
          </button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
        </div>
      ) : imports.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="font-semibold text-gray-500">Niciun import</p>
          <p className="text-sm text-gray-400 mt-1">Apasă butonul de mai sus pentru a importa prima factură cu OCR.</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg"
          >
            <ScanLine className="w-4 h-4" />
            Scanează factură
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Furnizor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Nr. factură</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Dată</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Creat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {imports.map(imp => {
                const si = STATUS_INFO[imp.status] ?? { label: imp.status, color: 'text-gray-600 bg-gray-100' }
                return (
                  <tr key={imp.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">{imp.supplier_name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{imp.invoice_number ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{imp.invoice_date ?? '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700">
                      {imp.total != null ? `${Number(imp.total).toFixed(2)} RON` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${si.color}`}>
                        {si.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(imp.created_at).toLocaleDateString('ro-RO')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <InvoiceImportModal
          suppliers={suppliers}
          onCreated={() => { void load() }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}