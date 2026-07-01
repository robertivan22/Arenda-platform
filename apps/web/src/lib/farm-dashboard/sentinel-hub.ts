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

  const tokenController = new AbortController()
  const tokenTimeout = setTimeout(() => tokenController.abort(), 8000)
  let tokenRes: Response
  try {
    tokenRes = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      }),
      signal: tokenController.signal,
    })
  } finally {
    clearTimeout(tokenTimeout)
  }
  const res = tokenRes

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

  console.info('[NDVI] Request bbox=', params.bbox, 'from=', params.from, 'to=', params.to)

  const payload = {
    input: {
      bounds: {
        bbox: params.bbox,
        // Explicitly declare WGS84 so CDSE interprets lon/lat coordinates correctly.
        properties: { crs: 'http://www.opengis.net/def/crs/EPSG/0/4326' },
      },
      data: [
        {
          type: 'sentinel-2-l2a',
          // maxCloudCoverage filters which Sentinel-2 scenes are included in the mosaic.
          // 35% gives a good balance: rejects very cloudy scenes while still finding
          // several cloud-free acquisitions over a 90-day window in central Europe.
          dataFilter: { maxCloudCoverage: 35 },
        },
      ],
    },
    aggregation: {
      timeRange: { from: params.from, to: params.to },
      aggregationInterval: { of: params.aggregationInterval ?? 'P10D' },
      // Resolution must be in the native units of the CRS (EPSG:4326 = degrees).
      // 0.0001° ≈ 11m in latitude, ≈ 8m in longitude at 44°N — close to
      // Sentinel-2's native 10m, well under the S2L2A 1500 m/px API limit.
      resx: 0.0001,
      resy: 0.0001,
      evalscript: `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B04", "B08", "dataMask"] }],
    output: [
      { id: "default", bands: 1 },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(samples) {
  var ndvi = (samples.B08 - samples.B04) / (samples.B08 + samples.B04 + 0.0001);
  return {
    default: [ndvi],
    dataMask: [samples.dataMask]
  };
}`,
    },
  }

  const statsController = new AbortController()
  const statsTimeout = setTimeout(() => statsController.abort(), 15000)
  let res: Response
  try {
    res = await fetch(`${baseUrl}/api/v1/statistics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
      signal: statsController.signal,
    })
  } finally {
    clearTimeout(statsTimeout)
  }

  // Always read as text first so we can log the raw body on failure or empty data.
  const rawText = await res.text()

  if (!res.ok) {
    console.error('[NDVI] Statistics API error', res.status, rawText.slice(0, 500))
    throw new Error(`Sentinel Stats API error (${res.status}): ${rawText.slice(0, 200)}`)
  }

  let json: StatsResponse
  try {
    json = JSON.parse(rawText) as StatsResponse
  } catch {
    console.error('[NDVI] Failed to parse Stats API response:', rawText.slice(0, 500))
    throw new Error('Failed to parse Statistics API response')
  }

  const intervalCount = json.data?.length ?? 0
  const validCount = (json.data ?? []).filter(d => {
    const m = d.outputs?.default?.bands?.B0?.stats?.mean
    return typeof m === 'number' && isFinite(m)
  }).length
  if (intervalCount === 0) {
    console.warn('[NDVI] Empty data. Full response body:', rawText.slice(0, 1000))
  } else {
    console.info('[NDVI] Stats response: total intervals =', intervalCount, 'valid =', validCount)
  }
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
  // 90-day lookback: gives 9 × P10D intervals; with maxCloudCoverage 35% this
  // reliably yields ≥2 cloud-free intervals over Romania in any season.
  const fromDate = new Date(`${params.fetchDate}T00:00:00Z`)
  fromDate.setUTCDate(fromDate.getUTCDate() - 90)
  const from = fromDate.toISOString().replace('.000Z', 'Z')

  const stats = await fetchParcelNdviStats({ bbox, from, to, aggregationInterval: 'P10D' })
  return extractParcelNdvi(stats)
}
