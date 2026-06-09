// ─── Sentinel Hub Statistical API client ─────────────────────────────────────
// Requires: SENTINEL_HUB_CLIENT_ID + SENTINEL_HUB_CLIENT_SECRET (server-side only)
// Gracefully returns null NDVI data when credentials are absent or on any error.
import type { NdviData } from './types'

// Copernicus Data Space Ecosystem (CDSE) endpoints
const SH_TOKEN_URL =
  'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token'
const SH_BASE_URL = 'https://sh.dataspace.copernicus.eu'
const SH_STATS_URL = `${SH_BASE_URL}/api/v1/statistics`

// CDSE-compatible evalscript: 2-band output (B0=NDVI, B1=dataMask)
// index() is a built-in CDSE helper: (a-b)/(a+b)
const NDVI_EVALSCRIPT = `//VERSION=3
function evaluatePixel(samples) {
  let val = index(samples.B08, samples.B04);
  return [val, samples.dataMask];
}

function setup() {
  return {
    input: [{ bands: ["B04", "B08", "dataMask"] }],
    output: { bands: 2 }
  }
}`

interface ShBandStats {
  mean: number
  sampleCount: number
  noDataCount: number
}

interface ShInterval {
  interval: { from: string; to: string }
  status: string
  // CDSE 2-band unnamed output: B0=NDVI value, B1=dataMask mean
  outputs: { default?: { bands?: { B0?: { stats?: ShBandStats }; B1?: { stats?: ShBandStats } } } }
}

interface ShStatsEntry {
  mean: number | null
  sampleCount: number
  date: string
}

export async function getSentinelToken(clientId: string, clientSecret: string): Promise<string> {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), 10000)
  const res = await fetch(SH_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
    signal: controller.signal,
  })
  clearTimeout(id)
  if (!res.ok) throw new Error(`SH token: ${res.status}`)
  const data = (await res.json()) as { access_token: string }
  return data.access_token
}

export async function fetchNdviStats(
  token: string,
  lat: number,
  lng: number,
): Promise<{ current: ShStatsEntry | null; prev: ShStatsEntry | null }> {
  const pad = 0.005 // ~500 m bounding box
  const bbox = [
    Math.round((lng - pad) * 1e6) / 1e6,
    Math.round((lat - pad) * 1e6) / 1e6,
    Math.round((lng + pad) * 1e6) / 1e6,
    Math.round((lat + pad) * 1e6) / 1e6,
  ]

  const now = new Date()
  const to = new Date(now); to.setDate(to.getDate() + 1)
  const from = new Date(now); from.setDate(from.getDate() - 20)
  const fmt = (d: Date) => d.toISOString().split('T')[0] + 'T00:00:00Z'

  const body = {
    input: {
      bounds: {
        bbox,
        properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' },
      },
      data: [{ type: 'sentinel-2-l2a', dataFilter: { mosaickingOrder: 'leastCC', maxCloudCoverage: 80 } }],
    },
    aggregation: {
      timeRange: { from: fmt(from), to: fmt(to) },
      aggregationInterval: { of: 'P10D' },
    },
    evalscript: NDVI_EVALSCRIPT,
  }

  try {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), 20000)
    const res = await fetch(SH_STATS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(id)
    if (!res.ok) return { current: null, prev: null }

    const data = (await res.json()) as { data?: ShInterval[] }
    const intervals = (data.data ?? []).filter(
      d => d.status === 'OK' || d.status === 'PARTIAL',
    )
    if (intervals.length === 0) return { current: null, prev: null }

    const extract = (item: ShInterval): ShStatsEntry | null => {
      const stats = item?.outputs?.default?.bands?.B0?.stats
      if (!stats) return null
      // Use dataMask band mean to detect cloud blocking (low mean = mostly clouded)
      const maskMean = item?.outputs?.default?.bands?.B1?.stats?.mean ?? 1
      const effectiveSampleCount = maskMean < 0.2 ? 0 : stats.sampleCount
      return {
        mean: isNaN(stats.mean) ? null : Math.round(stats.mean * 1000) / 1000,
        sampleCount: effectiveSampleCount,
        date: item.interval.to,
      }
    }

    const current = extract(intervals[intervals.length - 1])
    const prev = intervals.length >= 2 ? extract(intervals[intervals.length - 2]) : null
    return { current, prev }
  } catch {
    return { current: null, prev: null }
  }
}

export function normalizeNdvi(
  current: ShStatsEntry | null,
  prev: ShStatsEntry | null,
): NdviData {
  const ndvi_current = current?.mean ?? null
  const ndvi_prev = prev?.mean ?? null
  const cloud_block = current == null || current.sampleCount < 100
  const scene_date = current?.date?.split('T')[0] ?? null

  if (ndvi_current == null || ndvi_prev == null || ndvi_prev <= 0) {
    return { current: ndvi_current, prev: ndvi_prev, trend: null, drop_pct: null, cloud_block, scene_date }
  }

  const ratio = ndvi_current / ndvi_prev
  const trend: NdviData['trend'] = ratio > 1.05 ? 'up' : ratio < 0.92 ? 'down' : 'stable'
  const drop_pct = Math.round(((ndvi_prev - ndvi_current) / ndvi_prev) * 1000) / 10

  return { current: ndvi_current, prev: ndvi_prev, trend, drop_pct, cloud_block, scene_date }
}
