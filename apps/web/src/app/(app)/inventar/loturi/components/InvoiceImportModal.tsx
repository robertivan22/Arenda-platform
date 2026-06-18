'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  X, Upload, Loader2, CheckCircle2, AlertTriangle,
  FileText, Plus, ChevronDown, Search, Link2,
} from 'lucide-react'
import { parseInvoiceText, normalizeProductName, fuzzyMatch } from '@/lib/ocr-parser'
import type { OcrInvoiceResult, OcrInvoiceItem } from '@/lib/ocr-parser'
import type { Supplier, InputCategory } from '@/lib/inventory-types'
import { INPUT_CATEGORY_LABELS } from '@/lib/inventory-types'

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = 'upload' | 'processing' | 'review'

interface Props {
  suppliers: Supplier[]
  onCreated: () => void
  onClose: () => void
}

interface ExistingProduct { product_name: string; supplier_id: string | null; unit: string }

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/jpg']
const MAX_MB = 20
const CAT_OPTIONS: { value: InputCategory; label: string }[] = [
  { value: 'SEED', label: 'Sămânță' },
  { value: 'FERTILIZER', label: 'Îngrășăminte' },
  { value: 'PPP', label: 'Produs fitosanitar' },
  { value: 'FUEL', label: 'Combustibil' },
  { value: 'OTHER', label: 'Altele' },
]
const UNITS = ['kg', 'L', 't', 'buc', 'saci', 'litri']

// ─── OCR runner ───────────────────────────────────────────────────────────────

async function runOcrOnImages(imageUrls: string[], onProgress: (p: string) => void): Promise<string> {
  onProgress('Se inițializează OCR...')
  // Dynamic import – Tesseract.js runs entirely in browser
  const { createWorker } = await import('tesseract.js')
  const worker = await createWorker('ron+eng', 1, {
    workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
    langPath: 'https://tessdata.projectnaptha.com/4.0.0',
    corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core-simd-lstm.wasm.js',
    logger: () => {},
  })
  const texts: string[] = []
  for (let i = 0; i < imageUrls.length; i++) {
    onProgress(`Se rulează OCR pagina ${i + 1} din ${imageUrls.length}...`)
    const { data } = await worker.recognize(imageUrls[i])
    texts.push(data.text)
  }
  await worker.terminate()
  return texts.join('\n\n--- PAGINA URMATOARE ---\n\n')
}

async function pdfToImages(file: File, onProgress: (p: string) => void): Promise<string[]> {
  onProgress('Se citește fișierul PDF...')
  // Dynamic import – PDF.js runs in browser
  const pdfjs = await import('pdfjs-dist')
  // Use CDN worker to avoid build issues
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise
  const images: string[] = []

  for (let p = 1; p <= pdf.numPages; p++) {
    onProgress(`Se randează pagina ${p} din ${pdf.numPages}...`)
    const page = await pdf.getPage(p)
    const scale = 2.0 // 150dpi equivalent
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!
    await page.render({ canvasContext: ctx, viewport }).promise
    images.push(canvas.toDataURL('image/jpeg', 0.85))
  }
  return images
}

async function fileToImages(file: File): Promise<string[]> {
  return new Promise(resolve => {
    const reader = new FileReader()
    reader.onload = e => resolve([e.target!.result as string])
    reader.readAsDataURL(file)
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export function InvoiceImportModal({ suppliers, onCreated, onClose }: Props) {
  const [stage, setStage] = useState<Stage>('upload')
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState<OcrInvoiceResult | null>(null)
  const [items, setItems] = useState<OcrInvoiceItem[]>([])
  const [header, setHeader] = useState({
    supplier_name: '', supplier_tax_id: '', invoice_number: '',
    invoice_date: '', currency: 'RON', subtotal: '', vat_total: '', total: '',
  })
  const [existingProducts, setExistingProducts] = useState<ExistingProduct[]>([])
  const [supplierId, setSupplierId] = useState('')
  const [matchSearch, setMatchSearch] = useState<Record<number, string>>({})
  const [saveAlias, setSaveAlias] = useState<Record<number, boolean>>({})
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const inp = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500'

  // Load existing product names for matching
  useEffect(() => {
    createClient().from('input_lots')
      .select('product_name, supplier_id, unit')
      .order('product_name')
      .then(({ data }) => setExistingProducts((data ?? []) as ExistingProduct[]))
  }, [])

  const processFile = useCallback(async (f: File) => {
    if (!ALLOWED_TYPES.includes(f.type)) { toast.error('Tip fișier neacceptat.'); return }
    if (f.size > MAX_MB * 1024 * 1024) { toast.error(`Fișierul depășește ${MAX_MB} MB.`); return }
    setFile(f)
    setStage('processing')

    try {
      setProgress('Se pregătește fișierul...')
      const images = f.type === 'application/pdf'
        ? await pdfToImages(f, setProgress)
        : await fileToImages(f)

      const rawText = await runOcrOnImages(images, setProgress)
      setProgress('Se extrag produsele...')

      const parsed = parseInvoiceText(rawText)
      setResult(parsed)

      // Auto-match: compare each item description with existing products
      const matched = parsed.items.map(item => {
        const norm = normalizeProductName(item.description)
        let bestMatch = 0, bestName = ''
        for (const p of existingProducts) {
          const score = fuzzyMatch(norm, normalizeProductName(p.product_name))
          if (score > bestMatch) { bestMatch = score; bestName = p.product_name }
        }
        return {
          ...item,
          match_status: bestMatch >= 0.7 ? ('matched' as const) : ('unmatched' as const),
          matched_input_id: bestMatch >= 0.7 ? bestName : null,
        }
      })

      setItems(matched)
      setHeader({
        supplier_name:  parsed.supplier.name ?? '',
        supplier_tax_id: parsed.supplier.tax_id ?? '',
        invoice_number: parsed.invoice.number ?? '',
        invoice_date:   parsed.invoice.date ?? '',
        currency:       parsed.invoice.currency ?? 'RON',
        subtotal:       parsed.invoice.subtotal?.toString() ?? '',
        vat_total:      parsed.invoice.vat_total?.toString() ?? '',
        total:          parsed.invoice.total?.toString() ?? '',
      })
      setStage('review')
    } catch (err) {
      toast.error(`Eroare OCR: ${(err as Error).message}`)
      setStage('upload')
    }
  }, [existingProducts])

  // ── Drag & drop ────────────────────────────────────────────────────────────
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) processFile(f)
  }, [processFile])

  // ── Item actions ──────────────────────────────────────────────────────────
  const updateItem = (lineNo: number, patch: Partial<OcrInvoiceItem>) =>
    setItems(prev => prev.map(i => i.line_no === lineNo ? { ...i, ...patch } : i))

  const ignoreItem  = (lineNo: number) => updateItem(lineNo, { match_status: 'ignored' })
  const newInput    = (lineNo: number) => updateItem(lineNo, { match_status: 'new_input' })
  const matchItem   = (lineNo: number, productName: string) =>
    updateItem(lineNo, { match_status: 'matched', matched_input_id: productName })

  // ── Duplicate check ───────────────────────────────────────────────────────
  async function checkDuplicate(): Promise<boolean> {
    const { supplier_tax_id, invoice_number, invoice_date } = header
    if (!supplier_tax_id || !invoice_number) return false
    const db = createClient()
    const { data } = await db.from('input_invoice_imports')
      .select('id').eq('supplier_tax_id', supplier_tax_id)
      .eq('invoice_number', invoice_number)
      .limit(1)
    return (data?.length ?? 0) > 0
  }

  // ── Find or create supplier ────────────────────────────────────────────────
  async function resolveSupplier(userId: string): Promise<string | null> {
    const db = createClient()
    // 1. User manually selected a supplier
    if (supplierId) return supplierId
    // 2. Try to match by CUI
    const cui = header.supplier_tax_id?.replace(/^RO/i, '').trim()
    if (cui) {
      const { data: byCui } = await db.from('suppliers')
        .select('id').ilike('cui', `%${cui}%`).eq('is_active', true).limit(1)
      if (byCui?.[0]) return byCui[0].id
    }
    // 3. Try to match by name
    const name = header.supplier_name?.trim()
    if (name) {
      const { data: byName } = await db.from('suppliers')
        .select('id').ilike('name', name).eq('is_active', true).limit(1)
      if (byName?.[0]) return byName[0].id
    }
    // 4. Create new supplier from OCR data
    if (name) {
      const { data: newSup } = await db.from('suppliers').insert({
        user_id: userId,
        name,
        cui: header.supplier_tax_id || null,
        is_active: true,
      }).select('id').single()
      if (newSup) {
        toast.success(`Furnizor nou înregistrat: ${name}`)
        return newSup.id
      }
    }
    return null
  }

  // ── Save draft ────────────────────────────────────────────────────────────
  async function saveDraft() {
    setSaving(true)
    try {
      const db = createClient()
      const { data: { user } } = await db.auth.getUser()
      if (!user) throw new Error('Sesiune expirată')

      // Upload file to Supabase Storage
      let storagePath: string | null = null
      if (file) {
        const ext = file.name.split('.').pop()
        const path = `invoice-imports/${user.id}/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await db.storage.from('documents').upload(path, file, { upsert: false })
        if (!upErr) storagePath = path
      }

      const { data: imp, error: impErr } = await db.from('input_invoice_imports').insert({
        user_id: user.id,
        original_file_name: file?.name ?? 'unknown',
        file_size_bytes: file?.size ?? 0,
        storage_path: storagePath,
        supplier_name:   header.supplier_name || null,
        supplier_tax_id: header.supplier_tax_id || null,
        invoice_number:  header.invoice_number || null,
        invoice_date:    header.invoice_date || null,
        currency:        header.currency,
        subtotal:        header.subtotal ? parseFloat(header.subtotal) : null,
        vat_total:       header.vat_total ? parseFloat(header.vat_total) : null,
        total:           header.total ? parseFloat(header.total) : null,
        raw_ocr_text:    result?.raw_text ?? null,
        raw_ocr_json:    result ? JSON.stringify(result) : null,
        status:          'draft',
      }).select('id').single()

      if (impErr || !imp) throw new Error(impErr?.message ?? 'Eroare la salvare')

      if (items.length > 0) {
        const itemRows = items.map(it => ({
          import_id: imp.id, line_no: it.line_no,
          extracted_name: it.description, category: it.category ?? 'OTHER',
          quantity: it.quantity, unit: it.unit, unit_price: it.unit_price,
          vat_rate: it.vat_rate, vat_amount: it.vat_amount, line_total: it.line_total,
          lot_number: it.lot_number, expiration_date: it.expiration_date,
          match_status: it.match_status, confidence: it.confidence,
        }))
        await db.from('input_invoice_import_items').insert(itemRows)
      }

      toast.success('Import salvat ca draft.')
      onClose()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // ── Create lots ───────────────────────────────────────────────────────────
  async function createLots() {
    const validItems = items.filter(i =>
      (i.match_status === 'matched' || i.match_status === 'new_input') &&
      (i.quantity ?? 0) > 0
    )
    if (validItems.length === 0) {
      toast.error('Niciun produs valid pentru creare loturi.')
      return
    }

    // Validate each item
    for (const it of validItems) {
      if (!it.unit) { toast.error(`Linia ${it.line_no}: UM lipsă.`); return }
      if (!it.category) { toast.error(`Linia ${it.line_no}: Categoria lipsă.`); return }
    }

    // Check duplicate invoice
    const isDup = await checkDuplicate()
    if (isDup) {
      const ok = window.confirm(
        'Această factură pare să fi fost deja importată în Loturi Inputuri.\nContinui oricum?'
      )
      if (!ok) return
    }

    setSaving(true)
    try {
      const db = createClient()
      const { data: { user } } = await db.auth.getUser()
      if (!user) throw new Error('Sesiune expirată')

      // Upload file
      let storagePath: string | null = null
      if (file) {
        const ext = file.name.split('.').pop()
        const path = `invoice-imports/${user.id}/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await db.storage.from('documents').upload(path, file, { upsert: false })
        if (!upErr) storagePath = path
      }

      // Create import record
      const { data: imp, error: impErr } = await db.from('input_invoice_imports').insert({
        user_id: user.id,
        original_file_name: file?.name ?? 'unknown',
        file_size_bytes: file?.size ?? 0,
        storage_path: storagePath,
        supplier_name:   header.supplier_name || null,
        supplier_tax_id: header.supplier_tax_id || null,
        invoice_number:  header.invoice_number || null,
        invoice_date:    header.invoice_date || null,
        currency:        header.currency,
        subtotal:        header.subtotal ? parseFloat(header.subtotal) : null,
        vat_total:       header.vat_total ? parseFloat(header.vat_total) : null,
        total:           header.total ? parseFloat(header.total) : null,
        raw_ocr_text:    result?.raw_text ?? null,
        raw_ocr_json:    result ? result : null,
        status:          'lots_created',
        confirmed_at:    new Date().toISOString(),
      }).select('id').single()

      if (impErr || !imp) throw new Error(impErr?.message ?? 'Eroare la salvare')

      // Find or create supplier from OCR data
      const resolvedSupplierId = await resolveSupplier(user.id)

      const invoiceDate = header.invoice_date || new Date().toISOString().split('T')[0]
      const invoiceNotes = `Import OCR factură ${header.invoice_number ?? ''}`.trim()

      // Create lots / movements
      const createdLots: string[] = []
      for (const it of validItems) {

        // ── Matched product: add as IN movement to existing lot ──────────────
        if (it.match_status === 'matched' && it.matched_input_id) {
          const { data: existingLot } = await db.from('input_lots')
            .select('id')
            .eq('user_id', user.id)
            .eq('product_name', it.matched_input_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

          if (existingLot) {
            // The trigger update_lot_quantity_available() handles quantity_available += qty
            await db.from('input_stock_mvt').insert({
              user_id: user.id,
              lot_id:  existingLot.id,
              mvt_type: 'IN',
              quantity: it.quantity!,
              mvt_date: invoiceDate,
              notes:    invoiceNotes,
            })
            createdLots.push(existingLot.id)
            if (saveAlias[it.line_no]) {
              await db.from('input_product_aliases').upsert({
                user_id: user.id,
                lot_product_name: it.matched_input_id,
                supplier_tax_id: header.supplier_tax_id || null,
                alias_name: it.description,
                normalized_alias_name: normalizeProductName(it.description),
              }, { onConflict: 'user_id,normalized_alias_name', ignoreDuplicates: true })
            }
            continue  // skip new lot creation
          }
          // Fallthrough: no existing lot found — create one below
        }

        // ── New input or matched-but-no-lot: create new lot ──────────────────
        const productName = it.matched_input_id ?? it.description
        const { data: lot, error: lotErr } = await db.from('input_lots').insert({
          user_id: user.id,
          supplier_id: resolvedSupplierId,
          category: it.category ?? 'OTHER',
          product_name: productName,
          unit: it.unit!,
          quantity: it.quantity!,
          quantity_available: it.quantity!,
          unit_price: it.unit_price,
          batch_number: it.lot_number,
          expiry_date: it.expiration_date,
          received_date: invoiceDate,
          invoice_ref: header.invoice_number,
          source_invoice_import_id: imp.id,
          source_invoice_number: header.invoice_number,
          source_invoice_date: header.invoice_date || null,
          ocr_created: true,
          notes: invoiceNotes,
        }).select('id').single()

        if (!lotErr && lot) createdLots.push(lot.id)

        // Save alias if requested
        if (saveAlias[it.line_no] && it.matched_input_id) {
          await db.from('input_product_aliases').upsert({
            user_id: user.id,
            lot_product_name: it.matched_input_id,
            supplier_tax_id: header.supplier_tax_id || null,
            alias_name: it.description,
            normalized_alias_name: normalizeProductName(it.description),
          }, { onConflict: 'user_id,normalized_alias_name', ignoreDuplicates: true })
        }
      }

      // Save items
      const itemRows = items.map(it => ({
        import_id: imp.id, line_no: it.line_no,
        extracted_name: it.description, category: it.category ?? 'OTHER',
        quantity: it.quantity, unit: it.unit, unit_price: it.unit_price,
        vat_rate: it.vat_rate, vat_amount: it.vat_amount, line_total: it.line_total,
        lot_number: it.lot_number, expiration_date: it.expiration_date,
        match_status: it.match_status, confidence: it.confidence,
      }))
      await db.from('input_invoice_import_items').insert(itemRows)

      const newLots = validItems.filter(i => i.match_status === 'new_input' || !existingProducts.find(p => p.product_name === i.matched_input_id)).length
      const movements = createdLots.length - newLots
      if (movements > 0 && newLots > 0)
        toast.success(`${newLots} lot(uri) create + ${movements} intrare(i) adăugate din factură.`)
      else if (movements > 0)
        toast.success(`${movements} intrare(i) adăugate în loturi existente.`)
      else
        toast.success(`${createdLots.length} lot(uri) create din factură.`)
      onCreated()
      onClose()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-4 flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 text-brand-600" />
            <div>
              <h2 className="font-semibold text-gray-900">Scanează factură inputuri</h2>
              <p className="text-xs text-gray-500">OCR rulează direct în browser · fără server</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── Stage: Upload ─────────────────────────────────────────────── */}
          {stage === 'upload' && (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-colors ${dragging ? 'border-brand-500 bg-brand-50' : 'border-gray-300 hover:border-brand-400 hover:bg-gray-50'}`}
            >
              <Upload className={`w-12 h-12 ${dragging ? 'text-brand-500' : 'text-gray-300'}`} />
              <div className="text-center">
                <p className="font-semibold text-gray-700">Trage factura aici sau click pentru selectare</p>
                <p className="text-sm text-gray-400 mt-1">Suportă: PDF, JPG, JPEG, PNG, WEBP · max {MAX_MB} MB</p>
                <p className="text-xs text-gray-400 mt-3">
                  Sistemul va extrage automat produsele, cantitățile, prețurile și furnizorul.
                </p>
              </div>
              <input ref={fileRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }} />
            </div>
          )}

          {/* ── Stage: Processing ─────────────────────────────────────────── */}
          {stage === 'processing' && (
            <div className="flex flex-col items-center justify-center gap-6 py-16">
              <Loader2 className="w-12 h-12 text-brand-500 animate-spin" />
              <div className="text-center">
                <p className="font-semibold text-gray-800">{progress || 'Se procesează...'}</p>
                <p className="text-sm text-gray-400 mt-2">
                  {file?.name} · {((file?.size ?? 0) / 1024).toFixed(0)} KB
                </p>
              </div>
              <div className="text-xs text-gray-400 space-y-1 text-center">
                <p>✓ Se citește factura...</p>
                <p className={progress.includes('OCR') ? 'text-brand-500 font-medium' : ''}>→ Se rulează OCR (Tesseract.js)...</p>
                <p className={progress.includes('extrag') ? 'text-brand-500 font-medium' : ''}>→ Se extrag produsele...</p>
              </div>
            </div>
          )}

          {/* ── Stage: Review ─────────────────────────────────────────────── */}
          {stage === 'review' && result && (
            <div className="space-y-6">
              {/* Warnings */}
              {result.validation.warnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="font-semibold text-amber-800 flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4" /> Avertismente OCR
                  </p>
                  {result.validation.warnings.map((w, i) => (
                    <p key={i} className="text-sm text-amber-700">• {w}</p>
                  ))}
                </div>
              )}

              {/* Invoice header */}
              <div className="bg-gray-50 rounded-xl border p-5">
                <h3 className="font-semibold text-gray-800 mb-4">Date factură</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {([
                    ['supplier_name',  'Furnizor', 'text'],
                    ['supplier_tax_id','CUI/CIF',  'text'],
                    ['invoice_number', 'Nr. factură', 'text'],
                    ['invoice_date',   'Dată',     'date'],
                    ['currency',       'Monedă',   'text'],
                    ['subtotal',       'Subtotal', 'number'],
                    ['vat_total',      'TVA',      'number'],
                    ['total',          'Total',    'number'],
                  ] as [keyof typeof header, string, string][]).map(([k, label, type]) => (
                    <label key={k} className="block">
                      <span className="text-xs text-gray-500 font-medium">{label}</span>
                      <input type={type} value={header[k]}
                        onChange={e => setHeader(h => ({ ...h, [k]: e.target.value }))}
                        className="mt-1 w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    </label>
                  ))}
                </div>
                <div className="mt-3">
                  <label className="block text-xs text-gray-500 font-medium mb-1">Furnizor din baza de date</label>
                  <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500">
                    <option value="">— potrivire automată după nume —</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Items table */}
              <div className="bg-white rounded-xl border">
                <div className="px-5 py-4 border-b flex items-center justify-between">
                  <h3 className="font-semibold text-gray-800">
                    Produse detectate ({items.filter(i => i.match_status !== 'ignored').length} active)
                  </h3>
                  <p className="text-xs text-gray-400">Verifică și corectează înainte de creare loturi.</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 text-gray-500 uppercase">
                      <tr>
                        <th className="px-3 py-2 text-left">Denumire extrasă</th>
                        <th className="px-3 py-2 text-left">Produs / Mapare</th>
                        <th className="px-3 py-2 text-left">Cat.</th>
                        <th className="px-3 py-2 text-right">Cant.</th>
                        <th className="px-3 py-2 text-left">UM</th>
                        <th className="px-3 py-2 text-right">Preț</th>
                        <th className="px-3 py-2 text-right">Total</th>
                        <th className="px-3 py-2 text-left">Lot</th>
                        <th className="px-3 py-2 text-center">Status</th>
                        <th className="px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map(item => {
                        const ignored = item.match_status === 'ignored'
                        return (
                          <tr key={item.line_no} className={ignored ? 'opacity-40 bg-gray-50' : 'hover:bg-gray-50'}>
                            <td className="px-3 py-2 max-w-[180px]">
                              <span className="line-clamp-2 text-gray-800" title={item.description}>{item.description}</span>
                            </td>
                            <td className="px-3 py-2 min-w-[160px]">
                              {item.match_status === 'new_input' ? (
                                <span className="text-blue-600 font-medium flex items-center gap-1">
                                  <Plus className="w-3 h-3" /> Input nou
                                </span>
                              ) : (
                                <div className="space-y-1">
                                  <select
                                    value={item.matched_input_id ?? ''}
                                    onChange={e => matchItem(item.line_no, e.target.value)}
                                    disabled={ignored}
                                    className="w-full text-xs border border-gray-300 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500"
                                  >
                                    <option value="">— nemapat —</option>
                                    {existingProducts.map(p => (
                                      <option key={p.product_name} value={p.product_name}>{p.product_name}</option>
                                    ))}
                                  </select>
                                  {item.matched_input_id && (
                                    <label className="flex items-center gap-1 text-[10px] text-gray-500">
                                      <input type="checkbox" checked={saveAlias[item.line_no] ?? false}
                                        onChange={e => setSaveAlias(s => ({ ...s, [item.line_no]: e.target.checked }))}
                                        className="w-3 h-3" />
                                      Ține minte asocierea
                                    </label>
                                  )}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <select value={item.category ?? 'OTHER'}
                                onChange={e => updateItem(item.line_no, { category: e.target.value as OcrInvoiceItem['category'] })}
                                disabled={ignored}
                                className="text-xs border border-gray-300 rounded px-1 py-1 focus:outline-none">
                                {CAT_OPTIONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <input type="number" step="0.001" min="0"
                                value={item.quantity ?? ''}
                                onChange={e => updateItem(item.line_no, { quantity: parseFloat(e.target.value) || null })}
                                disabled={ignored}
                                className="w-20 text-right text-xs border border-gray-300 rounded px-1.5 py-1 focus:outline-none" />
                            </td>
                            <td className="px-3 py-2">
                              <select value={item.unit ?? 'kg'}
                                onChange={e => updateItem(item.line_no, { unit: e.target.value })}
                                disabled={ignored}
                                className="text-xs border border-gray-300 rounded px-1 py-1 focus:outline-none">
                                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2 text-right">
                              <input type="number" step="0.0001" min="0"
                                value={item.unit_price ?? ''}
                                onChange={e => updateItem(item.line_no, { unit_price: parseFloat(e.target.value) || null })}
                                disabled={ignored}
                                className="w-20 text-right text-xs border border-gray-300 rounded px-1.5 py-1 focus:outline-none" />
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-gray-600">
                              {item.line_total?.toFixed(2) ?? '—'}
                            </td>
                            <td className="px-3 py-2">
                              <input
                                value={item.lot_number ?? ''}
                                onChange={e => updateItem(item.line_no, { lot_number: e.target.value || null })}
                                disabled={ignored}
                                className="w-20 text-xs border border-gray-300 rounded px-1.5 py-1 focus:outline-none"
                                placeholder="Lot" />
                            </td>
                            <td className="px-3 py-2 text-center">
                              {item.match_status === 'matched' && (
                                <span className="inline-flex items-center gap-1 text-green-700 text-[10px] font-medium">
                                  <CheckCircle2 className="w-3 h-3" /> Mapat
                                </span>
                              )}
                              {item.match_status === 'unmatched' && (
                                <span className="text-amber-600 text-[10px] font-medium">Nemapat</span>
                              )}
                              {item.match_status === 'new_input' && (
                                <span className="text-blue-600 text-[10px] font-medium">Input nou</span>
                              )}
                              {item.match_status === 'ignored' && (
                                <span className="text-gray-400 text-[10px]">Ignorat</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex gap-1">
                                {!ignored && item.match_status !== 'new_input' && (
                                  <button onClick={() => newInput(item.line_no)} title="Crează input nou"
                                    className="text-blue-500 hover:text-blue-700 p-0.5">
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {!ignored ? (
                                  <button onClick={() => ignoreItem(item.line_no)} title="Ignoră linia"
                                    className="text-gray-400 hover:text-red-500 p-0.5">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                ) : (
                                  <button onClick={() => updateItem(item.line_no, { match_status: 'unmatched' })} title="Reactivează"
                                    className="text-gray-400 hover:text-green-600 p-0.5">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {items.length === 0 && (
                        <tr>
                          <td colSpan={10} className="px-3 py-8 text-center text-gray-400">
                            OCR-ul nu a putut extrage linii de produse. Adaugă manual produsele.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {/* Add manual line */}
                <div className="px-5 py-3 border-t bg-gray-50">
                  <button
                    onClick={() => setItems(prev => [...prev, {
                      line_no: (prev.at(-1)?.line_no ?? 0) + 1,
                      description: '', category: 'OTHER', sku: null,
                      quantity: null, unit: 'kg', unit_price: null,
                      vat_rate: null, vat_amount: null, line_total: null,
                      lot_number: null, expiration_date: null,
                      matched_input_id: null, match_status: 'new_input', confidence: null,
                    }])}
                    className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-700 font-medium"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adaugă linie manual
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {stage === 'review' && (
          <div className="flex-shrink-0 px-6 py-4 border-t border-gray-100 flex flex-wrap gap-3 justify-between items-center">
            <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50">
              Anulează
            </button>
            <div className="flex gap-3">
              <button onClick={saveDraft} disabled={saving}
                className="px-4 py-2 text-sm border border-brand-300 text-brand-700 rounded-lg hover:bg-brand-50 disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
                Salvează draft
              </button>
              <button onClick={createLots} disabled={saving}
                className="px-5 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
                Creează loturi inputuri
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
