export const runtime = 'edge'

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildInvoiceXml } from '@/lib/efactura/xml-builder'
import { validateEFactura } from '@/lib/efactura/validator'
import { mapToEFactura } from '@/lib/efactura/mapper'
import { AnafClient } from '@/lib/efactura/anaf-client'

/**
 * POST /api/efactura/submit
 *
 * Body: { invoice_id: string, env?: "test" | "prod" }
 *
 * Loads invoice + company + lessor + transactions, builds UBL XML,
 * packs into ZIP, uploads to ANAF, records the submission audit row.
 */
export async function POST(req: NextRequest) {
  const db = await createClient()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

  let body: { invoice_id?: string; env?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Corp cerere invalid (JSON required)' }, { status: 400 })
  }

  const { invoice_id, env = 'test' } = body
  if (!invoice_id) {
    return NextResponse.json({ error: 'invoice_id este obligatoriu' }, { status: 400 })
  }
  if (env !== 'test' && env !== 'prod') {
    return NextResponse.json({ error: 'env trebuie "test" sau "prod"' }, { status: 400 })
  }

  // ── Load invoice ──────────────────────────────────────────────────────────
  const { data: inv } = await db
    .from('invoices')
    .select('*')
    .eq('id', invoice_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!inv) {
    return NextResponse.json({ error: 'Factura nu a fost găsită' }, { status: 404 })
  }

  // Idempotency: block re-submission of already accepted invoices
  if ((inv as Record<string, unknown>).efactura_status === 'ACCEPTED') {
    return NextResponse.json(
      { error: 'Factura a fost deja acceptată de ANAF — nu poate fi retrimisă' },
      { status: 409 },
    )
  }
  if (
    (inv as Record<string, unknown>).efactura_status === 'SUBMITTED' ||
    (inv as Record<string, unknown>).efactura_status === 'PROCESSING'
  ) {
    return NextResponse.json(
      {
        error: 'Trimitere în curs de procesare. Verificați statusul cu endpoint-ul /status.',
        upload_id: (inv as Record<string, unknown>).efactura_upload_id,
      },
      { status: 409 },
    )
  }

  // ── Load related data in parallel ─────────────────────────────────────────
  const [{ data: company }, { data: lessor }, { data: txns }, { data: tokenRow }] =
    await Promise.all([
      db.from('company_settings').select('*').eq('user_id', user.id).maybeSingle(),
      db.from('lessors').select('*').eq('id', (inv as Record<string, unknown>).lessor_id as string).maybeSingle(),
      db.from('transactions').select('*').eq('invoice_id', invoice_id),
      db.from('anaf_oauth_tokens').select('access_token, expires_at').eq('user_id', user.id).maybeSingle(),
    ])

  if (!company) {
    return NextResponse.json(
      { error: 'Datele companiei nu sunt configurate. Mergeți la Setări → Companie.' },
      { status: 422 },
    )
  }

  // ── Validate ANAF token ───────────────────────────────────────────────────
  if (!tokenRow?.access_token) {
    return NextResponse.json(
      { error: 'Token ANAF lipsă. Mergeți la Setări → e-Factura pentru autorizare.' },
      { status: 422 },
    )
  }
  if (new Date((tokenRow as Record<string, unknown>).expires_at as string) <= new Date()) {
    return NextResponse.json(
      { error: 'Token ANAF expirat. Re-autorizați în Setări → e-Factura.' },
      { status: 422 },
    )
  }

  // ── Build domain model, validate, generate XML ────────────────────────────
  const efacturaInv = mapToEFactura(
    inv as Parameters<typeof mapToEFactura>[0],
    company as Parameters<typeof mapToEFactura>[1],
    lessor as Parameters<typeof mapToEFactura>[2],
    (txns ?? []) as Parameters<typeof mapToEFactura>[3],
  )

  const validationErrors = validateEFactura(efacturaInv)
  if (validationErrors.length > 0) {
    return NextResponse.json({ error: 'Validare eșuată', errors: validationErrors }, { status: 422 })
  }

  const xml = buildInvoiceXml(efacturaInv)
  const filename = `${efacturaInv.series}${efacturaInv.number}.xml`.replace(/[^a-zA-Z0-9._-]/g, '_')

  // ── Submit to ANAF ────────────────────────────────────────────────────────
  const client = new AnafClient(tokenRow.access_token, env as 'test' | 'prod')

  let upload_id: string
  let rawUploadResponse: unknown

  try {
    const result = await client.uploadInvoice(xml, company.cif, filename)
    upload_id = result.upload_id
    rawUploadResponse = result.raw
  } catch (err) {
    const errMsg = String(err)
    // Record failure
    await Promise.all([
      db.from('efactura_submissions').insert({
        user_id: user.id,
        invoice_id,
        status: 'ERROR',
        xml_sent: xml,
        error_message: errMsg,
      }),
      db.from('invoices').update({ efactura_status: 'ERROR' }).eq('id', invoice_id),
    ])
    return NextResponse.json({ error: errMsg }, { status: 502 })
  }

  // ── Persist successful submission ─────────────────────────────────────────
  const now = new Date().toISOString()
  await Promise.all([
    db.from('efactura_submissions').insert({
      user_id: user.id,
      invoice_id,
      status: 'SUBMITTED',
      upload_id,
      xml_sent: xml,
      response_status: 200,
      response_body: JSON.stringify(rawUploadResponse),
    }),
    db.from('invoices').update({
      efactura_status: 'SUBMITTED',
      efactura_upload_id: upload_id,
      efactura_submitted_at: now,
    }).eq('id', invoice_id),
  ])

  return NextResponse.json({
    ok: true,
    upload_id,
    env,
    message: `Factura trimisă cu succes (id_incarcare=${upload_id}). Verificați statusul în câteva minute.`,
  })
}
