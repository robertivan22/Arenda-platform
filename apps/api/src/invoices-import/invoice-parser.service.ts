import { Injectable } from '@nestjs/common'

export interface ParsedSupplier {
  name: string | null
  taxId: string | null
  registrationNumber: string | null
  address: string | null
}

export interface ParsedInvoiceHeader {
  number: string | null
  date: string | null
  dueDate: string | null
  currency: string | null
  subtotal: number | null
  vatTotal: number | null
  total: number | null
}

export interface ParsedInvoiceItem {
  lineNo: number
  description: string
  sku: string | null
  quantity: number | null
  unit: string | null
  unitPrice: number | null
  vatRate: number | null
  vatAmount: number | null
  lineTotal: number | null
  matchedProductId: string | null
  matchStatus: 'matched' | 'unmatched' | 'new_product' | 'ignored'
  confidence: number | null
}

export interface ParsedInvoiceValidation {
  totalsMatch: boolean
  warnings: string[]
}

export interface ParsedInvoice {
  supplier: ParsedSupplier
  invoice: ParsedInvoiceHeader
  items: ParsedInvoiceItem[]
  validation: ParsedInvoiceValidation
  rawText: string
}

// ─── Normalizers ─────────────────────────────────────────────────────────────

/** Convert Romanian number format (1.234,56 or 1 234,56) to JS number */
function normalizeNumber(raw: string): number | null {
  if (!raw) return null
  // Remove thousand separators (. or space before comma-decimal)
  let s = raw.trim().replace(/\s/g, '')
  // Romanian decimal: 1.234,56 → 1234.56
  if (/^\d{1,3}(\.\d{3})*(,\d+)?$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.')
  } else if (/^\d+(,\d+)?$/.test(s)) {
    // 1234,56 or 1234
    s = s.replace(',', '.')
  } else {
    // already standard: 1234.56
    s = s.replace(',', '.')
  }
  const n = parseFloat(s)
  return isNaN(n) ? null : n
}

/** Normalize date to YYYY-MM-DD */
function normalizeDate(raw: string): string | null {
  if (!raw) return null
  const s = raw.trim()
  // DD.MM.YYYY or DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  // YYYY.MM.DD
  const ymd = s.match(/^(\d{4})[./](\d{2})[./](\d{2})$/)
  if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`
  return null
}

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Regex patterns ───────────────────────────────────────────────────────────

const CUI_PATTERN = /(?:cui|cif|cod\s*fiscal|cod\s*de\s*identificare\s*fiscal[aă]|ro)\s*[:.]?\s*(RO)?(\d{6,10})/i
const INVOICE_NO_PATTERN = /(?:factur[aă]\s*nr\.?|nr\.?\s*factur[aă]|invoice\s*no\.?|seria?\s*\/?\s*num[aă]r|seria?\s+\w+\s+nr\.?)\s*[:.]?\s*([A-Z0-9/_-]{2,20})/i
const DATE_PATTERN = /(?:data\s*(?:facturii|emiterii|emis\s*la)?|dat[aă]\s*factur[aă]|emis[aă]?\s*la)\s*[:.]?\s*(\d{1,2}[./]\d{1,2}[./]\d{4}|\d{4}-\d{2}-\d{2})/i
const TOTAL_PATTERN = /(?:total\s*(?:de\s*plat[aă]|plata|general)?|valoare\s*total[aă])\s*[:.]?\s*([\d.,\s]+)/i
const SUBTOTAL_PATTERN = /(?:subtotal|total\s*f[aă]r[aă]\s*tva|baz[aă]\s*impozabil[aă])\s*[:.]?\s*([\d.,\s]+)/i
const VAT_PATTERN = /(?:tva|t\.v\.a\.?|valoare\s*tva)\s*[:.]?\s*([\d.,\s]+)/i
const CURRENCY_PATTERN = /\b(RON|EUR|USD|LEI)\b/i
const DUE_DATE_PATTERN = /(?:scadent[aă]|dat[aă]\s*scadent[aă]|termen\s*plat[aă])\s*[:.]?\s*(\d{1,2}[./]\d{1,2}[./]\d{4}|\d{4}-\d{2}-\d{2})/i
const SUPPLIER_NAME_PATTERN = /(?:furnizor|emitent|de\s*la)\s*[:.]?\s*([A-ZĂÂÎȘȚ][A-Za-zăâîșțĂÂÎȘȚ0-9&.,\s-]{2,60})/

// ─── Line item detection ───────────────────────────────────────────────────────

/**
 * Heuristic product line extraction:
 * Looks for lines that look like: description  qty  unit  price  total
 * Works best with layout-preserved text (pdftotext -layout).
 */
function extractProductLines(text: string): ParsedInvoiceItem[] {
  const lines = text.split('\n')
  const items: ParsedInvoiceItem[] = []

  // Find header row that contains table column keywords
  const headerKeywords = ['cantitate', 'cant', 'qty', 'um', 'pret', 'preț', 'valoare', 'denumire', 'total', 'tva']
  let headerLineIndex = -1
  let footerLineIndex = lines.length

  for (let i = 0; i < lines.length; i++) {
    const norm = normalizeText(lines[i])
    const matchCount = headerKeywords.filter(k => norm.includes(k)).length
    if (matchCount >= 3) {
      headerLineIndex = i
      break
    }
  }

  // Footer keywords signal end of table
  const footerKeywords = ['subtotal', 'total de plata', 'total general', 'total fara tva', 'valoare totala']
  for (let i = (headerLineIndex > 0 ? headerLineIndex + 1 : 0); i < lines.length; i++) {
    const norm = normalizeText(lines[i])
    if (footerKeywords.some(k => norm.includes(k))) {
      footerLineIndex = i
      break
    }
  }

  // Extract lines between header and footer
  const dataLines = lines.slice(
    headerLineIndex >= 0 ? headerLineIndex + 1 : 0,
    footerLineIndex,
  ).filter(l => l.trim().length > 5)

  // Pattern: optional line number, description, then numbers
  const lineItemRe = /^(\d+\s+)?(.{3,40}?)\s{2,}([\d.,]+)\s+(buc|kg|l|m|t|to|bax|set|pac|palet)?\s*([\d.,]+)\s+([\d.,]+)\s*([\d.,]+)?/i

  let lineNo = 1
  for (const line of dataLines) {
    const m = line.match(lineItemRe)
    if (!m) continue

    const description = (m[2] ?? '').trim()
    if (!description || description.length < 2) continue

    const qty = normalizeNumber(m[3])
    const unit = (m[4] ?? '').trim() || null
    const unitPrice = normalizeNumber(m[5])
    const lineTotal = normalizeNumber(m[6])

    items.push({
      lineNo: lineNo++,
      description,
      sku: null,
      quantity: qty,
      unit,
      unitPrice,
      vatRate: null,
      vatAmount: null,
      lineTotal,
      matchedProductId: null,
      matchStatus: 'unmatched',
      confidence: 60,
    })
  }

  return items
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class InvoiceParserService {
  parseInvoiceText(rawText: string): ParsedInvoice {
    const text = rawText

    // --- Supplier ---
    const cuiMatch = text.match(CUI_PATTERN)
    const taxId = cuiMatch ? (cuiMatch[1] ? 'RO' + cuiMatch[2] : cuiMatch[2]) : null

    const supplierNameMatch = text.match(SUPPLIER_NAME_PATTERN)
    const supplierName = supplierNameMatch ? supplierNameMatch[1].trim() : null

    // --- Invoice header ---
    const invoiceNoMatch = text.match(INVOICE_NO_PATTERN)
    const dateMatch = text.match(DATE_PATTERN)
    const dueDateMatch = text.match(DUE_DATE_PATTERN)
    const currencyMatch = text.match(CURRENCY_PATTERN)
    const totalMatch = text.match(TOTAL_PATTERN)
    const subtotalMatch = text.match(SUBTOTAL_PATTERN)
    const vatMatch = text.match(VAT_PATTERN)

    const total = totalMatch ? normalizeNumber(totalMatch[1]) : null
    const subtotal = subtotalMatch ? normalizeNumber(subtotalMatch[1]) : null
    const vatTotal = vatMatch ? normalizeNumber(vatMatch[1]) : null

    // --- Items ---
    const items = extractProductLines(text)

    // --- Validation ---
    const warnings: string[] = []
    const invoice = {
      number: invoiceNoMatch ? invoiceNoMatch[1].trim() : null,
      date: dateMatch ? normalizeDate(dateMatch[1]) : null,
      dueDate: dueDateMatch ? normalizeDate(dueDateMatch[1]) : null,
      currency: currencyMatch ? currencyMatch[1].toUpperCase() : 'RON',
      subtotal,
      vatTotal,
      total,
    }

    if (!invoice.number) warnings.push('Numărul facturii nu a putut fi identificat automat.')
    if (!invoice.date) warnings.push('Data facturii nu a putut fi identificată automat.')
    if (items.length === 0) warnings.push('Nu au fost identificate automat linii de produs. Verifică manual factura.')

    // Check totals match
    let totalsMatch = false
    if (items.length > 0 && total !== null) {
      const itemsSum = items.reduce((acc, i) => acc + (i.lineTotal ?? 0), 0)
      totalsMatch = Math.abs(itemsSum - total) < 0.05
      if (!totalsMatch && itemsSum > 0) {
        warnings.push(`Suma liniilor (${itemsSum.toFixed(2)}) diferă de totalul facturii (${total.toFixed(2)}).`)
      }
    }

    if (!invoice.number || !invoice.date || items.length === 0) {
      warnings.push('Nu au fost identificate automat toate câmpurile. Verifică manual factura.')
    }

    return {
      supplier: {
        name: supplierName,
        taxId,
        registrationNumber: null,
        address: null,
      },
      invoice,
      items,
      validation: { totalsMatch, warnings },
      rawText,
    }
  }

  validateExtractedInvoice(parsed: ParsedInvoice): string[] {
    const errors: string[] = []
    if (!parsed.invoice.number) errors.push('Factura trebuie să aibă număr.')
    if (!parsed.invoice.date) errors.push('Factura trebuie să aibă dată.')
    if (parsed.items.length === 0) errors.push('Factura trebuie să aibă cel puțin o linie de produs.')
    for (const item of parsed.items) {
      if (item.quantity !== null && item.quantity <= 0) {
        errors.push(`Linia ${item.lineNo}: cantitatea trebuie să fie mai mare decât 0.`)
      }
      if (item.unitPrice !== null && item.unitPrice < 0) {
        errors.push(`Linia ${item.lineNo}: prețul unitar nu poate fi negativ.`)
      }
    }
    return errors
  }

  normalizeProductName(name: string): string {
    return normalizeText(name)
  }

  /** Simple fuzzy match: returns true if normalized names share ≥70% of words */
  fuzzyMatch(a: string, b: string): boolean {
    const wa = new Set(normalizeText(a).split(' ').filter(Boolean))
    const wb = new Set(normalizeText(b).split(' ').filter(Boolean))
    if (wa.size === 0 || wb.size === 0) return false
    let common = 0
    for (const w of wa) if (wb.has(w)) common++
    return common / Math.max(wa.size, wb.size) >= 0.7
  }
}
