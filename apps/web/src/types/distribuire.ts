// ─── Types for Distribuire Arendă feature ─────────────────────────────────────

export type DeliveryMethod = 'siloz' | 'livrare_ferma' | 'transfer_bancar'
export type ConversionStatus = 'confirmed' | 'draft' | 'cancelled'
export type LessorType = 'NATURAL' | 'LEGAL' | 'PFA'

// ─── Domain entities ──────────────────────────────────────────────────────────

export interface Landlord {
  id: string
  code: string
  type: LessorType
  first_name: string
  last_name: string
  company_name: string | null
  cnp: string
  county: string
  locality: string
  phone: string | null
  email: string | null
  status: 'ACTIVE' | 'INACTIVE'
  // computed
  displayName: string
  activeContractsCount: number
  totalContractedKg: number
  distributedKg: number
}

export interface LandlordSearchResult {
  id: string
  code: string
  type: LessorType
  first_name: string
  last_name: string
  company_name: string | null
  cnp: string
  county: string
  locality: string
  status: 'ACTIVE' | 'INACTIVE'
}

export interface Contract {
  id: string
  contract_number: string
  contract_type: string
  start_date: string
  end_date: string
  status: string
  zone: string | null
  annual_rent: number
  lessor_id: string
}

export interface CropPrice {
  id: string
  crop_name: string
  price_per_kg: number
  source: 'MADR' | 'MANUAL'
  effective_date: string
  notes: string | null
}

export interface ArendaConversion {
  id: string
  user_id: string
  lessor_id: string
  contract_id: string
  campaign_id: string | null
  from_crop_name: string
  from_quantity_kg: number
  from_price_per_kg: number
  to_crop_name: string
  to_quantity_kg: number
  to_price_per_kg: number
  conversion_rate: number
  value_ron: number
  delivery_method: DeliveryMethod
  distribution_date: string
  notes: string | null
  status: ConversionStatus
  transaction_id: string | null
  created_at: string
  // joined
  lessor_name?: string
  contract_number?: string
}

export interface LandlordDistributionStatus {
  total_kg: number
  distributed_kg: number
  remaining_kg: number
  percent_distributed: number
  value_ron: number
  conversions: ArendaConversion[]
}

// ─── Form schema types ────────────────────────────────────────────────────────

export interface DistributionFormData {
  lessor_id: string
  contract_id: string
  from_crop_name: string
  from_quantity_kg: number
  to_crop_name: string
  to_quantity_kg: number
  conversion_rate: number
  from_price_per_kg: number
  to_price_per_kg: number
  distribution_date: string
  delivery_method: DeliveryMethod
  notes?: string
}

export interface DistributionResult {
  conversionId: string
  transactionId: string
}

// ─── Page-level stats ─────────────────────────────────────────────────────────

export interface DistribuirePageStats {
  totalToDistributeKg: number
  distributedKg: number
  remainingKg: number
  activeLandlordsCount: number
  pendingPaymentsCount: number
  activeCampaignName: string
  activeCampaignId: string | null
}

// ─── Conversion calculator ────────────────────────────────────────────────────

export interface ConversionResult {
  toQuantityKg: number
  valueRon: number
  rate: number
}
