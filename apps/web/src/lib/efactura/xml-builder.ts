/**
 * UBL 2.1 / RO_CIUS Invoice XML builder.
 *
 * Standard:  urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.1
 * Profile:   urn:fdc:peppol.eu:2017:poacc:billing:01:1.0
 *
 * Edge-compatible: pure string concatenation, no DOM or external libs.
 */

import type { EFacturaInvoice } from './types'
import { countyToIso3166 } from './county-codes'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** XML-encode a value for use inside element text content */
function xe(v: string | number | null | undefined): string {
  if (v == null) return ''
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Format a number to exactly 2 decimal places */
function m(n: number): string {
  return Math.abs(n) < 1e-9 ? '0.00' : n.toFixed(2)
}

/** Strip "RO" prefix (case-insensitive) and whitespace from a CUI/CIF */
function stripRo(cif: string): string {
  return cif.replace(/\s/g, '').replace(/^RO/i, '')
}

/**
 * For PartyTaxScheme/CompanyID the supplier MUST have the "RO" prefix
 * (signals VAT registered entity to the ANAF system).
 */
function supplierVatId(cif: string): string {
  const clean = stripRo(cif)
  return /^\d+$/.test(clean) ? `RO${clean}` : cif.trim()
}

// ─── Optional XML blocks ──────────────────────────────────────────────────────

function paymentMeansBlock(iban: string, bankName: string | null | undefined): string {
  const ibanClean = iban.replace(/\s/g, '')
  return `
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount>
      <cbc:ID>${xe(ibanClean)}</cbc:ID>${bankName ? `
      <cac:FinancialInstitutionBranch>
        <cbc:ID>${xe(bankName)}</cbc:ID>
      </cac:FinancialInstitutionBranch>` : ''}
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>`
}

function contactBlock(phone: string | null | undefined, email: string | null | undefined): string {
  if (!phone && !email) return ''
  return `
      <cac:Contact>${phone ? `
        <cbc:Telephone>${xe(phone)}</cbc:Telephone>` : ''}${email ? `
        <cbc:ElectronicMail>${xe(email)}</cbc:ElectronicMail>` : ''}
      </cac:Contact>`
}

// ─── Main builder ─────────────────────────────────────────────────────────────

export function buildInvoiceXml(inv: EFacturaInvoice): string {
  const cur = inv.currency || 'RON'
  const invoiceRef = `${inv.series}${inv.number}`
  const typeCode = inv.doc_type || '380'

  const supplierCounty = countyToIso3166(inv.supplier.county)
  const customerCounty = countyToIso3166(inv.customer.county)

  // ── Tax subtotals ──
  const taxSubtotalsXml = inv.tax_subtotals.map(sub => `    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${cur}">${m(sub.taxable_amount)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${cur}">${m(sub.tax_amount)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${xe(sub.tax_category)}</cbc:ID>
        <cbc:Percent>${m(sub.tax_percent)}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>`).join('\n')

  // ── Invoice lines ──
  const linesXml = inv.lines.map((line, i) => `  <cac:InvoiceLine>
    <cbc:ID>${i + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${xe(line.unit_code)}">${m(line.quantity)}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${cur}">${m(line.line_extension)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Description>${xe(line.description)}</cbc:Description>
      <cbc:Name>${xe(line.description)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${xe(line.tax_category)}</cbc:ID>
        <cbc:Percent>${m(line.tax_percent)}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="${cur}">${m(line.price_per_unit)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:efactura.mfinante.ro:CIUS-RO:1.0.1</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${xe(invoiceRef)}</cbc:ID>
  <cbc:IssueDate>${inv.issue_date}</cbc:IssueDate>${inv.due_date ? `
  <cbc:DueDate>${inv.due_date}</cbc:DueDate>` : ''}
  <cbc:InvoiceTypeCode>${typeCode}</cbc:InvoiceTypeCode>${inv.note ? `
  <cbc:Note>${xe(inv.note)}</cbc:Note>` : ''}
  <cbc:TaxPointDate>${inv.issue_date}</cbc:TaxPointDate>
  <cbc:DocumentCurrencyCode>${cur}</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>${xe(inv.supplier.name)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${xe(inv.supplier.address)}</cbc:StreetName>
        <cbc:CityName>${xe(inv.supplier.locality)}</cbc:CityName>
        <cbc:CountrySubentity>${supplierCounty}</cbc:CountrySubentity>
        <cac:Country>
          <cbc:IdentificationCode>RO</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${supplierVatId(inv.supplier.cif)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${xe(inv.supplier.name)}</cbc:RegistrationName>
        <cbc:CompanyID>${xe(stripRo(inv.supplier.cif))}</cbc:CompanyID>${inv.supplier.reg_com ? `
        <cbc:CompanyLegalForm>${xe(inv.supplier.reg_com)}</cbc:CompanyLegalForm>` : ''}
      </cac:PartyLegalEntity>${contactBlock(inv.supplier.phone, inv.supplier.email)}
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName>
        <cbc:Name>${xe(inv.customer.name)}</cbc:Name>
      </cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${xe(inv.customer.address ?? inv.customer.locality)}</cbc:StreetName>
        <cbc:CityName>${xe(inv.customer.locality)}</cbc:CityName>
        <cbc:CountrySubentity>${customerCounty}</cbc:CountrySubentity>
        <cac:Country>
          <cbc:IdentificationCode>RO</cbc:IdentificationCode>
        </cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${xe(inv.customer.cif_cnp)}</cbc:CompanyID>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${xe(inv.customer.name)}</cbc:RegistrationName>
        <cbc:CompanyID>${xe(inv.customer.cif_cnp)}</cbc:CompanyID>
      </cac:PartyLegalEntity>${contactBlock(inv.customer.phone, inv.customer.email)}
    </cac:Party>
  </cac:AccountingCustomerParty>${inv.supplier.iban ? paymentMeansBlock(inv.supplier.iban, inv.supplier.bank_name) : ''}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${cur}">${m(inv.tax_amount)}</cbc:TaxAmount>
${taxSubtotalsXml}
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${cur}">${m(inv.tax_exclusive_amount)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${cur}">${m(inv.tax_exclusive_amount)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${cur}">${m(inv.tax_inclusive_amount)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${cur}">${m(inv.payable_amount)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${linesXml}
</Invoice>`
}
