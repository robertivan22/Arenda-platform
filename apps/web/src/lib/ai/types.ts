// ─── ArendaPro AI Types ───────────────────────────────────────────────────────

export type Priority = 'inalta' | 'medie' | 'scazuta'
export type ContractStatus = 'expirat' | 'critic' | 'atentie' | 'ok'
export type StockStatus = 'critic' | 'scazut' | 'ok'
export type UtilajeStatus = 'critic' | 'atentie' | 'ok' | 'necunoscut'

export interface ContractAlert {
  contract_number: string
  lessor_name: string
  status: ContractStatus
  priority: Priority
  end_date: string | null
  days_until_expiry: number | null
  suprafata_ha: number | null
  mesaj: string
  actiune_recomandata: string
}

export interface FarmAlert {
  activitate: string
  parcela: string | null
  status: string
  priority: Priority
  data_planificata: string | null
  intarziere_zile: number | null
  mesaj: string
  actiune_recomandata: string
}

export interface StockAlert {
  produs: string
  categorie: string
  status: StockStatus
  priority: Priority
  cantitate_disponibila: number
  unitate: string
  valoare_estimata: number | null
  mesaj: string
  actiune_recomandata: string
}

export interface UtilajeAlert {
  utilaj: string
  tip: string
  status: UtilajeStatus
  priority: Priority
  rca_expiry: string | null
  mentenanta_pending: string | null
  mesaj: string
  actiune_recomandata: string
}

export interface FacturaAlert {
  invoice_number: string
  status: string
  priority: Priority
  total_amount: number
  due_date: string | null
  mesaj: string
  actiune_recomandata: string
}

export interface TranzactieAlert {
  lessor_name: string
  status: 'neplatita' | 'platita_recent'
  priority: Priority
  suma_ron: number
  campanie: number
  produs: string
  mesaj: string
  actiune_recomandata: string
}

export interface AnalysisResult {
  sumar: string
  scor_risc: number
  generat_la: string
  contracte: ContractAlert[]
  ferma: FarmAlert[]
  stocuri: StockAlert[]
  utilaje: UtilajeAlert[]
  tranzactii: TranzactieAlert[]
}

// ─── Mode ────────────────────────────────────────────────────────────────────

export type AssistantMode = 'full_analysis' | 'qa'

// ─── API request / response ───────────────────────────────────────────────────

export interface AssistantRequest {
  mode: AssistantMode
  question?: string
  context?: Record<string, unknown>
}

export interface AssistantResponse {
  data_errors?: string[]
  ok: boolean
  mode: AssistantMode
  result?: AnalysisResult
  answer?: string
  error?: string
  model?: string
  tokens_used?: number
}
