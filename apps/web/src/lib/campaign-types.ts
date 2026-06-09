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
