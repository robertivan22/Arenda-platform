'use client'

export const runtime = 'edge'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { FileText, RefreshCw, Clock, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { UploadZone } from './components/UploadZone'
import { InvoiceReviewForm } from './components/InvoiceReviewForm'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

type ImportStatus =
  | 'UPLOADED' | 'PROCESSING' | 'OCR_COMPLETED'
  | 'NEEDS_REVIEW' | 'APPROVED' | 'POSTED_TO_STOCK' | 'FAILED'

interface ImportRecord {
  id: string
  supplierName: string | null
  supplierTaxId: string | null
  invoiceNumber: string | null
  invoiceDate: string | null
  currency: string | null
  subtotal: number | null
  vatTotal: number | null
  total: number | null
  status: ImportStatus
  errorMessage: string | null
  createdAt: string
  rawOcrJson: { validation?: { warnings?: string[] } } | null
  items: any[]
}

const STATUS_ICON: Record<ImportStatus, React.ReactNode> = {
  UPLOADED:       <Clock className="w-4 h-4 text-gray-400" />,
  PROCESSING:     <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />,
  OCR_COMPLETED:  <RefreshCw className="w-4 h-4 text-blue-500" />,
  NEEDS_REVIEW:   <AlertTriangle className="w-4 h-4 text-amber-500" />,
  APPROVED:       <CheckCircle2 className="w-4 h-4 text-green-600" />,
  POSTED_TO_STOCK:<CheckCircle2 className="w-4 h-4 text-green-700" />,
  FAILED:         <XCircle className="w-4 h-4 text-red-500" />,
}

export default function ImportFacturaPage() {
  const [token, setToken] = useState<string | null>(null)
  const [imports, setImports] = useState<ImportRecord[]>([])
  const [selected, setSelected] = useState<ImportRecord | null>(null)
  const [uploading, setUploading] = useState(false)
  const [loadingList, setLoadingList] = useState(true)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Initialise Supabase token for passing to the NestJS API
  useEffect(() => {
    createClient().auth.getSession().then(({ data }) => {
      setToken(data.session?.access_token ?? null)
    })
  }, [])

  const authHeaders = token
    ? { Authorization: `Bearer ${token}` }
    : {}

  const loadList = useCallback(async () => {
    if (!token) return
    try {
      const res = await fetch(`${API_BASE}/api/v1/invoices/import`, { headers: authHeaders })
      if (!res.ok) return
      const data = await res.json()
      setImports(data)
    } catch {
      // silently ignore
    } finally {
      setLoadingList(false)
    }
  }, [token])

  useEffect(() => {
    loadList()
  }, [loadList])

  // Poll while any import is in PROCESSING state
  useEffect(() => {
    const hasProcessing = imports.some(
      i => i.status === 'PROCESSING' || i.status === 'OCR_COMPLETED',
    )
    if (hasProcessing && !pollRef.current) {
      pollRef.current = setInterval(async () => {
        await loadList()
        // Refresh selected if it's the one being processed
        if (selected && (selected.status === 'PROCESSING' || selected.status === 'OCR_COMPLETED')) {
          const res = await fetch(`${API_BASE}/api/v1/invoices/import/${selected.id}`, { headers: authHeaders })
          if (res.ok) setSelected(await res.json())
        }
      }, 3000)
    } else if (!hasProcessing && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [imports, selected, loadList])

  const handleFileSelected = async (file: File) => {
    if (!token) { toast.error('Sesiune expirată. Autentifică-te din nou.'); return }

    // Validate file on client side
    const MAX_MB = 20
    const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if (!ALLOWED.includes(file.type)) {
      toast.error(`Tip fișier neacceptat: ${file.type}`)
      return
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      toast.error(`Fișierul depășește limita de ${MAX_MB} MB`)
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`${API_BASE}/api/v1/invoices/import`, {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }))
        throw new Error(err.message ?? 'Eroare upload')
      }

      const { importId } = await res.json()
      toast.success('Factura încărcată! Se procesează OCR…')

      // Load the new record and select it
      const detailRes = await fetch(`${API_BASE}/api/v1/invoices/import/${importId}`, { headers: authHeaders })
      if (detailRes.ok) {
        const newImport = await detailRes.json()
        setImports(prev => [newImport, ...prev])
        setSelected(newImport)
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  const handleSelectImport = async (importId: string) => {
    if (!token) return
    const res = await fetch(`${API_BASE}/api/v1/invoices/import/${importId}`, { headers: authHeaders })
    if (res.ok) setSelected(await res.json())
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
                          {imp.invoiceNumber ?? imp.supplierName ?? `Import ${imp.id.slice(0, 8)}`}
                        </span>
                      </div>
                      {STATUS_ICON[imp.status]}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 ml-6">
                      {new Date(imp.createdAt).toLocaleDateString('ro-RO')}
                      {imp.total && ` · ${imp.total.toFixed(2)} ${imp.currency ?? 'RON'}`}
                    </p>
                    {imp.errorMessage && (
                      <p className="text-xs text-red-500 mt-0.5 ml-6 truncate" title={imp.errorMessage}>
                        {imp.errorMessage}
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
            token ? (
              <InvoiceReviewForm
                invoice={selected as any}
                apiBase={API_BASE}
                token={token}
                onUpdated={updated => {
                  setSelected(updated as any)
                  setImports(prev => prev.map(i => i.id === updated.id ? (updated as any) : i))
                }}
                onApproved={() => {
                  loadList()
                  setSelected(null)
                }}
              />
            ) : (
              <div className="bg-white rounded-xl border p-8 text-center text-gray-400">
                Se inițializează sesiunea…
              </div>
            )
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
