/**
 * Maps raw Supabase DB rows to the EFacturaInvoice domain model.
 *
 * DB schemas used:
 *  - invoices:           id, invoice_number, invoice_series, invoice_date, due_date,
 *                        total_ron, tva_amount, tva_rate, doc_type, status, lessor_id
 *  - company_settings:   name, cif, reg_com, address, county, locality, iban, bank_name, phone, email
 *  - lessors:            type, first_name, last_name, company_name, cnp, address,
 *                        county, locality, phone, mobile, email
 *  - transactions:       product_name, kg_brut, kg_net, price_per_unit, ron_brut, ron_net,
 *                        tax_amount, invoice_id
 */

import type { EFacturaInvoice, EFacturaLine, EFacturaTaxSubtotal } from './types'

type DbInvoice = {
  id: string
  invoice_number: string
  invoice_series: string | null
  invoice_date: string
  due_date: string | null
  total_ron: number
  tva_amount: number
  tva_rate: number
  doc_type: string
  status: string
  lessor_id: string
}

type DbLessor = {
  id: string
  type: string
  first_name: string
  last_name: string
  company_name: string | null
  cnp: string | null
  address: string | null
  county: string | null
  locality: string | null
  phone: string | null
  mobile: string | null
  email: string | null
}

type DbCompany = {
  name: string
  cif: string
  reg_com: string
  address: string
  county: string
  locality: string
  iban: string
  bank_name: string
  phone: string | null
  email: string | null
}

type DbTransaction = {
  id: string
  product_name: string | null
  kg_brut: number | null
  kg_net: number | null
  price_per_unit: number | null
  ron_brut: number | null
  ron_net: number | null
  tax_amount: number | null
}

/** Returns the UN/ECE Rec 20 unit code for a product name or unit string */
function toUnitCode(productName: string | null): string {
  if (!productName) return 'C62'
  const lc = productName.toLowerCase()
  if (lc.includes('ha') || lc.includes('hectar')) return 'HAR'
  if (lc.includes('ton')) return 'TNE'
  // Agricultural grain products are weighed in kg
  return 'KGM'
}

/** Round to exactly 2 decimal places to avoid floating-point drift */
function r2(n: number): number {
  return Math.round(n * 100) / 100
}

export function mapToEFactura(
  inv: DbInvoice,
  company: DbCompany,
  lessor: DbLessor | null,
  transactions: DbTransaction[],
): EFacturaInvoice {
  // ── Supplier ────────────────────────────────────────────────────────────
  const supplier = {
    name: company.name,
    cif: company.cif,
    reg_com: company.reg_com,
    address: company.address,
    county: company.county,
    locality: company.locality,
    iban: company.iban,
    bank_name: company.bank_name,
    phone: company.phone,
    email: company.email,
  }

  // ── Customer ─────────────────────────────────────────────────────────────
  const lessorType = (lessor?.type ?? 'NATURAL') as 'NATURAL' | 'LEGAL' | 'PFA'
  const customerName =
    lessor == null
      ? 'Client necunoscut'
      : lessorType === 'LEGAL'
        ? (lessor.company_name ?? `${lessor.last_name} ${lessor.first_name}`.trim())
        : `${lessor.last_name} ${lessor.first_name}`.trim()

  const customer = {
    name: customerName,
    cif_cnp: lessor?.cnp ?? '',
    type: lessorType,
    address: lessor?.address ?? null,
    county: lessor?.county ?? '',
    locality: lessor?.locality ?? '',
    phone: lessor?.phone ?? lessor?.mobile ?? null,
    email: lessor?.email ?? null,
  }

  // ── Tax parameters ────────────────────────────────────────────────────────
  const tvaRate = inv.tva_rate ?? 0
  // 'E' = exempt (art. 292 CF — arendă), 'S' = standard rate
  const taxCategory = tvaRate > 0 ? 'S' : ('E' as const)

  // ── Invoice lines ─────────────────────────────────────────────────────────
  let lines: EFacturaLine[] = []

  if (transactions.length > 0) {
    lines = transactions.map((t, i) => {
      const qty = r2(t.kg_brut ?? t.kg_net ?? 1)
      const price = t.price_per_unit ?? 0
      const lineExt = r2(qty * price)
      return {
        id: i + 1,
        description: t.product_name ?? 'Produs',
        quantity: qty,
        unit_code: toUnitCode(t.product_name),
        price_per_unit: price,
        line_extension: lineExt,
        tax_category: taxCategory,
        tax_percent: tvaRate,
      }
    })
  } else {
    // Fallback: single synthetic line from invoice totals
    lines = [
      {
        id: 1,
        description: 'Arendă',
        quantity: 1,
        unit_code: 'C62',
        price_per_unit: inv.total_ron,
        line_extension: inv.total_ron,
        tax_category: taxCategory,
        tax_percent: tvaRate,
      },
    ]
  }

  // ── Totals ────────────────────────────────────────────────────────────────
  // Use invoice.total_ron as the authoritative taxable base (excl. VAT).
  // The sum of lines may differ slightly due to rounding in kg/price fields.
  // We honour the invoice-level total so ANAF validation passes.
  const sumLines = r2(lines.reduce((s, l) => s + l.line_extension, 0))
  // Rescale lines proportionally if there's a non-trivial drift
  const drift = Math.abs(sumLines - inv.total_ron)
  if (drift > 0.05 && drift / Math.max(inv.total_ron, 1) < 0.02) {
    // Adjust last line to absorb small rounding difference
    lines[lines.length - 1].line_extension = r2(
      lines[lines.length - 1].line_extension + (inv.total_ron - sumLines),
    )
  }

  const taxBase = r2(lines.reduce((s, l) => s + l.line_extension, 0))
  const taxAmount = r2(inv.tva_amount ?? 0)
  const taxInclusive = r2(taxBase + taxAmount)

  const taxSubtotals: EFacturaTaxSubtotal[] = [
    {
      taxable_amount: taxBase,
      tax_amount: taxAmount,
      tax_category: taxCategory,
      tax_percent: tvaRate,
    },
  ]

  return {
    invoice_id: inv.id,
    number: inv.invoice_number,
    series: inv.invoice_series ?? '',
    issue_date: inv.invoice_date,
    due_date: inv.due_date ?? null,
    currency: 'RON',
    doc_type: '380',
    supplier,
    customer,
    lines,
    tax_exclusive_amount: taxBase,
    tax_amount: taxAmount,
    tax_inclusive_amount: taxInclusive,
    payable_amount: taxInclusive,
    tax_subtotals: taxSubtotals,
  }
}
