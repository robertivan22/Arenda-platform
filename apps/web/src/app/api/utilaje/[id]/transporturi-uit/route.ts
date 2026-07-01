export const runtime = 'edge'

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Valabilitate în zile în funcție de tip operațiune
const VALIDITY_DAYS: Record<string, number> = {
  national:        5,
  import:         15,
  export:         15,
  intracomunitar: 15,
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COD_UIT_RE = /^[A-Za-z0-9]{36}$/
const VALID_TIPURI = new Set(['import', 'export', 'national', 'intracomunitar'])
const VALID_STATUS = new Set(['activ', 'expirat', 'utilizat', 'anulat'])

// ── GET /api/utilaje/[id]/transporturi-uit ────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = await params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'ID utilaj invalid' }, { status: 400 })
  }

  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

  // Verify machine belongs to this user (tenant scoping)
  const { data: machine } = await db
    .from('machines')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!machine) return NextResponse.json({ error: 'Utilaj negăsit' }, { status: 404 })

  const { data, error } = await db
    .from('transporturi_uit')
    .select('*')
    .eq('machine_id', id)
    .eq('user_id', user.id)
    .order('data_declarare', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

// ── POST /api/utilaje/[id]/transporturi-uit ───────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = await params
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'ID utilaj invalid' }, { status: 400 })
  }

  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })

  // Verify machine belongs to this user
  const { data: machine } = await db
    .from('machines')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!machine) return NextResponse.json({ error: 'Utilaj negăsit' }, { status: 404 })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Body JSON invalid' }, { status: 400 })
  }

  // ── Validare cod_uit ───────────────────────────────────────────────────────
  const cod_uit = String(body.cod_uit ?? '').trim()
  if (!COD_UIT_RE.test(cod_uit)) {
    return NextResponse.json({
      error: 'cod_uit invalid — trebuie exact 36 caractere alfanumerice',
    }, { status: 400 })
  }

  // ── Validare tip_operatiune ────────────────────────────────────────────────
  const tip_operatiune = String(body.tip_operatiune ?? '').trim()
  if (!VALID_TIPURI.has(tip_operatiune)) {
    return NextResponse.json({
      error: `tip_operatiune invalid — valori acceptate: ${[...VALID_TIPURI].join(', ')}`,
    }, { status: 400 })
  }

  // ── Validare / calcul date ─────────────────────────────────────────────────
  const data_declarare = String(body.data_declarare ?? new Date().toISOString().split('T')[0])
  const valabil_de     = String(body.valabil_de     ?? data_declarare)

  // valabil_pana: explicit override sau calculat automat
  let valabil_pana: string
  if (body.valabil_pana) {
    valabil_pana = String(body.valabil_pana)
  } else {
    const base = new Date(valabil_de + 'T00:00:00Z')
    base.setUTCDate(base.getUTCDate() + (VALIDITY_DAYS[tip_operatiune] ?? 15))
    valabil_pana = base.toISOString().split('T')[0]
  }

  if (valabil_pana < valabil_de) {
    return NextResponse.json({
      error: 'valabil_pana trebuie să fie >= valabil_de',
    }, { status: 400 })
  }

  // ── Unicitate cod_uit per utilizator ───────────────────────────────────────
  const { data: existing } = await db
    .from('transporturi_uit')
    .select('id')
    .eq('user_id', user.id)
    .eq('cod_uit', cod_uit)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ error: 'cod_uit deja înregistrat' }, { status: 409 })
  }

  const { data: inserted, error: insErr } = await db
    .from('transporturi_uit')
    .insert({
      user_id:            user.id,
      machine_id:         id,
      transaction_id:     body.transaction_id ? String(body.transaction_id) : null,
      cod_uit,
      tip_operatiune,
      data_declarare,
      valabil_de,
      valabil_pana,
      status:             'activ',
      loc_incarcare:      body.loc_incarcare      ? String(body.loc_incarcare)  : null,
      loc_descarcare:     body.loc_descarcare     ? String(body.loc_descarcare) : null,
      greutate_kg:        body.greutate_kg        ? Number(body.greutate_kg)    : null,
      valoare_ron:        body.valoare_ron         ? Number(body.valoare_ron)    : null,
      document_referinta: body.document_referinta ? String(body.document_referinta) : null,
      notes:              body.notes              ? String(body.notes)          : null,
    })
    .select('*')
    .single()

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
  return NextResponse.json({ data: inserted }, { status: 201 })
}
