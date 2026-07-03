/**
 * Shared types for the onboarding wizard.
 */

export const STEPS = [
  'account_type',
  'fiscal_data',
  'import_parcels',
  'import_contracts',
  'alert_preferences',
] as const

export type Step = typeof STEPS[number] | 'completed'

export interface FiscalData {
  cui: string
  denumire: string
  adresaSediu: string
  codCaen: string
}

export interface OnboardingData {
  accountType?: 'PFA' | 'SRL'
  fiscal?: FiscalData
  parcelsImported?: boolean
  contractsImported?: boolean
  alertPreferences?: Record<string, boolean>
}

export interface OnboardingState {
  current_step: Step
  data: OnboardingData
  completed_at: string | null
  tour_seen_at: string | null
}

/** Map step → 0-based index (for progress bar). */
export function stepIndex(step: Step): number {
  const idx = STEPS.indexOf(step as typeof STEPS[number])
  return idx === -1 ? STEPS.length : idx
}

export const STEP_LABELS: Record<string, string> = {
  account_type: 'Tip cont',
  fiscal_data: 'Date fiscale',
  import_parcels: 'Parcele',
  import_contracts: 'Contracte',
  alert_preferences: 'Alerte',
}
