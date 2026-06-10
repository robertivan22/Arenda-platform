// ─── ArendaPro AI Types ───────────────────────────────────────────────────────

export type Priority = 'inalta' | 'medie' | 'scazuta'
export type ContractStatus = 'expirat' | 'critic' | 'atentie' | 'ok'
export type StockStatus = 'critic' | 'scazut' | 'ok'

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

export interface AnalysisResult {
  sumar: string
  scor_risc: number          // 0–100
  generat_la: string         // ISO timestamp
  contracte: ContractAlert[]
  ferma: FarmAlert[]
  stocuri: StockAlert[]
}

// ─── Mode ────────────────────────────────────────────────────────────────────

export type AssistantMode =
  | 'full_analysis'
  | 'contract_alerts'
  | 'farm_alerts'
  | 'inventory_alerts'
  | 'qa'

// ─── API request / response ───────────────────────────────────────────────────

export interface AssistantRequest {
  mode: AssistantMode
  question?: string          // used in 'qa' mode
  context?: Record<string, unknown>  // optional structured data to inject
}

export interface AssistantResponse {
  ok: boolean
  mode: AssistantMode
  result?: AnalysisResult
  answer?: string            // for 'qa' mode
  error?: string
  model?: string
  tokens_used?: number
}
