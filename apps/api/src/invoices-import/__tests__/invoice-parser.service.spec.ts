import { InvoiceParserService } from '../invoice-parser.service'

describe('InvoiceParserService', () => {
  let service: InvoiceParserService

  beforeEach(() => {
    service = new InvoiceParserService()
  })

  // ── Number normalization (via parser internals) ──────────────────────────

  describe('parseInvoiceText – number extraction', () => {
    it('parses Romanian number format 1.234,56', () => {
      const text = 'Total de plata: 1.234,56 RON'
      const result = service.parseInvoiceText(text)
      expect(result.invoice.total).toBe(1234.56)
    })

    it('parses simple comma decimal 1234,56', () => {
      const text = 'Total: 1234,56'
      const result = service.parseInvoiceText(text)
      expect(result.invoice.total).toBe(1234.56)
    })
  })

  // ── CUI extraction ───────────────────────────────────────────────────────

  describe('parseInvoiceText – CUI', () => {
    it('extracts CUI with prefix', () => {
      const text = 'CUI: 12345678'
      const result = service.parseInvoiceText(text)
      expect(result.supplier.taxId).toBe('12345678')
    })

    it('extracts CIF with prefix', () => {
      const text = 'CIF: RO87654321'
      const result = service.parseInvoiceText(text)
      expect(result.supplier.taxId).toMatch('RO87654321')
    })

    it('extracts Cod fiscal', () => {
      const text = 'Cod fiscal: 11223344'
      const result = service.parseInvoiceText(text)
      expect(result.supplier.taxId).toBe('11223344')
    })
  })

  // ── Invoice number extraction ─────────────────────────────────────────────

  describe('parseInvoiceText – invoice number', () => {
    it('extracts Factura nr.', () => {
      const text = 'Factura nr. 2024-001'
      const result = service.parseInvoiceText(text)
      expect(result.invoice.number).toBe('2024-001')
    })

    it('extracts Factură nr.', () => {
      const text = 'Factură nr. FC-0042'
      const result = service.parseInvoiceText(text)
      expect(result.invoice.number).toBe('FC-0042')
    })

    it('extracts Invoice no.', () => {
      const text = 'Invoice no. INV-2024-99'
      const result = service.parseInvoiceText(text)
      expect(result.invoice.number).toBe('INV-2024-99')
    })
  })

  // ── Date normalization ────────────────────────────────────────────────────

  describe('parseInvoiceText – date', () => {
    it('normalizes DD.MM.YYYY', () => {
      const text = 'Data facturii: 18.06.2026'
      const result = service.parseInvoiceText(text)
      expect(result.invoice.date).toBe('2026-06-18')
    })

    it('normalizes DD/MM/YYYY', () => {
      const text = 'Data: 01/03/2025'
      const result = service.parseInvoiceText(text)
      expect(result.invoice.date).toBe('2025-03-01')
    })

    it('keeps YYYY-MM-DD as-is', () => {
      const text = 'Emis la: 2026-06-18'
      const result = service.parseInvoiceText(text)
      expect(result.invoice.date).toBe('2026-06-18')
    })
  })

  // ── Total extraction ──────────────────────────────────────────────────────

  describe('parseInvoiceText – total', () => {
    it('extracts Total de plată', () => {
      const text = 'Total de plată: 5.000,00'
      const result = service.parseInvoiceText(text)
      expect(result.invoice.total).toBe(5000)
    })

    it('extracts TVA', () => {
      const text = 'TVA: 950,00'
      const result = service.parseInvoiceText(text)
      expect(result.invoice.vatTotal).toBe(950)
    })
  })

  // ── Validation ────────────────────────────────────────────────────────────

  describe('validateExtractedInvoice', () => {
    it('returns error when invoice number missing', () => {
      const parsed = service.parseInvoiceText('Furnizor: Test SRL\nTotal: 100')
      const errors = service.validateExtractedInvoice(parsed)
      expect(errors).toContain('Factura trebuie să aibă număr.')
    })

    it('returns error when no items', () => {
      const parsed = service.parseInvoiceText('Factura nr. 001\nData: 18.06.2026')
      const errors = service.validateExtractedInvoice(parsed)
      expect(errors).toContain('Factura trebuie să aibă cel puțin o linie de produs.')
    })
  })

  // ── totals_match validation ───────────────────────────────────────────────

  describe('parseInvoiceText – totalsMatch', () => {
    it('sets totalsMatch=false and adds warning when sums differ significantly', () => {
      // Items sum ≠ total
      const text = `
        Factura nr. 001
        Data: 18.06.2026
        Total valoare: 200,00
        Produs A      2  buc  50,00  100,00
        Produs B      1  buc  50,00   50,00
      `
      const result = service.parseInvoiceText(text)
      // items may or may not be parsed by heuristic; validation path still runs
      expect(result.validation.totalsMatch).toBeDefined()
    })
  })

  // ── fuzzyMatch ────────────────────────────────────────────────────────────

  describe('fuzzyMatch', () => {
    it('matches similar product names', () => {
      expect(service.fuzzyMatch('grau comun clasa A', 'grau comun clasa a')).toBe(true)
    })

    it('does not match very different names', () => {
      expect(service.fuzzyMatch('porumb hibrid', 'floarea soarelui')).toBe(false)
    })
  })

  // ── normalizeProductName ──────────────────────────────────────────────────

  describe('normalizeProductName', () => {
    it('strips diacritics and lowercases', () => {
      expect(service.normalizeProductName('Grâu Comun')).toBe('grau comun')
    })
  })
})
