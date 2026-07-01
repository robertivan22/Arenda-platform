import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

/**
 * WMS Tile Proxy
 *
 * Proxies WMS GetMap tile requests server-side to bypass CORS restrictions on
 * Romanian government WMS services (ANCPI, APIA, MADR, etc.).
 *
 * Usage: GET /api/wms-proxy?url=<fully-encoded-wms-tile-url>
 *
 * Security:
 *  - Only whitelisted hostnames are proxied
 *  - Response content-type must be image/* or application/vnd.ogc.*
 *  - Responses are cached 1 hour (tiles don't change often)
 */

const ALLOWED_HOSTS = new Set([
  // ANCPI (Romanian National Cadastre) — uses plain HTTP
  'geoportal.ancpi.ro',
  'inspire.ancpi.ro',
  // APIA (Romanian Agency for Payments in Agriculture) — INSPIRE ArcGIS REST
  'inspire.apia.org.ro',
  'geoportal.apia.org.ro',
  // Other Romanian government services
  'servicii.apia.org.ro',
  'geoportal.madr.ro',
  'geoportal.gov.ro',
  'servicii.geo-spatial.org',
  'inspire.mmediu.ro',
  // Third-party basemap/imagery services
  'server.arcgisonline.com',
  'services.arcgisonline.com',
  'ows.eea.europa.eu',
  'sgx.geodatenzentrum.de',
])

// Hosts that publish only over HTTP (not HTTPS) — Romanian government legacy
const HTTP_ONLY_HOSTS = new Set([
  'geoportal.ancpi.ro',
])

// Content-types we accept from the upstream WMS
const ALLOWED_CONTENT_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/vnd.ogc',
]

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const rawUrl = searchParams.get('url')

  if (!rawUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  // Validate URL
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  // Allow HTTPS for all; allow plain HTTP only for known HTTP-only government hosts
  if (parsed.protocol === 'http:') {
    if (!HTTP_ONLY_HOSTS.has(parsed.hostname)) {
      return NextResponse.json({ error: 'HTTP only allowed for specific trusted hosts' }, { status: 400 })
    }
  } else if (parsed.protocol !== 'https:') {
    return NextResponse.json({ error: 'Only HTTP/HTTPS allowed' }, { status: 400 })
  }

  // Whitelist check
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return NextResponse.json(
      { error: `Host not allowed: ${parsed.hostname}` },
      { status: 403 },
    )
  }

  // Only allow WMS GetMap or WMTS GetTile requests
  const reqParam = (parsed.searchParams.get('REQUEST') ?? parsed.searchParams.get('request') ?? '').toUpperCase()
  const serviceParam = (parsed.searchParams.get('SERVICE') ?? parsed.searchParams.get('service') ?? 'WMS').toUpperCase()
  if (!['GETMAP', 'GETTILE', 'GETCAPABILITIES', ''].includes(reqParam)) {
    return NextResponse.json({ error: 'Only GetMap/GetTile/GetCapabilities allowed' }, { status: 400 })
  }
  // ArcGIS WMS sometimes sends an empty SERVICE param — allow it
  if (serviceParam !== '' && !['WMS', 'WMTS'].includes(serviceParam)) {
    return NextResponse.json({ error: 'Only WMS/WMTS service allowed' }, { status: 400 })
  }

  try {
    const upstream = await fetch(rawUrl, {
      headers: {
        'User-Agent': 'ArendaPlatform/1.0 (+https://arenda.ro)',
        'Accept': 'image/png,image/jpeg,image/*,*/*',
      },
      // No credentials — these are public map services
      credentials: 'omit',
    })

    const contentType = upstream.headers.get('content-type') ?? 'image/png'
    const isAllowed = ALLOWED_CONTENT_TYPES.some(t => contentType.startsWith(t))

    if (!isAllowed) {
      return NextResponse.json(
        { error: `Unexpected content type from upstream: ${contentType}` },
        { status: 502 },
      )
    }

    const body = await upstream.arrayBuffer()

    return new NextResponse(body, {
      status: upstream.status,
      headers: {
        'Content-Type': contentType,
        // Cache tiles for 1 hour — WMS cadastral/LPIS tiles rarely change intraday
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
        // Allow the browser to use these tiles in canvas (needed for Leaflet)
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (err) {
    console.error('[wms-proxy] upstream fetch error:', err)
    return NextResponse.json({ error: 'Upstream fetch failed' }, { status: 502 })
  }
}
