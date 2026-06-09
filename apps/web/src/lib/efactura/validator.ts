import type { EFacturaInvoice, ValidationError } from './types'

/**
 * Business-level validation for an EFacturaInvoice before XML generation.
 * Returns an array of errors (empty = valid).
 */
export function validateEFactura(inv: EFacturaInvoice): ValidationError[] {
  const errors: ValidationError[] = []
  const err = (field: string, message: string) => errors.push({ field, message })

  // ── Invoice header ────────────────────────────────────────────────────────
  if (!inv.number?.trim()) {
    err('number', 'Numărul facturii este obligatoriu')
  }
  if (!inv.issue_date) {
    err('issue_date', 'Data emiterii este obligatorie')
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(inv.issue_date)) {
    err('issue_date', 'Data trebuie în format YYYY-MM-DD')
  }
  if (inv.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(inv.due_date)) {
    err('due_date', 'Scadența trebuie în format YYYY-MM-DD')
  }

  // ── Supplier (company_settings) ───────────────────────────────────────────
  if (!inv.supplier.name?.trim()) {
    err('supplier.name', 'Denumirea furnizorului este obligatorie')
  }
  if (!inv.supplier.cif?.trim()) {
    err('supplier.cif', 'CIF/CUI-ul furnizorului este obligatoriu')
  }
  if (!inv.supplier.address?.trim()) {
    err('supplier.address', 'Adresa furnizorului este obligatorie (Setări → Companie)')
  }
  if (!inv.supplier.county?.trim()) {
    err('supplier.county', 'Județul furnizorului este obligatoriu (Setări → Companie)')
  }
  if (!inv.supplier.locality?.trim()) {
    err('supplier.locality', 'Localitatea furnizorului este obligatorie (Setări → Companie)')
  }
  if (!inv.supplier.iban?.trim()) {
    err('supplier.iban', 'IBAN-ul furnizorului este obligatoriu (Setări → Companie)')
  }

  // ── Customer (lessor) ─────────────────────────────────────────────────────
  if (!inv.customer.name?.trim()) {
    err('customer.name', 'Denumirea clientului este obligatorie')
  }
  if (!inv.customer.cif_cnp?.trim()) {
    err('customer.cif_cnp', 'CIF/CNP-ul clientului este obligatoriu')
  } else {
    const val = inv.customer.cif_cnp.trim()
    if (inv.customer.type === 'NATURAL' && !/^\d{13}$/.test(val)) {
      err('customer.cif_cnp', 'CNP-ul persoanei fizice trebuie să aibă exact 13 cifre')
    }
    if (inv.customer.type === 'PFA' && val.length < 3) {
      err('customer.cif_cnp', 'CIF-ul PFA este prea scurt')
    }
    if (inv.customer.type === 'LEGAL' && val.length < 2) {
      err('customer.cif_cnp', 'CUI-ul persoanei juridice este invalid')
    }
  }
  if (!inv.customer.county?.trim()) {
    err('customer.county', 'Județul clientului este obligatoriu (fișa arendatorului)')
  }
  if (!inv.customer.locality?.trim()) {
    err('customer.locality', 'Localitatea clientului este obligatorie (fișa arendatorului)')
  }

  // ── Lines ─────────────────────────────────────────────────────────────────
  if (!inv.lines.length) {
    err('lines', 'Factura trebuie să aibă cel puțin o linie')
  }

  for (const [i, line] of inv.lines.entries()) {
    if (!line.description?.trim()) {
      err(`lines[${i}].description`, `Linia ${i + 1}: descrierea produsului este obligatorie`)
    }
    if (line.quantity <= 0) {
      err(`lines[${i}].quantity`, `Linia ${i + 1}: cantitatea trebuie să fie pozitivă`)
    }
    if (line.price_per_unit < 0) {
      err(`lines[${i}].price_per_unit`, `Linia ${i + 1}: prețul nu poate fi negativ`)
    }
    const expected = Math.round(line.quantity * line.price_per_unit * 100) / 100
    if (Math.abs(line.line_extension - expected) > 0.02) {
      err(
        `lines[${i}].line_extension`,
        `Linia ${i + 1}: suma liniei (${line.line_extension.toFixed(2)}) ≠ cant × preț (${expected.toFixed(2)})`,
      )
    }
  }

  // ── Totals consistency ────────────────────────────────────────────────────
  const sumLines = inv.lines.reduce((s, l) => s + l.line_extension, 0)
  if (Math.abs(sumLines - inv.tax_exclusive_amount) > 0.05) {
    err(
      'tax_exclusive_amount',
      `Suma liniilor (${sumLines.toFixed(2)}) ≠ baza TVA (${inv.tax_exclusive_amount.toFixed(2)})`,
    )
  }

  const expectedInclusive = inv.tax_exclusive_amount + inv.tax_amount
  if (Math.abs(inv.tax_inclusive_amount - expectedInclusive) > 0.05) {
    err('tax_inclusive_amount', `Total cu TVA (${inv.tax_inclusive_amount.toFixed(2)}) ≠ baza + TVA (${expectedInclusive.toFixed(2)})`)
  }

  return errors
}
