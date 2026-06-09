// ─── Main pipeline orchestrator ──────────────────────────────────────────────
import type { ParcelInput, ParcelResult, FarmDashboardResult, WeatherData, SoilData, NdviData } from './types'
import { fetchOpenMeteo, normalizeWeather, normalizeSoil } from './open-meteo'
import { fetchNdviStats, normalizeNdvi } from './sentinel-hub'
import { computeAlerts } from './alerts'
import { computeHealthScore } from './scoring'
import { computeSummary } from './summary'

const NULL_WEATHER: WeatherData = {
  temp_current: null, temp_min_48h: null, temp_max_48h: null,
  precip_7d_mm: null, forecast_rain_48h: null, et0_today: null, condition_label: null,
}
const NULL_SOIL: SoilData = { moisture_avg: null, status: null }
const NULL_NDVI: NdviData = { current: null, prev: null, trend: null, drop_pct: null, cloud_block: true, scene_date: null }

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
  }
}

function validCoords(lat: number, lng: number): boolean {
  return (
    isFinite(lat) && isFinite(lng) &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180 &&
    !(lat === 0 && lng === 0)
  )
}

async function processParcel(input: ParcelInput, shToken: string | null): Promise<ParcelResult> {
  if (!validCoords(input.lat, input.lng)) return nullParcel(input)

  const [weatherSettled, ndviSettled] = await Promise.allSettled([
    fetchOpenMeteo(input.lat, input.lng),
    shToken ? fetchNdviStats(shToken, input.lat, input.lng) : Promise.resolve(null),
  ])

  const rawWeather = weatherSettled.status === 'fulfilled' ? weatherSettled.value : null
  const weather = normalizeWeather(rawWeather)
  const soil = normalizeSoil(rawWeather)

  const ndviRaw = ndviSettled.status === 'fulfilled' ? ndviSettled.value : null
  const ndvi = ndviRaw
    ? normalizeNdvi(ndviRaw.current, ndviRaw.prev)
    : { ...NULL_NDVI }

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
  }
}

/** Process in batches to stay well within Cloudflare Worker concurrent fetch limits */
async function processBatched(inputs: ParcelInput[], shToken: string | null, batchSize = 4): Promise<ParcelResult[]> {
  const results: ParcelResult[] = []
  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize)
    const settled = await Promise.allSettled(batch.map(p => processParcel(p, shToken)))
    for (let j = 0; j < batch.length; j++) {
      const r = settled[j]
      results.push(r.status === 'fulfilled' ? r.value : nullParcel(batch[j]))
    }
  }
  return results
}

export async function computeFarmDashboard(
  inputs: ParcelInput[],
  shToken: string | null,
): Promise<FarmDashboardResult> {
  const valid = inputs.filter(p => p.lat != null && p.lng != null)
  const parcels = await processBatched(valid, shToken)
  return {
    fetched_at: new Date().toISOString(),
    parcels,
    summary: computeSummary(parcels),
  }
}
