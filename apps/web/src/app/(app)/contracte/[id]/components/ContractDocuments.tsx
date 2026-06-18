'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Upload, FileText, Download, Trash2, Eye,
  Loader2, CheckCircle2, AlertTriangle, X, ChevronDown,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContractDocument {
  id: string
  document_type: string
  title: string | null
  original_file_name: string
  storage_path: string
  compressed_storage_path: string | null
  active_storage_path: string
  mime_type: string
  original_size_bytes: number
  compressed_size_bytes: number | null
  compression_ratio: number | null
  compression_status: string
  created_at: string
}

interface Props {
  contractId: string
  lessorId: string
}

const DOC_TYPES: { value: string; label: string }[] = [
  { value: 'main_contract',     label: 'Contract principal' },
  { value: 'additional_act',   label: 'Act adițional' },
  { value: 'annex',            label: 'Anexă' },
  { value: 'payment_document', label: 'Document plată' },
  { value: 'other',            label: 'Alt document' },
]

const DOC_TYPE_LABELS: Record<string, string> = Object.fromEntries(DOC_TYPES.map(d => [d.value, d.label]))

const COMPRESSION_JPEG_QUALITY = 0.70
const MAX_MB = 30

// ─── PDF compression (client-side via PDF.js + jsPDF) ───────────────────────

interface CompressionResult {
  blob: Blob
  originalBytes: number
  compressedBytes: number
  ratio: number   // e.g. 0.42 means 42% smaller
}

async function compressPdf(file: File, onStatus: (s: string) => void): Promise<CompressionResult | null> {
  try {
    onStatus('Se comprimă PDF-ul în browser...')
    const pdfjs = await import('pdfjs-dist')
    // .mjs ES module worker – works on all modern desktop browsers
    pdfjs.GlobalWorkerOptions.workerSrc =
      `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

    const { jsPDF } = await import('jspdf')

    const arrayBuffer = await file.arrayBuffer()
    const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', compress: true })

    for (let p = 1; p <= pdf.numPages; p++) {
      onStatus(`Comprimă pagina ${p} din ${pdf.numPages}...`)
      const page = await pdf.getPage(p)
      const viewport = page.getViewport({ scale: 1.5 })  // 113dpi equivalent
      const canvas = document.createElement('canvas')
      canvas.width  = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')!
      await page.render({ canvasContext: ctx, viewport }).promise

      const imgData = canvas.toDataURL('image/jpeg', COMPRESSION_JPEG_QUALITY)

      const pdfW  = doc.internal.pageSize.getWidth()
      const pdfH  = doc.internal.pageSize.getHeight()
      const imgW  = viewport.width
      const imgH  = viewport.height
      const ratio = Math.min(pdfW / imgW * 72, pdfH / imgH * 72)  // fit to page (72dpi baseline)
      const drawW = (imgW * ratio) / 72
      const drawH = (imgH * ratio) / 72
      const x = (pdfW - drawW) / 2
      const y = (pdfH - drawH) / 2

      if (p > 1) doc.addPage()
      doc.addImage(imgData, 'JPEG', x, y, drawW, drawH)
    }

    const compressedBytes = doc.output('arraybuffer')
    const blob = new Blob([compressedBytes], { type: 'application/pdf' })

    return {
      blob,
      originalBytes: file.size,
      compressedBytes: blob.size,
      ratio: (file.size - blob.size) / file.size,
    }
  } catch (err) {
    console.warn('PDF compression failed:', err)
    return null
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ContractDocuments({ contractId, lessorId }: Props) {
  const [docs, setDocs] = useState<ContractDocument[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [compressionStatus, setCompressionStatus] = useState('')
  const [showUpload, setShowUpload] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [uploadForm, setUploadForm] = useState({ type: 'main_contract', title: '' })
  const [deleting, setDeleting] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const db = createClient()
  const inp = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500'

  const load = useCallback(async () => {
    const { data } = await db.from('contract_documents').select('*').eq('contract_id', contractId).order('created_at', { ascending: false })
    setDocs((data ?? []) as ContractDocument[])
    setLoading(false)
  }, [contractId])

  useEffect(() => { load() }, [load])

  const handleFile = useCallback(async (file: File) => {
    if (file.size > MAX_MB * 1024 * 1024) { toast.error(`Fișierul depășește ${MAX_MB} MB.`); return }
    const allowed = ['application/pdf', 'image/jpeg', 'image/png']
    if (!allowed.includes(file.type)) { toast.error('Tip fișier neacceptat (PDF, JPG, PNG).'); return }

    setUploading(true)
    setCompressionStatus('')
    try {
      const { data: { user } } = await db.auth.getUser()
      if (!user) throw new Error('Sesiune expirată')

      const uuid = crypto.randomUUID()
      const ext  = file.name.split('.').pop()

      // Upload original
      const origPath = `contract-docs/${user.id}/${contractId}/${uuid}-orig.${ext}`
      setCompressionStatus('Se încarcă documentul...')
      const { error: upErr } = await db.storage.from('documents').upload(origPath, file, { upsert: false })
      if (upErr) throw new Error(upErr.message)

      // Try PDF compression
      let compressedPath: string | null = null
      let compressedBytes: number | null = null
      let compressionRatio: number | null = null
      let compressionStatusVal = 'not_attempted'
      let activePath = origPath

      if (file.type === 'application/pdf') {
        const result = await compressPdf(file, setCompressionStatus)
        if (result && result.ratio > 0.05) {
          // Compressed is meaningfully smaller — upload it
          const compPath = `contract-docs/${user.id}/${contractId}/${uuid}-compressed.pdf`
          const { error: cErr } = await db.storage.from('documents').upload(compPath, result.blob, {
            contentType: 'application/pdf', upsert: false,
          })
          if (!cErr) {
            compressedPath = compPath
            compressedBytes = result.compressedBytes
            compressionRatio = result.ratio
            compressionStatusVal = 'compressed'
            activePath = compPath
            setCompressionStatus('PDF comprimat cu succes.')
          } else {
            compressionStatusVal = 'failed'
            setCompressionStatus('PDF-ul a fost încărcat, dar compresia nu a reușit.')
          }
        } else if (result) {
          compressionStatusVal = 'not_smaller'
          setCompressionStatus('Compresia nu a redus dimensiunea. Se păstrează originalul.')
        } else {
          compressionStatusVal = 'failed'
          setCompressionStatus('PDF-ul a fost încărcat, dar compresia nu a reușit.')
        }
      }

      // Save to DB
      const { error: dbErr } = await db.from('contract_documents').insert({
        user_id:                  user.id,
        contract_id:              contractId,
        lessor_id:                lessorId,
        document_type:            uploadForm.type,
        title:                    uploadForm.title || null,
        original_file_name:       file.name,
        storage_path:             origPath,
        compressed_storage_path:  compressedPath,
        active_storage_path:      activePath,
        mime_type:                file.type,
        original_size_bytes:      file.size,
        compressed_size_bytes:    compressedBytes,
        compression_ratio:        compressionRatio,
        compression_status:       compressionStatusVal,
      })
      if (dbErr) throw new Error(dbErr.message)

      toast.success('Document încărcat.')
      setShowUpload(false)
      setUploadForm({ type: 'main_contract', title: '' })
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setUploading(false)
      setCompressionStatus('')
    }
  }, [contractId, lessorId, uploadForm, load])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  async function getSignedUrl(path: string): Promise<string | null> {
    const { data } = await db.storage.from('documents').createSignedUrl(path, 60)
    return data?.signedUrl ?? null
  }

  async function preview(doc: ContractDocument) {
    const url = await getSignedUrl(doc.active_storage_path)
    if (url) window.open(url, '_blank')
    else toast.error('Nu s-a putut genera link-ul de previzualizare.')
  }

  async function download(doc: ContractDocument) {
    const url = await getSignedUrl(doc.active_storage_path)
    if (!url) { toast.error('Eroare la descărcare.'); return }
    const a = document.createElement('a')
    a.href = url; a.download = doc.original_file_name; a.click()
  }

  async function deleteDoc(doc: ContractDocument) {
    if (!window.confirm(`Ștergi documentul "${doc.title ?? doc.original_file_name}"?`)) return
    setDeleting(doc.id)
    try {
      // Delete from storage
      const paths = [doc.storage_path, doc.compressed_storage_path].filter(Boolean) as string[]
      await db.storage.from('documents').remove(paths)
      // Delete from DB
      const { error } = await db.from('contract_documents').delete().eq('id', doc.id)
      if (error) throw new Error(error.message)
      toast.success('Document șters.')
      await load()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setDeleting(null)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }

  return (
    <div className="mt-6 bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-500" />
          <h3 className="font-semibold text-gray-800">Documente încărcate</h3>
          {docs.length > 0 && (
            <span className="ml-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{docs.length}</span>
          )}
        </div>
        <button
          onClick={() => setShowUpload(!showUpload)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-600 hover:bg-brand-700 text-white rounded-lg transition-colors"
        >
          <Upload className="w-3.5 h-3.5" />
          Încarcă document
        </button>
      </div>

      {/* Upload panel */}
      {showUpload && (
        <div className="border-b border-gray-100 p-5 bg-gray-50 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tip document</label>
              <select className={inp} value={uploadForm.type}
                onChange={e => setUploadForm(f => ({ ...f, type: e.target.value }))}>
                {DOC_TYPES.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Titlu (opțional)</label>
              <input className={inp} value={uploadForm.title}
                onChange={e => setUploadForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Ex: Contract 2026, Act adițional nr. 1" />
            </div>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => !uploading && fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${dragging ? 'border-brand-500 bg-brand-50' : 'border-gray-300 hover:border-brand-400 hover:bg-white'} ${uploading ? 'pointer-events-none' : ''}`}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin" />
                <p className="text-sm text-gray-600">{compressionStatus || 'Se procesează...'}</p>
              </div>
            ) : (
              <>
                <Upload className={`w-8 h-8 ${dragging ? 'text-brand-500' : 'text-gray-300'}`} />
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-700">Trage fișierul sau click pentru selectare</p>
                  <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG · max {MAX_MB} MB</p>
                  <p className="text-xs text-gray-400">PDF-urile vor fi comprimate client-side dacă este posibil.</p>
                </div>
              </>
            )}
            <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
          </div>

          <div className="flex justify-end">
            <button onClick={() => setShowUpload(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100">
              Închide
            </button>
          </div>
        </div>
      )}

      {/* Document list */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : docs.length === 0 ? (
        <div className="px-5 py-10 text-center text-gray-400">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Niciun document încărcat.</p>
          <p className="text-xs mt-1">Apasă "Încarcă document" pentru a adăuga contracte sau acte adiționale.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {docs.map(doc => {
            const savings = doc.compression_ratio ? `${(doc.compression_ratio * 100).toFixed(0)}% mai mic` : null
            return (
              <div key={doc.id} className="px-5 py-3 flex items-center gap-4 hover:bg-gray-50 transition-colors">
                <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-800 truncate">
                      {doc.title ?? doc.original_file_name}
                    </span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                    </span>
                    {doc.compression_status === 'compressed' && savings && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> {savings}
                      </span>
                    )}
                    {doc.compression_status === 'not_smaller' && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Original</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {doc.original_file_name}
                    {' · '}
                    {doc.compression_status === 'compressed' && doc.compressed_size_bytes
                      ? `${formatSize(doc.compressed_size_bytes)} (orig: ${formatSize(doc.original_size_bytes)})`
                      : formatSize(doc.original_size_bytes)}
                    {' · '}
                    {new Date(doc.created_at).toLocaleDateString('ro-RO')}
                  </div>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => preview(doc)} title="Previzualizare"
                    className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded transition-colors">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => download(doc)} title="Descarcă"
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors">
                    <Download className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteDoc(doc)} disabled={deleting === doc.id} title="Șterge"
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors disabled:opacity-50">
                    {deleting === doc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
