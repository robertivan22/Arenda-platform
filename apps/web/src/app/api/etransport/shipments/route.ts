export const runtime = 'edge'

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VALID_OPS = new Set(['national', 'import', 'export', 'intracomunitar'])

// ── GET /api/etransport/shipments ─────────────────────────
export async function GET(_req: NextRequest) {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

  const { data, error } = await db
    .from('etransport_shipments')
    .select('*, etransport_goods(id, name, nc_code, quantity, uom, gross_weight_kg, value_ron), machines(name, plate)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

// ── POST /api/etransport/shipments ────────────────────────
export async function POST(req: NextRequest) {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Corp cerere invalid' }, { status: 400 })
  }

  const op = String(body.operation_type ?? '')
  if (!VALID_OPS.has(op)) {
    return NextResponse.json({ error: 'operation_type invalid' }, { status: 400 })
  }
  if (!body.vehicle_no || !String(body.vehicle_no).trim()) {
    return NextResponse.json({ error: 'vehicle_no obligatoriu' }, { status: 400 })
  }
  if (!body.loading_location || !body.unloading_location) {
    return NextResponse.json({ error: 'loading_location și unloading_location obligatorii' }, { status: 400 })
  }

  const { data: ship, error: shipErr } = await db.from('etransport_shipments').insert({
    user_id:              user.id,
    operation_type:       op,
    status:               'draft',
    transport_start_date: body.transport_start_date ?? new Date().toISOString().split('T')[0],
    loading_country:      body.loading_country    ? String(body.loading_country)    : 'RO',
    loading_location:     String(body.loading_location),
    unloading_country:    body.unloading_country  ? String(body.unloading_country)  : 'RO',
    unloading_location:   String(body.unloading_location),
    carrier_name:         body.carrier_name        ? String(body.carrier_name)       : null,
    carrier_cui:          body.carrier_cui         ? String(body.carrier_cui)        : null,
    vehicle_no:           String(body.vehicle_no).trim().toUpperCase(),
    trailer1_no:          body.trailer1_no         ? String(body.trailer1_no)        : null,
    machine_id:           body.machine_id          ? String(body.machine_id)         : null,
    source_document_ref:  body.source_document_ref ? String(body.source_document_ref): null,
    notes:                body.notes               ? String(body.notes)              : null,
  }).select('*').single()

  if (shipErr) return NextResponse.json({ error: shipErr.message }, { status: 500 })

  // Insert goods if provided
  const goods = Array.isArray(body.goods) ? body.goods as Array<Record<string, unknown>> : []
  if (goods.length > 0 && ship) {
    await db.from('etransport_goods').insert(
      goods.map((g, i) => ({
        shipment_id:     (ship as any).id,
        user_id:         user.id,
        nc_code:         g.nc_code         ? String(g.nc_code)  : null,
        name:            g.name            ? String(g.name)     : `Marfă ${i + 1}`,
        quantity:        g.quantity        ? Number(g.quantity) : 1,
        uom:             g.uom             ? String(g.uom)      : 'C62',
        net_weight_kg:   g.net_weight_kg   ? Number(g.net_weight_kg) : null,
        gross_weight_kg: g.gross_weight_kg ? Number(g.gross_weight_kg) : null,
        value_ron:       g.value_ron       ? Number(g.value_ron) : null,
        risk_category:   Boolean(g.risk_category),
      }))
    )
  }

  return NextResponse.json({ data: ship }, { status: 201 })
}
