// Campaign / Agricultural Season — the temporal anchor for all modules

export interface Campaign {
  id: string
  user_id: string
  name: string
  year: number
  start_date: string        // ISO date
  end_date: string | null
  is_active: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CropPlan {
  id: string
  user_id: string
  campaign_id: string
  parcel_id: string
  crop: string
  planned_area_ha: number | null
  seed_variety: string | null
  planned_yield_t_ha: number | null
  status: 'PLANIFICAT' | 'IN_PRODUCTIE' | 'RECOLTAT' | 'ABANDONAT'
  notes: string | null
  created_at: string
}

export type WorkOrderStatus = 'PLANIFICAT' | 'IN_EXECUTIE' | 'FINALIZAT' | 'ANULAT'

export interface WorkOrder {
  id: string
  user_id: string
  campaign_id: string
  parcel_id: string | null
  title: string
  operation_type: string
  planned_date: string | null
  completed_date: string | null
  machine_id: string | null
  operator_id: string | null
  area_ha: number | null
  status: WorkOrderStatus
  notes: string | null
  created_at: string
  // Joined fields
  parcels?: { parcel_nr: string | null; tarla_nr: string | null } | null
  machines?: { name: string } | null
  operators?: { name: string } | null
}

export interface WorkOrderInput {
  id: string
  user_id: string
  work_order_id: string
  product_name: string
  unit: string
  planned_qty: number | null
  actual_qty: number | null
  lot_id: string | null   // FK -> input_lots (Phase 1 inventory)
  cost_per_unit: number | null
  notes: string | null
  created_at: string
}

export interface HarvestLot {
  id: string
  user_id: string
  campaign_id: string
  parcel_id: string
  harvest_date: string | null
  crop: string
  yield_t_ha: number | null
  total_yield_t: number | null
  moisture_pct: number | null
  storage_location: string | null
  notes: string | null
  created_at: string
  // Joined fields
  parcels?: { parcel_nr: string | null; tarla_nr: string | null; locality: string | null } | null
}
