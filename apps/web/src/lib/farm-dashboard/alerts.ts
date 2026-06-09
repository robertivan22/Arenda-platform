// ─── Deterministic alert rules ────────────────────────────────────────────────
import type { Alert, SoilData, WeatherData, NdviData } from './types'

interface AlertInputs {
  weather: WeatherData
  soil: SoilData
  ndvi: NdviData
  bbch_stage: number | null
}

export function computeAlerts({ weather, soil, ndvi, bbch_stage }: AlertInputs): Alert[] {
  const alerts: Alert[] = []
  const { drop_pct, current: nc, cloud_block } = ndvi
  const { moisture_avg: sa, status: ss } = soil
  const { temp_min_48h, precip_7d_mm } = weather

  // ── NDVI drop > 25% ──────────────────────────────────────────────────────
  if (drop_pct != null && drop_pct > 25) {
    alerts.push({
      type: 'ndvi_drop',
      severity: 'critical',
      message: `Scădere NDVI critică: -${drop_pct.toFixed(1)}% față de perioada anterioară.`,
    })
  } else if (drop_pct != null && drop_pct > 15) {
    // ── NDVI drop 15-25% ───────────────────────────────────────────────────
    alerts.push({
      type: 'ndvi_drop',
      severity: 'high',
      message: `Scădere NDVI semnificativă: -${drop_pct.toFixed(1)}% față de perioada anterioară.`,
    })
  }

  // ── NDVI critically low < 0.2 ────────────────────────────────────────────
  if (nc != null && nc < 0.2 && !cloud_block) {
    alerts.push({
      type: 'ndvi_critical',
      severity: 'critical',
      message: `NDVI extrem de scăzut (${nc.toFixed(2)}) — posibilă degradare a culturii.`,
    })
  }

  // ── Drought / soil moisture ───────────────────────────────────────────────
  if (sa != null) {
    if (sa < 0.15) {
      alerts.push({
        type: 'drought_risk',
        severity: 'critical',
        message: `Umiditate sol critică (${sa.toFixed(3)} m³/m³) — risc ridicat de secetă.`,
      })
    } else if (sa < 0.25) {
      alerts.push({
        type: 'drought_risk',
        severity: 'high',
        message: `Umiditate sol scăzută (${sa.toFixed(3)} m³/m³) — monitorizare necesară.`,
      })
    }
  }

  // ── Frost risk ───────────────────────────────────────────────────────────
  if (temp_min_48h != null) {
    if (temp_min_48h < 0) {
      alerts.push({
        type: 'frost_risk',
        severity: 'critical',
        message: `Risc de îngheț: temperatură minimă prognozată ${temp_min_48h}°C.`,
      })
    } else if (
      temp_min_48h <= 2 &&
      bbch_stage != null &&
      bbch_stage >= 51 &&
      bbch_stage <= 69
    ) {
      // Flowering / grain fill stage is most susceptible to late frost
      alerts.push({
        type: 'frost_risk',
        severity: 'high',
        message: `Temperatură minimă joasă (${temp_min_48h}°C) în faza BBCH ${bbch_stage} — sensibilitate la brumă.`,
      })
    }
  }

  // ── Excess soil moisture ─────────────────────────────────────────────────
  if (sa != null && sa > 0.45) {
    alerts.push({
      type: 'excess_moisture',
      severity: 'medium',
      message: `Exces umiditate sol (${sa.toFixed(3)} m³/m³) — risc de asfixiere radiculară.`,
    })
  }

  // ── No rain + critical soil ───────────────────────────────────────────────
  if (precip_7d_mm != null && precip_7d_mm < 5 && ss === 'critic') {
    alerts.push({
      type: 'no_rain_stress',
      severity: 'high',
      message: `Precipitații reduse (${precip_7d_mm} mm/7 zile) cu sol critic — stres hidric sever.`,
    })
  }

  return alerts
}
