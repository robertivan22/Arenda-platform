// ─── Deterministic health scoring ────────────────────────────────────────────
import type { NdviData, SoilData, Alert, HealthLabel } from './types'

export function computeHealthScore(
  ndvi: NdviData,
  soil: SoilData,
  alerts: Alert[],
): { score: number; label: HealthLabel } {
  // NDVI component (0–40 pts)
  let ndvi_pts: number
  const nc = ndvi.current
  if (nc == null) ndvi_pts = 20          // unknown: neutral mid-score
  else if (nc >= 0.6) ndvi_pts = 40
  else if (nc >= 0.4) ndvi_pts = 25
  else if (nc >= 0.2) ndvi_pts = 10
  else ndvi_pts = 0

  // Soil component (0–35 pts)
  let soil_pts: number
  switch (soil.status) {
    case 'optim':   soil_pts = 35; break
    case 'scazut':  soil_pts = 20; break
    case 'ridicat': soil_pts = 15; break
    case 'critic':  soil_pts = 0;  break
    default:        soil_pts = 17          // unknown: neutral
  }

  // Alert penalties
  const criticals = alerts.filter(a => a.severity === 'critical').length
  const highs     = alerts.filter(a => a.severity === 'high').length
  const mediums   = alerts.filter(a => a.severity === 'medium').length

  const penalty = Math.min(criticals * 20, 40) + Math.min(highs * 10, 20) + Math.min(mediums * 5, 10)

  const raw = ndvi_pts + soil_pts - penalty
  const score = Math.max(0, Math.min(100, raw))

  return { score, label: healthLabel(score) }
}

export function healthLabel(score: number): HealthLabel {
  if (score <= 40) return 'Critic'
  if (score <= 65) return 'Moderat'
  if (score <= 85) return 'Bun'
  return 'Excelent'
}
