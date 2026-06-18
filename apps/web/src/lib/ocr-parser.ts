// Romanian invoice text parser – runs entirely in the browser (no server)

export interface OcrInvoiceResult {
  supplier: {
    name: string | null
    tax_id: string | null
    registration_number: string | null
    address: string | null
  }
  invoice: {
    number: string | null
    date: string | null           // YYYY-MM-DD
    currency: string | null
    subtotal: number | null
    vat_total: number | null
    total: number | null
  }
  items: OcrInvoiceItem[]
  validation: {
    totals_match: boolean
    warnings: string[]
  }
  raw_text: string
}

export interface OcrInvoiceItem {
  line_no: number
  description: string
  category: 'SEED' | 'FERTILIZER' | 'PPP' | 'FUEL' | 'OTHER' | null
  sku: string | null
  quantity: number | null
  unit: string | null
  unit_price: number | null
  vat_rate: number | null
  vat_amount: number | null
  line_total: number | null
  lot_number: string | null
  expiration_date: string | null
  matched_input_id: string | null
  match_status: 'unmatched' | 'matched' | 'new_input' | 'ignored'
  confidence: number | null
}

// ─── Number helpers ──────────────────────────────────────────────────────────

/** Romanian format: "1.234,56" → 1234.56 */
export function normalizeNumber(s: string): number | null {
  const clean = s.trim().replace(/\s/g, '')
  // Romanian: dots as thousands, comma as decimal
  const roFmt = clean.replace(/\./g, '').replace(',', '.')
  const n = parseFloat(roFmt)
  if (!isNaN(n)) return n
  // International format already
  const intl = parseFloat(clean)
  return isNaN(intl) ? null : intl
}

/** "18.06.2026" → "2026-06-18" */
export function normalizeDate(s: string): string | null {
  const m = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/)
  if (!m) {
    // ISO format already
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
    return null
  }
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
}

// ─── Patterns ────────────────────────────────────────────────────────────────

const CUI_PATTERN = /(?:CUI|CIF|C\.U\.I\.|C\.I\.F\.|cod fiscal)[:\s]+(?:RO\s*)?(\d{6,10})/i
const REG_PATTERN = /(?:nr\.?\s*reg|J\d{2}\/)/i
const INV_NO_PATTERN = /(?:factur[aă]\s+(?:fiscal[aă]\s+)?nr\.?|seria\s+\w+\s+nr\.?)\s*([A-Z0-9\-/]+)/i
const INV_NO_PATTERN2 = /(?:nr\.?\s*factur[aă]|invoice\s+no\.?)\s*[:\s]+([A-Z0-9\-/]+)/i
const DATE_PATTERN = /(?:data|date|emis[aă]?\s+(?:la|in))\s*[:\s]+(\d{1,2}[./]\d{1,2}[./]\d{4})/i
const TOTAL_PATTERN = /(?:total\s+(?:general|factur[aă]|de plat[aă]|cu\s+TVA|inclus(?:iv)?\s+TVA))\s*[:\s]+([\d.,]+)/i
const VAT_PATTERN   = /(?:total\s+TVA|TVA\s+total|valoare\s+TVA)\s*[:\s]+([\d.,]+)/i
const SUBTOTAL_PATTERN = /(?:total\s+f[aă]r[aă]\s+TVA|baza\s+(?:de\s+impozitare|impozabil[aă]))\s*[:\s]+([\d.,]+)/i

// ─── Category detection ──────────────────────────────────────────────────────

const SEED_KW    = /\b(s[aă]m[aâ]n[tț][aă]|s[aâ]min[tț]e|hibrid|porumb|fl\.?\s*soare|floarea[\s-]?soarelui|rap[ițt][aă]|soia|grâu|grau|orz|orzoaic[aă]|triticale|lucern[aă]|mazăre|mazare)\b/i
const FERT_KW    = /\b(ngr[aăâ][sș][aă]m[aâ]nt|fertilizant|NPK|DAP|MAP|MOP|uree|azotat|sulfat|amoniu|potasiu|fosfor|nitrat|urea|amofos)\b/i
const PPP_KW     = /\b(erbicid|fungicid|insecticid|pesticid|produs\s+(?:de\s+)?protec[tț]ie|acaricid|nematocid|molluscicid|rodenticid|dezinfectant|biostimulator|probiotic\s+foliar)\b/i
const FUEL_KW    = /\b(motorin[aă]|combustibil|benzin[aă]|carburant|gpl|kerosen|adblue|aditiv\s+combustibil)\b/i

export function detectCategory(text: string): OcrInvoiceItem['category'] {
  if (PPP_KW.test(text)) return 'PPP'
  if (SEED_KW.test(text)) return 'SEED'
  if (FERT_KW.test(text)) return 'FERTILIZER'
  if (FUEL_KW.test(text)) return 'FUEL'
  return 'OTHER'
}

// ─── Line detection ──────────────────────────────────────────────────────────

// Matches: "1 | Seminte porumb Pioneer | kg | 500 | 12,50 | ... | 6.250,00"
// Very heuristic — works for most Romanian invoice formats
const LINE_UNIT_RE = /\b(kg|t|to?ne?|L|litri?|buc[aă]t?i?|saci|flac[ao]ane?|ha|SET|pct|pac)\b/i

function extractLines(text: string): OcrInvoiceItem[] {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 3)
  const items: OcrInvoiceItem[] = []
  let lineNo = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Skip header-like lines
    if (/^\s*(nr\.?\s*crt|denumire|cantitate|pret|valoare|total|TVA|U\.?M|cota|baza|um|qty|price|amount)\s*$/i.test(line)) continue
    if (/^[\s\d]+$/.test(line) && line.length < 5) continue

    // A product line typically has a unit somewhere and numbers
    if (!LINE_UNIT_RE.test(line)) continue

    // Extract numbers from the line
    const numMatches = [...line.matchAll(/([\d]{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,4})?)/g)]
    const nums = numMatches.map(m => normalizeNumber(m[0])).filter(n => n !== null) as number[]
    if (nums.length < 2) continue

    // Try to extract unit
    const unitMatch = line.match(LINE_UNIT_RE)
    const unit = unitMatch ? unitMatch[1] : null

    // Extract description: text before the first number block
    const firstNumIdx = line.search(/\d/)
    let description = firstNumIdx > 3 ? line.slice(0, firstNumIdx).trim() : line
    // Clean description
    description = description.replace(/^\d+[\s.]+/, '').replace(/[|;:]+$/, '').trim()
    if (description.length < 2) continue

    // Best-guess: last big number = line_total, qty is first, unit_price is third
    const quantity   = nums[0] ?? null
    const unit_price = nums.length >= 3 ? nums[nums.length - 3] : nums[1] ?? null
    const line_total = nums[nums.length - 1] ?? null

    // Extract lot/serie
    let lot_number: string | null = null
    const lotMatch = line.match(/(?:lot|serie|seria)[:\s]+([A-Z0-9\-/]+)/i)
    if (lotMatch) lot_number = lotMatch[1]

    // Extract expiry date
    let expiration_date: string | null = null
    const expMatch = line.match(/(?:exp(?:ira)?re?|valabil pana|data exp)[:\s]+(\d{1,2}[./]\d{1,2}[./]\d{4})/i)
    if (expMatch) expiration_date = normalizeDate(expMatch[1])

    lineNo++
    items.push({
      line_no: lineNo,
      description,
      category: detectCategory(description),
      sku: null,
      quantity,
      unit,
      unit_price,
      vat_rate: null,
      vat_amount: null,
      line_total,
      lot_number,
      expiration_date,
      matched_input_id: null,
      match_status: 'unmatched',
      confidence: 60,
    })
  }

  return items
}

// ─── Main parser ─────────────────────────────────────────────────────────────

export function parseInvoiceText(rawText: string): OcrInvoiceResult {
  const warnings: string[] = []
  const text = rawText

  // ── Supplier ─────────────────────────────────────────────────────────────
  const cuiMatch = text.match(CUI_PATTERN)
  const tax_id = cuiMatch ? `RO${cuiMatch[1]}` : null

  // Supplier name: usually the largest text block in the first ~20 lines
  let supplierName: string | null = null
  const topLines = text.split('\n').slice(0, 25).map(l => l.trim()).filter(l => l.length > 3)
  for (const line of topLines) {
    if (/^[A-ZĂÂÎȘȚ][A-ZĂÂÎȘȚ\s&.,\-–]{5,50}$/.test(line)) {
      supplierName = line
      break
    }
  }

  // Registration number
  let regNo: string | null = null
  const regMatch = text.match(/J\d{2}\/\d+\/\d{4}/)
  if (regMatch) regNo = regMatch[0]

  // ── Invoice header ────────────────────────────────────────────────────────
  const invNoMatch = text.match(INV_NO_PATTERN) ?? text.match(INV_NO_PATTERN2)
  const invoiceNumber = invNoMatch ? invNoMatch[1].trim() : null

  const dateMatch = text.match(DATE_PATTERN)
  let invoiceDate: string | null = null
  if (dateMatch) {
    invoiceDate = normalizeDate(dateMatch[1])
  } else {
    // Fallback: first date that looks like an invoice date in the header
    const fallbackDate = text.match(/(\d{1,2}[./]\d{1,2}[./]\d{4})/)
    if (fallbackDate) invoiceDate = normalizeDate(fallbackDate[1])
  }

  const totalMatch    = text.match(TOTAL_PATTERN)
  const vatMatch      = text.match(VAT_PATTERN)
  const subtotalMatch = text.match(SUBTOTAL_PATTERN)

  const total    = totalMatch    ? normalizeNumber(totalMatch[1])    : null
  const vat_total = vatMatch     ? normalizeNumber(vatMatch[1])      : null
  const subtotal  = subtotalMatch ? normalizeNumber(subtotalMatch[1]) : null

  // Detect currency
  const currency = /\bEUR\b/i.test(text) ? 'EUR' : /\bUSD\b/i.test(text) ? 'USD' : 'RON'

  // ── Items ─────────────────────────────────────────────────────────────────
  const items = extractLines(text)
  if (items.length === 0) warnings.push('Nu au putut fi extrase linii de produse.')

  // ── Validation ────────────────────────────────────────────────────────────
  let totals_match = true
  if (total !== null && items.length > 0) {
    const itemsSum = items.reduce((s, i) => s + (i.line_total ?? 0), 0)
    if (Math.abs(itemsSum - total) > 0.1) {
      totals_match = false
      warnings.push(`Suma liniilor (${itemsSum.toFixed(2)}) nu corespunde totalului facturii (${total.toFixed(2)}).`)
    }
  }
  if (!invoiceNumber) warnings.push('Numarul facturii nu a putut fi detectat.')
  if (!invoiceDate)   warnings.push('Data facturii nu a putut fi detectata.')
  if (!tax_id)        warnings.push('CUI-ul furnizorului nu a putut fi detectat.')

  return {
    supplier: { name: supplierName, tax_id, registration_number: regNo, address: null },
    invoice:  { number: invoiceNumber, date: invoiceDate, currency, subtotal, vat_total, total },
    items,
    validation: { totals_match, warnings },
    raw_text: rawText,
  }
}

// ─── Normalize for alias matching ────────────────────────────────────────────

export function normalizeProductName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Simple fuzzy match: ≥70% word overlap */
export function fuzzyMatch(a: string, b: string): number {
  const wa = new Set(normalizeProductName(a).split(' ').filter(w => w.length > 2))
  const wb = new Set(normalizeProductName(b).split(' ').filter(w => w.length > 2))
  if (wa.size === 0 || wb.size === 0) return 0
  let overlap = 0
  wa.forEach(w => { if (wb.has(w)) overlap++ })
  return overlap / Math.max(wa.size, wb.size)
}
