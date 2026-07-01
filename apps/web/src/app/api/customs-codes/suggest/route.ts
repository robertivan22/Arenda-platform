export const runtime = 'edge'

/**
 * GET /api/customs-codes/suggest?query=porumb&operation_type=national
 *
 * Deterministic search in customs_codes table.
 * No LLM. Scoring based on:
 *   - exact keyword match     → +0.40
 *   - substring match in desc → +0.30
 *   - alias match             → +0.25
 *   - chapter relevance       → +0.05
 *
 * Special rules for known ambiguous goods (porumb sămânță vs. porumb boabe).
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface Suggestion {
  code: string
  code_type: string
  description_ro: string
  description_en: string | null
  chapter: string | null
  source: string
  source_url: string
  confidence: number
  is_auto: boolean           // true if confidence >= 0.85 → can pre-fill
  requires_confirmation: boolean
  warning: string | null
}

// Keywords that signal "seed" variants
const SEED_SIGNALS    = ['samanta','sămânță','seminte','semințe','insamantare','însămânțare','seed']
// Keywords that signal "processed / canned"
const PROCESSED_SIGNALS = ['conservat','preparat','procesat','cutie','canned','liofilizat','tocat','macinat']

function normalize(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove diacritics
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function score(
  q: string,
  keywords_ro: string[],
  description_ro: string | null,
  baseConfidence: number,
): number {
  const qn = normalize(q)
  let s = baseConfidence

  // Exact keyword match
  if (keywords_ro.some(k => normalize(k) === qn)) s += 0.40
  // Keyword contains query
  else if (keywords_ro.some(k => normalize(k).includes(qn))) s += 0.30
  // Description contains query
  else if (description_ro && normalize(description_ro).includes(qn)) s += 0.20

  return Math.min(s, 1.0)
}

export async function GET(req: NextRequest) {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

  const url = new URL(req.url)
  const query = (url.searchParams.get('query') ?? '').trim()
  if (!query || query.length < 2) {
    return NextResponse.json({ query, suggestions: [] })
  }

  const qn = normalize(query)        // diacritics-free + lowercase
  const qLower = query.toLowerCase() // just lowercase (keep diacritics for ILIKE)
  const isSeed      = SEED_SIGNALS.some(s => qn.includes(normalize(s)))
  const isProcessed = PROCESSED_SIGNALS.some(s => qn.includes(normalize(s)))

  // ── Multi-variant search ──────────────────────────────────
  // 1. description ILIKE with original lowercase   → "grâu" matches "grâu dur"
  // 2. description ILIKE with normalized           → "grau" may match "Grau dur" 
  // 3. keywords array contains lowercase original  → array has exact 'grâu'
  // 4. keywords array contains normalized          → array has 'grau'
  // Both ilike variants are case-insensitive; both cs variants are exact-match.
  const orFilter = [
    `description_ro.ilike.%${qLower}%`,
    `description_ro.ilike.%${qn}%`,
    `keywords_ro.cs.{${qLower}}`,
    `keywords_ro.cs.{${qn}}`,
  ].join(',')

  const { data: rows } = await db
    .from('customs_codes')
    .select('id, code, code_type, description_ro, description_en, keywords_ro, chapter, heading, source, source_url, confidence_default')
    .eq('is_active', true)
    .or(orFilter)
    .limit(10)

  // Also search aliases (lowercase)
  const { data: aliasRows } = await db
    .from('customs_code_aliases')
    .select('customs_code_id, alias')
    .or(`alias.ilike.%${qLower}%,alias.ilike.%${qn}%`)
    .limit(10)

  // Collect all matching IDs
  const aliasIds = new Set((aliasRows ?? []).map((a: any) => a.customs_code_id as number))

  // Load customs_codes for alias matches not already in rows
  const matchedIds = new Set((rows ?? []).map((r: any) => r.id as number))
  const missingIds = [...aliasIds].filter(id => !matchedIds.has(id))
  let aliasCodeRows: any[] = []
  if (missingIds.length > 0) {
    const { data: extra } = await db
      .from('customs_codes')
      .select('id, code, code_type, description_ro, description_en, keywords_ro, chapter, heading, source, source_url, confidence_default')
      .in('id', missingIds)
      .eq('is_active', true)
    aliasCodeRows = extra ?? []
  }

  const allRows: any[] = [...(rows ?? []), ...aliasCodeRows]

  // ── Score + filter ────────────────────────────────────────
  const suggestions: Suggestion[] = allRows.map((r: any) => {
    const aliasBonus = aliasIds.has(r.id) ? 0.25 : 0
    let confidence = score(query, r.keywords_ro ?? [], r.description_ro, Number(r.confidence_default ?? 0.70)) + aliasBonus

    // Seed adjustment
    if (isSeed && r.code.endsWith('10')) confidence += 0.15
    if (isSeed && r.code.endsWith('90')) confidence -= 0.10
    if (!isSeed && r.code.endsWith('90')) confidence += 0.05

    confidence = Math.min(Math.max(confidence, 0.01), 1.0)

    let warning: string | null = null
    if (isProcessed) {
      warning = 'Produsul pare procesat/conservat. Verificați dacă nu aparține altui capitol tarifar.'
      confidence = Math.min(confidence, 0.70)  // cap confidence for processed goods
    }

    const is_auto = confidence >= 0.85
    return {
      code: r.code,
      code_type: r.code_type,
      description_ro: r.description_ro ?? '',
      description_en: r.description_en ?? null,
      chapter: r.chapter ?? null,
      source: r.source ?? 'EU TARIC',
      source_url: r.source_url ?? 'https://ec.europa.eu/taxation_customs/dds2/taric/taric_consultation.jsp?Lang=ro',
      confidence: Math.round(confidence * 100) / 100,
      is_auto,
      requires_confirmation: true, // ALWAYS require user confirmation
      warning,
    }
  })
  .sort((a, b) => b.confidence - a.confidence)
  .slice(0, 6)

  return NextResponse.json({ query, suggestions })
}
