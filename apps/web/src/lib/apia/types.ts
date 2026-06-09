// ─── APIA module domain types ─────────────────────────────────────────────────

export type DossierStatus =
  | 'DRAFT'         // Being prepared
  | 'CHECKING'      // Under internal completeness check
  | 'READY'         // All checks pass — ready to submit to AGI Online
  | 'SUBMITTED'     // Submitted via AGI Online portal
  | 'UNDER_REVIEW'  // APIA is reviewing (post-submission)
  | 'ACCEPTED'      // APIA accepted the dossier
  | 'CORRECTED'     // Corrected via M1-M4 forms after submission
  | 'ARCHIVED'      // Campaign closed

export type InterventionCategory =
  | 'DIRECT'
  | 'ANT'
  | 'ECO_SCHEMA'
  | 'DR'
  | 'ZOOTEHNIC'
  | 'OTHER'

export type LandUseCode =
  | 'AR'  // Arabil
  | 'PS'  // Pășune
  | 'FN'  // Fânețe
  | 'LV'  // Livadă
  | 'VI'  // Vie
  | 'AL'  // Alte terenuri agricole

export type LandRightType =
  | 'ARENDA'
  | 'PROPRIETATE'
  | 'CONCESIUNE'
  | 'COMODAT'
  | 'ASOCIERE'
  | 'OTHER'

export type ChangeFormType =
  | 'M1'    // Modificare declarație suprafețe
  | 'M1.1'  // Modificare declarație zotehnică
  | 'M1.2'  // Modificare declarație apă irigații
  | 'M1.3'  // Modificare declarație protecție plante / echipament
  | 'M1.4'  // Modificare declarație terase
  | 'M1.5'  // Modificare studii agrochimice
  | 'M2'    // Completare cerere
  | 'M3'    // Retragere parțială
  | 'M4'    // Modificare date administrative / bancare / societate

export type DocumentStatus = 'MISSING' | 'UPLOADED' | 'VERIFIED' | 'EXPIRED' | 'NOT_APPLICABLE'

// ─── Supabase row shapes ──────────────────────────────────────────────────────

export interface ApiaCampaign {
  id: string
  user_id: string
  year: number
  name: string
  status: 'DRAFT' | 'ACTIVE' | 'CLOSED'
  submission_start: string | null
  submission_end: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ApiaDossier {
  id: string
  user_id: string
  campaign_year: number
  agi_dossier_number: string | null
  exploitation_code: string | null
  status: DossierStatus
  submission_date: string | null
  accepted_date: string | null
  correction_deadline: string | null
  total_declared_ha: number
  total_eligible_ha: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ApiaDossierParcel {
  id: string
  user_id: string
  dossier_id: string
  parcel_id: string | null
  lpis_block_code: string | null
  tarla_nr: string | null
  parcel_nr: string | null
  county: string | null
  locality: string | null
  siruta_code: string | null
  declared_surface_ha: number
  land_use_code: LandUseCode | null
  lpis_reference_ha: number | null
  overlap_flag: boolean
  eligible: boolean
  ineligible_reason: string | null
  land_right_type: LandRightType | null
  land_right_reference: string | null
  land_right_valid_from: string | null
  land_right_valid_until: string | null
  land_right_expired: boolean  // computed in view: valid_until < CURRENT_DATE
  notes: string | null
  created_at: string
}

export interface ApiaIntervention {
  id: string
  code: string
  name: string
  category: InterventionCategory
  subcategory: string | null
  description: string | null
  year_from: number
  year_to: number | null
  is_active: boolean
  sort_order: number
}

export interface ApiaDossierIntervention {
  id: string
  user_id: string
  dossier_id: string
  intervention_id: string
  status: 'PENDING' | 'ELIGIBLE' | 'INELIGIBLE'
  notes: string | null
  created_at: string
  // joined
  apia_interventions?: ApiaIntervention
}

export interface ApiaDossierDocument {
  id: string
  user_id: string
  dossier_id: string
  intervention_id: string | null
  document_type: string
  document_label: string
  file_url: string | null
  reference_number: string | null
  issue_date: string | null
  valid_until: string | null
  status: DocumentStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ApiaChangeRequest {
  id: string
  user_id: string
  dossier_id: string
  form_type: ChangeFormType
  description: string | null
  submission_date: string | null
  deadline_date: string | null
  status: 'DRAFT' | 'SUBMITTED' | 'PROCESSED' | 'REJECTED'
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ApiaZootechnicalDeclaration {
  id: string
  user_id: string
  dossier_id: string
  exploitation_code: string | null
  species: string
  head_count: number
  uat_code: string | null
  bnd_updated: boolean
  ansvsa_confirmed: boolean
  declaration_date: string | null
  notes: string | null
  created_at: string
}

export interface ApiaAuditLog {
  id: string
  user_id: string
  dossier_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  old_value: unknown
  new_value: unknown
  notes: string | null
  created_at: string
}

// ─── View model (enriched for UI) ────────────────────────────────────────────

export interface DossierSummary extends ApiaDossier {
  parcel_count: number
  missing_doc_count: number
  intervention_count: number
  completeness_pct: number  // 0–100
}

// ─── Rules engine types ───────────────────────────────────────────────────────

export interface DocumentRequirement {
  type: string
  label: string
  mandatory: boolean
  notes?: string
}
