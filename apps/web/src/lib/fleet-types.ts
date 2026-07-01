export interface Machine {
  id: string
  user_id: string
  name: string
  type: string
  brand: string | null
  model: string | null
  year: number | null
  plate: string | null
  fuel_type: string
  notes: string | null
  is_active: boolean
  current_hours: number | null
  current_km: number | null
  engine_hp: number | null
  vin: string | null
  purchase_date: string | null
  purchase_price: number | null
  rca_active: boolean | null
  rca_price: number | null
  rca_expiry_date: string | null
  // TARIC fields
  taric_code: string | null
  taric_validated: boolean | null
  taric_description: string | null
  taric_checked_at: string | null
  // Import fields (added 20260701)
  tara_origine: string | null
  data_import: string | null
  import_extra_ue: boolean | null
  created_at: string
  updated_at: string
}

export interface TransportUit {
  id: string
  user_id: string
  machine_id: string | null
  transaction_id: string | null
  cod_uit: string
  tip_operatiune: 'import' | 'export' | 'national' | 'intracomunitar'
  status: 'activ' | 'expirat' | 'utilizat' | 'anulat'
  data_declarare: string
  valabil_de: string
  valabil_pana: string
  loc_incarcare: string | null
  loc_descarcare: string | null
  greutate_kg: number | null
  valoare_ron: number | null
  document_referinta: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface TaricValidationResult {
  code: string
  normalized_code: string
  code_level: 'HS' | 'CN' | 'TARIC' | null
  format_valid: boolean
  exists_in_taric: boolean | null
  valid_for_reference_date: boolean | null
  description: string | null
  valid_from?: string | null
  valid_to?: string | null
  message: string
  error?: boolean
}

export interface Implement {
  id: string
  user_id: string
  name: string
  type: string
  brand: string | null
  model: string | null
  year: number | null
  notes: string | null
  is_active: boolean
  created_at: string
}

export interface Operator {
  id: string
  user_id: string
  name: string
  phone: string | null
  license_category: string | null
  notes: string | null
  is_active: boolean
  created_at: string
}

export interface FuelLog {
  id: string
  user_id: string
  machine_id: string
  log_date: string
  liters: number
  cost_per_liter: number | null
  total_cost: number | null   // GENERATED column, null when cost_per_liter is null
  odometer_km: number | null
  hours_meter: number | null
  location: string | null
  notes: string | null
  created_at: string
}

export interface MaintenanceTask {
  id: string
  user_id: string
  machine_id: string
  title: string
  type: string
  due_date: string | null
  due_hours: number | null
  due_km: number | null
  completed_date: string | null
  completed_hours: number | null
  cost: number | null
  service_provider: string | null
  notes: string | null
  status: 'PLANIFICAT' | 'IN_EXECUTIE' | 'FINALIZAT' | 'ANULAT'
  created_at: string
}

export interface MachineWorkLog {
  id: string
  user_id: string
  machine_id: string
  implement_id: string | null
  operator_id: string | null
  work_order_id: string | null
  parcel_id: string | null
  campaign_id: string | null
  log_date: string
  operation_type: string | null
  hours_worked: number | null
  area_worked_ha: number | null
  fuel_consumed_l: number | null
  start_hours: number | null
  end_hours: number | null
  notes: string | null
  created_at: string
  // Joined fields from Supabase nested select
  operators?: { name: string } | null
  implements?: { name: string } | null
}

export interface TelematicsDevice {
  id: string
  user_id: string
  machine_id: string | null
  device_serial: string | null
  provider: string | null
  api_token_ref: string | null
  last_sync_at: string | null
  is_active: boolean
  created_at: string
}
