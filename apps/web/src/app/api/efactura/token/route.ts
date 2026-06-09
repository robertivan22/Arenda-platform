export const runtime = 'edge'

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET  /api/efactura/token
 *   Returns the current ANAF token status for the logged-in user.
 *
 * POST /api/efactura/token
 *   Body: { access_token: string, refresh_token?: string, expires_in?: number, cif?: string }
 *   Saves (upserts) the ANAF token. For MVP: user pastes a token obtained
 *   from ANAF SPV portal directly. OAuth2 flow can be added later.
 *
 * DELETE /api/efactura/token
 *   Revokes / removes the stored token.
 */

export async function GET() {
  const db = await createClient()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

  const { data } = await db
    .from('anaf_oauth_tokens')
    .select('expires_at, cif, created_at, updated_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!data) return NextResponse.json({ connected: false })

  const expiresAt = new Date((data as Record<string, unknown>).expires_at as string)
  return NextResponse.json({
    connected: true,
    expires_at: (data as Record<string, unknown>).expires_at,
    expired: expiresAt <= new Date(),
    cif: (data as Record<string, unknown>).cif,
    updated_at: (data as Record<string, unknown>).updated_at,
  })
}

export async function POST(req: NextRequest) {
  const db = await createClient()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

  let body: {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    expires_at?: string
    cif?: string
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Corp cerere invalid' }, { status: 400 })
  }

  if (!body.access_token?.trim()) {
    return NextResponse.json({ error: 'access_token este obligatoriu' }, { status: 400 })
  }

  // Calculate expiry: prefer explicit expires_at, then expires_in seconds from now
  let expiresAt: string
  if (body.expires_at) {
    expiresAt = body.expires_at
  } else if (body.expires_in) {
    expiresAt = new Date(Date.now() + body.expires_in * 1000).toISOString()
  } else {
    // Default: 1 hour from now (typical ANAF token lifetime)
    expiresAt = new Date(Date.now() + 3600 * 1000).toISOString()
  }

  const now = new Date().toISOString()

  const { error } = await db.from('anaf_oauth_tokens').upsert(
    {
      user_id: user.id,
      access_token: body.access_token.trim(),
      refresh_token: body.refresh_token?.trim() ?? null,
      expires_at: expiresAt,
      cif: body.cif?.trim() ?? null,
      updated_at: now,
    },
    { onConflict: 'user_id' },
  )

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, expires_at: expiresAt })
}

export async function DELETE() {
  const db = await createClient()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

  await db.from('anaf_oauth_tokens').delete().eq('user_id', user.id)
  return NextResponse.json({ ok: true })
}
