/**
 * ArendaPro — Alerte Operationale types
 * 100% deterministic, DB-driven. No AI / Groq dependency.
 */

export type DocStatus =
  | 'valid'
  | 'expiring_soon'       // 8–45 days  (32 days → expiring_soon, NOT valid)
  | 'expiring_critical'   // 1–7 days
  | 'expired'             // <= 0 days past expiry
  | 'missing'             // null / empty / not set
  | 'invalid_date'        // unparseable / pre-2000 / epoch

export type AlertPaymentStatus = 'paid' | 'unpaid' | 'overdue_unpaid'
export type RiskTier = 'scazut' | 'moderat' | 'ridicat' | 'critic'
export type AlertPriority = 'inalta' | 'medie' | 'scazuta'
export type StocStatus = 'epuizat' | 'critic' | 'scazut' | 'ok'

// ─── Per-section row types ────────────────────────────────────────────────────

export interface ContractAlerta {
  id: string
  contract_number: string
  lessor_name: string
  lessor_id: string | null
  end_date: string | null
  status_db: string             // 'ACTIVE' | 'EXPIRED' | 'DRAFT'
  doc_status: DocStatus
  days_until_expiry: number | null
  annual_rent: number
  priority: AlertPriority
}

export interface FermaAlerta {
  id: string
  operation_type: string
  parcel_code: string | null
  status_db: string
  planned_date: string | null
  overdue_days: number | null   // positive = days overdue
  is_overdue: boolean
  priority: AlertPriority
}

export interface StocAlerta {
  id: string
  product_name: string
  category: string
  quantity_available: number
  quantity_original: number
  unit: string
  pct_remaining: number         // 0–100
  stock_status: StocStatus
  priority: AlertPriority
  expiry_date: string | null
  expiry_doc_status: DocStatus | null
}

export interface UtilajeAlerta {
  id: string
  name: string
  type: string
  brand: string | null
  model: string | null
  year: number | null
  plate: string | null
  rca_expiry_date: string | null
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

export interface TranzactieAlerta {
  id: string
  lessor_name: string
  lessor_id: string | null
  contract_id: string | null     // ← use for /contracte/[id] navigation
  contract_number: string | null
  product_name: string
  campaign_year: number
  transaction_date: string | null
  ron_net: number
  is_paid: boolean
  payment_status: AlertPaymentStatus
  is_overdue: boolean
}

export interface AlertaInsight {
  impact: 'mare' | 'mediu' | 'mic'
  categorie: string
  titlu: string
  descriere: string
}

export interface SumarExecutiv {
  contracte_active: number
  contracte_expira_curand: number
  contracte_expirate: number
  tranzactii_neplatite: number
  tranzactii_restante: number
  tranzactii_neplatite_ron: number
  utilaje_total: number
  utilaje_cu_alerte: number
  stocuri_epuizate: number
  stocuri_scazute: number
  activitati_restante: number
  activitati_azi: number
  arendasi_afectati: number
}

export interface AlerteResponse {
  ok: boolean
  generat_la: string
  contracte: ContractAlerta[]
  ferma: FermaAlerta[]
  stocuri: StocAlerta[]
  utilaje: UtilajeAlerta[]
  tranzactii: TranzactieAlerta[]
  insights: AlertaInsight[]
  sumar: SumarExecutiv
  sumar_text: string
  scor_risc: number
  scor_tier: RiskTier
  errors: string[]
  error?: string
}
