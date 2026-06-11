import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { chat, safeParseJSON } from '@/lib/groq'
import { SYSTEM_PROMPT, buildPrompt } from '@/lib/ai/prompts'
import { MOCK_FARM_DATA } from '@/lib/ai/mock-data'
import { createClient } from '@supabase/supabase-js'
import type { AssistantResponse, AnalysisResult } from '@/lib/ai/types'

export const runtime = 'edge'

// â”€â”€â”€ Request schema â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const RequestSchema = z.object({
  mode: z.enum(['full_analysis', 'qa']),
  question: z.string().optional(),
  context: z.record(z.unknown()).optional(),
})

// â”€â”€â”€ Fetch ALL live data from Supabase â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function fetchLiveData() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return MOCK_FARM_DATA

  const db = createClient(url, key)
  const today = new Date().toISOString().split('T')[0]
  const yearStart = `${new Date().getFullYear()}-01-01`

  const [contractsRes, ordersRes, stockRes, machinesRes, maintenanceRes, invoicesRes, transactionsRes] = await Promise.all([
    db.from('contracts').select('contract_number, end_date, status, lessors(first_name, last_name, company_name)').limit(50),
    db.from('work_orders').select('operation_type, status, planned_date, execution_date, parcels(bloc_fizic)').gte('planned_date', yearStart).order('planned_date').limit(40),
    db.from('input_lots').select('product_name, category, quantity_available, quantity, unit, expiry_date').order('category').limit(60),
    db.from('machines').select('*').order('name').limit(30),
    db.from('maintenance_tasks').select('title, type, due_date, status, machine_id').in('status', ['PLANIFICAT', 'IN_EXECUTIE']).order('due_date').limit(20),
    db.from('invoices').select('invoice_number, total_amount, status, due_date').order('due_date', { ascending: true, nullsFirst: false }).limit(30),
    db.from('transactions').select('ron_net, is_paid, campaign_year, product_name, lessors(company_name, first_name, last_name, type)').gte('transaction_date', yearStart).order('transaction_date', { ascending: false }).limit(60),
  ])

  const _errors: string[] = []
  if (contractsRes.error) _errors.push(`Contracte: ${contractsRes.error.message}`)
  if (ordersRes.error) _errors.push(`Activitati: ${ordersRes.error.message}`)
  if (stockRes.error) _errors.push(`Stocuri: ${stockRes.error.message}`)
  if (machinesRes.error) _errors.push(`Utilaje: ${machinesRes.error.message}`)
  if (invoicesRes.error) _errors.push(`Facturi: ${invoicesRes.error.message}`)
  if (maintenanceRes.error) _errors.push(`Mentenanta: ${maintenanceRes.error.message}`)
  if (transactionsRes.error) _errors.push(`Tranzactii: ${transactionsRes.error.message}`)

  console.log('[AI]', { c: contractsRes.data?.length, o: ordersRes.data?.length, s: stockRes.data?.length, m: machinesRes.data?.length, f: invoicesRes.data?.length, tx: transactionsRes.data?.length })

  const today_d = new Date(today)

  const contracts = (contractsRes.data ?? []).map((c: any) => {
    const l = c.lessors
    const arendas = l ? (l.company_name ?? `${l.last_name ?? ''} ${l.first_name ?? ''}`.trim()) : ''
    const zile = c.end_date ? Math.round((new Date(c.end_date).getTime() - today_d.getTime()) / 86400000) : null
    return { nr: c.contract_number, arendas, status: c.status, exp: c.end_date, zile }
  })

  return {
    azi: today,
    contracte: contracts,
    activitati: (ordersRes.data ?? [])
      .filter((o: any) => o.status !== 'DONE' && o.status !== 'COMPLETED')
      .map((o: any) => ({ op: o.operation_type, parc: o.parcels?.bloc_fizic ?? null, st: o.status, plan: o.planned_date, exec: o.execution_date })),
    stocuri: (stockRes.data ?? []).map((s: any) => ({ prod: s.product_name, cat: s.category, disp: s.quantity_available, ini: s.quantity, unit: s.unit, exp: s.expiry_date })),
    utilaje: (machinesRes.data ?? []).map((m: any) => {
      const rcaExp = m.rca_expiry_date ? new Date(m.rca_expiry_date) : null
      const rcaZile = rcaExp ? Math.round((rcaExp.getTime() - today_d.getTime()) / 86400000) : null
      const rca = !rcaExp ? 'NECUNOSCUT' : rcaZile! < 0 ? 'EXPIRAT' : rcaZile! <= 30 ? 'EXPIRA_CURAND' : rcaZile! <= 60 ? 'ATENTIE' : 'OK'
      return { utilaj: m.name, tip: m.type, rca, rca_zile: rcaZile, rca_data: m.rca_expiry_date }
    }),
    mentenanta: (() => {
      const mMap: Record<string, string> = {}
      for (const m of machinesRes.data ?? []) mMap[(m as any).id] = (m as any).name
      return (maintenanceRes.data ?? []).map((t: any) => ({ masina: mMap[t.machine_id] ?? t.machine_id, titlu: t.title, tip: t.type, scad: t.due_date, st: t.status }))
    })(),
    tranzactii: (transactionsRes.data ?? []).map((t: any) => {
      const l = t.lessors
      const lessor = l ? (l.type === 'LEGAL' ? l.company_name : `${l.last_name ?? ''} ${l.first_name ?? ''}`.trim()) : ''
      return { lessor, ron: t.ron_net, prod: t.product_name, an: t.campaign_year, paid: t.is_paid }
    }),
    facturi: (invoicesRes.data ?? []).map((i: any) => {
      const due = i.due_date ? new Date(i.due_date) : null
      const dep = due ? Math.round((today_d.getTime() - due.getTime()) / 86400000) : null
      const unpaid = i.status !== 'PAID' && i.status !== 'PLATITA'
      return { nr: i.invoice_number, suma: i.total_amount, st: i.status, scad: i.due_date, unpaid, dep: dep && dep > 0 ? dep : 0 }
    }).filter((i: any) => i.unpaid),
    _errors,
  }
}

// â”€â”€â”€ POST /api/assistant â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function POST(req: NextRequest): Promise<NextResponse<AssistantResponse>> {
  try {
    const body = await req.json()
    const parsed = RequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ ok: false, mode: 'full_analysis', error: 'Cerere invalida.' }, { status: 400 })
    }

    const { mode, question, context } = parsed.data
    const rawData: any = context ?? await fetchLiveData()
    const queryErrors: string[] = rawData._errors ?? []
    delete rawData._errors
    const userPrompt = buildPrompt(mode, rawData, question)

    const { text, model, tokens } = await chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { json: mode !== 'qa', temperature: mode === 'qa' ? 0.4 : 0.15, max_tokens: 4000 }
    )

    if (mode === 'qa') {
      return NextResponse.json({ ok: true, mode, answer: text, model, tokens_used: tokens })
    }

    const result = safeParseJSON<AnalysisResult>(text)
    if (!result) {
      return NextResponse.json({ ok: false, mode, error: 'Raspuns AI invalid (nu e JSON).', model }, { status: 500 })
    }

    result.generat_la = result.generat_la || new Date().toISOString()
    // Ensure all arrays exist
    result.contracte ??= []
    result.ferma ??= []
    result.stocuri ??= []
    result.utilaje ??= []
    result.facturi ??= []
    result.tranzactii ??= []

    return NextResponse.json({ ok: true, mode, result, model, tokens_used: tokens, data_errors: queryErrors.length > 0 ? queryErrors : undefined })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Eroare necunoscuta.'
    return NextResponse.json({ ok: false, mode: 'full_analysis', error: message }, { status: 500 })
  }
}

