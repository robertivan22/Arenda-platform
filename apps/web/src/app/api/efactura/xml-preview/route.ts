export const runtime = 'edge'

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildInvoiceXml } from '@/lib/efactura/xml-builder'
import { validateEFactura } from '@/lib/efactura/validator'
import { mapToEFactura } from '@/lib/efactura/mapper'

/**
 * GET /api/efactura/xml-preview?invoice_id={id}
 *
 * Generates the UBL XML for an invoice without submitting it.
 * Returns the XML string and any validation errors.
 * Useful for debugging before sending to ANAF.
 */
export async function GET(req: NextRequest) {
  const db = await createClient()
  const {
    data: { user },
  } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Neautentificat' }, { status: 401 })

  const invoice_id = new URL(req.url).searchParams.get('invoice_id')
  if (!invoice_id) {
    return NextResponse.json({ error: 'invoice_id este obligatoriu' }, { status: 400 })
  }

  // Load all required data
  const [{ data: inv }, { data: company }, { data: lessor, error: lessorErr }, { data: txns }] =
    await Promise.all([
      db.from('invoices').select('*').eq('id', invoice_id).eq('user_id', user.id).maybeSingle(),
      db.from('company_settings').select('*').eq('user_id', user.id).maybeSingle(),
      (async () => {
        const invRow = await db
          .from('invoices')
          .select('lessor_id')
          .eq('id', invoice_id)
          .eq('user_id', user.id)
          .maybeSingle()
        if (!invRow.data?.lessor_id) return { data: null, error: null }
        return db.from('lessors').select('*').eq('id', invRow.data.lessor_id).maybeSingle()
      })(),
      db.from('transactions').select('*').eq('invoice_id', invoice_id),
    ])

  if (!inv) return NextResponse.json({ error: 'Factură negăsită' }, { status: 404 })
  if (!company) {
    return NextResponse.json(
      { error: 'Datele companiei nu sunt configurate (Setări → Companie)' },
      { status: 422 },
    )
  }

  const efacturaInv = mapToEFactura(
    inv as Parameters<typeof mapToEFactura>[0],
    company as Parameters<typeof mapToEFactura>[1],
    lessor as Parameters<typeof mapToEFactura>[2],
    (txns ?? []) as Parameters<typeof mapToEFactura>[3],
  )

  const validationErrors = validateEFactura(efacturaInv)
  const xml = buildInvoiceXml(efacturaInv)

  const format = new URL(req.url).searchParams.get('format')
  if (format === 'xml') {
    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${efacturaInv.series}${efacturaInv.number}.xml"`,
      },
    })
  }

  return NextResponse.json({
    valid: validationErrors.length === 0,
    validation_errors: validationErrors,
    xml,
    invoice_ref: `${efacturaInv.series}${efacturaInv.number}`,
  })
}
