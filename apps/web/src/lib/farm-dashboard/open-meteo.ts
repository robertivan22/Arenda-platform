// ─── Open-Meteo API client – free, no key required ───────────────────────────
import type { WeatherData, SoilData } from './types'

const BASE_URL = 'https://api.open-meteo.com/v1/forecast'

interface OpenMeteoResponse {
  current?: {
    time: string
    temperature_2m: number | null
    weather_code: number | null
  }
  hourly?: {
    time: string[]
    soil_moisture_0_to_1cm: (number | null)[]
    soil_moisture_1_to_3cm: (number | null)[]
    soil_moisture_3_to_9cm: (number | null)[]
  }
  daily?: {
    time: string[]
    temperature_2m_max: (number | null)[]
    temperature_2m_min: (number | null)[]
    precipitation_sum: (number | null)[]
    et0_fao_evapotranspiration: (number | null)[]
  }
}

const WMO_LABELS: Record<number, string> = {
  0: 'Senin', 1: 'Predominant senin', 2: 'Parțial noros', 3: 'Noros',
  45: 'Ceață', 48: 'Ceață cu chiciură',
  51: 'Burniță ușoară', 53: 'Burniță moderată', 55: 'Burniță densă',
  61: 'Ploaie ușoară', 63: 'Ploaie moderată', 65: 'Ploaie puternică',
  71: 'Ninsoare ușoară', 73: 'Ninsoare moderată', 75: 'Ninsoare puternică',
  80: 'Averse ușoare', 81: 'Averse moderate', 82: 'Averse violente',
  85: 'Averse de ninsoare', 86: 'Averse de ninsoare puternice',
  95: 'Furtună', 96: 'Furtună cu grindină ușoară', 99: 'Furtună cu grindină puternică',
}

export async function fetchOpenMeteo(lat: number, lng: number): Promise<OpenMeteoResponse | null> {
  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lng),
      current: 'temperature_2m,weather_code',
      hourly: 'soil_moisture_0_to_1cm,soil_moisture_1_to_3cm,soil_moisture_3_to_9cm',
      daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration',
      past_days: '7',
      forecast_days: '3',
      timezone: 'Europe/Bucharest',
    })
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), 12000)
    const res = await fetch(`${BASE_URL}?${params}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
    clearTimeout(id)
    if (!res.ok) return null
    return res.json() as Promise<OpenMeteoResponse>
  } catch {
    return null
  }
}

export function normalizeWeather(raw: OpenMeteoResponse | null): WeatherData {
  const empty: WeatherData = {
    temp_current: null, temp_min_48h: null, temp_max_48h: null,
    precip_7d_mm: null, forecast_rain_48h: null, et0_today: null, condition_label: null,
  }
  if (!raw) return empty

  const temp_current = raw.current?.temperature_2m ?? null
  const code = raw.current?.weather_code ?? null
  const condition_label = code != null ? (WMO_LABELS[code] ?? null) : null

  if (!raw.daily) return { ...empty, temp_current, condition_label }

  // daily array: indices 0-6 = past 7 days, index 7 = today, 8 = tomorrow, 9 = day+2
  const today = new Date().toISOString().split('T')[0]
  let todayIdx = raw.daily.time.findIndex(t => t === today)
  if (todayIdx < 0) todayIdx = raw.daily.time.length - 3

  const mins = raw.daily.temperature_2m_min
  const maxs = raw.daily.temperature_2m_max
  const precips = raw.daily.precipitation_sum
  const et0s = raw.daily.et0_fao_evapotranspiration

  const pastPrecip = precips.slice(0, todayIdx).filter((v): v is number => v != null)
  const precip_7d_mm = pastPrecip.length > 0 ? r1(pastPrecip.reduce((a, b) => a + b, 0)) : null

  const fcastPrecip = [precips[todayIdx], precips[todayIdx + 1]].filter((v): v is number => v != null)
  const forecast_rain_48h = fcastPrecip.length > 0 ? r1(fcastPrecip.reduce((a, b) => a + b, 0)) : null

  const t0 = mins[todayIdx] ?? null
  const t1 = mins[todayIdx + 1] ?? null
  const temp_min_48h = t0 != null && t1 != null ? Math.min(t0, t1) : (t0 ?? t1)

  const x0 = maxs[todayIdx] ?? null
  const x1 = maxs[todayIdx + 1] ?? null
  const temp_max_48h = x0 != null && x1 != null ? Math.max(x0, x1) : (x0 ?? x1)

  const et0_today = et0s[todayIdx] != null ? r2(et0s[todayIdx]!) : null

  return { temp_current, temp_min_48h, temp_max_48h, precip_7d_mm, forecast_rain_48h, et0_today, condition_label }
}

export function normalizeSoil(raw: OpenMeteoResponse | null): SoilData {
  if (!raw?.hourly) return { moisture_avg: null, status: null }

  const h = raw.hourly
  const nowHour = new Date().toISOString().slice(0, 13) // "2026-06-09T12"
  let curIdx = h.time.findIndex(t => t.startsWith(nowHour))
  if (curIdx < 0) curIdx = h.time.length - 1

  const hourlyAvgs: number[] = []
  for (let i = Math.max(0, curIdx - 2); i <= curIdx; i++) {
    const vals = [
      h.soil_moisture_0_to_1cm[i],
      h.soil_moisture_1_to_3cm[i],
      h.soil_moisture_3_to_9cm[i],
    ].filter((v): v is number => v != null)
    if (vals.length > 0) hourlyAvgs.push(vals.reduce((a, b) => a + b, 0) / vals.length)
  }

  if (hourlyAvgs.length === 0) return { moisture_avg: null, status: null }

  const moisture_avg = r3(hourlyAvgs.reduce((a, b) => a + b, 0) / hourlyAvgs.length)

  let status: SoilData['status']
  if (moisture_avg < 0.15) status = 'critic'
  else if (moisture_avg < 0.25) status = 'scazut'
  else if (moisture_avg <= 0.40) status = 'optim'
  else status = 'ridicat'

  return { moisture_avg, status }
}

const r1 = (n: number) => Math.round(n * 10) / 10
const r2 = (n: number) => Math.round(n * 100) / 100
const r3 = (n: number) => Math.round(n * 1000) / 1000
