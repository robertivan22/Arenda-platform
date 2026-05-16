import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'

const FLAT_DEDUCTION_PCT = 0.40
const WITHHOLDING_RATE   = 0.10
const LEGAL_BASIS = 'art.84 CF — cedarea folosinței bunurilor, deducere forfetar 40%, cotă 10%'

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
    return NextResponse.json({ error: 'Parametrii lipsă: year, month (1-12)' }, { status: 400 })
  }

  const periodFrom = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const periodTo = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

  // Fetch payments in period for this user, join lessor
  const { data: payments, error } = await supabase
    .from('payments')
    .select(`
      id,
      amount,
      status,
      paid_date,
      contract_id,
      lessor:lessors!payments_lessor_id_fkey(cnp, first_name, last_name)
    `)
    .eq('user_id', user.id)
    .in('status', ['PAID', 'paid'])
    .gte('paid_date', periodFrom)
    .lte('paid_date', periodTo)

  if (error) {
    return NextResponse.json({ error: 'Eroare interogare plăți: ' + error.message }, { status: 500 })
  }

  const applicabilityNotes = [
    `Perioadă: ${String(month).padStart(2, '0')}/${year}`,
    LEGAL_BASIS,
    'DRAFT — necesită validare contabil înainte de depunere.',
  ]

  if (!payments || payments.length === 0) {
    return NextResponse.json({
      dataset: {
        periodYear: year, periodMonth: month,
        rows: [], totalGrossRon: 0, totalWithholdingTaxRon: 0,
        rowsWithWarnings: 0, rowsIncomplete: 0,
        applicabilityNotes: [...applicabilityNotes, 'Nu există plăți cu status PAID în această perioadă.'],
        warnings: [], generatedAt: new Date().toISOString(),
        status: 'DRAFT', requiresAccountantReview: true,
      },
    })
  }

  const rows = payments.map((p: any) => {
    const lessor = Array.isArray(p.lessor) ? p.lessor[0] : p.lessor
    const warnings: string[] = []

    const cnp: string = lessor?.cnp ?? ''
    if (!cnp || cnp.length !== 13) warnings.push('CNP arendator lipsă sau invalid')
    if (!lessor) warnings.push('Arendator lipsă pe plată')

    const gross = Number(p.amount ?? 0)
    if (gross <= 0) warnings.push('Suma brută zero sau negativă')

    const flatDeduction = Math.round(gross * FLAT_DEDUCTION_PCT * 100) / 100
    const netTaxable    = Math.round((gross - flatDeduction) * 100) / 100
    const withheld      = Math.round(netTaxable * WITHHOLDING_RATE * 100) / 100

    return {
      lessorCnp:         cnp,
      lessorLastName:    lessor?.last_name  ?? '—',
      lessorFirstName:   lessor?.first_name ?? '—',
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


// ─── Constants ───────────────────────────────────────────────────────────────
// Legislație în vigoare: OUG 156/2024 (01-06-2026) + OUG 89/2025 (07-12-2026)
// Baza legală: art.84 și art.72 CF — venituri din cedarea folosinței bunurilor
const FLAT_DEDUCTION_PCT = 0.40   // 40% deducere forfetar
const WITHHOLDING_RATE   = 0.10   // 10% impozit pe venit
const LEGAL_BASIS = 'art.84 CF — cedarea folosinței bunurilor, deducere forfetar 40%, cotă 10%'

// ─── Types ────────────────────────────────────────────────────────────────────
export interface D112Row {
  lessorCnp: string
  lessorLastName: string
  lessorFirstName: string
  contractId: string
  paymentIds: string[]
  paymentType: 'CASH' | 'IN_KIND'
  grossAmountRon: number
  flatDeductionRon: number
  netTaxableRon: number
  withholdingTaxRon: number
  warnings: string[]
  isComplete: boolean
  legalBasis: string
}

export interface D112Dataset {
  periodYear: number
  periodMonth: number
  rows: D112Row[]
  totalGrossRon: number
  totalWithholdingTaxRon: number
  rowsWithWarnings: number
  rowsIncomplete: number
  applicabilityNotes: string[]
  warnings: string[]
  generatedAt: string
  status: 'DRAFT'
  requiresAccountantReview: true
}

// ─── Route Handler ─────────────────────────────────────────────────────────────
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

  const body = await req.json() as { year: number; month: number; tenantId?: string }
  const { year, month } = body

  if (!year || !month || month < 1 || month > 12) {
    return NextResponse.json({ error: 'Parametrii lipsă sau incorecți: year, month (1-12)' }, { status: 400 })
  }

  const periodFrom = new Date(year, month - 1, 1).toISOString()
  const periodTo   = new Date(year, month, 0, 23, 59, 59).toISOString()

  // Fetch payments in period — join lessor + contract
  const { data: payments, error: paymentsErr } = await supabase
    .from('payments')
    .select(`
      id,
      amountRon,
      paymentMethodId,
      status,
      periodFrom,
      periodTo,
      contractId,
      lessor:lessors!payments_lessor_id_fkey(
        id,
        cnpCui,
        lastName,
        firstName
      ),
      productPayment:product_payments(id)
    `)
    .in('status', ['COMPLETED', 'APPROVED'])
    .gte('periodFrom', periodFrom)
    .lte('periodTo', periodTo)

  if (paymentsErr) {
    console.error('D112 payments query error:', paymentsErr)
    return NextResponse.json({ error: 'Eroare interogare plăți: ' + paymentsErr.message }, { status: 500 })
  }

  const rows: D112Row[] = []
  const applicabilityNotes: string[] = [
    `Perioadă: ${String(month).padStart(2, '0')}/${year}`,
    LEGAL_BASIS,
    'DRAFT — necesită validare contabil înainte de depunere.',
  ]
  const globalWarnings: string[] = []

  if (!payments || payments.length === 0) {
    return NextResponse.json({
      dataset: {
        periodYear: year,
        periodMonth: month,
        rows: [],
        totalGrossRon: 0,
        totalWithholdingTaxRon: 0,
        rowsWithWarnings: 0,
        rowsIncomplete: 0,
        applicabilityNotes: [...applicabilityNotes, 'Nu există plăți finalizate în această perioadă.'],
        warnings: [],
        generatedAt: new Date().toISOString(),
        status: 'DRAFT',
        requiresAccountantReview: true,
      } satisfies D112Dataset,
    })
  }

  for (const payment of payments) {
    const warnings: string[] = []
    const lessor = Array.isArray(payment.lessor) ? payment.lessor[0] : payment.lessor
    const productPayment = Array.isArray(payment.productPayment) ? payment.productPayment[0] : payment.productPayment

    if (!lessor) {
      warnings.push('Arendator lipsă pe plată')
    }

    const cnp: string = lessor?.cnpCui ?? ''
    if (!cnp || cnp.length !== 13) {
      warnings.push('CNP arendator lipsă sau invalid')
    }

    const gross = Number(payment.amountRon ?? 0)
    if (gross <= 0) {
      warnings.push('Suma brută zero sau negativă')
    }

    const flatDeduction = Math.round(gross * FLAT_DEDUCTION_PCT * 100) / 100
    const netTaxable    = Math.round((gross - flatDeduction) * 100) / 100
    const withheld      = Math.round(netTaxable * WITHHOLDING_RATE * 100) / 100

    const paymentType: 'CASH' | 'IN_KIND' = productPayment ? 'IN_KIND' : 'CASH'
    if (paymentType === 'IN_KIND') {
      warnings.push('Plată în natură — verificați valoarea de piață folosită pentru evaluare')
    }

    const isComplete = cnp.length === 13 && gross > 0 && !!lessor

    rows.push({
      lessorCnp:        cnp,
      lessorLastName:   lessor?.lastName  ?? '—',
      lessorFirstName:  lessor?.firstName ?? '—',
      contractId:       (payment.contractId as string) ?? '',
      paymentIds:       [payment.id],
      paymentType,
      grossAmountRon:   gross,
      flatDeductionRon: flatDeduction,
      netTaxableRon:    netTaxable,
      withholdingTaxRon: withheld,
      warnings,
      isComplete,
      legalBasis: LEGAL_BASIS,
    })
  }

  const totalGross    = rows.reduce((s, r) => s + r.grossAmountRon, 0)
  const totalWithheld = rows.reduce((s, r) => s + r.withholdingTaxRon, 0)

  const dataset: D112Dataset = {
    periodYear: year,
    periodMonth: month,
    rows,
    totalGrossRon:           Math.round(totalGross    * 100) / 100,
    totalWithholdingTaxRon:  Math.round(totalWithheld * 100) / 100,
    rowsWithWarnings:        rows.filter(r => r.warnings.length > 0).length,
    rowsIncomplete:          rows.filter(r => !r.isComplete).length,
    applicabilityNotes,
    warnings: globalWarnings,
    generatedAt: new Date().toISOString(),
    status: 'DRAFT',
    requiresAccountantReview: true,
  }

  return NextResponse.json({ dataset })
}
