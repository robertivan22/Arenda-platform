export const runtime = 'edge'

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AnafETransportClient } from '@/lib/etransport/anaf-etransport-client'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * POST /api/etransport/cancel
 *
 * Body: { uit_id: string, env?: "test" | "prod" }
 *
 * Calls ANAF to cancel the UIT, then marks status='anulat' in DB.
 */
export async function POST(req: NextRequest) {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

  let body: { uit_id?: string; env?: string } = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Corp cerere invalid' }, { status: 400 })
  }

  const { uit_id, env = process.env.ANAF_ENV ?? 'test' } = body
  if (!uit_id || !UUID_RE.test(uit_id)) {
    return NextResponse.json({ error: 'uit_id invalid' }, { status: 400 })
  }

  const [{ data: uit }, { data: company }, { data: tokenRow }] = await Promise.all([
    db.from('transporturi_uit').select('cod_uit, status').eq('id', uit_id).eq('user_id', user.id).maybeSingle(),
    db.from('company_settings').select('cif').eq('user_id', user.id).maybeSingle(),
    db.from('anaf_oauth_tokens').select('access_token, expires_at').eq('user_id', user.id).maybeSingle(),
  ])

  if (!uit) return NextResponse.json({ error: 'Înregistrare UIT negăsită' }, { status: 404 })

  const cod_uit = (uit as any).cod_uit as string | null
  if (!cod_uit) {
    // Not yet declared at ANAF — just mark locally
    await db.from('transporturi_uit').update({ status: 'anulat' }).eq('id', uit_id).eq('user_id', user.id)
    return NextResponse.json({ anulat: true, anaf_called: false })
  }

  if (!tokenRow) return NextResponse.json({ error: 'Token ANAF lipsă' }, { status: 422 })
  if (new Date((tokenRow as any).expires_at) <= new Date()) {
    return NextResponse.json({ error: 'Token ANAF expirat' }, { status: 422 })
  }

  const cif = ((company as any)?.cif ?? '').replace(/\s/g, '').replace(/^RO/i, '')
  const client = new AnafETransportClient((tokenRow as any).access_token, env as 'test' | 'prod')

  try {
    await client.cancel(cod_uit, cif)
  } catch (err) {
    // Log but don't block — mark locally anyway if ANAF returned already-cancelled
    const msg = String(err)
    if (!msg.includes('404') && !msg.includes('anulat')) {
      return NextResponse.json({ error: msg }, { status: 502 })
    }
  }

  await db.from('transporturi_uit').update({ status: 'anulat' }).eq('id', uit_id).eq('user_id', user.id)
  return NextResponse.json({ anulat: true, anaf_called: true })
}
