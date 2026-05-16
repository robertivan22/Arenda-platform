import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'

const FLAT_DEDUCTION_PCT = 0.40
const WITHHOLDING_RATE   = 0.10
const LEGAL_BASIS = 'art.84 CF - cedarea folosintei bunurilor, deducere forfetar 40%, cota 10%'

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

  const body = await req.json() as { year: number; month: number }
  const { year, month } = body
  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Parametrii lipsa: year, month (1-12)' }, { status: 400 })
  }

  const periodFrom = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const periodTo = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

  // Step 1: fetch all payments (no join - avoid FK name ambiguity)
  const { data: payments, error: paymentsError } = await supabase
    .from('payments')
    .select('id, amount, status, paid_date, due_date, contract_id, lessor_id')
    .eq('user_id', user.id)

  if (paymentsError) {
    return NextResponse.json({
      error: 'Eroare interogare plati: ' + paymentsError.message,
      _debug: { paymentsError }
    }, { status: 500 })
  }

  // Step 2: fetch lessors separately by ID
  const lessorIds = [...new Set((payments ?? []).map((p: any) => p.lessor_id).filter(Boolean))]
  const lessorMap = new Map<string, { cnp: string; first_name: string; last_name: string }>()
  if (lessorIds.length > 0) {
    const { data: lessors } = await supabase
      .from('lessors')
      .select('id, cnp, first_name, last_name')
      .in('id', lessorIds)
    for (const l of lessors ?? []) lessorMap.set(l.id, l)
  }

  // Status check - normalize to handle Platit/PAID/platit/achitat etc.
  function isPaid(status: string | null): boolean {
    if (!status) return false
    const s = status.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return s === 'paid' || s === 'platit' || s === 'platita' || s === 'achitat' ||
      s.includes('platit') || s.includes('paid')
  }

  const allPayments = payments ?? []
  const paymentsInPeriod = allPayments.filter((p: any) => {
    if (!isPaid(p.status)) return false
    const dateStr: string | null = p.paid_date ?? p.due_date ?? null
    if (!dateStr) return false
    const d = dateStr.slice(0, 10)
    return d >= periodFrom && d <= periodTo
  })

  const applicabilityNotes = [
    `Perioada: ${String(month).padStart(2, '0')}/${year}`,
    LEGAL_BASIS,
    'DRAFT - necesita validare contabil inainte de depunere.',
  ]

  if (allPayments.length === 0) {
    return NextResponse.json({
      dataset: {
        periodYear: year, periodMonth: month,
        rows: [], totalGrossRon: 0, totalWithholdingTaxRon: 0,
        rowsWithWarnings: 0, rowsIncomplete: 0,
        applicabilityNotes: [...applicabilityNotes, 'Nu exista plati inregistrate.'],
        warnings: [], generatedAt: new Date().toISOString(),
        status: 'DRAFT', requiresAccountantReview: true,
      },
      _debug: { totalInDB: 0, userId: user.id, periodFrom, periodTo }
    })
  }

  if (paymentsInPeriod.length === 0) {
    const note = `Nu exista plati in ${String(month).padStart(2, '0')}/${year}. Exista ${allPayments.length} plati - verificati statusul si data.`
    return NextResponse.json({
      dataset: {
        periodYear: year, periodMonth: month,
        rows: [], totalGrossRon: 0, totalWithholdingTaxRon: 0,
        rowsWithWarnings: 0, rowsIncomplete: 0,
        applicabilityNotes: [...applicabilityNotes, note],
        warnings: [], generatedAt: new Date().toISOString(),
        status: 'DRAFT', requiresAccountantReview: true,
      },
      _debug: {
        totalInDB: allPayments.length,
        userId: user.id,
        statuses: [...new Set(allPayments.map((p: any) => p.status))],
        dates: allPayments.slice(0, 10).map((p: any) => ({
          id: p.id, status: p.status, paid_date: p.paid_date, due_date: p.due_date, lessor_id: p.lessor_id
        })),
        periodFrom, periodTo,
      }
    })
  }

  const rows = paymentsInPeriod.map((p: any) => {
    const lessor = lessorMap.get(p.lessor_id)
    const warnings: string[] = []
    const cnp: string = lessor?.cnp ?? ''
    if (!cnp || cnp.length !== 13) warnings.push('CNP arendator lipsa sau invalid')
    if (!lessor) warnings.push('Arendator lipsa pe plata')
    const gross = Number(p.amount ?? 0)
    if (gross <= 0) warnings.push('Suma bruta zero sau negativa')
    const flatDeduction = Math.round(gross * FLAT_DEDUCTION_PCT * 100) / 100
    const netTaxable    = Math.round((gross - flatDeduction) * 100) / 100
    const withheld      = Math.round(netTaxable * WITHHOLDING_RATE * 100) / 100
    return {
      lessorCnp:         cnp,
      lessorLastName:    lessor?.last_name  ?? '-',
      lessorFirstName:   lessor?.first_name ?? '-',
      contractId:        p.contract_id ?? '',
      paymentIds:        [p.id],
      paymentType:       'CASH' as const,
      grossAmountRon:    gross,
      flatDeductionRon:  flatDeduction,
      netTaxableRon:     netTaxable,
      withholdingTaxRon: withheld,
      warnings,
      isComplete: cnp.length === 13 && gross > 0 && !!lessor,
      legalBasis: LEGAL_BASIS,
    }
  })

  const totalGross    = rows.reduce((s: number, r: any) => s + r.grossAmountRon, 0)
  const totalWithheld = rows.reduce((s: number, r: any) => s + r.withholdingTaxRon, 0)

  return NextResponse.json({
    dataset: {
      periodYear: year, periodMonth: month, rows,
      totalGrossRon:          Math.round(totalGross    * 100) / 100,
      totalWithholdingTaxRon: Math.round(totalWithheld * 100) / 100,
      rowsWithWarnings:       rows.filter((r: any) => r.warnings.length > 0).length,
      rowsIncomplete:         rows.filter((r: any) => !r.isComplete).length,
      applicabilityNotes, warnings: [],
      generatedAt: new Date().toISOString(),
      status: 'DRAFT', requiresAccountantReview: true,
    },
  })
}
