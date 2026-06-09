// ─── Sentinel Hub / CDSE Statistics API client ───────────────────────────────
// Collection: sentinel-2-l2a (L2A = BOA, atmospherically corrected — correct for analytics).
// Statistics API v1, unnamed 2-band output: B0=NDVI, B1=dataMask.
// Evalscript uses explicit formula (index() helper not guaranteed in Stats API).

export type BBox = [number, number, number, number]

type TokenResponse = {
  access_token: string
  expires_in: number
  token_type: string
}

type StatsBand = {
  stats?: {
    min?: number
    max?: number
    mean?: number
    stDev?: number
    sampleCount?: number
    noDataCount?: number
    percentiles?: Record<string, number>
  }
}

type StatsItem = {
  interval?: { from?: string; to?: string }
  // Unnamed 2-band output: B0 = NDVI value, B1 = dataMask
  outputs?: {
    default?: {
      bands?: {
        B0?: StatsBand
        B1?: StatsBand
      }
    }
  }
}

type StatsResponse = { data?: StatsItem[] }

export type ParcelNdviResult = {
  current: number | null
  prev: number | null
  trend: 'up' | 'down' | 'stable' | null
  drop_pct: number | null
  cloud_block: boolean
  scene_date: string | null
  intervals: Array<{
    from: string | null
    to: string | null
    mean: number | null
    sampleCount: number | null
    noDataCount: number | null
    cloudBlock: boolean
  }>
}

let cachedToken: { value: string; expiresAt: number } | null = null

function round(value: number, digits: number) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export function parcelToBBox(lat: number, lng: number, delta = 0.005): BBox {
  return [lng - delta, lat - delta, lng + delta, lat + delta]
}

export async function getSentinelHubAccessToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && now < cachedToken.expiresAt - 60_000) return cachedToken.value

  const clientId = process.env.SENTINEL_HUB_CLIENT_ID
  const clientSecret = process.env.SENTINEL_HUB_CLIENT_SECRET
  const tokenUrl =
    process.env.SENTINEL_HUB_TOKEN_URL ||
    'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token'

  if (!clientId || !clientSecret) {
    throw new Error('Missing SENTINEL_HUB_CLIENT_ID or SENTINEL_HUB_CLIENT_SECRET')
  }

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Sentinel Hub token error (${res.status}): ${text}`)
  }

  const json = (await res.json()) as TokenResponse
  cachedToken = { value: json.access_token, expiresAt: now + json.expires_in * 1000 }
  return json.access_token
}

export async function fetchParcelNdviStats(params: {
  bbox: BBox
  from: string
  to: string
  aggregationInterval?: string
}): Promise<StatsResponse> {
  const token = await getSentinelHubAccessToken()
  const baseUrl =
    process.env.SENTINEL_HUB_BASE_URL || 'https://sh.dataspace.copernicus.eu'

  const payload = {
    input: {
      bounds: { bbox: params.bbox },
      data: [
        {
          type: 'sentinel-2-l2a',
          // maxCloudCoverage filters scenes at acquisition time.
          // Do NOT include timeRange here — it belongs only in aggregation.timeRange.
          dataFilter: { maxCloudCoverage: 20 },
        },
      ],
    },
    aggregation: {
      timeRange: { from: params.from, to: params.to },
      aggregationInterval: { of: params.aggregationInterval ?? 'P10D' },
      // Numeric analytics evalscript — NOT a color-ramp visualization script.
      // Band 0 (B0) = NDVI value (finite float), Band 1 (B1) = dataMask.
      // Explicit formula — avoids relying on index() helper availability in Stats API.
      evalscript: `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "dataMask"] }],
    output: { bands: 2 }
  };
}
function evaluatePixel(samples) {
  var ndvi = (samples.B08 - samples.B04) / (samples.B08 + samples.B04 + 0.0001);
  return [ndvi, samples.dataMask];
}`,
    },
  }

  const res = await fetch(`${baseUrl}/api/v1/statistics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('[NDVI] Statistics API error', res.status, text)
    throw new Error(`Sentinel Stats API error (${res.status}): ${text}`)
  }

  const json = (await res.json()) as StatsResponse
  const validCount = (json.data ?? []).filter(d => {
    const m = d.outputs?.default?.bands?.B0?.stats?.mean
    return typeof m === 'number' && isFinite(m)
  }).length
  console.info('[NDVI] Stats response: total intervals =', json.data?.length ?? 0, 'valid =', validCount)
  return json
}

export function extractParcelNdvi(stats: StatsResponse): ParcelNdviResult {
  const intervals = (stats.data ?? [])
    .map((item) => {
      // Unnamed output: B0 = NDVI band, B1 = dataMask band
      const ndviStats = item.outputs?.default?.bands?.B0?.stats
      const sampleCount = typeof ndviStats?.sampleCount === 'number' ? ndviStats.sampleCount : null
      const noDataCount = typeof ndviStats?.noDataCount === 'number' ? ndviStats.noDataCount : null
      const rawMean = ndviStats?.mean
      const mean = typeof rawMean === 'number' && isFinite(rawMean) ? round(rawMean, 3) : null
      // cloud_block = true when fewer than 10 valid (non-masked) pixels were
      // aggregated. A tiny sampleCount means NDVI is statistically unreliable.
      const cloudBlock = sampleCount === null || sampleCount < 10
      return {
        from: item.interval?.from ?? null,
        to: item.interval?.to ?? null,
        mean,
        sampleCount,
        noDataCount,
        cloudBlock,
      }
    })
    .filter((x) => x.mean !== null && !x.cloudBlock)

  const current = intervals.at(-1) ?? null
  const prev = intervals.length > 1 ? intervals[intervals.length - 2] : null

  let trend: 'up' | 'down' | 'stable' | null = null
  let dropPct: number | null = null

  if (current?.mean != null && prev?.mean != null && prev.mean > 0) {
    if (current.mean > prev.mean * 1.05) trend = 'up'
    else if (current.mean < prev.mean * 0.92) trend = 'down'
    else trend = 'stable'
    dropPct = round(((prev.mean - current.mean) / prev.mean) * 100, 1)
  }

  return {
    current: current?.mean ?? null,
    prev: prev?.mean ?? null,
    trend,
    drop_pct: dropPct,
    cloud_block: current?.cloudBlock ?? true,
    scene_date: current?.to ?? current?.from ?? null,
    intervals,
  }
}

export async function getParcelNdviFromLatLng(params: {
  lat: number
  lng: number
  fetchDate: string // YYYY-MM-DD
  bboxDelta?: number
}): Promise<ParcelNdviResult> {
  const bbox = parcelToBBox(params.lat, params.lng, params.bboxDelta ?? 0.01)
  const to = `${params.fetchDate}T23:59:59Z`
  // 60-day lookback: at 20% maxCloudCoverage in central/eastern Europe we need
  // a wider window to guarantee ≥2 valid P10D intervals for trend computation.
  const fromDate = new Date(`${params.fetchDate}T00:00:00Z`)
  fromDate.setUTCDate(fromDate.getUTCDate() - 60)
  const from = fromDate.toISOString().replace('.000Z', 'Z')

  const stats = await fetchParcelNdviStats({ bbox, from, to, aggregationInterval: 'P10D' })
  return extractParcelNdvi(stats)
}
