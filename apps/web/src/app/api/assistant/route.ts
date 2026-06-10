import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { chat, safeParseJSON } from '@/lib/groq'
import { SYSTEM_PROMPT, buildPrompt } from '@/lib/ai/prompts'
import { MOCK_FARM_DATA } from '@/lib/ai/mock-data'
import { createClient } from '@supabase/supabase-js'
import type { AssistantResponse, AnalysisResult } from '@/lib/ai/types'

export const runtime = 'edge'

// ─── Request schema ───────────────────────────────────────────────────────────

const RequestSchema = z.object({
  mode: z.enum(['full_analysis', 'contract_alerts', 'farm_alerts', 'inventory_alerts', 'qa']),
  question: z.string().optional(),
  context: z.record(z.unknown()).optional(),
})

// ─── Fetch live data from Supabase (server-side, uses service role key) ───────

async function fetchLiveData(mode: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return MOCK_FARM_DATA

  const db = createClient(url, key)
  const today = new Date().toISOString().split('T')[0]

  const [contractsRes, ordersRes, stockRes, txnRes] = await Promise.all([
    db.from('contracts')
      .select('id, contract_number, sign_date, end_date, status, lessors(first_name, last_name, company_name)')
      .limit(50),
    mode === 'contract_alerts' ? { data: [], error: null } :
      db.from('work_orders')
        .select('id, operation_type, status, planned_date, execution_date, area_ha, parcels(bloc_fizic)')
        .gte('planned_date', `${new Date().getFullYear()}-01-01`)
        .order('planned_date')
        .limit(50),
    mode === 'contract_alerts' ? { data: [], error: null } :
      db.from('input_lots')
        .select('product_name, category, quantity_available, quantity, unit, unit_price, expiry_date')
        .order('category')
        .limit(50),
    db.from('transactions')
      .select('ron_net, is_paid')
      .gte('transaction_date', `${new Date().getFullYear()}-01-01`)
      .limit(500),
  ])

  const txns = txnRes.data ?? []
  const totalNet = txns.reduce((s: number, t: any) => s + Number(t.ron_net ?? 0), 0)
  const unpaidNet = txns.filter((t: any) => !t.is_paid).reduce((s: number, t: any) => s + Number(t.ron_net ?? 0), 0)
  const paid = txns.filter((t: any) => t.is_paid).length
  const rataAchitare = txns.length > 0 ? Math.round((paid / txns.length) * 100) : 0

  // Enrich contracts with days_until_expiry
  const contracte = (contractsRes.data ?? []).map((c: any) => {
    const lessor = c.lessors
    const lessorName = lessor
      ? (lessor.company_name ?? `${lessor.last_name} ${lessor.first_name}`.trim())
      : '—'
    const endDate = c.end_date
    const daysLeft = endDate
      ? Math.round((new Date(endDate).getTime() - new Date(today).getTime()) / 86400000)
      : null
    return { ...c, lessor_name: lessorName, days_until_expiry: daysLeft }
  })

  return {
    generatedAt: new Date().toISOString(),
    farm: { total_ha: null, campaign_year: new Date().getFullYear() },
    contracte,
    activitati: (ordersRes.data ?? []).map((o: any) => ({
      operatie: o.operation_type,
      parcela: o.parcels?.bloc_fizic ?? null,
      suprafata_ha: o.area_ha,
      status: o.status,
      data_planificata: o.planned_date,
      data_executie: o.execution_date,
    })),
    stocuri: (stockRes.data ?? []).map((s: any) => ({
      produs: s.product_name,
      categorie: s.category,
      cantitate_disponibila: s.quantity_available,
      cantitate_initiala: s.quantity,
      unitate: s.unit,
      pret_unitar: s.unit_price,
      data_expirare: s.expiry_date,
    })),
    tranzactii: {
      total_ron_net: totalNet,
      neplatit_ron: unpaidNet,
      rata_achitare_pct: rataAchitare,
    },
  }
}

// ─── POST /api/assistant ──────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse<AssistantResponse>> {
  try {
    const body = await req.json()
    const parsed = RequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ ok: false, mode: 'qa', error: 'Cerere invalidă.' }, { status: 400 })
    }

    const { mode, question, context } = parsed.data

    // For qa mode with no DB context, use provided context or mock
    const data = context ?? await fetchLiveData(mode)

    const userPrompt = buildPrompt(mode, data, question)

    const { text, model, tokens } = await chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { json: mode !== 'qa', temperature: mode === 'qa' ? 0.4 : 0.15 }
    )

    if (mode === 'qa') {
      return NextResponse.json({ ok: true, mode, answer: text, model, tokens_used: tokens })
    }

    const result = safeParseJSON<AnalysisResult>(text)
    if (!result) {
      return NextResponse.json({ ok: false, mode, error: 'Răspuns AI invalid (nu e JSON).', model }, { status: 500 })
    }

    result.generat_la = result.generat_la || new Date().toISOString()

    return NextResponse.json({ ok: true, mode, result, model, tokens_used: tokens })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Eroare necunoscută.'
    return NextResponse.json({ ok: false, mode: 'full_analysis', error: message }, { status: 500 })
  }
}
