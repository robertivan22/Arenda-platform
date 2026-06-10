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

  const [
    contractsRes,
    ordersRes,
    stockRes,
    txnRes,
    machinesRes,
    maintenanceRes,
    invoicesRes,
    fitosanitarRes,
    apiaRes,
    lessorsRes,
    parcelsRes,
    cropPlansRes,
    harvestRes,
    fuelRes,
  ] = await Promise.all([
    // Contracte
    db.from('contracts')
      .select('id, contract_number, sign_date, end_date, status, lessors(first_name, last_name, company_name), parcels(surface)')
      .limit(100),

    // Ordine de lucru (monitorizare ferma)
    db.from('work_orders')
      .select('id, operation_type, status, planned_date, execution_date, area_ha, parcels(bloc_fizic, surface)')
      .gte('planned_date', yearStart)
      .order('planned_date')
      .limit(100),

    // Stocuri
    db.from('input_lots')
      .select('product_name, category, quantity_available, quantity, unit, unit_price, expiry_date, received_date')
      .order('category')
      .limit(100),

    // Tranzactii
    db.from('transactions')
      .select('ron_net, is_paid, transaction_date')
      .gte('transaction_date', yearStart)
      .limit(500),

    // Utilaje
    db.from('machines')
      .select('*')
      .order('name')
      .limit(50),

    // Sarcini de mentenanta
    db.from('maintenance_tasks')
      .select('title, due_date, status, machine_id, priority')
      .in('status', ['PENDING', 'OVERDUE'])
      .order('due_date')
      .limit(30),

    // Facturi
    db.from('invoices')
      .select('*')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(50),

    // Registru fitosanitar
    db.from('registru_fitosanitar')
      .select('*')
      .gte('created_at', new Date(Date.now() - 90 * 86400_000).toISOString())
      .order('created_at', { ascending: false })
      .limit(50),

    // Dosare APIA
    db.from('apia_dossiers')
      .select('campaign_year, status, total_declared_ha, total_eligible_ha, submission_date, correction_deadline')
      .order('campaign_year', { ascending: false })
      .limit(5),

    // Arendasi
    db.from('lessors')
      .select('id, first_name, last_name, company_name, is_active')
      .limit(200),

    // Parcele
    db.from('parcels')
      .select('id, bloc_fizic, surface, status, culture')
      .eq('status', 'ACTIVE')
      .limit(200),

    // Planuri cultura
    db.from('crop_plans')
      .select('culture, total_ha, status, campaign_id')
      .limit(50),

    // Recolte
    db.from('harvest_lots')
      .select('culture, total_quantity, unit, campaign_id')
      .limit(50),

    // Consum carburant
    db.from('fuel_logs')
      .select('quantity, fuel_type, log_date, machine_id')
      .gte('log_date', yearStart)
      .limit(100),
  ])

  // Log query results for debugging
  console.log('[AI] Query results:', {
    contracts: contractsRes.data?.length ?? `ERR:${contractsRes.error?.message}`,
    orders: ordersRes.data?.length ?? `ERR:${ordersRes.error?.message}`,
    stock: stockRes.data?.length ?? `ERR:${stockRes.error?.message}`,
    machines: machinesRes.data?.length ?? `ERR:${machinesRes.error?.message}`,
    invoices: invoicesRes.data?.length ?? `ERR:${invoicesRes.error?.message}`,
    apia: apiaRes.data?.length ?? `ERR:${apiaRes.error?.message}`,
    fitosanitar: fitosanitarRes.data?.length ?? `ERR:${fitosanitarRes.error?.message}`,
  })

  const txns = txnRes.data ?? []
  const totalNet = txns.reduce((s: number, t: any) => s + Number(t.ron_net ?? 0), 0)
  const unpaidNet = txns.filter((t: any) => !t.is_paid).reduce((s: number, t: any) => s + Number(t.ron_net ?? 0), 0)
  const paidCount = txns.filter((t: any) => t.is_paid).length
  const rataAchitare = txns.length > 0 ? Math.round((paidCount / txns.length) * 100) : 0

  const contracts = (contractsRes.data ?? []).map((c: any) => {
    const lessor = c.lessors
    const lessorName = lessor
      ? (lessor.company_name ?? `${lessor.last_name ?? ''} ${lessor.first_name ?? ''}`.trim())
      : 'N/A'
    const daysLeft = c.end_date
      ? Math.round((new Date(c.end_date).getTime() - new Date(today).getTime()) / 86400000)
      : null
    const suprafata = Array.isArray(c.parcels)
      ? c.parcels.reduce((sum: number, p: any) => sum + Number(p.surface ?? 0), 0)
      : null
    return { contract_number: c.contract_number, lessor_name: lessorName, status: c.status, end_date: c.end_date, days_until_expiry: daysLeft, suprafata_ha: suprafata }
  })

  const parcels = parcelsRes.data ?? []
  const totalHa = parcels.reduce((s: number, p: any) => s + Number(p.surface ?? 0), 0)

  const fuelLogs = fuelRes.data ?? []
  const totalFuel = fuelLogs.reduce((s: number, f: any) => s + Number(f.quantity ?? 0), 0)

  const lessors = lessorsRes.data ?? []

  return {
    generat_la: new Date().toISOString(),
    ferma: {
      total_parcele: parcels.length,
      total_ha: Math.round(totalHa * 100) / 100,
      an_campanie: new Date().getFullYear(),
      planuri_cultura: (cropPlansRes.data ?? []),
      recolte: (harvestRes.data ?? []),
      consum_carburant_litri_an: Math.round(totalFuel),
    },
    contracte: contracts,
    activitati_ferma: (ordersRes.data ?? []).map((o: any) => ({
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
    utilaje: (machinesRes.data ?? []).map((m: any) => {
      const rcaExpiry = m.rca_expiry_date ? new Date(m.rca_expiry_date) : null
      const rcaDaysLeft = rcaExpiry
        ? Math.round((rcaExpiry.getTime() - new Date(today).getTime()) / 86400000)
        : null
      const rcaStatus = !rcaExpiry ? 'NECUNOSCUT'
        : rcaDaysLeft! < 0 ? 'EXPIRAT'
        : rcaDaysLeft! <= 30 ? 'EXPIRA_CURAND'
        : rcaDaysLeft! <= 60 ? 'ATENTIE'
        : 'OK'
      return {
        nume: m.name,
        tip: m.type,
        marca: m.brand,
        model: m.model,
        an: m.year,
        numar_inmatriculare: m.plate,
        activ: m.is_active,
        rca_activ: m.rca_active,
        rca_pret: m.rca_price,
        rca_expira: m.rca_expiry_date,
        rca_status: rcaStatus,
        rca_zile_ramase: rcaDaysLeft,
      }
    }),
    sarcini_mentenanta: (maintenanceRes.data ?? []),
    facturi: (invoicesRes.data ?? []).map((i: any) => {
      const dueDate = i.due_date ? new Date(i.due_date) : null
      const daysOverdue = dueDate
        ? Math.round((new Date(today).getTime() - dueDate.getTime()) / 86400000)
        : null
      const isUnpaid = i.status !== 'PAID' && i.status !== 'PLATITA'
      return {
        numar: i.invoice_number,
        total: i.total_amount,
        status: i.status,
        data_emitere: i.issue_date,
        scadenta: i.due_date,
        efactura_status: i.efactura_status,
        neplatita: isUnpaid,
        zile_depasit: daysOverdue && daysOverdue > 0 ? daysOverdue : 0,
        scadenta_depasita: daysOverdue !== null && daysOverdue > 0 && isUnpaid,
      }
    }),
    fitosanitar_recent: (fitosanitarRes.data ?? []),
    apia: (apiaRes.data ?? []),
    arendasi: {
      total: lessors.length,
      activi: lessors.filter((l: any) => l.is_active !== false).length,
    },
    tranzactii: {
      total_ron_net: Math.round(totalNet),
      neplatit_ron: Math.round(unpaidNet),
      rata_achitare_pct: rataAchitare,
      total_tranzactii: txns.length,
    },
  }
}

// â”€â”€â”€ POST /api/assistant â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function POST(req: NextRequest): Promise<NextResponse<AssistantResponse>> {
  try {
    const body = await req.json()
    const parsed = RequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ ok: false, mode: 'full_analysis', error: 'Cerere invalidÄƒ.' }, { status: 400 })
    }

    const { mode, question, context } = parsed.data
    const data = context ?? await fetchLiveData()
    const userPrompt = buildPrompt(mode, data, question)

    const { text, model, tokens } = await chat(
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      { json: mode !== 'qa', temperature: mode === 'qa' ? 0.4 : 0.15, max_tokens: 6000 }
    )

    if (mode === 'qa') {
      return NextResponse.json({ ok: true, mode, answer: text, model, tokens_used: tokens })
    }

    const result = safeParseJSON<AnalysisResult>(text)
    if (!result) {
      return NextResponse.json({ ok: false, mode, error: 'RÄƒspuns AI invalid (nu e JSON).', model }, { status: 500 })
    }

    result.generat_la = result.generat_la || new Date().toISOString()
    // Ensure all arrays exist
    result.contracte ??= []
    result.ferma ??= []
    result.stocuri ??= []
    result.utilaje ??= []
    result.facturi ??= []
    result.apia ??= []
    result.fitosanitar ??= []
    result.arendasi_sumar ??= { total: 0, total_suprafata_ha: 0 }

    return NextResponse.json({ ok: true, mode, result, model, tokens_used: tokens })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Eroare necunoscutÄƒ.'
    return NextResponse.json({ ok: false, mode: 'full_analysis', error: message }, { status: 500 })
  }
}

