// ─── RO e-Factura domain types ────────────────────────────────────────────────
// Aligned with RO_CIUS / UBL 2.1 / EN 16931

export interface EFacturaSupplier {
  name: string
  cif: string         // CUI with or without "RO" prefix — normalised in xml-builder
  reg_com: string     // J__/__/____ trade register number
  address: string
  county: string
  locality: string
  iban: string
  bank_name: string
  phone?: string | null
  email?: string | null
}

export interface EFacturaCustomer {
  name: string
  /** CUI for LEGAL/PFA, 13-digit CNP for NATURAL */
  cif_cnp: string
  type: 'NATURAL' | 'LEGAL' | 'PFA'
  address: string | null
  county: string
  locality: string
  phone?: string | null
  email?: string | null
}

export interface EFacturaLine {
  id: number
  description: string
  quantity: number
  /** UN/ECE Rec 20 unit code: KGM (kg), TNE (tonne), HAR (hectare), C62 (piece) */
  unit_code: string
  price_per_unit: number
  /** MUST equal quantity × price_per_unit (±0.01 tolerance) */
  line_extension: number
  /** S=standard, AE=reverse charge, E=exempt, Z=zero-rated, O=outside scope */
  tax_category: 'S' | 'AE' | 'E' | 'Z' | 'O'
  tax_percent: number
}

export interface EFacturaTaxSubtotal {
  taxable_amount: number
  tax_amount: number
  tax_category: string
  tax_percent: number
}

export interface EFacturaInvoice {
  invoice_id: string
  /** Invoice number only (digits or alpha-numeric) */
  number: string
  /** Series prefix (e.g. "A", "FCT") */
  series: string
  issue_date: string    // YYYY-MM-DD
  due_date: string | null
  currency: string      // always RON for Romanian invoices
  /** 380 = invoice, 381 = credit note, 389 = self-billed invoice */
  doc_type: '380' | '381' | '389'
  note?: string | null

  supplier: EFacturaSupplier
  customer: EFacturaCustomer
  lines: EFacturaLine[]

  /** Sum of all LineExtensionAmount (excl. VAT) */
  tax_exclusive_amount: number
  /** Total VAT */
  tax_amount: number
  /** tax_exclusive_amount + tax_amount */
  tax_inclusive_amount: number
  /** Amount the customer must pay */
  payable_amount: number

  tax_subtotals: EFacturaTaxSubtotal[]
}

// ─── Status tracking ──────────────────────────────────────────────────────────

export type EFacturaStatus =
  | 'NOT_SUBMITTED'
  | 'SUBMITTED'
  | 'PROCESSING'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'ERROR'

export interface ValidationError {
  field: string
  message: string
}

// ─── ANAF API response shapes ─────────────────────────────────────────────────

export interface AnafUploadResponse {
  dateResponse?: {
    ExecutionStatus?: string
    id_incarcare?: string | number
  }
  Errors?: Array<{ errorMessage: string }>
}

export interface AnafStatusResponse {
  stare?: string
  id_descarcare?: string | number
  Errors?: Array<{ errorMessage: string }>
}
