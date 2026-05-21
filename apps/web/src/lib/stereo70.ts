/**
 * Stereo 70 (EPSG:3844) — Romanian national projection for APIA/LPIS
 *
 * All agricultural parcel geometry is stored in Supabase using Stereo 70
 * coordinates (x, y in metres).  Leaflet displays in WGS84 (lat, lng),
 * so every boundary crossing (load / save) must convert.
 *
 * Coordinate ranges inside Romania:
 *   Stereo 70  X: ~200 000 – 900 000 m
 *   Stereo 70  Y: ~200 000 – 800 000 m
 *   WGS84      Lat: 43.5° – 48.3°    Lng: 20.2° – 29.7°
 */

import proj4 from 'proj4'

// ── Projection definitions ────────────────────────────────────────────────────

// WGS 84 (geographic, lat/lng)
proj4.defs('EPSG:4326', '+proj=longlat +datum=WGS84 +no_defs')

// Stereo 70 — EPSG:3844
// Note: APIA / ANCPI use Krasovsky ellipsoid with 1942(58) datum shifts.
// For web use the simplified WGS84-based definition matches to ~1 m accuracy.
proj4.defs(
  'EPSG:3844',
  '+proj=sterea +lat_0=46 +lon_0=25 +k=0.99975 +x_0=500000 +y_0=500000 ' +
  '+ellps=WGS84 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs',
)

// ── Single-point conversions ──────────────────────────────────────────────────

/**
 * WGS84 → Stereo 70
 * @param lng  WGS84 longitude  (Nominatim/GeoJSON order)
 * @param lat  WGS84 latitude
 * @returns    [x, y] in Stereo 70 metres
 */
export function wgs84ToStereo70(lng: number, lat: number): [number, number] {
  const [x, y] = proj4('EPSG:4326', 'EPSG:3844', [lng, lat]) as [number, number]
  return [x, y]
}

/**
 * Stereo 70 → WGS84
 * @param x  Stereo 70 easting
 * @param y  Stereo 70 northing
 * @returns  [lat, lng]  (Leaflet order — lat first)
 */
export function stereo70ToLeaflet(x: number, y: number): [number, number] {
  const [lng, lat] = proj4('EPSG:3844', 'EPSG:4326', [x, y]) as [number, number]
  return [lat, lng]
}

// ── Ring (coordinate array) conversions ───────────────────────────────────────

/**
 * Convert GeoJSON ring from WGS84 [lng, lat] → Stereo 70 [x, y].
 * The ring may be open (first ≠ last) or closed; both are preserved.
 */
export function ringWgs84ToStereo70(ring: number[][]): number[][] {
  return ring.map(([lng, lat]) => {
    const [x, y] = proj4('EPSG:4326', 'EPSG:3844', [lng, lat]) as [number, number]
    return [x, y]
  })
}

/**
 * Convert GeoJSON ring from Stereo 70 [x, y] → WGS84 [lng, lat].
 */
export function ringStereo70ToWgs84(ring: number[][]): number[][] {
  return ring.map(([x, y]) => {
    const [lng, lat] = proj4('EPSG:3844', 'EPSG:4326', [x, y]) as [number, number]
    return [lng, lat]
  })
}

// ── Area calculation (planar Shoelace on Stereo 70 — accurate for Romania) ───

/**
 * Calculate polygon area in hectares using the planar Shoelace formula
 * applied to Stereo 70 coordinates (units = metres).
 *
 * This is significantly more accurate than spherical approximations for
 * small agricultural parcels in Romania.
 *
 * @param ring  Stereo 70 ring [[x,y], …]  (closed or open)
 */
export function calcAreaHaStereo70(ring: number[][]): number {
  if (ring.length < 4) return 0
  // Remove closing duplicate if present
  const pts =
    ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
      ? ring.slice(0, -1)
      : ring

  let area = 0
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const [x1, y1] = pts[i]
    const [x2, y2] = pts[(i + 1) % n]
    area += x1 * y2 - x2 * y1
  }
  return Math.round((Math.abs(area) / 2 / 10000) * 100) / 100 // m² → ha
}

// ── Centroid ──────────────────────────────────────────────────────────────────

/**
 * Calculate centroid of a Stereo 70 ring.
 * Returns [x, y] in Stereo 70 metres.
 */
export function centroidStereo70(ring: number[][]): [number, number] {
  const pts =
    ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
      ? ring.slice(0, -1)
      : ring
  const n = pts.length
  let sx = 0
  let sy = 0
  for (const [x, y] of pts) {
    sx += x
    sy += y
  }
  return [sx / n, sy / n]
}

// ── Detection helper ──────────────────────────────────────────────────────────

/**
 * Heuristic to detect whether a coordinate pair is Stereo 70 vs WGS84.
 * Stereo 70 Romania bounding box: X 200 000–900 000, Y 100 000–800 000.
 */
export function isLikelyStereo70(coord0: number[]): boolean {
  const [x, y] = coord0
  return x > 100_000 && y > 100_000
}

// ── Formatting helpers ────────────────────────────────────────────────────────

/** Format a Stereo 70 coordinate for display: "548 234" */
export function fmtStereo70(v: number): string {
  return Math.round(v).toLocaleString('ro-RO')
}

/** Format WGS84 lat or lng for display: "45.943200°" */
export function fmtDeg(v: number): string {
  return v.toFixed(6) + '°'
}
