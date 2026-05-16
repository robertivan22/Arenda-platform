import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'

const FLAT_DEDUCTION_PCT = 0.40
const WITHHOLDING_RATE   = 0.10
const LEGAL_BASIS = 'art.84 CF \u2014 cedarea folosin\u021bei bunurilor, deducere forfetar 40%, cot\u0103 10%'

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
    return NextResponse.json({ error: 'Parametrii lips\u0103: year, month (1-12)' }, { status: 400 })
  }

  const periodFrom = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const periodTo = `${year}-${String(month).padStart(2, '0')}-${lastDay}`

  // Fetch ALL payments for this user — filter status in-memory to handle
  // any status variant: PAID, paid, Plătit, Platit, platit, etc.
  const { data: payments, error } = await supabase
    .from('payments')
    .select(`
      id,
      amount,
      status,
      paid_date,
      due_date,
      contract_id,
      lessor:lessors!payments_lessor_id_fkey(cnp, first_name, last_name)
    `)
    .eq('user_id', user.id)

  // Status check — case-insensitive, accept any "paid/platit" variant
  function isPaid(status: string | null): boolean {
    if (!status) return false
    const s = status.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    return s === 'paid' || s === 'platit' || s === 'platita'
  }

  // Filter in-memory: only paid, use paid_date if available, else due_date
  const paymentsInPeriod = (payments ?? []).filter((p: any) => {
    if (!isPaid(p.status)) return false
    const dateStr: string | null = p.paid_date ?? p.due_date ?? null
    if (!dateStr) return false
    const d = dateStr.slice(0, 10)  // YYYY-MM-DD
    return d >= periodFrom && d <= periodTo
  })

  if (error) {
    return NextResponse.json({ error: 'Eroare interogare pl\u0103\u021bi: ' + error.message }, { status: 500 })
  }

  const applicabilityNotes = [
    `Perioad\u0103: ${String(month).padStart(2, '0')}/${year}`,
    LEGAL_BASIS,
    'DRAFT \u2014 necesit\u0103 validare contabil \u00eenainte de depunere.',
  ]

  if (!payments || payments.length === 0) {
    const note = 'Nu există plăți cu status PAID în această perioadă.'
    return NextResponse.json({
      dataset: {
        periodYear: year, periodMonth: month,
        rows: [], totalGrossRon: 0, totalWithholdingTaxRon: 0,
        rowsWithWarnings: 0, rowsIncomplete: 0,
        applicabilityNotes: [...applicabilityNotes, note],
        warnings: [], generatedAt: new Date().toISOString(),
        status: 'DRAFT', requiresAccountantReview: true,
      },
    })
  }

  if (paymentsInPeriod.length === 0) {
    const allPayments = payments ?? []
    const note = allPayments.length > 0
      ? `Nu există plăți în ${String(month).padStart(2, '0')}/${year}. Există ${allPayments.length} plăți în alte perioade — verificați data plății/scadenței.`
      : 'Nu există plăți înregistrate.'
    return NextResponse.json({
      dataset: {
        periodYear: year, periodMonth: month,
        rows: [], totalGrossRon: 0, totalWithholdingTaxRon: 0,
        rowsWithWarnings: 0, rowsIncomplete: 0,
        applicabilityNotes: [...applicabilityNotes, note],
        warnings: [], generatedAt: new Date().toISOString(),
        status: 'DRAFT', requiresAccountantReview: true,
      },
      // debug info — remove after diagnosis
      _debug: {
        totalInDB: allPayments.length,
        statuses: [...new Set(allPayments.map((p: any) => p.status))],
        dates: allPayments.map((p: any) => ({ id: p.id, paid_date: p.paid_date, due_date: p.due_date, status: p.status })),
        periodFrom,
        periodTo,
      }
    })
  }

  const rows = paymentsInPeriod.map((p: any) => {
    const lessor = Array.isArray(p.lessor) ? p.lessor[0] : p.lessor
    const warnings: string[] = []

    const cnp: string = lessor?.cnp ?? ''
    if (!cnp || cnp.length !== 13) warnings.push('CNP arendator lips\u0103 sau invalid')
    if (!lessor) warnings.push('Arendator lips\u0103 pe plat\u0103')

    const gross = Number(p.amount ?? 0)
    if (gross <= 0) warnings.push('Suma brut\u0103 zero sau negativ\u0103')

    const flatDeduction = Math.round(gross * FLAT_DEDUCTION_PCT * 100) / 100
    const netTaxable    = Math.round((gross - flatDeduction) * 100) / 100
    const withheld      = Math.round(netTaxable * WITHHOLDING_RATE * 100) / 100

    return {
      lessorCnp:         cnp,
      lessorLastName:    lessor?.last_name  ?? '\u2014',
      lessorFirstName:   lessor?.first_name ?? '\u2014',
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
