// ─── Farm Intelligence Dashboard – shared types ──────────────────────────────

export interface ParcelInput {
  id: string
  apia_code?: string | null
  crop_type?: string | null
  bbch_stage?: number | null
  area_ha?: number | null
  lat: number
  lng: number
}

export type SoilStatus = 'critic' | 'scazut' | 'optim' | 'ridicat'
export type NdviTrend = 'up' | 'stable' | 'down'
export type AlertSeverity = 'critical' | 'high' | 'medium'
export type AlertType =
  | 'ndvi_drop'
  | 'ndvi_critical'
  | 'drought_risk'
  | 'frost_risk'
  | 'excess_moisture'
  | 'no_rain_stress'
export type HealthLabel = 'Critic' | 'Moderat' | 'Bun' | 'Excelent'

export interface WeatherData {
  temp_current: number | null
  temp_min_48h: number | null
  temp_max_48h: number | null
  precip_7d_mm: number | null
  forecast_rain_48h: number | null
  et0_today: number | null
  condition_label: string | null
}

export interface SoilData {
  moisture_avg: number | null
  status: SoilStatus | null
}

export interface NdviData {
  current: number | null
  prev: number | null
  trend: NdviTrend | null
  drop_pct: number | null
  cloud_block: boolean
  scene_date: string | null
}

export interface Alert {
  type: AlertType
  severity: AlertSeverity
  message: string
}

export interface ParcelResult {
  id: string
  apia_code: string | null
  crop_type: string | null
  bbch_stage: number | null
  area_ha: number | null
  weather: WeatherData
  soil: SoilData
  ndvi: NdviData
  alerts: Alert[]
  health_score: number
  health_label: HealthLabel
}

export interface FarmSummary {
  total_area_ha: number
  avg_ndvi: number | null
  avg_soil_moisture: number | null
  avg_temp: number | null
  total_alerts: number
  critical_alerts: number
  farm_health_score: number
  farm_health_label: HealthLabel
}

export interface FarmDashboardResult {
  fetched_at: string
  parcels: ParcelResult[]
  summary: FarmSummary
}
