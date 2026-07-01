import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

// UK Trade Tariff API — same CN/HS codes as EU, reliable from edge
// TARIC 10-digit codes are looked up using the first 8 digits (CN level)
const UK_TARIFF_BASE = 'https://www.trade-tariff.service.gov.uk/api/v2'

function detectLevel(code: string): 'HS' | 'CN' | 'TARIC' | null {
  const clean = code.replace(/\s/g, '')
  if (clean.length === 6)  return 'HS'
  if (clean.length === 8)  return 'CN'
  if (clean.length === 10) return 'TARIC'
  return null
}

function normalizeCode(code: string): string {
  return code.replace(/[\s.]/g, '').trim()
}

// For UK API: 10-digit TARIC → use as-is; 6/8-digit → pad to 10 with zeros
function toUkLookupCode(code: string, level: 'HS' | 'CN' | 'TARIC'): string {
  if (level === 'HS')    return code + '0000'
  if (level === 'CN')    return code + '00'
  return code
}

interface UkCommodityResponse {
  data?: {
    attributes?: {
      description?: string
      formatted_description?: string
      validity_start_date?: string
      validity_end_date?: string | null
    }
  }
  errors?: Array<{ detail: string }>
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  }

  // Verify the token is actually valid
  const { createClient: createSupabase } = await import('@supabase/supabase-js')
  const supabase = createSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

  let body: { code?: string; reference_date?: string; language?: string } = {}
  try { body = await req.json() } catch { /* empty body */ }

  const raw = body.code ?? ''
  const code = normalizeCode(raw)
  const referenceDate = body.reference_date ?? new Date().toISOString().split('T')[0]

  if (!code) {
    return NextResponse.json({ error: 'Missing code' }, { status: 400 })
  }

  const level = detectLevel(code)
  if (!level) {
    return NextResponse.json({
      code,
      normalized_code: code,
      code_level: null,
      format_valid: false,
      exists_in_taric: false,
      valid_for_reference_date: false,
      description: null,
      message: 'Format invalid. Se acceptă 6 (HS), 8 (CN) sau 10 cifre (TARIC).',
    })
  }

  const lookupCode = toUkLookupCode(code, level)

  try {
    const url = `${UK_TARIFF_BASE}/commodities/${lookupCode}?as_of=${referenceDate}`
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json', 'User-Agent': 'ArendaPro/1.0' },
      signal: AbortSignal.timeout(8000),
    })

    if (res.status === 404) {
      return NextResponse.json({
        code,
        normalized_code: code,
        code_level: level,
        format_valid: true,
        exists_in_taric: false,
        valid_for_reference_date: false,
        description: null,
        message: 'Cod negăsit în nomenclatorul vamal pentru data specificată.',
      })
    }

    if (!res.ok) {
      throw new Error(`Tariff API returned ${res.status}`)
    }

    const data = await res.json() as UkCommodityResponse
    const attrs = data.data?.attributes
    const description = attrs?.formatted_description ?? attrs?.description ?? null
    const validFrom = attrs?.validity_start_date ?? null
    const validTo   = attrs?.validity_end_date ?? null

    const isValidForDate = (() => {
      const ref = new Date(referenceDate)
      if (validFrom && new Date(validFrom) > ref) return false
      if (validTo   && new Date(validTo)   < ref) return false
      return true
    })()

    return NextResponse.json({
      code,
      normalized_code: code,
      code_level: level,
      format_valid: true,
      exists_in_taric: true,
      valid_for_reference_date: isValidForDate,
      description,
      valid_from: validFrom,
      valid_to: validTo,
      message: isValidForDate
        ? 'Cod valid în nomenclatorul vamal pentru data specificată.'
        : 'Codul există dar nu este valid pentru data specificată.',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Verificare indisponibilă'
    return NextResponse.json({
      code,
      normalized_code: code,
      code_level: level,
      format_valid: true,
      exists_in_taric: null,
      valid_for_reference_date: null,
      description: null,
      message: `Verificare live indisponibilă (${message}). Codul a fost salvat fără confirmare externă.`,
      error: true,
    })
  }
}

