'use client'

export const runtime = 'edge'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  FileCheck2, RefreshCw, CheckCircle2, XCircle, Loader2, AlertCircle, Download,
} from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/layout/PageHeader'

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
  lessors?: Lessor | null
}

function lessorName(l: Lessor | null | undefined) {
  if (!l) return '-'
  return l.type === 'LEGAL' ? (l.company_name ?? '-') : `${l.last_name} ${l.first_name}`.trim()
}

type ValidationResult = 'valid' | 'invalid' | null

function ValidationBadge({ result }: { result: ValidationResult }) {
  if (!result) return null
  return result === 'valid'
    ? (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
        <CheckCircle2 className="w-3 h-3" />
        Valid
      </span>
    )
    : (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
        <XCircle className="w-3 h-3" />
        Erori
      </span>
    )
}

export default function EFacturaPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)
  const [validationResults, setValidationResults] = useState<Record<string, ValidationResult>>({})

  const loadData = useCallback(async () => {
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return

    const { data } = await db
      .from('invoices')
      .select('id, invoice_number, invoice_series, invoice_date, total_ron, tva_amount, doc_type, status, lessor_id, efactura_status, lessors(id, first_name, last_name, company_name, type)')
      .eq('user_id', user.id)
      .eq('doc_type', 'FACTURA')
      .order('invoice_date', { ascending: false })

    setInvoices(
      (data ?? []).map(inv => ({
        ...inv,
        lessors: Array.isArray(inv.lessors) ? (inv.lessors[0] ?? null) : (inv.lessors ?? null),
      })) as unknown as Invoice[],
    )
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function validateInvoice(inv: Invoice) {
    setActionInProgress(inv.id)
    const res = await fetch(`/api/efactura/xml-preview?invoice_id=${inv.id}`)
    const data = await res.json() as {
      valid?: boolean
      validation_errors?: { field: string; message: string }[]
      error?: string
    }
    setActionInProgress(null)

    if (!res.ok) {
      toast.error(data.error ?? 'Eroare la validare')
      setValidationResults(r => ({ ...r, [inv.id]: 'invalid' }))
      return
    }

    if (data.valid) {
      toast.success('Factura este valida pentru e-Factura')
      setValidationResults(r => ({ ...r, [inv.id]: 'valid' }))
    } else {
      const msgs = (data.validation_errors ?? []).map(e => e.message).join('; ')
      toast.error(`Erori validare: ${msgs}`, { duration: 10000 })
      setValidationResults(r => ({ ...r, [inv.id]: 'invalid' }))
    }
  }

  function downloadXml(inv: Invoice) {
    window.open(`/api/efactura/xml-preview?invoice_id=${inv.id}&format=xml`, '_blank')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-brand-600" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex items-start justify-between gap-4">
        <PageHeader
          title="e-Factura ANAF"
          subtitle="Validare si generare XML conform RO_CIUS / UBL 2.1"
        />
        <button
          onClick={loadData}
          className="mt-1 p-1.5 border border-gray-200 rounded text-gray-500 hover:text-gray-700"
          title="Reincarca"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-700 flex items-start gap-2">
        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Validati XML-ul fiecarei facturi, descarcati fisierul UBL 2.1 si incarcati-l manual pe{' '}
          <a
            href="https://efactura.mfinante.gov.ro"
            target="_blank"
            rel="noopener noreferrer"
            className="underline font-medium"
          >
            efactura.mfinante.gov.ro
          </a>
          {' '}(SPV &rarr; Incarcare factura).
          Standardul utilizat: <strong>RO_CIUS / UBL 2.1</strong>
        </span>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
          <FileCheck2 className="w-4 h-4 text-brand-600" />
          <span className="font-semibold text-sm text-gray-800">
            Facturi ({invoices.length})
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Nr.</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Data</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Arendas</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Total RON</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Validare XML</th>
                <th className="px-4 py-2 bg-gray-50"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map(inv => {
                const busy = actionInProgress === inv.id
                const vResult = validationResults[inv.id] ?? null

                return (
                  <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium text-gray-800">
                      {inv.invoice_series ?? ''}{inv.invoice_number}
                    </td>
                    <td className="px-4 py-2.5 text-gray-600">{inv.invoice_date}</td>
                    <td className="px-4 py-2.5 text-gray-700 max-w-[180px] truncate">
                      {lessorName(inv.lessors)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-green-700">
                      {inv.total_ron.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2.5">
                      <ValidationBadge result={vResult} />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1 justify-end">
                        {busy
                          ? <Loader2 className="w-4 h-4 animate-spin text-brand-600" />
                          : (
                            <>
                              <button
                                onClick={() => validateInvoice(inv)}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs border border-gray-300 rounded hover:border-brand-400 hover:text-brand-600 text-gray-600 font-medium transition-colors"
                              >
                                <FileCheck2 className="w-3.5 h-3.5" />
                                Valideaza
                              </button>
                              <button
                                onClick={() => downloadXml(inv)}
                                className="flex items-center gap-1 px-2.5 py-1 text-xs bg-brand-600 hover:bg-brand-700 text-white rounded font-medium transition-colors"
                              >
                                <Download className="w-3.5 h-3.5" />
                                XML
                              </button>
                            </>
                          )}
                      </div>
                    </td>
                  </tr>
                )
              })}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-sm text-gray-400">
                    Nu exista facturi. Creati facturi din pagina Contracte &rarr; Tranzactii.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
