import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

// EU TARIC public API — no API key required
const EU_TARIC_BASE = 'https://api.trade.ec.europa.eu/en/v1'

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

export async function POST(req: NextRequest) {
  let body: { code?: string; reference_date?: string; language?: string } = {}
  try { body = await req.json() } catch { /* empty body */ }

  const raw = body.code ?? ''
  const code = normalizeCode(raw)
  const language = body.language ?? 'EN'
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
      message: 'Invalid code format. Expected 6, 8, or 10 digits.',
    })
  }

  try {
    // Goods nomenclature lookup
    const url = `${EU_TARIC_BASE}/goods/nomenclatures/${code}?language=${language}&as_of=${referenceDate}`
    const res = await fetch(url, {
      headers: { 'Accept': 'application/json' },
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
        message: 'Code not found in TARIC for the specified date.',
      })
    }

    if (!res.ok) {
      throw new Error(`TARIC API returned ${res.status}`)
    }

    const data = await res.json() as {
      goodsNomenclature?: { description?: string; validityStartDate?: string; validityEndDate?: string }
      description?: string
      validityStartDate?: string
      validityEndDate?: string
    }

    // Handle both flat and nested response shapes
    const entry = data.goodsNomenclature ?? data
    const description = entry.description ?? null
    const validFrom = entry.validityStartDate ?? null
    const validTo = entry.validityEndDate ?? null

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
        ? 'Code is valid in TARIC for the reference date.'
        : 'Code exists but is not valid for the reference date.',
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'TARIC lookup failed'
    // Return a graceful degraded response — still useful for UI
    return NextResponse.json({
      code,
      normalized_code: code,
      code_level: level,
      format_valid: true,
      exists_in_taric: null,
      valid_for_reference_date: null,
      description: null,
      message: `TARIC verification unavailable: ${message}`,
      error: true,
    })
  }
}
