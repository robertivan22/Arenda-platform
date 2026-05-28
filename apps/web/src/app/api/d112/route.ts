import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'

const LEGAL_BASIS = 'art.84 CF - cedarea folosintei bunurilor, impozit 10% retinut la sursa'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  }
  const token = authHeader.slice(7)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  }

  let rawBody: unknown
  try { rawBody = await req.json() } catch {
    return NextResponse.json({ error: 'Body JSON invalid' }, { status: 400 })
  }
  const year  = Number((rawBody as any)?.year)
  const month = Number((rawBody as any)?.month)
  if (!Number.isInteger(year) || year < 2000 || year > 2100 ||
      !Number.isInteger(month) || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Parametrii invalizi: year (2000-2100), month (1-12)' }, { status: 400 })
  }

  const periodFrom = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const periodTo = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

  const applicabilityNotes = [
    `Perioada: ${String(month).padStart(2, '0')}/${year}`,
    LEGAL_BASIS,
    'DRAFT - necesita validare contabil inainte de depunere.',
  ]

  // Query transactions for the period — only definitive rows with tax applied
  const { data: txData, error: txError } = await supabase
    .from('transactions')
    .select('id, lessor_id, contract_id, ron_brut, ron_net, tax_amount, payment_type, transaction_date')
    .eq('user_id', user.id)
    .eq('is_previzionata', false)
    .eq('impozit_aplicat', true)
    .gte('transaction_date', periodFrom)
    .lte('transaction_date', periodTo)

  if (txError) {
    return NextResponse.json({ error: 'Eroare interogare tranzactii: ' + txError.message }, { status: 500 })
  }

  const transactions = txData ?? []

  if (transactions.length === 0) {
    return NextResponse.json({
      dataset: {
        periodYear: year, periodMonth: month, rows: [],
        totalGrossRon: 0, totalWithholdingTaxRon: 0,
        rowsWithWarnings: 0, rowsIncomplete: 0,
        applicabilityNotes: [
          ...applicabilityNotes,
          `Nu exista tranzactii cu impozit inregistrate in ${String(month).padStart(2, '0')}/${year}.`,
        ],
        warnings: [], generatedAt: new Date().toISOString(), status: 'DRAFT', requiresAccountantReview: true,
      },
    })
  }

  // Fetch lessors for joined name/CNP display
  const lessorIds = [...new Set(transactions.map((t: any) => t.lessor_id).filter(Boolean))]
  const lessorMap = new Map<string, { cnp: string; first_name: string; last_name: string }>()
  if (lessorIds.length > 0) {
    const { data: lessors } = await supabase
      .from('lessors')
      .select('id, cnp, first_name, last_name')
      .in('id', lessorIds)
    for (const l of lessors ?? []) lessorMap.set(l.id, l)
  }

  // Aggregate per lessor
  const grouped = new Map<string, {
    ronBrut: number; ronNet: number; taxAmount: number
    contractIds: string[]; lessorId: string
  }>()
  for (const t of transactions) {
    const key = (t as any).lessor_id ?? 'UNKNOWN'
    const ex = grouped.get(key)
    if (ex) {
      ex.ronBrut += Number((t as any).ron_brut ?? 0)
      ex.ronNet += Number((t as any).ron_net ?? 0)
      ex.taxAmount += Number((t as any).tax_amount ?? 0)
      const cid = (t as any).contract_id
      if (cid && !ex.contractIds.includes(cid)) ex.contractIds.push(cid)
    } else {
      grouped.set(key, {
        lessorId: key,
        ronBrut: Number((t as any).ron_brut ?? 0),
        ronNet: Number((t as any).ron_net ?? 0),
        taxAmount: Number((t as any).tax_amount ?? 0),
        contractIds: (t as any).contract_id ? [(t as any).contract_id] : [],
      })
    }
  }

  const rows = [...grouped.entries()].map(([lessorId, agg]) => {
    const lessor = lessorMap.get(lessorId)
    const warnings: string[] = []
    const cnp: string = lessor?.cnp ?? ''
    if (!cnp || cnp.length !== 13) warnings.push('CNP arendator lipsa sau invalid')
    if (!lessor) warnings.push('Arendator lipsa pe tranzactie')
    const gross = Math.round(agg.ronBrut * 100) / 100
    if (gross <= 0) warnings.push('Suma bruta zero sau negativa')
    const netTaxable = Math.round(agg.ronNet * 100) / 100
    const withheld = Math.round(agg.taxAmount * 100) / 100
    const flatDeduction = Math.round((gross - netTaxable) * 100) / 100
    return {
      lessorCnp: cnp,
      lessorLastName: lessor?.last_name ?? '-',
      lessorFirstName: lessor?.first_name ?? '-',
      contractId: agg.contractIds.join(', '),
      paymentType: 'CASH' as const,
      grossAmountRon: gross,
      flatDeductionRon: flatDeduction,
      netTaxableRon: netTaxable,
      withholdingTaxRon: withheld,
      warnings,
      isComplete: cnp.length === 13 && gross > 0 && !!lessor,
      legalBasis: LEGAL_BASIS,
    }
  })

  const totalGross = rows.reduce((s, r) => s + r.grossAmountRon, 0)
  const totalWithheld = rows.reduce((s, r) => s + r.withholdingTaxRon, 0)

  return NextResponse.json({
    dataset: {
      periodYear: year, periodMonth: month, rows,
      totalGrossRon: Math.round(totalGross * 100) / 100,
      totalWithholdingTaxRon: Math.round(totalWithheld * 100) / 100,
      rowsWithWarnings: rows.filter(r => r.warnings.length > 0).length,
      rowsIncomplete: rows.filter(r => !r.isComplete).length,
      applicabilityNotes,
      warnings: [],
      generatedAt: new Date().toISOString(),
      status: 'DRAFT',
      requiresAccountantReview: true,
    },
  })
}
