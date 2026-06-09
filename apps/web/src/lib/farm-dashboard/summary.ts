// ─── Farm-level summary aggregator ───────────────────────────────────────────
import type { ParcelResult, FarmSummary, HealthLabel } from './types'
import { healthLabel } from './scoring'

export function computeSummary(parcels: ParcelResult[]): FarmSummary {
  if (parcels.length === 0) {
    return {
      total_area_ha: 0, avg_ndvi: null, avg_soil_moisture: null,
      avg_temp: null, total_alerts: 0, critical_alerts: 0,
      farm_health_score: 0, farm_health_label: 'Critic',
    }
  }

  const total_area_ha = r2(parcels.reduce((s, p) => s + (p.area_ha ?? 0), 0))

  // Area-weighted farm health score
  const withArea = parcels.filter(p => (p.area_ha ?? 0) > 0)
  let farm_health_score: number
  if (withArea.length > 0) {
    const totalArea = withArea.reduce((s, p) => s + p.area_ha!, 0)
    farm_health_score = Math.round(
      withArea.reduce((s, p) => s + p.health_score * p.area_ha!, 0) / totalArea,
    )
  } else {
    farm_health_score = Math.round(
      parcels.reduce((s, p) => s + p.health_score, 0) / parcels.length,
    )
  }

  const farm_health_label: HealthLabel = healthLabel(farm_health_score)

  const ndvis = parcels.map(p => p.ndvi.current).filter((v): v is number => v != null)
  const avg_ndvi = ndvis.length > 0 ? r3(ndvis.reduce((a, b) => a + b, 0) / ndvis.length) : null

  const soils = parcels.map(p => p.soil.moisture_avg).filter((v): v is number => v != null)
  const avg_soil_moisture = soils.length > 0 ? r3(soils.reduce((a, b) => a + b, 0) / soils.length) : null

  const temps = parcels.map(p => p.weather.temp_current).filter((v): v is number => v != null)
  const avg_temp = temps.length > 0 ? r1(temps.reduce((a, b) => a + b, 0) / temps.length) : null

  const all_alerts = parcels.flatMap(p => p.alerts)
  const total_alerts = all_alerts.length
  const critical_alerts = all_alerts.filter(a => a.severity === 'critical').length

  return {
    total_area_ha, avg_ndvi, avg_soil_moisture, avg_temp,
    total_alerts, critical_alerts, farm_health_score, farm_health_label,
  }
}

const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100
const r3 = (n: number) => Math.round(n * 1000) / 1000
