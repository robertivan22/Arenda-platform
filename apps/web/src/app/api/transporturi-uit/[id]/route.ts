export const runtime = 'edge'

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const UUID_RE    = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const VALID_STATUS = new Set(['activ', 'expirat', 'utilizat', 'anulat'])

// ── PATCH /api/transporturi-uit/[id] ─────────────────────────────────────────
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'ID invalid' }, { status: 400 })
  }

  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

  // Verify record belongs to this user (RLS + explicit check)
  const { data: existing } = await db
    .from('transporturi_uit')
    .select('id, status')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!existing) return NextResponse.json({ error: 'Înregistrare negăsită' }, { status: 404 })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Body JSON invalid' }, { status: 400 })
  }

  // Build update payload — only allow patching safe fields
  const patch: Record<string, unknown> = {}

  if (body.status !== undefined) {
    const s = String(body.status)
    if (!VALID_STATUS.has(s)) {
      return NextResponse.json({
        error: `status invalid — valori acceptate: ${[...VALID_STATUS].join(', ')}`,
      }, { status: 400 })
    }
    patch.status = s
  }

  if (body.notes              !== undefined) patch.notes              = body.notes ? String(body.notes) : null
  if (body.loc_incarcare      !== undefined) patch.loc_incarcare      = body.loc_incarcare      ? String(body.loc_incarcare)  : null
  if (body.loc_descarcare     !== undefined) patch.loc_descarcare     = body.loc_descarcare     ? String(body.loc_descarcare) : null
  if (body.greutate_kg        !== undefined) patch.greutate_kg        = body.greutate_kg        ? Number(body.greutate_kg)    : null
  if (body.valoare_ron        !== undefined) patch.valoare_ron        = body.valoare_ron        ? Number(body.valoare_ron)    : null
  if (body.document_referinta !== undefined) patch.document_referinta = body.document_referinta ? String(body.document_referinta) : null

  // valabil_pana override (manual correction)
  if (body.valabil_pana !== undefined) {
    patch.valabil_pana = String(body.valabil_pana)
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Niciun câmp de actualizat' }, { status: 400 })
  }

  const { data: updated, error } = await db
    .from('transporturi_uit')
    .update(patch)
    .eq('id', id)
    .eq('user_id', user.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: updated })
}
