export const runtime = 'edge'

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildETransportXml } from '@/lib/etransport/xml-builder'
import { AnafETransportClient } from '@/lib/etransport/anaf-etransport-client'
import type { ETransportDeclaratie, TipOperatiuneAnaf, TipVehicul } from '@/lib/etransport/types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Mapare tip_operatiune → codTipOp ANAF
function toAnafTipOp(tip: string, extraUe: boolean): TipOperatiuneAnaf {
  if (tip === 'national')        return 20
  if (tip === 'intracomunitar')  return 40
  if (tip === 'import')          return extraUe ? 50 : 40
  if (tip === 'export')          return extraUe ? 51 : 41
  return 20
}

/**
 * POST /api/etransport/declare
 *
 * Body: { uit_id: string, env?: "test" | "prod" }
 *
 * Loads the transporturi_uit row + linked machine + company_settings,
 * builds the ETRANSPORT XML, calls ANAF, stores the returned cod_UIT.
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
  if (env !== 'test' && env !== 'prod') {
    return NextResponse.json({ error: 'env trebuie "test" sau "prod"' }, { status: 400 })
  }

  // ── Load data in parallel ─────────────────────────────────────────────────
  const [{ data: uit }, { data: company }, { data: tokenRow }] = await Promise.all([
    db.from('transporturi_uit')
      .select('*, machines(name, plate, vin, taric_code, tara_origine, import_extra_ue, brand, model)')
      .eq('id', uit_id)
      .eq('user_id', user.id)
      .maybeSingle(),
    db.from('company_settings').select('*').eq('user_id', user.id).maybeSingle(),
    db.from('anaf_oauth_tokens').select('access_token, expires_at').eq('user_id', user.id).maybeSingle(),
  ])

  if (!uit) return NextResponse.json({ error: 'Înregistrare UIT negăsită' }, { status: 404 })
  if ((uit as any).cod_uit) {
    return NextResponse.json({ error: 'UIT are deja un cod declarat la ANAF', cod_uit: (uit as any).cod_uit }, { status: 409 })
  }
  if (!company) return NextResponse.json({ error: 'Lipsesc datele companiei (Setări → Companie)' }, { status: 422 })
  if (!tokenRow) return NextResponse.json({ error: 'Token ANAF lipsă — conectați-vă în pagina e-Transport' }, { status: 422 })

  const tokenExpired = new Date((tokenRow as any).expires_at) <= new Date()
  if (tokenExpired) return NextResponse.json({ error: 'Token ANAF expirat — reîmprospătați tokenul' }, { status: 422 })

  const u = uit as any
  const c = company as any
  const machine = u.machines as any

  const cifNum = (c.cif ?? '').replace(/\s/g, '').replace(/^RO/i, '')
  const extraUe = machine?.import_extra_ue ?? false
  const codTipOp = toAnafTipOp(u.tip_operatiune, extraUe)

  // ── Build XML ─────────────────────────────────────────────────────────────
  const declaratie: ETransportDeclaratie = {
    codUnic: uit_id,
    dataCreeareDocument: u.data_declarare,
    declarant: {
      tipDeclarant: 2,  // PJ = persoană juridică
      codDeclarant: cifNum,
      denumireDeclarant: c.name ?? '',
    },
    codTipOp,
    codScopOp: 10,  // comercial
    furnizor: {
      codfiscal: cifNum,
      denumire: c.name ?? '',
      codJudet: c.county ?? 'B',
      localitate: c.locality ?? c.city ?? '',
      codTara: 'RO',
    },
    cumparator: {
      codfiscal: cifNum,
      denumire: c.name ?? '',
      codJudet: c.county ?? 'B',
      localitate: c.locality ?? c.city ?? '',
      codTara: 'RO',
    },
    bunuri: [{
      nrCrt: 1,
      denumire: machine ? `${machine.brand ?? ''} ${machine.model ?? ''} ${machine.name ?? ''}`.trim() : 'Utilaj agricol',
      cantitate: 1,
      unitateMasura: 'C62',  // bucată
      valoareLeiFaraTva: u.valoare_ron ?? 0,
      codTarifar: machine?.taric_code ?? undefined,
    }],
    dataTransport: u.valabil_de ?? u.data_declarare,
    codJudetIncarcare: extractJudet(u.loc_incarcare),
    locIncarcare: u.loc_incarcare ?? '',
    codJudetDescarcare: extractJudet(u.loc_descarcare),
    locDescarcare: u.loc_descarcare ?? '',
    nrVehicul: machine?.plate ?? '',
    tipVehicul: 1,  // auto
  }

  const xml = buildETransportXml(declaratie)

  // ── Call ANAF ─────────────────────────────────────────────────────────────
  const client = new AnafETransportClient((tokenRow as any).access_token, env as 'test' | 'prod')
  let cod_uit: string
  let raw: unknown
  try {
    const result = await client.declare(xml, c.cif ?? cifNum)
    cod_uit = result.cod_uit
    raw = result.raw
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }

  // ── Persist cod_UIT returned by ANAF ──────────────────────────────────────
  const { error: updErr } = await db.from('transporturi_uit')
    .update({ cod_uit, status: 'activ' })
    .eq('id', uit_id)
    .eq('user_id', user.id)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({ cod_uit, anaf_response: raw }, { status: 201 })
}

/** Extrage codul de județ din string (ex: "Cluj-Napoca, Cluj" → "CJ") */
function extractJudet(loc: string | null): string {
  if (!loc) return 'B'
  // If it contains a comma, assume last part is county name
  const parts = loc.split(',')
  const raw = (parts.length > 1 ? parts[parts.length - 1] : parts[0]).trim()
  return JUDET_CODES[raw.toLowerCase()] ?? raw.slice(0, 2).toUpperCase()
}

const JUDET_CODES: Record<string, string> = {
  'alba': 'AB', 'arad': 'AR', 'argeș': 'AG', 'arges': 'AG',
  'bacău': 'BC', 'bacau': 'BC', 'bihor': 'BH', 'bistrița-năsăud': 'BN',
  'botoșani': 'BT', 'brașov': 'BV', 'brăila': 'BR', 'buzău': 'BZ',
  'caraș-severin': 'CS', 'călărași': 'CL', 'cluj': 'CJ', 'constanța': 'CT',
  'covasna': 'CV', 'dâmbovița': 'DB', 'dolj': 'DJ', 'galați': 'GL',
  'giurgiu': 'GR', 'gorj': 'GJ', 'harghita': 'HR', 'hunedoara': 'HD',
  'ialomița': 'IL', 'iași': 'IS', 'ilfov': 'IF', 'maramureș': 'MM',
  'mehedinți': 'MH', 'mureș': 'MS', 'neamț': 'NT', 'olt': 'OT',
  'prahova': 'PH', 'satu mare': 'SM', 'sălaj': 'SJ', 'sibiu': 'SB',
  'suceava': 'SV', 'teleorman': 'TR', 'timiș': 'TM', 'tulcea': 'TL',
  'vaslui': 'VS', 'vâlcea': 'VL', 'vrancea': 'VN', 'bucurești': 'B', 'bucharest': 'B',
}
