export const runtime = 'edge'

import { type NextRequest, NextResponse } from 'next/server'
import { computeFarmDashboard } from '@/lib/farm-dashboard'
import type { ParcelInput } from '@/lib/farm-dashboard/types'

// Optional env vars for Sentinel Hub NDVI (if absent, NDVI data will be null):
//   SENTINEL_HUB_CLIENT_ID=<your-oauth2-client-id>
//   SENTINEL_HUB_CLIENT_SECRET=<your-oauth2-client-secret>

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  }

  // Verify the token is actually valid
  const { createClient: createSupabase } = await import('@supabase/supabase-js')
  const supabase = createSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

  try {
    const body = (await req.json()) as { parcels?: ParcelInput[] }
    if (!Array.isArray(body.parcels) || body.parcels.length === 0) {
      return NextResponse.json({ error: 'parcels array required' }, { status: 400 })
    }

    // Limit request size
    const inputs = body.parcels.slice(0, 50)

    const result = await computeFarmDashboard(inputs)

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
