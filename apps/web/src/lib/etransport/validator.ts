/**
 * ArendaPro e-Transport — Business Validator
 *
 * Validates a shipment record + its goods before XML generation and ANAF upload.
 * Deterministic — no LLM, no external calls.
 */

export interface ValidationResult {
  isValid: boolean
  errors: string[]
}

interface ShipmentRow {
  operation_type: string
  loading_location: string
  unloading_location: string
  loading_country: string
  unloading_country: string
  transport_start_date: string
  vehicle_no: string
  etransport_required: boolean
  uit_code: string | null
  status: string
}

interface GoodRow {
  name: string
  nc_code: string | null
  quantity: number
  gross_weight_kg: number | null
  value_ron: number | null
}

interface CompanyRow {
  name: string | null
  cif: string | null
  locality: string | null
  county: string | null
}

/**
 * Validate all business rules before upload to ANAF.
 * Returns { isValid, errors[] }.
 */
export function validateBeforeUpload(
  shipment: ShipmentRow,
  goods: GoodRow[],
  company: CompanyRow,
): ValidationResult {
  const errors: string[] = []

  // ── Company ───────────────────────────────────────────────
  if (!company.name?.trim()) errors.push('Lipsește denumirea companiei (Setări → Companie)')
  if (!company.cif?.trim())  errors.push('Lipsește CUI-ul companiei (Setări → Companie)')

  // ── Already has UIT ───────────────────────────────────────
  if (shipment.uit_code) {
    errors.push(`Transportul are deja cod UIT: ${shipment.uit_code}`)
  }

  // ── Lifecycle guard ───────────────────────────────────────
  if (['submitted', 'processing'].includes(shipment.status)) {
    errors.push('Transportul este deja în procesare la ANAF')
  }
  if (['deleted', 'confirmed'].includes(shipment.status)) {
    errors.push(`Transportul are statusul ${shipment.status} și nu poate fi redeclarat`)
  }

  // ── Transport fields ──────────────────────────────────────
  if (!shipment.vehicle_no?.trim()) {
    errors.push('Numărul vehiculului este obligatoriu')
  }
  if (!shipment.loading_location?.trim()) {
    errors.push('Punctul de încărcare este obligatoriu')
  }
  if (!shipment.unloading_location?.trim()) {
    errors.push('Punctul de descărcare este obligatoriu')
  }
  if (!shipment.transport_start_date) {
    errors.push('Data de început a transportului este obligatorie')
  }
  if (!shipment.operation_type) {
    errors.push('Tipul operațiunii este obligatoriu')
  }

  // ── Transport date must not be in the past (>7 days) ──────
  if (shipment.transport_start_date) {
    const startDate = new Date(shipment.transport_start_date + 'T00:00:00Z')
    const now = new Date()
    now.setUTCHours(0, 0, 0, 0)
    const daysOld = Math.round((now.getTime() - startDate.getTime()) / 86400000)
    if (daysOld > 7) {
      errors.push(`Data transportului este cu ${daysOld} zile în urmă — ANAF nu acceptă declarații retroactive mai vechi de 7 zile`)
    }
  }

  // ── Goods ─────────────────────────────────────────────────
  if (!goods || goods.length === 0) {
    errors.push('Trebuie să existe cel puțin un bun transportat')
  } else {
    // NC Code is REQUIRED only when transport is reportable (etransport_required=true)
    const requireNcCode = shipment.etransport_required !== false
    goods.forEach((g, i) => {
      const nr = i + 1
      if (!g.name?.trim()) {
        errors.push(`Bunul ${nr}: denumirea este obligatorie`)
      }
      if (requireNcCode) {
        if (!g.nc_code?.trim()) {
          errors.push(`Bunul ${nr} (${g.name || '?'}): codul NC/TARIC (6–8 cifre) este obligatoriu pentru declarația e-Transport`)
        } else if (!/^\d{6,8}$/.test(g.nc_code.replace(/\s/g, ''))) {
          errors.push(`Bunul ${nr}: codul NC trebuie să aibă 6–8 cifre (primit: "${g.nc_code}")`)
        }
      }
      if (!g.quantity || g.quantity <= 0) {
        errors.push(`Bunul ${nr}: cantitatea trebuie să fie mai mare decât 0`)
      }
    })
  }

  return { isValid: errors.length === 0, errors }
}

/**
 * Quick check: can the "Generează cod UIT" button be shown as active?
 * Lighter check — doesn't validate goods nc_codes (those are shown separately).
 */
export function canGenerateUit(
  shipment: Pick<ShipmentRow, 'uit_code' | 'status' | 'vehicle_no' | 'loading_location' | 'unloading_location'>,
  goodsCount: number,
  tokenConnected: boolean,
): { allowed: boolean; reason?: string } {
  if (shipment.uit_code) return { allowed: false, reason: 'UIT deja generat' }
  if (!tokenConnected)   return { allowed: false, reason: 'Token ANAF lipsă/expirat' }
  if (['submitted','processing'].includes(shipment.status)) return { allowed: false, reason: 'Deja în procesare la ANAF' }
  if (['deleted','confirmed'].includes(shipment.status))    return { allowed: false, reason: `Status: ${shipment.status}` }
  if (!shipment.vehicle_no?.trim())          return { allowed: false, reason: 'Lipsă nr. vehicul' }
  if (!shipment.loading_location?.trim())    return { allowed: false, reason: 'Lipsă loc încărcare' }
  if (!shipment.unloading_location?.trim())  return { allowed: false, reason: 'Lipsă loc descărcare' }
  if (goodsCount === 0)                      return { allowed: false, reason: 'Fără bunuri transportate' }
  return { allowed: true }
}
