export const runtime = 'edge'

/**
 * GET /api/direct-status
 * Direct database query — NO Groq, NO AI, NO summarization.
 * Computes RCA / document / transaction statuses deterministically from real DB rows.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DocStatus =
  | 'valid'
  | 'expiring_soon'       // 8–45 days  (32 days → expiring_soon, NOT valid)
  | 'expiring_critical'   // 1–7 days
  | 'expired'             // <= 0 days
  | 'missing'             // null / undefined / empty string
  | 'invalid_date'        // unparseable / pre-2000 / epoch

export type PaymentStatus = 'paid' | 'unpaid' | 'overdue_unpaid'

export interface UtilajRow {
  id: string
  name: string
  type: string
  brand: string | null
  model: string | null
  year: number | null
  plate: string | null
  rca_expiry_date: string | null
  rca_active: boolean
  rca_status: DocStatus
  rca_days: number | null
  itp_task_title: string | null
  itp_due_date: string | null
  itp_status: DocStatus | null
  itp_days: number | null
  service_task_title: string | null
  service_due_date: string | null
  service_status: DocStatus | null
  service_days: number | null
  overall_priority: 'high' | 'medium' | 'low'
}

export interface TranzactieRow {
  id: string
  lessor_name: string
  product_name: string
  campaign_year: number
  transaction_date: string | null
  ron_net: number
  is_paid: boolean
  payment_status: PaymentStatus
  is_overdue: boolean
}

export interface DirectStatusResponse {
  ok: boolean
  utilaje: UtilajRow[]
  tranzactii: TranzactieRow[]
  summary: {
    utilaje_total: number
    utilaje_critical: number
    utilaje_warning: number
    tranzactii_total: number
    tranzactii_unpaid: number
    tranzactii_overdue: number
    tranzactii_unpaid_ron: number
  }
  errors: string[]
  error?: string
}

// ─── Deterministic helpers — no AI involved ───────────────────────────────────

/**
 * Safely parse a date string.
 * Returns null for: null, empty, epoch (1970), pre-2000, Invalid Date.
 */
function safeDate(val: string | null | undefined): Date | null {
  if (!val || val === '0' || val.trim() === '') return null
  const d = new Date(val)
  if (isNaN(d.getTime())) return null
  // Reject epoch (timestamp 0) and any obviously wrong year
  if (d.getTime() === 0 || d.getFullYear() < 2000) return null
  return d
}

/**
 * Days from `from` to `to` (positive = future, negative = past).
 */
function daysDiff(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86400000)
}

/**
 * Classify a document expiry date:
 *   <= 0  → expired
 *   1–7   → expiring_critical
 *   8–45  → expiring_soon   ← 32 days falls here (NOT valid)
 *   > 45  → valid
 */
function computeDocStatus(
  dateStr: string | null | undefined,
  today: Date
): { status: DocStatus; days: number | null } {
  if (!dateStr || dateStr.trim() === '') return { status: 'missing', days: null }
  const d = safeDate(dateStr)
  if (!d) return { status: 'invalid_date', days: null }
  const days = daysDiff(today, d)  // positive = future
  if (days < 0)  return { status: 'expired',             days }
  if (days <= 7) return { status: 'expiring_critical',   days }
  if (days <= 45) return { status: 'expiring_soon',      days }
  return { status: 'valid', days }
}

/**
 * Map doc status → priority bucket.
 */
function docStatusToPriority(s: DocStatus | null): 'high' | 'medium' | 'low' {
  if (!s) return 'low'
  if (s === 'expired' || s === 'expiring_critical' || s === 'invalid_date') return 'high'
  if (s === 'expiring_soon' || s === 'missing') return 'medium'
  return 'low'
}

/**
 * Compute transaction payment status from real DB columns.
 * Overdue = is_paid false AND transaction_date > 30 days ago.
 */
function computePaymentStatus(
  isPaid: boolean,
  transactionDate: string | null,
  today: Date
): { status: PaymentStatus; is_overdue: boolean } {
  if (isPaid) return { status: 'paid', is_overdue: false }
  const d = safeDate(transactionDate)
  // Overdue: transaction happened more than 30 days ago and still unpaid
  const isOverdue = d !== null && daysDiff(d, today) > 30
  return { status: isOverdue ? 'overdue_unpaid' : 'unpaid', is_overdue: isOverdue }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest): Promise<NextResponse<DirectStatusResponse>> {
  const errors: string[] = []

  try {
    const db = await createClient()
    const today = new Date()

    // ── 1. Machines ──────────────────────────────────────────────────────────
    const { data: machinesRaw, error: machinesErr } = await db
      .from('machines')
      .select('id, name, type, brand, model, year, plate, is_active, rca_active, rca_price, rca_expiry_date')
      .eq('is_active', true)
      .order('name')

    if (machinesErr) errors.push(`machines: ${machinesErr.message}`)

    // ── 2. Maintenance tasks (ITP / SERVICE / REVIZIE) ────────────────────────
    const machineIds = (machinesRaw ?? []).map((m: any) => m.id as string)
    let maintenanceRaw: any[] = []

    if (machineIds.length > 0) {
      const { data: mtRaw, error: mtErr } = await db
        .from('maintenance_tasks')
        .select('id, machine_id, title, type, due_date, status')
        .in('machine_id', machineIds)
        .in('status', ['PLANIFICAT', 'IN_EXECUTIE'])
        .order('due_date', { ascending: true })

      if (mtErr) errors.push(`maintenance_tasks: ${mtErr.message}`)
      maintenanceRaw = mtRaw ?? []
    }

    // Group tasks by machine_id
    const tasksByMachine: Record<string, any[]> = {}
    for (const t of maintenanceRaw) {
      if (!tasksByMachine[t.machine_id]) tasksByMachine[t.machine_id] = []
      tasksByMachine[t.machine_id].push(t)
    }

    // ── 3. Build utilaje rows ─────────────────────────────────────────────────
    const utilaje: UtilajRow[] = (machinesRaw ?? []).map((m: any) => {
      const rcaResult = computeDocStatus(m.rca_expiry_date, today)

      const tasks = tasksByMachine[m.id] ?? []
      const itpTask    = tasks.find((t: any) => t.type === 'ITP')
      const serviceTask = tasks.find((t: any) => t.type === 'SERVICE' || t.type === 'REVIZIE' || t.type === 'REPARATIE')

      const itpResult     = itpTask    ? computeDocStatus(itpTask.due_date, today) : null
      const serviceResult = serviceTask ? computeDocStatus(serviceTask.due_date, today) : null

      const priorities = [
        docStatusToPriority(rcaResult.status),
        docStatusToPriority(itpResult?.status ?? null),
        docStatusToPriority(serviceResult?.status ?? null),
      ]
      const overall_priority: 'high' | 'medium' | 'low' =
        priorities.includes('high') ? 'high' :
        priorities.includes('medium') ? 'medium' : 'low'

      return {
        id:                  m.id,
        name:                m.name,
        type:                m.type,
        brand:               m.brand ?? null,
        model:               m.model ?? null,
        year:                m.year ?? null,
        plate:               m.plate ?? null,
        rca_expiry_date:     m.rca_expiry_date ?? null,
        rca_active:          m.rca_active ?? false,
        rca_status:          rcaResult.status,
        rca_days:            rcaResult.days,
        itp_task_title:      itpTask?.title ?? null,
        itp_due_date:        itpTask?.due_date ?? null,
        itp_status:          itpResult?.status ?? null,
        itp_days:            itpResult?.days ?? null,
        service_task_title:  serviceTask?.title ?? null,
        service_due_date:    serviceTask?.due_date ?? null,
        service_status:      serviceResult?.status ?? null,
        service_days:        serviceResult?.days ?? null,
        overall_priority,
      }
    })

    // ── 4. Transactions ───────────────────────────────────────────────────────
    const { data: txRaw, error: txErr } = await db
      .from('transactions')
      .select('id, lessor_id, ron_net, is_paid, campaign_year, transaction_date, product_name, is_previzionata')
      .eq('is_previzionata', false)
      .order('transaction_date', { ascending: false })
      .limit(200)

    if (txErr) errors.push(`transactions: ${txErr.message}`)

    // ── 5. Fetch lessors (separate query — no ambiguous PostgREST join) ───────
    const lessorIds = [...new Set((txRaw ?? []).map((t: any) => t.lessor_id).filter(Boolean))] as string[]
    let lessorMap: Record<string, any> = {}

    if (lessorIds.length > 0) {
      const { data: lData, error: lErr } = await db
        .from('lessors')
        .select('id, type, first_name, last_name, company_name')
        .in('id', lessorIds)

      if (lErr) errors.push(`lessors: ${lErr.message}`)
      lessorMap = Object.fromEntries((lData ?? []).map((l: any) => [l.id, l]))
    }

    // ── 6. Build tranzactii rows ───────────────────────────────────────────────
    const tranzactii: TranzactieRow[] = (txRaw ?? []).map((t: any) => {
      const lessor = t.lessor_id ? lessorMap[t.lessor_id] : null
      const lessorName = lessor
        ? (lessor.type === 'LEGAL'
            ? (lessor.company_name ?? '—')
            : `${lessor.last_name ?? ''} ${lessor.first_name ?? ''}`.trim() || '—')
        : '—'

      const { status, is_overdue } = computePaymentStatus(
        t.is_paid === true,
        t.transaction_date,
        today
      )

      return {
        id:               t.id,
        lessor_name:      lessorName,
        product_name:     t.product_name ?? '—',
        campaign_year:    t.campaign_year,
        transaction_date: t.transaction_date ?? null,
        ron_net:          Number(t.ron_net ?? 0),
        is_paid:          t.is_paid === true,
        payment_status:   status,
        is_overdue,
      }
    })

    // ── 7. Summary ────────────────────────────────────────────────────────────
    const unpaidTx = tranzactii.filter(t => !t.is_paid)
    const summary = {
      utilaje_total:        utilaje.length,
      utilaje_critical:     utilaje.filter(u => u.overall_priority === 'high').length,
      utilaje_warning:      utilaje.filter(u => u.overall_priority === 'medium').length,
      tranzactii_total:     tranzactii.length,
      tranzactii_unpaid:    unpaidTx.length,
      tranzactii_overdue:   tranzactii.filter(t => t.is_overdue).length,
      tranzactii_unpaid_ron: unpaidTx.reduce((s, t) => s + t.ron_net, 0),
    }

    return NextResponse.json({ ok: true, utilaje, tranzactii, summary, errors }, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })

  } catch (err) {
    return NextResponse.json(
      { ok: false, utilaje: [], tranzactii: [], summary: { utilaje_total: 0, utilaje_critical: 0, utilaje_warning: 0, tranzactii_total: 0, tranzactii_unpaid: 0, tranzactii_overdue: 0, tranzactii_unpaid_ron: 0 }, errors, error: String(err) },
      { status: 500 }
    )
  }
}
