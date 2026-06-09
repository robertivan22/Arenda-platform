export const runtime = 'edge'

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { AnafClient, anafStateToStatus } from '@/lib/efactura/anaf-client'

/**
 * GET /api/efactura/status?invoice_id={id}&env=test|prod
 *
 * Polls ANAF for the current processing state of a submitted invoice.
 * Updates invoices and efactura_submissions tables on status change.
 */
export async function GET(req: NextRequest) {
  const db = await createClient()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

  const url = new URL(req.url)
  const invoice_id = url.searchParams.get('invoice_id')
  const env = (url.searchParams.get('env') ?? 'test') as 'test' | 'prod'

  if (!invoice_id) {
    return NextResponse.json({ error: 'invoice_id este obligatoriu' }, { status: 400 })
  }

  // ── Load invoice ──────────────────────────────────────────────────────────
  const { data: inv } = await db
    .from('invoices')
    .select('efactura_status, efactura_upload_id, efactura_download_id')
    .eq('id', invoice_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!inv) return NextResponse.json({ error: 'Factură negăsită' }, { status: 404 })

  const uploadId = (inv as Record<string, unknown>).efactura_upload_id as string | null
  if (!uploadId) {
    return NextResponse.json({
      status: (inv as Record<string, unknown>).efactura_status ?? 'NOT_SUBMITTED',
      message: 'Factura nu a fost încă trimisă la ANAF',
    })
  }

  // ── Validate token ────────────────────────────────────────────────────────
  const { data: tokenRow } = await db
    .from('anaf_oauth_tokens')
    .select('access_token, expires_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!tokenRow?.access_token) {
    return NextResponse.json({ error: 'Token ANAF lipsă' }, { status: 422 })
  }
  if (new Date((tokenRow as Record<string, unknown>).expires_at as string) <= new Date()) {
    return NextResponse.json({ error: 'Token ANAF expirat. Re-autorizați.' }, { status: 422 })
  }

  // ── Query ANAF ────────────────────────────────────────────────────────────
  const client = new AnafClient(tokenRow.access_token, env)
  let result: Awaited<ReturnType<AnafClient['getStatus']>>

  try {
    result = await client.getStatus(uploadId)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 })
  }

  const newStatus = anafStateToStatus(result.anaf_state)
  const currentStatus = (inv as Record<string, unknown>).efactura_status as string

  // ── Persist if changed ────────────────────────────────────────────────────
  if (newStatus !== currentStatus) {
    const now = new Date().toISOString()
    const invoiceUpdate: Record<string, unknown> = {
      efactura_status: newStatus,
    }
    if (result.download_id) {
      invoiceUpdate.efactura_download_id = result.download_id
    }
    if (newStatus === 'ACCEPTED') {
      invoiceUpdate.efactura_accepted_at = now
    }
    if (newStatus === 'REJECTED' && result.errors.length > 0) {
      invoiceUpdate.efactura_rejection_reason = result.errors.join('; ')
    }

    await Promise.all([
      db.from('invoices').update(invoiceUpdate).eq('id', invoice_id),
      db
        .from('efactura_submissions')
        .update({
          status: newStatus,
          download_id: result.download_id,
          response_body: JSON.stringify(result.raw),
          updated_at: now,
        })
        .eq('invoice_id', invoice_id)
        .eq('upload_id', uploadId),
    ])
  }

  return NextResponse.json({
    status: newStatus,
    anaf_state: result.anaf_state,
    download_id: result.download_id,
    errors: result.errors,
  })
}
