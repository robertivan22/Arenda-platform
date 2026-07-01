export const runtime = 'edge'

/**
 * POST /api/etransport/shipments/[id]/generate-uit
 *
 * Complete UIT generation flow:
 *  1. Load shipment + goods + company + token
 *  2. Validate business rules (vehicle, goods, nc_code, dates, etc.)
 *  3. Build XML v2
 *  4. Upload to ANAF → receive cod_UIT + upload_index
 *  5. Log request/response (sanitized — no token in clear)
 *  6. Save cod_UIT, set status = 'uit_generated'
 *  7. Create DB alerts for validation failures
 *
 * Returns structured response per §14 of the UIT specification.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildETransportXml } from '@/lib/etransport/xml-builder'
import { AnafETransportClient } from '@/lib/etransport/anaf-etransport-client'
import { validateBeforeUpload } from '@/lib/etransport/validator'
import { classifyAnafError } from '@/lib/etransport/error-classifier'
import type { ETransportDeclaratie, TipOperatiuneAnaf } from '@/lib/etransport/types'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function toAnafTipOp(op: string, extraUe: boolean): TipOperatiuneAnaf {
  if (op === 'national')       return 20
  if (op === 'intracomunitar') return 40
  if (op === 'import')         return extraUe ? 50 : 40
  if (op === 'export')         return extraUe ? 51 : 41
  return 20
}

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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!UUID_RE.test(id)) return NextResponse.json({ error: 'ID invalid' }, { status: 400 })

  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

  let body: { env?: string } = {}
  try { body = await req.json() } catch { /* empty body OK */ }
  const env = (String(body.env ?? process.env.ANAF_ENV ?? 'test')) as 'test' | 'prod'

  // ── 1. Load all data in parallel ──────────────────────────
  const [{ data: ship }, { data: goods }, { data: company }, { data: tokenRow }] =
    await Promise.all([
      db.from('etransport_shipments')
        .select('*, machines(name, plate, taric_code, tara_origine, import_extra_ue)')
        .eq('id', id).eq('user_id', user.id).maybeSingle(),
      db.from('etransport_goods').select('*').eq('shipment_id', id).order('created_at'),
      db.from('company_settings').select('*').eq('user_id', user.id).maybeSingle(),
      // Load refresh_token too for 401 retry
      db.from('anaf_oauth_tokens').select('access_token, refresh_token, expires_at').eq('user_id', user.id).maybeSingle(),
    ])

  if (!ship) return NextResponse.json({ error: 'Transport negăsit' }, { status: 404 })

  const s = ship as any
  const c = company as any

  // ── 2. Check for existing UIT ─────────────────────────────
  if (s.uit_code) {
    return NextResponse.json({
      status: 'already_generated',
      uitCode: s.uit_code,
      message: `Transportul are deja cod UIT: ${s.uit_code}`,
    })
  }

  // ── 3. Check token ────────────────────────────────────────
  if (!tokenRow) {
    return NextResponse.json({ error: 'Token ANAF lipsă — configurați în pagina e-Transport → Setări' }, { status: 422 })
  }
  if (new Date((tokenRow as any).expires_at) <= new Date()) {
    await createAlert(db, id, user.id, 'TOKEN_EXPIRED', 'high', 'Token ANAF expirat — reconectați-vă în pagina e-Transport.')
    return NextResponse.json({ error: 'Token ANAF expirat', status: 'token_expired' }, { status: 422 })
  }

  // ── 4. Business validation ────────────────────────────────
  const validation = validateBeforeUpload(s, (goods ?? []) as any[], c ?? {})
  if (!validation.isValid) {
    // Persist validation errors + create alerts
    await Promise.all([
      db.from('etransport_shipments')
        .update({ status: 'validation_failed', validation_errors: validation.errors })
        .eq('id', id).eq('user_id', user.id),
      ...validation.errors.map(msg =>
        createAlert(db, id, user.id, 'VALIDATION_FAILED', 'medium', msg)
      ),
    ])
    return NextResponse.json({
      status: 'validation_failed',
      errors: validation.errors,
    }, { status: 422 })
  }

  // Mark as ready_to_submit
  await db.from('etransport_shipments')
    .update({ status: 'ready_to_submit', validation_errors: null })
    .eq('id', id).eq('user_id', user.id)

  // ── 5. Build XML ──────────────────────────────────────────
  const machine = (s.machines as any) ?? {}
  const extraUe = machine.import_extra_ue ?? false
  const cifNum  = (c?.cif ?? '').replace(/\s/g, '').replace(/^RO/i, '')

  const goodsList: any[] = goods ?? []
  const declaratie: ETransportDeclaratie = {
    codUnic: id,
    dataCreeareDocument: new Date().toISOString().split('T')[0],
    declarant: { tipDeclarant: 2, codDeclarant: cifNum, denumireDeclarant: c?.name ?? '' },
    codTipOp: toAnafTipOp(s.operation_type, extraUe),
    codScopOp: 10,
    furnizor:   { codfiscal: cifNum, denumire: c?.name ?? '', codJudet: c?.county ?? 'B', localitate: c?.locality ?? '', codTara: s.loading_country ?? 'RO' },
    cumparator: { codfiscal: cifNum, denumire: c?.name ?? '', codJudet: c?.county ?? 'B', localitate: c?.locality ?? '', codTara: s.unloading_country ?? 'RO' },
    bunuri: goodsList.length > 0
      ? goodsList.map((g: any, i: number) => ({
          nrCrt: i + 1,
          denumire: String(g.name ?? 'Marfă'),
          cantitate: Number(g.quantity ?? 1),
          unitateMasura: String(g.uom ?? 'C62'),
          valoareLeiFaraTva: Number(g.value_ron ?? 0),
          codTarifar: g.nc_code ? String(g.nc_code) : undefined,
        }))
      : [{ nrCrt: 1, denumire: machine.name ?? 'Utilaj agricol', cantitate: 1, unitateMasura: 'C62', valoareLeiFaraTva: 0 }],
    dataTransport:      s.transport_start_date,
    codJudetIncarcare:  extractJudet(s.loading_location),
    locIncarcare:       s.loading_location,
    codJudetDescarcare: extractJudet(s.unloading_location),
    locDescarcare:      s.unloading_location,
    nrVehicul:          s.vehicle_no,
    tipVehicul:         1,
  }

  const xml = buildETransportXml(declaratie)

  // Mark as submitted
  await db.from('etransport_shipments')
    .update({ status: 'submitted' })
    .eq('id', id).eq('user_id', user.id)

  // ── 6. Upload to ANAF (with one 401-retry if refresh_token available) ────
  const anafClient = new AnafETransportClient((tokenRow as any).access_token, env)
  let cod_uit: string
  let upload_index: number | null
  let rawResp: unknown
  let uploadErr: string | null = null

  const attemptUpload = async (client: AnafETransportClient) => {
    const result = await client.declare(xml, c?.cif ?? cifNum)
    return result
  }

  try {
    const result = await attemptUpload(anafClient)
    cod_uit      = result.cod_uit
    upload_index = result.upload_index
    rawResp      = result.raw
  } catch (firstErr) {
    const firstErrMsg = String(firstErr)
    uploadErr = firstErrMsg

    // ── 401 retry with refresh_token (once) ─────────────────
    const is401 = firstErrMsg.includes('401') || firstErrMsg.toLowerCase().includes('unauthorized')
    const refreshToken = (tokenRow as any)?.refresh_token as string | null

    if (is401 && refreshToken) {
      // Try to get a new access token using the refresh token
      try {
        const tokenUrl = 'https://logincert.anaf.ro/anafserv/login/oauth/access_token'
        const refreshRes = await fetch(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
          }),
          signal: AbortSignal.timeout(8000),
        })
        if (refreshRes.ok) {
          const refreshData = await refreshRes.json() as { access_token?: string; expires_in?: number }
          if (refreshData.access_token) {
            // Persist new token
            const newExpiry = new Date(Date.now() + (refreshData.expires_in ?? 3600) * 1000).toISOString()
            await db.from('anaf_oauth_tokens').update({
              access_token: refreshData.access_token,
              expires_at: newExpiry,
              updated_at: new Date().toISOString(),
            }).eq('user_id', user.id)

            // Retry upload with new token
            const retryClient = new AnafETransportClient(refreshData.access_token, env)
            try {
              const retryResult = await attemptUpload(retryClient)
              cod_uit      = retryResult.cod_uit
              upload_index = retryResult.upload_index
              rawResp      = retryResult.raw
              uploadErr    = null  // success after retry
            } catch (retryErr) {
              uploadErr = String(retryErr)
            }
          }
        }
      } catch {
        // refresh failed — keep original error
      }
    }

    if (uploadErr !== null) {
      // Classify the error for structured response
      const errInfo = classifyAnafError(uploadErr)
      const isAuthErr = errInfo.type === 'anaf_unauthorized'

      await Promise.all([
        db.from('etransport_shipments').update({
          status: isAuthErr ? 'anaf_auth_error' : 'rejected',
          anaf_last_status: 'error',
        }).eq('id', id).eq('user_id', user.id),
        db.from('etransport_api_logs').insert({
          shipment_id: id, user_id: user.id, request_type: 'UPLOAD',
          request_url: `${env}/upload/ETRANSP/${cifNum}/2`,
          request_xml: xml,
          error_message: uploadErr.slice(0, 500), http_status: isAuthErr ? 401 : 0,
        }),
        createAlert(db, id, user.id,
          isAuthErr ? 'ANAF_UNAUTHORIZED' : 'ANAF_REJECTED',
          'high',
          errInfo.message.slice(0, 200)
        ),
      ])

      return NextResponse.json({
        status: isAuthErr ? 'anaf_auth_error' : 'rejected',
        error_type: errInfo.type,
        title: errInfo.title,
        message: errInfo.message,
        actions: errInfo.actions,
        technical: errInfo.technical,
      }, { status: isAuthErr ? 401 : 502 })
    }
  }

  // ── 7. Log + save UIT ─────────────────────────────────────
  const now = new Date().toISOString()
  await Promise.all([
    db.from('etransport_shipments').update({
      uit_code:         cod_uit,
      anaf_upload_index: upload_index,
      anaf_last_status: 'ok',
      status:           'uit_generated',
      uit_generated_at: now,
    }).eq('id', id).eq('user_id', user.id),
    db.from('etransport_api_logs').insert({
      shipment_id: id, user_id: user.id, request_type: 'UPLOAD',
      request_url: `${env}/upload/ETRANSP/${cifNum}/2`,
      request_xml: xml,
      response_body: JSON.stringify(rawResp),
      http_status: 200, anaf_status: 'ok',
      cod_uit, upload_index,
    }),
  ])

  return NextResponse.json({
    status: 'uit_generated',
    uitCode: cod_uit,
    upload_index,
    message: `Cod UIT generat cu succes: ${cod_uit}`,
  }, { status: 201 })
}

// ── Helper: create a DB alert (fire-and-forget safe) ─────────
async function createAlert(
  db: ReturnType<typeof import('@/lib/supabase/server').createClient> extends Promise<infer T> ? T : never,
  shipmentId: string,
  userId: string,
  alertType: string,
  severity: 'high' | 'medium' | 'low',
  message: string,
) {
  await (await db).from('etransport_alerts').insert({
    shipment_id: shipmentId,
    user_id: userId,
    alert_type: alertType,
    severity,
    message,
  })
}
