export const runtime = 'edge'

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildETransportXml } from '@/lib/etransport/xml-builder'
import { AnafETransportClient } from '@/lib/etransport/anaf-etransport-client'
import type { ETransportDeclaratie, TipOperatiuneAnaf, TipVehicul } from '@/lib/etransport/types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function toAnafTipOp(op: string, extraUe: boolean): TipOperatiuneAnaf {
  if (op === 'national')       return 20
  if (op === 'intracomunitar') return 40
  if (op === 'import')         return extraUe ? 50 : 40
  if (op === 'export')         return extraUe ? 51 : 41
  return 20
}

// ── GET /api/etransport/shipments/[id] ─────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'ID invalid' }, { status: 400 })

  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

  const [{ data: ship }, { data: goods }, { data: logs }] = await Promise.all([
    db.from('etransport_shipments').select('*, machines(name, plate, taric_code, tara_origine, import_extra_ue)').eq('id', id).eq('user_id', user.id).maybeSingle(),
    db.from('etransport_goods').select('*').eq('shipment_id', id).order('created_at'),
    db.from('etransport_api_logs').select('id, request_type, http_status, anaf_status, cod_uit, error_message, created_at').eq('shipment_id', id).order('created_at', { ascending: false }).limit(20),
  ])
  if (!ship) return NextResponse.json({ error: 'Transport negăsit' }, { status: 404 })
  return NextResponse.json({ data: { ...ship, goods: goods ?? [], logs: logs ?? [] } })
}

// ── PATCH /api/etransport/shipments/[id] ───────────────────
// Actions: submit (declare at ANAF), poll (check status), cancel
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'ID invalid' }, { status: 400 })

  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Corp cerere invalid' }, { status: 400 })
  }

  const action = String(body.action ?? '')
  const env = (String(body.env ?? process.env.ANAF_ENV ?? 'test')) as 'test' | 'prod'

  // ── Load shipment ──────────────────────────────────────────
  const { data: ship } = await db
    .from('etransport_shipments')
    .select('*, etransport_goods(*), machines(name, plate, taric_code, tara_origine, import_extra_ue)')
    .eq('id', id).eq('user_id', user.id).maybeSingle()
  if (!ship) return NextResponse.json({ error: 'Transport negăsit' }, { status: 404 })

  const s = ship as any

  // ── SUBMIT ─────────────────────────────────────────────────
  if (action === 'submit') {
    if (s.uit_code) return NextResponse.json({ error: 'Transport deja declarat', uit_code: s.uit_code }, { status: 409 })

    const [{ data: company }, { data: tokenRow }] = await Promise.all([
      db.from('company_settings').select('*').eq('user_id', user.id).maybeSingle(),
      db.from('anaf_oauth_tokens').select('access_token, expires_at').eq('user_id', user.id).maybeSingle(),
    ])
    if (!company) return NextResponse.json({ error: 'Lipsesc date companie (Setări)' }, { status: 422 })
    if (!tokenRow) return NextResponse.json({ error: 'Token ANAF lipsă' }, { status: 422 })
    if (new Date((tokenRow as any).expires_at) <= new Date()) return NextResponse.json({ error: 'Token ANAF expirat' }, { status: 422 })

    const c = company as any
    const cifNum = (c.cif ?? '').replace(/\s/g, '').replace(/^RO/i, '')
    const machine = s.machines as any
    const extraUe = machine?.import_extra_ue ?? false
    const goods: Array<Record<string,unknown>> = s.etransport_goods ?? []

    const declaratie: ETransportDeclaratie = {
      codUnic: id,
      dataCreeareDocument: new Date().toISOString().split('T')[0],
      declarant: { tipDeclarant: 2, codDeclarant: cifNum, denumireDeclarant: c.name ?? '' },
      codTipOp: toAnafTipOp(s.operation_type, extraUe),
      codScopOp: 10,
      furnizor: { codfiscal: cifNum, denumire: c.name ?? '', codJudet: c.county ?? 'B', localitate: c.locality ?? '', codTara: 'RO' },
      cumparator: { codfiscal: cifNum, denumire: c.name ?? '', codJudet: c.county ?? 'B', localitate: c.locality ?? '', codTara: 'RO' },
      bunuri: goods.length > 0
        ? goods.map((g, i) => ({
            nrCrt:            i + 1,
            denumire:         String(g.name ?? 'Marfă'),
            cantitate:        Number(g.quantity ?? 1),
            unitateMasura:    String(g.uom ?? 'C62'),
            valoareLeiFaraTva: Number(g.value_ron ?? 0),
            codTarifar:       g.nc_code ? String(g.nc_code) : undefined,
          }))
        : [{ nrCrt: 1, denumire: machine ? `${machine.brand ?? ''} ${machine.name ?? ''}`.trim() : 'Utilaj agricol', cantitate: 1, unitateMasura: 'C62', valoareLeiFaraTva: 0 }],
      dataTransport:      s.transport_start_date,
      codJudetIncarcare:  extractJudet(s.loading_location),
      locIncarcare:       s.loading_location,
      codJudetDescarcare: extractJudet(s.unloading_location),
      locDescarcare:      s.unloading_location,
      nrVehicul:          s.vehicle_no,
      tipVehicul:         1,
    }

    const xml = buildETransportXml(declaratie)
    await db.from('etransport_shipments').update({ status: 'submitted' }).eq('id', id).eq('user_id', user.id)

    const client = new AnafETransportClient((tokenRow as any).access_token, env)
    let cod_uit: string
    let upload_index: number | null
    let raw: unknown
    try {
      const r = await client.declare(xml, c.cif ?? cifNum)
      cod_uit = r.cod_uit
      upload_index = r.upload_index
      raw = r.raw
    } catch (err) {
      await Promise.all([
        db.from('etransport_shipments').update({ status: 'rejected' }).eq('id', id).eq('user_id', user.id),
        db.from('etransport_api_logs').insert({ shipment_id: id, user_id: user.id, request_type: 'UPLOAD', request_url: `${env}/upload/ETRANSP/${cifNum}/2`, request_xml: xml, error_message: String(err), http_status: 0 }),
      ])
      return NextResponse.json({ error: String(err) }, { status: 502 })
    }

    await Promise.all([
      db.from('etransport_shipments').update({ uit_code: cod_uit, anaf_upload_index: upload_index, status: 'accepted' }).eq('id', id).eq('user_id', user.id),
      db.from('etransport_api_logs').insert({ shipment_id: id, user_id: user.id, request_type: 'UPLOAD', request_xml: xml, response_body: JSON.stringify(raw), http_status: 200, cod_uit, upload_index }),
    ])

    return NextResponse.json({ cod_uit, upload_index, anaf_response: raw })
  }

  // ── POLL ───────────────────────────────────────────────────
  if (action === 'poll') {
    if (!s.anaf_upload_index) return NextResponse.json({ error: 'Nu există upload_index ANAF' }, { status: 422 })

    const [{ data: company }, { data: tokenRow }] = await Promise.all([
      db.from('company_settings').select('cif').eq('user_id', user.id).maybeSingle(),
      db.from('anaf_oauth_tokens').select('access_token, expires_at').eq('user_id', user.id).maybeSingle(),
    ])
    if (!tokenRow || new Date((tokenRow as any).expires_at) <= new Date()) {
      return NextResponse.json({ error: 'Token ANAF lipsă/expirat' }, { status: 422 })
    }

    const cif = (company as any)?.cif ?? ''
    const client = new AnafETransportClient((tokenRow as any).access_token, env)
    let statusResp: Record<string, unknown>
    try {
      statusResp = await client.getStatus(cif, s.anaf_upload_index) as Record<string, unknown>
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 502 })
    }

    const anafStatus = String((statusResp as any).stare ?? '')
    const newStatus = anafStatus === 'ok' ? 'accepted' : anafStatus === 'nok' ? 'rejected' : 'processing'
    const codUit = (statusResp as any).cod_UIT ?? s.uit_code ?? null

    await Promise.all([
      db.from('etransport_shipments').update({ status: newStatus, ...(codUit ? { uit_code: codUit } : {}) }).eq('id', id).eq('user_id', user.id),
      db.from('etransport_api_logs').insert({ shipment_id: id, user_id: user.id, request_type: 'STATUS', anaf_status: anafStatus, response_body: JSON.stringify(statusResp), cod_uit: codUit, http_status: 200 }),
    ])

    return NextResponse.json({ status: newStatus, anaf_status: anafStatus, cod_uit: codUit })
  }

  // ── CANCEL ─────────────────────────────────────────────────
  if (action === 'cancel') {
    if (!s.uit_code) {
      await db.from('etransport_shipments').update({ status: 'deleted' }).eq('id', id).eq('user_id', user.id)
      return NextResponse.json({ deleted: true, anaf_called: false })
    }

    const [{ data: company }, { data: tokenRow }] = await Promise.all([
      db.from('company_settings').select('cif').eq('user_id', user.id).maybeSingle(),
      db.from('anaf_oauth_tokens').select('access_token, expires_at').eq('user_id', user.id).maybeSingle(),
    ])
    if (!tokenRow || new Date((tokenRow as any).expires_at) <= new Date()) {
      return NextResponse.json({ error: 'Token ANAF lipsă/expirat' }, { status: 422 })
    }

    const cif = (company as any)?.cif ?? ''
    const client = new AnafETransportClient((tokenRow as any).access_token, env)
    try { await client.cancel(s.uit_code, cif) } catch { /* log but proceed */ }

    await db.from('etransport_shipments').update({ status: 'deleted' }).eq('id', id).eq('user_id', user.id)
    return NextResponse.json({ deleted: true, anaf_called: true })
  }

  return NextResponse.json({ error: 'Acțiune necunoscută. Folosiți: submit | poll | cancel' }, { status: 400 })
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const JUDET_CODES: Record<string, string> = {
  'alba':'AB','arad':'AR','argeș':'AG','arges':'AG','bacău':'BC','bacau':'BC',
  'bihor':'BH','bistrița-năsăud':'BN','botoșani':'BT','brașov':'BV','brăila':'BR',
  'buzău':'BZ','caraș-severin':'CS','călărași':'CL','cluj':'CJ','constanța':'CT',
  'covasna':'CV','dâmbovița':'DB','dolj':'DJ','galați':'GL','giurgiu':'GR',
  'gorj':'GJ','harghita':'HR','hunedoara':'HD','ialomița':'IL','iași':'IS',
  'ilfov':'IF','maramureș':'MM','mehedinți':'MH','mureș':'MS','neamț':'NT',
  'olt':'OT','prahova':'PH','satu mare':'SM','sălaj':'SJ','sibiu':'SB',
  'suceava':'SV','teleorman':'TR','timiș':'TM','tulcea':'TL','vaslui':'VS',
  'vâlcea':'VL','vrancea':'VN','bucurești':'B','bucharest':'B',
}

function extractJudet(loc: string | null): string {
  if (!loc) return 'B'
  const parts = loc.split(',')
  const raw = (parts.length > 1 ? parts[parts.length - 1] : parts[0]).trim()
  return JUDET_CODES[raw.toLowerCase()] ?? raw.slice(0, 2).toUpperCase()
}
