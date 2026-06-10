// ─── ArendaPro AI Types ───────────────────────────────────────────────────────

export type Priority = 'inalta' | 'medie' | 'scazuta'
export type ContractStatus = 'expirat' | 'critic' | 'atentie' | 'ok'
export type StockStatus = 'critic' | 'scazut' | 'ok'
export type UtilajeStatus = 'critic' | 'atentie' | 'ok'

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

export interface ApiaAlert {
  campaign_year: number
  status: string
  priority: Priority
  total_declared_ha: number
  mesaj: string
  actiune_recomandata: string
}

export interface FitosanitarAlert {
  produs: string
  parcela: string | null
  priority: Priority
  data_aplicarii: string | null
  mesaj: string
  actiune_recomandata: string
}

export interface ArendasiSumar {
  total: number
  total_suprafata_ha: number
}

export interface AnalysisResult {
  sumar: string
  scor_risc: number
  generat_la: string
  contracte: ContractAlert[]
  ferma: FarmAlert[]
  stocuri: StockAlert[]
  utilaje: UtilajeAlert[]
  facturi: FacturaAlert[]
  apia: ApiaAlert[]
  fitosanitar: FitosanitarAlert[]
  arendasi_sumar: ArendasiSumar
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
  ok: boolean
  mode: AssistantMode
  result?: AnalysisResult
  answer?: string
  error?: string
  model?: string
  tokens_used?: number
}
