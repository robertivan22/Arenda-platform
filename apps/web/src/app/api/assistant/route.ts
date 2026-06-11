import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { chat, safeParseJSON } from '@/lib/groq'
import { SYSTEM_PROMPT, buildPrompt } from '@/lib/ai/prompts'
import { createClient as createSupabaseServerClient } from '@/lib/supabase/server'
import type { AssistantResponse, AnalysisResult, UtilajeAlert, TranzactieAlert } from '@/lib/ai/types'

export const runtime = 'edge'

// â”€â”€â”€ Request schema â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const RequestSchema = z.object({
  mode: z.enum(['full_analysis', 'qa']),
  question: z.string().optional(),
  context: z.record(z.unknown()).optional(),
})

// ─── Server-side alert computers (no AI hallucination possible) ───────────────

function computeUtilajeAlerts(machines: any[], maintenance: any[], today_d: Date): UtilajeAlert[] {
  return machines.map((m: any) => {
    const rcaExp = m.rca_expiry_date ? new Date(m.rca_expiry_date) : null
    const rcaZile = rcaExp ? Math.round((rcaExp.getTime() - today_d.getTime()) / 86400000) : null
    const rcaSt = !rcaExp ? 'NECUNOSCUT' : rcaZile! < 0 ? 'EXPIRAT' : rcaZile! <= 30 ? 'EXPIRA_CURAND' : rcaZile! <= 60 ? 'ATENTIE' : 'OK'
    const tasks = maintenance.filter((t: any) => t.machine_id === m.id)
    const nextTask = tasks[0]
    const mentenantaPending = nextTask ? `${nextTask.title}(${nextTask.type},${nextTask.due_date})` : null
    const taskZile = nextTask?.due_date ? Math.round((new Date(nextTask.due_date).getTime() - today_d.getTime()) / 86400000) : null
    let status: 'critic' | 'atentie' | 'ok' | 'necunoscut' = 'ok'
    let priority: 'inalta' | 'medie' | 'scazuta' = 'scazuta'
    if (rcaSt === 'EXPIRAT') { status = 'critic'; priority = 'inalta' }
    else if (rcaSt === 'EXPIRA_CURAND') { status = 'atentie'; priority = 'inalta' }
    else if (rcaSt === 'ATENTIE') { status = 'atentie'; priority = 'medie' }
    else if (rcaSt === 'NECUNOSCUT') { status = 'necunoscut'; priority = 'medie' }
    if (taskZile !== null && taskZile <= 0 && priority !== 'inalta') priority = 'inalta'
    else if (taskZile !== null && taskZile <= 14 && priority === 'scazuta') priority = 'medie'
    let mesaj = `${m.name} (${m.type})`
    if (rcaSt === 'EXPIRAT') mesaj += ` — RCA expirat cu ${Math.abs(rcaZile!)} zile in urma (${m.rca_expiry_date})`
    else if (rcaSt === 'EXPIRA_CURAND') mesaj += ` — RCA expira in ${rcaZile} zile (${m.rca_expiry_date})`
    else if (rcaSt === 'ATENTIE') mesaj += ` — RCA expira in ${rcaZile} zile`
    else if (rcaSt === 'NECUNOSCUT') mesaj += ' — data expirare RCA necunoscuta'
    else mesaj += ` — RCA valid pana la ${m.rca_expiry_date}`
    if (nextTask && taskZile !== null) mesaj += taskZile <= 0 ? `. Service "${nextTask.title}" intarziat` : `. Service "${nextTask.title}" in ${taskZile} zile`
    const actiune = rcaSt === 'EXPIRAT' ? 'Reinnoiti RCA imediat — utilajul nu poate circula legal'
      : rcaSt === 'EXPIRA_CURAND' ? `Programati reinnoirea RCA (expira ${m.rca_expiry_date})`
      : rcaSt === 'NECUNOSCUT' ? 'Adaugati data de expirare RCA in sistemul de evidenta'
      : nextTask && taskZile !== null && taskZile <= 14 ? `Programati service-ul: ${nextTask.title} (${nextTask.type})`
      : 'Verificati documentele periodic'
    return { utilaj: m.name, tip: m.type, status, priority, rca_expiry: m.rca_expiry_date ?? null, mentenanta_pending: mentenantaPending, mesaj, actiune_recomandata: actiune }
  })
}

function computeTranzactiiAlerts(transactions: any[]): TranzactieAlert[] {
  return transactions
    .filter((t: any) => t.is_paid !== true)
    .map((t: any) => {
    const l = t.lessors
    const lessor = l ? (l.type === 'LEGAL' ? l.company_name : `${l.last_name ?? ''} ${l.first_name ?? ''}`.trim()) : ''
    const suma = Number(t.ron_net ?? 0)
    const priority: 'inalta' | 'medie' | 'scazuta' = suma > 1000 ? 'inalta' : suma > 200 ? 'medie' : 'scazuta'
    return {
      lessor_name: lessor,
      status: 'neplatita' as const,
      priority,
      suma_ron: suma,
      campanie: t.campaign_year ?? 0,
      produs: t.product_name ?? '',
      mesaj: `Tranzactie neplatita: ${t.product_name ?? '?'} ${suma.toFixed(2)} RON — ${lessor || 'arendator necunoscut'}`,
      actiune_recomandata: suma > 500 ? 'Contactati arendatorul si regularizati plata urgent' : 'Efectuati plata conform contractului',
    }
  })
}

// ─── Fetch ALL live data from Supabase ────────────────────────────────────────
// Uses the user's authenticated session (cookies) — no service role key needed.
// RLS applies: user sees only their own data.

async function fetchLiveData() {
  const db = await createSupabaseServerClient()
  const today = new Date().toISOString().split('T')[0]
  const yearStart = `${new Date().getFullYear()}-01-01`

  const [contractsRes, ordersRes, stockRes, machinesRes, maintenanceRes, txBaseRes] = await Promise.all([
    db.from('contracts').select('contract_number, end_date, status, lessors(first_name, last_name, company_name)').limit(50),
    db.from('work_orders').select('operation_type, status, planned_date, parcels(bloc_fizic)').gte('planned_date', yearStart).order('planned_date').limit(40),
    db.from('input_lots').select('product_name, category, quantity_available, quantity, unit, expiry_date').order('category').limit(60),
    db.from('machines').select('*').order('name').limit(30),
    db.from('maintenance_tasks').select('title, type, due_date, status, machine_id').in('status', ['PLANIFICAT', 'IN_EXECUTIE']).order('due_date').limit(20),
    db.from('transactions').select('id, lessor_id, ron_net, is_paid, campaign_year, product_name').order('transaction_date', { ascending: false }).limit(100),
  ])

  // Fetch lessors separately — avoids ambiguous PostgREST join on transactions
  const _lessorIds = [...new Set((txBaseRes.data ?? []).map((t: any) => t.lessor_id).filter(Boolean))]
  const lessorRes = _lessorIds.length > 0
    ? await db.from('lessors').select('id, company_name, first_name, last_name, type').in('id', _lessorIds as string[])
    : { data: [] as any[], error: null }
  const _lessorMap: Record<string, any> = Object.fromEntries(
    (lessorRes.data ?? []).map((l: any) => [l.id, l])
  )
  const _transactions_raw = (txBaseRes.data ?? []).map((t: any) => ({
    ...t,
    lessors: t.lessor_id ? (_lessorMap[t.lessor_id] ?? null) : null,
  }))

  const _errors: string[] = []
  if (contractsRes.error) _errors.push(`Contracte: ${contractsRes.error.message}`)
  if (ordersRes.error) _errors.push(`Activitati: ${ordersRes.error.message}`)
  if (stockRes.error) _errors.push(`Stocuri: ${stockRes.error.message}`)
  if (machinesRes.error) _errors.push(`Utilaje: ${machinesRes.error.message}`)
  if (maintenanceRes.error) _errors.push(`Mentenanta: ${maintenanceRes.error.message}`)
  if (txBaseRes.error) _errors.push(`Tranzactii: ${txBaseRes.error.message}`)
  if (lessorRes.error) _errors.push(`Arendatori: ${lessorRes.error.message}`)

  console.log('[AI]', { c: contractsRes.data?.length, o: ordersRes.data?.length, s: stockRes.data?.length, m: machinesRes.data?.length, tx: txBaseRes.data?.length, lessors: lessorRes.data?.length })

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
    _machines_raw: machinesRes.data ?? [],
    _maintenance_raw: maintenanceRes.data ?? [],
    _transactions_raw,
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
    const today_d_post = new Date()
    const serverUtilaje = computeUtilajeAlerts(rawData._machines_raw ?? [], rawData._maintenance_raw ?? [], today_d_post)
    const serverTranzactii = computeTranzactiiAlerts(rawData._transactions_raw ?? [])
    // Build AI prompt data without internal raw arrays
    const { _machines_raw: _m, _maintenance_raw: _mt, _transactions_raw: _tx, _errors: _e, ...aiData } = rawData
    const promptData = {
      ...aiData,
      utilaje_risc: serverUtilaje.filter(u => u.priority === 'inalta').map(u => u.mesaj).join('; ') || 'toate OK',
      tranzactii_risc: serverTranzactii.length > 0 ? `${serverTranzactii.length} neplatite total ${serverTranzactii.reduce((s, t) => s + t.suma_ron, 0).toFixed(0)} RON` : 'toate platite',
    }
    const userPrompt = buildPrompt(mode, promptData, question)

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

    result.generat_la = new Date().toISOString()  // always server time, never trust AI date
    result.contracte ??= []
    result.ferma ??= []
    result.stocuri ??= []
    result.actiuni ??= []
    result.insights ??= []
    result.utilaje = serverUtilaje
    result.tranzactii = serverTranzactii

    return NextResponse.json({ ok: true, mode, result, model, tokens_used: tokens, data_errors: queryErrors.length > 0 ? queryErrors : undefined, _debug: { machines: rawData._machines_raw?.length ?? 0, transactions: rawData._transactions_raw?.length ?? 0 } })
  } catch (err: unknown) {
    const e = err as any
    const is429 = e?.status === 429 || (err instanceof Error && (err.message.includes('rate_limit') || err.message.includes('Rate limit') || err.message.includes('429')))
    if (is429) {
    const errMsg = err instanceof Error ? err.message : ''
    const minSecMatch = errMsg.match(/try again in (\d+)m(\d+\.?\d*)s/)
    const secOnlyMatch = errMsg.match(/try again in (\d+\.?\d*)s/)
    const retryAfterSecs = minSecMatch
      ? Math.ceil(Number(minSecMatch[1]) * 60 + Number(minSecMatch[2]))
      : secOnlyMatch ? Math.ceil(Number(secOnlyMatch[1])) : 60
      return NextResponse.json({ ok: false, mode: 'full_analysis', rateLimited: true, retryAfterSecs })
    }
    const message = err instanceof Error ? err.message : 'Eroare necunoscuta.'
    return NextResponse.json({ ok: false, mode: 'full_analysis', error: message }, { status: 500 })
  }
}

