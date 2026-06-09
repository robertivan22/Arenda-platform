// ─── Main pipeline orchestrator ──────────────────────────────────────────────
import type { ParcelInput, ParcelResult, FarmDashboardResult, WeatherData, SoilData, NdviData } from './types'
import { fetchOpenMeteo, normalizeWeather, normalizeSoil } from './open-meteo'
import { getParcelNdviFromLatLng } from './sentinel-hub'
import { computeAlerts } from './alerts'
import { computeHealthScore } from './scoring'
import { computeSummary } from './summary'

const NULL_WEATHER: WeatherData = {
  temp_current: null, temp_min_48h: null, temp_max_48h: null,
  precip_7d_mm: null, forecast_rain_48h: null, et0_today: null, condition_label: null,
}
const NULL_SOIL: SoilData = { moisture_avg: null, status: null }
const NULL_NDVI: NdviData = { current: null, prev: null, trend: null, drop_pct: null, cloud_block: true, scene_date: null }
// NOTE: do NOT compute TODAY at module level — in Cloudflare Workers the
// Date API may return epoch (0) during cold-start module initialisation.
// Always derive the current date inside the request handler.

function nullParcel(input: ParcelInput): ParcelResult {
  return {
    id: input.id,
    apia_code: input.apia_code ?? null,
    crop_type: input.crop_type ?? null,
    bbch_stage: input.bbch_stage ?? null,
    area_ha: input.area_ha ?? null,
    weather: NULL_WEATHER,
    soil: NULL_SOIL,
    ndvi: NULL_NDVI,
    alerts: [],
    health_score: 50,
    health_label: 'Moderat',
    no_data: true,
  }
}

function validCoords(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' && typeof lng === 'number' &&
    isFinite(lat) && isFinite(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0)
  )
}

async function processParcel(input: ParcelInput): Promise<ParcelResult> {
  if (!validCoords(input.lat, input.lng)) {
    console.warn('[Dashboard] Invalid coords for parcel', input.id, { lat: input.lat, lng: input.lng })
    return nullParcel(input)
  }

  // Compute inside the request so Cloudflare Workers' Date API is fully live.
  const today = new Date().toISOString().split('T')[0]

  const [weatherSettled, ndviSettled] = await Promise.allSettled([
    fetchOpenMeteo(input.lat, input.lng),
    getParcelNdviFromLatLng({ lat: input.lat, lng: input.lng, fetchDate: today }),
  ])

  if (weatherSettled.status === 'rejected') {
    console.error('[Dashboard] Weather fetch rejected for', input.id, weatherSettled.reason)
  }
  if (ndviSettled.status === 'rejected') {
    console.error('[Dashboard] NDVI fetch rejected for', input.id, String(ndviSettled.reason))
  }

  const rawWeather = weatherSettled.status === 'fulfilled' ? weatherSettled.value : null
  const weather = normalizeWeather(rawWeather)
  const soil = normalizeSoil(rawWeather)

  const ndviResult = ndviSettled.status === 'fulfilled' ? ndviSettled.value : null
  const ndvi: NdviData = ndviResult ?? { ...NULL_NDVI }

  const no_data = (
    weather.temp_current == null &&
    soil.moisture_avg == null &&
    ndvi.current == null
  )

  const alerts = computeAlerts({ weather, soil, ndvi, bbch_stage: input.bbch_stage ?? null })
  const { score: health_score, label: health_label } = computeHealthScore(ndvi, soil, alerts)

  return {
    id: input.id,
    apia_code: input.apia_code ?? null,
    crop_type: input.crop_type ?? null,
    bbch_stage: input.bbch_stage ?? null,
    area_ha: input.area_ha ?? null,
    weather,
    soil,
    ndvi,
    alerts,
    health_score,
    health_label,
    no_data,
  }
}

/** Process in batches to stay well within Cloudflare Worker concurrent fetch limits */
async function processBatched(inputs: ParcelInput[], batchSize = 4): Promise<ParcelResult[]> {
  const results: ParcelResult[] = []
  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize)
    const settled = await Promise.allSettled(batch.map(p => processParcel(p)))
    for (let j = 0; j < batch.length; j++) {
      const r = settled[j]
      results.push(r.status === 'fulfilled' ? r.value : nullParcel(batch[j]))
    }
  }
  return results
}

export async function computeFarmDashboard(
  inputs: ParcelInput[],
): Promise<FarmDashboardResult> {
  const valid = inputs.filter(p => p.lat != null && p.lng != null)
  const parcels = await processBatched(valid)
  return {
    fetched_at: new Date().toISOString(),
    parcels,
    summary: computeSummary(parcels),
  }
}
