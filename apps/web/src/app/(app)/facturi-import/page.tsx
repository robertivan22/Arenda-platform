'use client'

export const runtime = 'edge'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { FileText, RefreshCw, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { UploadZone } from './components/UploadZone'
import { InvoiceReviewForm } from './components/InvoiceReviewForm'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

type ImportStatus =
  | 'uploaded' | 'processing' | 'ocr_completed'
  | 'needs_review' | 'approved' | 'posted_to_stock' | 'failed'

export interface ImportRecord {
  id: string
  supplier_name: string | null
  supplier_tax_id: string | null
  invoice_number: string | null
  invoice_date: string | null
  currency: string | null
  subtotal: number | null
  vat_total: number | null
  total: number | null
  status: ImportStatus
  error_message: string | null
  created_at: string
  raw_ocr_json: { validation?: { warnings?: string[] } } | null
  items: InvoiceItem[]
}

export interface InvoiceItem {
  id: string
  line_no: number
  extracted_name: string
  quantity: number | null
  unit: string | null
  unit_price: number | null
  vat_rate: number | null
  line_total: number | null
  match_status: 'matched' | 'unmatched' | 'new_product' | 'ignored'
  product_id: string | null
  confidence: number | null
}

const STATUS_ICON: Record<ImportStatus, React.ReactNode> = {
  uploaded:       <Clock className="w-4 h-4 text-gray-400" />,
  processing:     <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />,
  ocr_completed:  <RefreshCw className="w-4 h-4 text-blue-500" />,
  needs_review:   <AlertTriangle className="w-4 h-4 text-amber-500" />,
  approved:       <CheckCircle2 className="w-4 h-4 text-green-600" />,
  posted_to_stock:<CheckCircle2 className="w-4 h-4 text-green-700" />,
  failed:         <XCircle className="w-4 h-4 text-red-500" />,
}

export default function ImportFacturaPage() {
  const [token, setToken] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [imports, setImports] = useState<ImportRecord[]>([])
  const [selected, setSelected] = useState<ImportRecord | null>(null)
  const [uploading, setUploading] = useState(false)
  const [loadingList, setLoadingList] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null)
      setUserId(data.session?.user.id ?? null)
    })
  }, [])

  const loadList = useCallback(async () => {
    if (!userId) return
    const db = createClient()
    const { data, error } = await db
      .from('purchase_invoices')
      .select('*, purchase_invoice_items(*)')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) {
      // Table may not exist yet (migration not run) — show empty state instead of error
      if (error.code === '42P01') { setImports([]); setLoadingList(false); return }
      toast.error('Eroare la încărcarea importurilor')
      setLoadingList(false)
      return
    }
    setImports((data ?? []) as any)
    setLoadingList(false)
  }, [userId])

  useEffect(() => { loadList() }, [loadList])

  // Poll while any import is in processing state
  useEffect(() => {
    const hasProcessing = imports.some(
      i => i.status === 'processing' || i.status === 'ocr_completed',
    )
    if (hasProcessing && !pollRef.current) {
      pollRef.current = setInterval(() => {
        loadList()
        if (selected && (selected.status === 'processing' || selected.status === 'ocr_completed')) {
          createClient()
            .from('purchase_invoices')
            .select('*, purchase_invoice_items(*)')
            .eq('id', selected.id)
            .single()
            .then(({ data }) => { if (data) setSelected(data as any) })
        }
      }, 3000)
    } else if (!hasProcessing && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [imports, selected, loadList])

  const handleFileSelected = async (file: File) => {
    if (!token || !userId) { toast.error('Sesiune expirată. Autentifică-te din nou.'); return }

    const MAX_MB = 20
    const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if (!ALLOWED.includes(file.type)) { toast.error(`Tip fișier neacceptat: ${file.type}`); return }
    if (file.size > MAX_MB * 1024 * 1024) { toast.error(`Fișierul depășește limita de ${MAX_MB} MB`); return }

    if (!API_BASE) {
      toast.error('NEXT_PUBLIC_API_URL nu este configurat. OCR-ul necesită API server.')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`${API_BASE}/api/v1/invoices/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }))
        throw new Error(err.message ?? 'Eroare upload')
      }

      const { importId } = await res.json()
      toast.success('Factura încărcată! Se procesează OCR…')
      await loadList()
      const { data } = await createClient().from('purchase_invoices').select('*, purchase_invoice_items(*)').eq('id', importId).single()
      if (data) setSelected(data as any)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const handleSelectImport = async (importId: string) => {
    const { data } = await createClient().from('purchase_invoices').select('*, purchase_invoice_items(*)').eq('id', importId).single()
    if (data) setSelected(data as any)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-6">
      <PageHeader title="Import factură" subtitle="OCR local · fără servicii plătite" />

      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: upload + history */}
        <div className="space-y-6 lg:col-span-1">
          <UploadZone onFileSelected={handleFileSelected} uploading={uploading} />

          <div className="bg-white rounded-xl border">
            <div className="px-4 py-3 border-b">
              <h2 className="font-semibold text-gray-800">Importuri recente</h2>
            </div>
            {loadingList ? (
              <div className="p-6 flex justify-center">
                <RefreshCw className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : imports.length === 0 ? (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">
                Niciun import. Încarcă prima factură.
              </p>
            ) : (
              <ul className="divide-y">
                {imports.map(imp => (
                  <li
                    key={imp.id}
                    onClick={() => handleSelectImport(imp.id)}
                    className={`px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${selected?.id === imp.id ? 'bg-green-50' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-800 truncate">
                          {imp.invoice_number ?? imp.supplier_name ?? `Import ${imp.id.slice(0, 8)}`}
                        </span>
                      </div>
                      {STATUS_ICON[imp.status]}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 ml-6">
                      {new Date(imp.created_at).toLocaleDateString('ro-RO')}
                      {imp.total && ` · ${imp.total.toFixed(2)} ${imp.currency ?? 'RON'}`}
                    </p>
                    {imp.error_message && (
                      <p className="text-xs text-red-500 mt-0.5 ml-6 truncate" title={imp.error_message}>
                        {imp.error_message}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Right: review form */}
        <div className="lg:col-span-2">
          {selected ? (
            <InvoiceReviewForm
              invoice={selected}
              onUpdated={updated => {
                setSelected(updated)
                setImports(prev => prev.map(i => i.id === updated.id ? updated : i))
              }}
              onApproved={() => { loadList(); setSelected(null) }}
            />
          ) : (
            <div className="bg-white rounded-xl border p-12 flex flex-col items-center justify-center gap-3 text-gray-400">
              <FileText className="w-12 h-12" />
              <p className="text-sm">Selectează un import din stânga sau încarcă o factură nouă.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
