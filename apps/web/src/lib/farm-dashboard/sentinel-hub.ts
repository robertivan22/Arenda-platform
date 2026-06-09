// ─── Sentinel Hub / CDSE Statistics API client ───────────────────────────────
// Named-output evalscript pattern required by Statistics API v1.
// Reads credentials from env: SENTINEL_HUB_CLIENT_ID, SENTINEL_HUB_CLIENT_SECRET

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
  outputs?: {
    ndvi?: { bands?: { B0?: StatsBand } }
    dataMask?: { bands?: { B0?: StatsBand } }
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
          dataFilter: {
            timeRange: { from: params.from, to: params.to },
          },
        },
      ],
    },
    aggregation: {
      timeRange: { from: params.from, to: params.to },
      aggregationInterval: { of: params.aggregationInterval ?? 'P5D' },
      evalscript: `//VERSION=3
function setup() {
  return {
    input: ["B04", "B08", "dataMask"],
    output: [
      { id: "ndvi", bands: 1 },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(sample) {
  let ndvi = (sample.B08 - sample.B04) / (sample.B08 + sample.B04 + 0.0001);
  return {
    ndvi: [ndvi],
    dataMask: [sample.dataMask]
  };
}`,
      calculations: {
        ndvi: { statistics: { default: {} } },
      },
    },
  }

  const res = await fetch(`${baseUrl}/api/v1/statistics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Sentinel Stats API error (${res.status}): ${text}`)
  }

  return (await res.json()) as StatsResponse
}

export function extractParcelNdvi(stats: StatsResponse): ParcelNdviResult {
  const intervals = (stats.data ?? [])
    .map((item) => {
      const ndviStats = item.outputs?.ndvi?.bands?.B0?.stats
      const sampleCount = typeof ndviStats?.sampleCount === 'number' ? ndviStats.sampleCount : null
      const noDataCount = typeof ndviStats?.noDataCount === 'number' ? ndviStats.noDataCount : null
      const mean = typeof ndviStats?.mean === 'number' ? round(ndviStats.mean, 3) : null
      const cloudBlock = sampleCount === null ? true : sampleCount < 100
      return {
        from: item.interval?.from ?? null,
        to: item.interval?.to ?? null,
        mean,
        sampleCount,
        noDataCount,
        cloudBlock,
      }
    })
    .filter((x) => x.mean !== null)

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
  const bbox = parcelToBBox(params.lat, params.lng, params.bboxDelta ?? 0.005)
  const to = `${params.fetchDate}T23:59:59Z`
  const fromDate = new Date(`${params.fetchDate}T00:00:00Z`)
  fromDate.setUTCDate(fromDate.getUTCDate() - 10)
  const from = fromDate.toISOString()

  const stats = await fetchParcelNdviStats({ bbox, from, to, aggregationInterval: 'P5D' })
  return extractParcelNdvi(stats)
}
