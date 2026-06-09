export const runtime = 'edge'

import { type NextRequest, NextResponse } from 'next/server'
import { computeFarmDashboard } from '@/lib/farm-dashboard'
import { getSentinelToken } from '@/lib/farm-dashboard/sentinel-hub'
import type { ParcelInput } from '@/lib/farm-dashboard/types'

// Optional env vars for Sentinel Hub NDVI (if absent, NDVI data will be null):
//   SENTINEL_HUB_CLIENT_ID=<your-oauth2-client-id>
//   SENTINEL_HUB_CLIENT_SECRET=<your-oauth2-client-secret>

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { parcels?: ParcelInput[] }
    if (!Array.isArray(body.parcels) || body.parcels.length === 0) {
      return NextResponse.json({ error: 'parcels array required' }, { status: 400 })
    }

    // Limit request size
    const inputs = body.parcels.slice(0, 50)

    // Sentinel Hub credentials are kept server-side only
    const shClientId = (process.env.SENTINEL_HUB_CLIENT_ID ?? '').trim()
    const shClientSecret = (process.env.SENTINEL_HUB_CLIENT_SECRET ?? '').trim()

    let shToken: string | null = null
    if (shClientId && shClientSecret) {
      try {
        shToken = await getSentinelToken(shClientId, shClientSecret)
      } catch {
        // Non-fatal: NDVI will be null for all parcels
      }
    }

    const result = await computeFarmDashboard(inputs, shToken)

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Internal error', detail: String(err) },
      { status: 500 },
    )
  }
}
