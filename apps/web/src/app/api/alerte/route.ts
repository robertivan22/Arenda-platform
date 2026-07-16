export const runtime = 'edge'

/**
 * GET /api/alerte
 * Complete deterministic farm alert computation — NO Groq, NO AI, NO LLM.
 * All statuses, priorities, insights, and scores come directly from DB rows.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type {
  DocStatus, AlertPaymentStatus, RiskTier, AlertPriority, StocStatus,
  ContractAlerta, FermaAlerta, StocAlerta, UtilajeAlerta, TranzactieAlerta,
  AlertaInsight, SumarExecutiv, AlerteResponse,
} from '@/lib/alerte/types'

// ─── Safe date helpers (no epoch, no 1970, no Invalid Date) ──────────────────

function safeDate(val: string | null | undefined): Date | null {
  if (!val || val.trim() === '') return null
  const d = new Date(val)
  if (isNaN(d.getTime())) return null
  // Reject epoch (0) and any suspiciously old year
  if (d.getTime() === 0 || d.getFullYear() < 2000) return null
  return d
}

/** Positive = future days remaining; negative = days past expiry */
function daysDiff(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86400000)
}

/**
 * Classify a document / contract expiry date.
 * Thresholds:
 *   <= 0 days  → expired
 *   1–7 days   → expiring_critical
 *   8–45 days  → expiring_soon   (32 days is expiring_soon, NOT valid)
 *   > 45 days  → valid
 */
function computeDocStatus(
  dateStr: string | null | undefined,
  today: Date,
): { status: DocStatus; days: number | null } {
  if (!dateStr || dateStr.trim() === '') return { status: 'missing', days: null }
  const d = safeDate(dateStr)
  if (!d) return { status: 'invalid_date', days: null }
  const days = daysDiff(today, d)
  if (days < 0)   return { status: 'expired',           days }
  if (days <= 7)  return { status: 'expiring_critical', days }
  if (days <= 45) return { status: 'expiring_soon',     days }
  return { status: 'valid', days }
}

function docStatusToPriority(s: DocStatus | null): 'high' | 'medium' | 'low' {
  if (!s) return 'low'
  if (s === 'expired' || s === 'expiring_critical' || s === 'invalid_date') return 'high'
  if (s === 'expiring_soon' || s === 'missing') return 'medium'
  return 'low'
}

function alertPriorityFromDoc(s: DocStatus): AlertPriority {
  if (s === 'expired' || s === 'expiring_critical' || s === 'invalid_date') return 'inalta'
  if (s === 'expiring_soon' || s === 'missing') return 'medie'
  return 'scazuta'
}

/**
 * Transaction payment status.
 * overdue_unpaid = is_paid false AND transaction_date > 30 days ago.
 */
function computePaymentStatus(
  isPaid: boolean,
  transactionDate: string | null,
  today: Date,
): { status: AlertPaymentStatus; is_overdue: boolean } {
  if (isPaid) return { status: 'paid', is_overdue: false }
  const d = safeDate(transactionDate)
  const isOverdue = d !== null && daysDiff(d, today) > 30
  return { status: isOverdue ? 'overdue_unpaid' : 'unpaid', is_overdue: isOverdue }
}

/**
 * Stock status based on percentage remaining (no minimum_stock column exists).
 *   0%        → epuizat (out of stock)
 *   0–5%      → critic (critical)
 *   5–25%     → scazut (low)
 *   25%+      → ok
 */
function computeStocStatus(qtyAvail: number, qtyOrig: number): StocStatus {
  if (qtyAvail <= 0) return 'epuizat'
  if (qtyOrig <= 0) return 'ok'            // can't compute %, assume fine
  const pct = qtyAvail / qtyOrig
  if (pct < 0.05) return 'critic'
  if (pct < 0.25) return 'scazut'
  return 'ok'
}

// ─── Risk score — transparent deterministic model ────────────────────────────

function computeRiskScore(
  contracte: ContractAlerta[],
  tranzactii: TranzactieAlerta[],
  utilaje: UtilajeAlerta[],
  stocuri: StocAlerta[],
  ferma: FermaAlerta[],
): { score: number; tier: RiskTier } {
  let raw = 0

  for (const c of contracte) {
    const s = c.doc_status
    if (s === 'expired' || c.status_db === 'EXPIRED') raw += 20
    else if (s === 'expiring_critical') raw += 15
    else if (s === 'expiring_soon') raw += 8
    else if (s === 'missing' || s === 'invalid_date') raw += 5
  }

  for (const t of tranzactii) {
    if (!t.is_paid) raw += t.is_overdue ? 15 : 8
  }

  for (const u of utilaje) {
    const rca = u.rca_status
    if (rca === 'expired') raw += 12
    else if (rca === 'expiring_critical') raw += 8
    else if (rca === 'expiring_soon') raw += 4
    const itp = u.itp_status
    if (itp === 'expired') raw += 8
    else if (itp === 'expiring_critical') raw += 5
    else if (itp === 'expiring_soon') raw += 2
  }

  for (const s of stocuri) {
    if (s.stock_status === 'epuizat') raw += 10
    else if (s.stock_status === 'critic') raw += 7
    else if (s.stock_status === 'scazut') raw += 4
  }

  for (const f of ferma) {
    if (f.is_overdue && (f.overdue_days ?? 0) > 7) raw += 12
    else if (f.is_overdue) raw += 6
    else if (f.priority === 'inalta') raw += 4
    else if (f.priority === 'medie') raw += 2
  }

  const score = Math.min(100, raw)
  const tier: RiskTier =
    score >= 80 ? 'critic' :
    score >= 50 ? 'ridicat' :
    score >= 20 ? 'moderat' : 'scazut'
  return { score, tier }
}

// ─── Deterministic insights — ranked by severity ──────────────────────────────

function computeInsights(
  contracte: ContractAlerta[],
  tranzactii: TranzactieAlerta[],
  utilaje: UtilajeAlerta[],
  stocuri: StocAlerta[],
  ferma: FermaAlerta[],
): AlertaInsight[] {
  const out: AlertaInsight[] = []

  // Expired contracts
  const expiredC = contracte.filter(c => c.doc_status === 'expired' || c.status_db === 'EXPIRED')
  if (expiredC.length > 0) {
    out.push({
      impact: 'mare', categorie: 'Contracte',
      titlu: `${expiredC.length} contract${expiredC.length > 1 ? 'e expirate' : ' expirat'}`,
      descriere: `${expiredC.slice(0, 3).map(c => `#${c.contract_number} (${c.lessor_name})`).join(', ')}. Reinnoire urgenta necesara pentru a continua relatia de arendare.`,
    })
  }

  // Expiring soon contracts
  const soonC = contracte.filter(c =>
    c.doc_status === 'expiring_critical' || c.doc_status === 'expiring_soon',
  )
  if (soonC.length > 0) {
    const minDays = Math.min(...soonC.map(c => c.days_until_expiry ?? 9999))
    out.push({
      impact: soonC.some(c => c.doc_status === 'expiring_critical') ? 'mare' : 'mediu',
      categorie: 'Contracte',
      titlu: `${soonC.length} contract${soonC.length > 1 ? 'e expira' : ' expira'} in ${minDays} zile`,
      descriere: `Cel mai urgent: #${soonC[0].contract_number} — ${soonC[0].lessor_name}. Initiati procesul de reinnoire inainte de expirare pentru a evita intreruperea contractelor.`,
    })
  }

  // Overdue payments
  const overdueT = tranzactii.filter(t => t.is_overdue)
  if (overdueT.length > 0) {
    const totalRON = overdueT.reduce((s, t) => s + t.ron_net, 0)
    out.push({
      impact: 'mare', categorie: 'Tranzactii',
      titlu: `${overdueT.length} plata restanta — ${totalRON.toFixed(0)} RON neachitat`,
      descriere: `Tranzactii cu intarziere peste 30 de zile. Impact financiar total: ${totalRON.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON. Contactati arendatorii afectati imediat.`,
    })
  }

  // Unpaid (not yet overdue)
  const unpaidT = tranzactii.filter(t => !t.is_paid && !t.is_overdue)
  if (unpaidT.length > 0) {
    const totalRON = unpaidT.reduce((s, t) => s + t.ron_net, 0)
    out.push({
      impact: 'mediu', categorie: 'Tranzactii',
      titlu: `${unpaidT.length} tranzacti${unpaidT.length === 1 ? 'e' : 'i'} neplatite — ${totalRON.toFixed(0)} RON`,
      descriere: `Plati pendinte catre arendasi. Total: ${totalRON.toLocaleString('ro-RO', { minimumFractionDigits: 2 })} RON. Asigurati regularizarea la timp pentru a mentine relatia cu arendatorii.`,
    })
  }

  // Critical/urgent machines
  const criticalM = utilaje.filter(u => u.rca_status === 'expired' || u.rca_status === 'expiring_critical')
  if (criticalM.length > 0) {
    out.push({
      impact: 'mare', categorie: 'Utilaje',
      titlu: `RCA expirat/urgent: ${criticalM.slice(0, 3).map(u => u.name).join(', ')}`,
      descriere: `${criticalM.length} utilaj${criticalM.length > 1 ? 'e' : ''} cu RCA expirat sau in expirare critica (sub 7 zile). Utilajele fara RCA valabil nu pot circula legal pe drumuri publice.`,
    })
  }

  // Out of stock / critical stock
  const critS = stocuri.filter(s => s.stock_status === 'epuizat' || s.stock_status === 'critic')
  if (critS.length > 0) {
    out.push({
      impact: 'mare', categorie: 'Stocuri',
      titlu: `${critS.length} produs${critS.length > 1 ? 'e cu stoc critic' : ' cu stoc critic/epuizat'}`,
      descriere: `${critS.slice(0, 3).map(s => s.product_name).join(', ')} — stoc sub 5% sau epuizat. Aprovizionati imediat pentru a nu bloca operatiunile de camp.`,
    })
  }

  // Overdue activities
  const overdueF = ferma.filter(f => f.is_overdue)
  if (overdueF.length > 0) {
    out.push({
      impact: 'mediu', categorie: 'Activitati',
      titlu: `${overdueF.length} activitat${overdueF.length === 1 ? 'e' : 'i'} de camp restante`,
      descriere: `${overdueF.slice(0, 3).map(a => a.operation_type).join(', ')}. Verificati planul de campanie si reprogramati lucrarile intarziate.`,
    })
  }

  // Sort: mare first, then mediu, then mic
  const order: Record<string, number> = { mare: 0, mediu: 1, mic: 2 }
  return out.sort((a, b) => order[a.impact] - order[b.impact]).slice(0, 6)
}

// ─── Template-based sumar executiv (no AI) ────────────────────────────────────

function buildSumarText(s: SumarExecutiv, scor: number, tier: RiskTier): string {
  const tierLabel =
    tier === 'critic' ? 'CRITIC' :
    tier === 'ridicat' ? 'ridicat' :
    tier === 'moderat' ? 'moderat' : 'scazut'

  const parts: string[] = []

  // Contracte
  if (s.contracte_expirate > 0)
    parts.push(`${s.contracte_expirate} contract${s.contracte_expirate > 1 ? 'e expirate' : ' expirat'}`)
  if (s.contracte_expira_curand > 0)
    parts.push(`${s.contracte_expira_curand} contract${s.contracte_expira_curand > 1 ? 'e in expirare' : ' in expirare'} (≤45 zile)`)
  if (s.contracte_expirate === 0 && s.contracte_expira_curand === 0 && s.contracte_active > 0)
    parts.push(`${s.contracte_active} contracte active — toate in termen`)

  // Tranzactii
  if (s.tranzactii_restante > 0)
    parts.push(`${s.tranzactii_restante} plata restanta (${s.tranzactii_neplatite_ron.toFixed(0)} RON intarziat)`)
  else if (s.tranzactii_neplatite > 0)
    parts.push(`${s.tranzactii_neplatite} tranzacti${s.tranzactii_neplatite === 1 ? 'e' : 'i'} neplatite — ${s.tranzactii_neplatite_ron.toFixed(0)} RON`)
  else if (s.contracte_active > 0)
    parts.push('toate tranzactiile achitate')

  // Utilaje
  if (s.utilaje_cu_alerte > 0)
    parts.push(`${s.utilaje_cu_alerte}/${s.utilaje_total} utilaj${s.utilaje_cu_alerte > 1 ? 'e' : ''} cu alerte documentare`)
  else if (s.utilaje_total > 0)
    parts.push(`${s.utilaje_total} utilaje fara alerte documentare`)

  // Stocuri
  if (s.stocuri_epuizate > 0)
    parts.push(`${s.stocuri_epuizate} produs${s.stocuri_epuizate > 1 ? 'e epuizate' : ' epuizat'}`)
  else if (s.stocuri_scazute > 0)
    parts.push(`${s.stocuri_scazute} produs${s.stocuri_scazute > 1 ? 'e cu stoc scazut' : ' cu stoc scazut'}`)

  // Activitati
  if (s.activitati_restante > 0)
    parts.push(`${s.activitati_restante} activitat${s.activitati_restante === 1 ? 'e' : 'i'} de camp restante`)
  else if (s.activitati_azi > 0)
    parts.push(`${s.activitati_azi} activitat${s.activitati_azi === 1 ? 'e' : 'i'} planificate pentru astazi`)

  if (parts.length === 0) return `Situatie generala buna. Scor risc: ${scor}/100 (${tierLabel}).`
  return parts.join('; ') + `. Scor risc global: ${scor}/100 (${tierLabel}).`
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest): Promise<NextResponse<AlerteResponse>> {
  const errors: string[] = []
  const today = new Date()
  const yearStart = `${today.getFullYear()}-01-01`
  const todayStr = today.toISOString().split('T')[0]

  const EMPTY_SUMAR: SumarExecutiv = {
    contracte_active: 0, contracte_expira_curand: 0, contracte_expirate: 0,
    tranzactii_neplatite: 0, tranzactii_restante: 0, tranzactii_neplatite_ron: 0,
    utilaje_total: 0, utilaje_cu_alerte: 0,
    stocuri_epuizate: 0, stocuri_scazute: 0,
    activitati_restante: 0, activitati_azi: 0, arendasi_afectati: 0,
    uit_expira_curand: 0,
  }

  try {
    const db = await createClient()

    // ── Queries 1–4 run in parallel (independent) ─────────────────────────────
    const [
      { data: contractsRaw, error: cErr },
      { data: ordersRaw,    error: oErr },
      { data: stockRaw,     error: sErr },
      { data: machinesRaw,  error: mErr },
      { data: txRaw,        error: txErr },
    ] = await Promise.all([
      db.from('contracts')
        .select('id, contract_number, status, end_date, annual_rent, lessor_id, lessors(first_name, last_name, company_name, type)')
        .neq('status', 'DRAFT')
        .limit(100),
      db.from('work_orders')
        .select('id, operation_type, status, planned_date, parcels(bloc_fizic, parcel_nr)')
        .gte('planned_date', yearStart)
        .order('planned_date', { ascending: true })
        .limit(80),
      db.from('input_lots')
        .select('id, product_name, category, quantity, quantity_available, unit, expiry_date')
        .order('category')
        .limit(100),
      db.from('machines')
        .select('id, name, type, brand, model, year, plate, is_active, rca_expiry_date')
        .eq('is_active', true)
        .order('name')
        .limit(50),
      db.from('transactions')
        .select('id, lessor_id, contract_id, ron_net, is_paid, campaign_year, transaction_date, product_name, is_previzionata')
        .eq('is_previzionata', false)
        .order('transaction_date', { ascending: false })
        .limit(200),
    ])
    if (cErr)   errors.push(`Contracte: ${cErr.message}`)
    if (oErr)   errors.push(`Activitati: ${oErr.message}`)
    if (sErr)   errors.push(`Stocuri: ${sErr.message}`)
    if (mErr)   errors.push(`Utilaje: ${mErr.message}`)
    if (txErr)  errors.push(`Tranzactii: ${txErr.message}`)

    // ── 5. Maintenance tasks (depends on machinesRaw) ─────────────────────────
    const machineIds = (machinesRaw ?? []).map((m: any) => m.id as string)
    let maintenanceRaw: any[] = []
    if (machineIds.length > 0) {
      const { data: mtRaw, error: mtErr } = await db
        .from('maintenance_tasks')
        .select('id, machine_id, title, type, due_date, status')
        .in('machine_id', machineIds)
        .in('status', ['PLANIFICAT', 'IN_EXECUTIE'])
        .order('due_date', { ascending: true })
        .limit(50)
      if (mtErr) errors.push(`Mentenanta: ${mtErr.message}`)
      maintenanceRaw = mtRaw ?? []
    }

    // ── 7. Lessors for transactions (no ambiguous PostgREST join) ──────────────
    const lessorIds = [
      ...new Set((txRaw ?? []).map((t: any) => t.lessor_id).filter(Boolean)),
    ] as string[]
    let lessorMap: Record<string, any> = {}
    if (lessorIds.length > 0) {
      const { data: lData, error: lErr } = await db
        .from('lessors')
        .select('id, type, first_name, last_name, company_name')
        .in('id', lessorIds)
      if (lErr) errors.push(`Arendatori (tx): ${lErr.message}`)
      lessorMap = Object.fromEntries((lData ?? []).map((l: any) => [l.id, l]))
    }

    // ── 8. Contracts for transactions (to expose contract_number & contract_id) ─
    const contractIdsFromTx = [
      ...new Set((txRaw ?? []).map((t: any) => t.contract_id).filter(Boolean)),
    ] as string[]
    let txContractMap: Record<string, any> = {}
    if (contractIdsFromTx.length > 0) {
      const { data: cData, error: cErr2 } = await db
        .from('contracts')
        .select('id, contract_number')
        .in('id', contractIdsFromTx)
      if (cErr2) errors.push(`Contracte (tx): ${cErr2.message}`)
      txContractMap = Object.fromEntries((cData ?? []).map((c: any) => [c.id, c]))
    }

    // ══════════════════════════════════════════════════════════════════════════
    // BUILD SECTION ROWS
    // ══════════════════════════════════════════════════════════════════════════

    // ── Contracte ─────────────────────────────────────────────────────────────
    const contracte: ContractAlerta[] = (contractsRaw ?? []).map((c: any) => {
      const l = c.lessors
      const lessorName = l
        ? (l.type === 'LEGAL' ? (l.company_name ?? '—') : `${l.last_name ?? ''} ${l.first_name ?? ''}`.trim() || '—')
        : '—'
      const { status: docStatus, days } = computeDocStatus(c.end_date, today)
      // If DB says EXPIRED, treat as expired regardless of date
      const effectiveStatus: DocStatus = c.status === 'EXPIRED' ? 'expired' : docStatus
      return {
        id: c.id,
        contract_number: c.contract_number,
        lessor_name: lessorName,
        lessor_id: c.lessor_id ?? null,
        end_date: c.end_date ?? null,
        status_db: c.status,
        doc_status: effectiveStatus,
        days_until_expiry: days,
        annual_rent: Number(c.annual_rent ?? 0),
        priority: alertPriorityFromDoc(effectiveStatus),
      }
    })

    // ── Ferma (work orders) ───────────────────────────────────────────────────
    // Filter completed/cancelled in JS (safe across any status naming convention)
    const DONE_STATUSES = new Set(['DONE', 'COMPLETED', 'FINALIZAT', 'ANULAT', 'CANCELLED'])
    const ferma: FermaAlerta[] = (ordersRaw ?? [])
      .filter((o: any) => !DONE_STATUSES.has(o.status))
      .map((o: any) => {
        const plannedDate = safeDate(o.planned_date)
        // How many days overdue (positive = overdue; negative = days until planned)
        const overdueDays = plannedDate ? daysDiff(plannedDate, today) : null
        const isOverdue = overdueDays !== null && overdueDays > 0
        const parcelCode =
          o.parcels?.bloc_fizic ?? o.parcels?.parcel_nr ?? null
        let priority: AlertPriority = 'scazuta'
        if (isOverdue && (overdueDays ?? 0) > 7) priority = 'inalta'
        else if (isOverdue) priority = 'medie'
        else if (overdueDays !== null && overdueDays > -3) priority = 'medie'  // due within 3 days
        return {
          id: o.id,
          operation_type: o.operation_type ?? '—',
          parcel_code: parcelCode,
          status_db: o.status ?? 'NECUNOSCUT',
          planned_date: o.planned_date ?? null,
          overdue_days: overdueDays,
          is_overdue: isOverdue,
          priority,
        }
      })

    // ── Stocuri ───────────────────────────────────────────────────────────────
    // Only expose items with stock issues OR expiry concerns
    const stocuriAll: StocAlerta[] = (stockRaw ?? []).map((s: any) => {
      const qty = Number(s.quantity_available ?? 0)
      const qtyOrig = Number(s.quantity ?? 0)
      const pct = qtyOrig > 0 ? Math.round((qty / qtyOrig) * 100) : qty > 0 ? 100 : 0
      const stockStatus = computeStocStatus(qty, qtyOrig)
      const expiryResult = s.expiry_date ? computeDocStatus(s.expiry_date, today) : null
      let priority: AlertPriority = 'scazuta'
      if (stockStatus === 'epuizat' || stockStatus === 'critic') priority = 'inalta'
      else if (stockStatus === 'scazut') priority = 'medie'
      if (expiryResult?.status === 'expired' || expiryResult?.status === 'expiring_critical') priority = 'inalta'
      else if (expiryResult?.status === 'expiring_soon' && priority === 'scazuta') priority = 'medie'
      return {
        id: s.id,
        product_name: s.product_name,
        category: s.category,
        quantity_available: qty,
        quantity_original: qtyOrig,
        unit: s.unit,
        pct_remaining: pct,
        stock_status: stockStatus,
        priority,
        expiry_date: s.expiry_date ?? null,
        expiry_doc_status: expiryResult?.status ?? null,
      }
    })
    // Only show items with any issue (hides fully-stocked items without expiry)
    const stocuri = stocuriAll.filter(
      s => s.stock_status !== 'ok' || (s.expiry_doc_status !== null && s.expiry_doc_status !== 'valid'),
    )

    // ── Utilaje ───────────────────────────────────────────────────────────────
    const tasksByMachine: Record<string, any[]> = {}
    for (const t of maintenanceRaw) {
      if (!tasksByMachine[t.machine_id]) tasksByMachine[t.machine_id] = []
      tasksByMachine[t.machine_id].push(t)
    }

    const utilaje: UtilajeAlerta[] = (machinesRaw ?? []).map((m: any) => {
      const rcaResult = computeDocStatus(m.rca_expiry_date, today)
      const tasks = tasksByMachine[m.id] ?? []
      const itpTask     = tasks.find((t: any) => t.type === 'ITP')
      const serviceTask = tasks.find((t: any) =>
        t.type === 'SERVICE' || t.type === 'REVIZIE' || t.type === 'REPARATIE',
      )
      const itpResult     = itpTask     ? computeDocStatus(itpTask.due_date, today)     : null
      const serviceResult = serviceTask ? computeDocStatus(serviceTask.due_date, today) : null

      const priorities = [
        docStatusToPriority(rcaResult.status),
        docStatusToPriority(itpResult?.status ?? null),
        docStatusToPriority(serviceResult?.status ?? null),
      ]
      const overall_priority: 'high' | 'medium' | 'low' =
        priorities.includes('high')   ? 'high' :
        priorities.includes('medium') ? 'medium' : 'low'

      return {
        id:                  m.id,
        name:                m.name,
        type:                m.type,
        brand:               m.brand  ?? null,
        model:               m.model  ?? null,
        year:                m.year   ?? null,
        plate:               m.plate  ?? null,
        rca_expiry_date:     m.rca_expiry_date ?? null,
        rca_status:          rcaResult.status,
        rca_days:            rcaResult.days,
        itp_task_title:      itpTask?.title    ?? null,
        itp_due_date:        itpTask?.due_date ?? null,
        itp_status:          itpResult?.status ?? null,
        itp_days:            itpResult?.days   ?? null,
        service_task_title:  serviceTask?.title    ?? null,
        service_due_date:    serviceTask?.due_date ?? null,
        service_status:      serviceResult?.status ?? null,
        service_days:        serviceResult?.days   ?? null,
        overall_priority,
        uit_expiry_days: null,
        uit_cod: null,
      }
    })

    // ── Tranzactii ────────────────────────────────────────────────────────────
    const tranzactii: TranzactieAlerta[] = (txRaw ?? []).map((t: any) => {
      const lessor = t.lessor_id ? lessorMap[t.lessor_id] : null
      const lessorName = lessor
        ? (lessor.type === 'LEGAL'
          ? (lessor.company_name ?? '—')
          : `${lessor.last_name ?? ''} ${lessor.first_name ?? ''}`.trim() || '—')
        : '—'
      const contract = t.contract_id ? txContractMap[t.contract_id] : null
      const { status, is_overdue } = computePaymentStatus(
        t.is_paid === true,
        t.transaction_date,
        today,
      )
      return {
        id:               t.id,
        lessor_name:      lessorName,
        lessor_id:        t.lessor_id   ?? null,
        contract_id:      t.contract_id ?? null,
        contract_number:  contract?.contract_number ?? null,
        product_name:     t.product_name ?? '—',
        campaign_year:    t.campaign_year,
        transaction_date: t.transaction_date ?? null,
        ron_net:          Number(t.ron_net ?? 0),
        is_paid:          t.is_paid === true,
        payment_status:   status,
        is_overdue,
      }
    })

    // ── Insights ──────────────────────────────────────────────────────────────
    const insights = computeInsights(contracte, tranzactii, utilaje, stocuri, ferma)

    // ── Sumar executiv ────────────────────────────────────────────────────────
    const unpaidTx = tranzactii.filter(t => !t.is_paid)
    const arendasiSet = new Set(unpaidTx.map(t => t.lessor_id).filter(Boolean))

    const sumar: SumarExecutiv = {
      contracte_active:         contracte.filter(c => c.status_db === 'ACTIVE').length,
      contracte_expira_curand:  contracte.filter(c =>
        c.doc_status === 'expiring_soon' || c.doc_status === 'expiring_critical',
      ).length,
      contracte_expirate:       contracte.filter(c =>
        c.doc_status === 'expired' || c.status_db === 'EXPIRED',
      ).length,
      tranzactii_neplatite:     unpaidTx.length,
      tranzactii_restante:      tranzactii.filter(t => t.is_overdue).length,
      tranzactii_neplatite_ron: unpaidTx.reduce((s, t) => s + t.ron_net, 0),
      utilaje_total:            utilaje.length,
      utilaje_cu_alerte:        utilaje.filter(u => u.overall_priority !== 'low').length,
      stocuri_epuizate:         stocuri.filter(s =>
        s.stock_status === 'epuizat' || s.stock_status === 'critic',
      ).length,
      stocuri_scazute:          stocuri.filter(s => s.stock_status === 'scazut').length,
      activitati_restante:      ferma.filter(f => f.is_overdue).length,
      activitati_azi:           ferma.filter(f => f.planned_date === todayStr).length,
      arendasi_afectati:        arendasiSet.size,
      uit_expira_curand:        0,
    }

    // ── Risk score ────────────────────────────────────────────────────────────
    const { score: scor_risc, tier: scor_tier } = computeRiskScore(
      contracte, tranzactii, utilaje, stocuri, ferma,
    )

    // ── Sumar text ────────────────────────────────────────────────────────────
    const sumar_text = buildSumarText(sumar, scor_risc, scor_tier)

    return NextResponse.json(
      {
        ok: true,
        generat_la: new Date().toISOString(),
        contracte,
        ferma,
        stocuri,
        utilaje,
        tranzactii,
        uit: [],
        insights,
        sumar,
        sumar_text,
        scor_risc,
        scor_tier,
        errors,
      },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } },
    )
  } catch (err) {
    console.error('[Alerte] Uncaught error in GET handler:', err)
    return NextResponse.json(
      {
        ok: false,
        generat_la: new Date().toISOString(),
        contracte: [], ferma: [], stocuri: [], utilaje: [], tranzactii: [], uit: [],
        insights: [], sumar: EMPTY_SUMAR, sumar_text: 'Nu s-a putut incarca situatia fermei.',
        scor_risc: 0, scor_tier: 'scazut' as const,
        errors, error: String(err),
      },
      { status: 500 },
    )
  }
}
