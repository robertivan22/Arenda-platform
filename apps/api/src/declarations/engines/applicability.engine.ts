/**
 * Declaration Applicability Engine.
 *
 * Determines which declarations are required/applicable for a given payer scenario.
 * All results are explicitly DRAFT and include the reasoning behind each decision.
 *
 * Key decisions:
 *   D112 — always required for arendă withholding (payer obligation, monthly)
 *   D205 — potentially required for legal-entity payers; DISPUTED in practice → accountant validation
 *   D394 — NOT applicable to standard arendă (TVA-exempt); only if TVA option was activated
 *   APIA — always relevant if parcels exist in the system
 */

export interface ApplicabilityInput {
  payerIsLegalEntity: boolean
  payerIsVatRegistered: boolean
  payerHasArendaVatOption: boolean  // extremely rare — must be explicitly confirmed
  hasActiveContracts: boolean
  hasParcels: boolean
}

export interface ApplicabilityResult {
  d112: {
    required: boolean
    reason: string
    frequency: string
    deadline: string
  }
  d205: {
    applicable: boolean
    reason: string
    requiresAccountantValidation: boolean
    frequency: string
  }
  d394: {
    applicable: boolean
    reason: string
  }
  apia: {
    relevant: boolean
    reason: string
    frequency: string
  }
  cass: {
    warningRequired: boolean
    reason: string
  }
  globalWarnings: string[]
  isDraft: true
}

export class ApplicabilityEngine {
  evaluate(input: ApplicabilityInput): ApplicabilityResult {
    const globalWarnings: string[] = [
      '⚠️ Rezultatele aplicabilității sunt ORIENTATIVE și necesită confirmare de un contabil autorizat.',
    ]

    // ── D112 ───────────────────────────────────────────────────────────────
    // Always required for the payer of arendă who withholds income tax.
    // Legal basis: Legea 227/2015 art.101, Ordin ANAF D112
    const d112 = {
      required: input.hasActiveContracts,
      reason: input.hasActiveContracts
        ? 'D112 este obligatorie lunar pentru plătitorul de arendă (arendașul) care reține impozit la sursă. ' +
          'Baza legală: Legea 227/2015, art. 101.'
        : 'Nu există contracte active — D112 nu este aplicabilă pentru această perioadă.',
      frequency: 'Lunar',
      deadline: '25 ale lunii următoare perioadei de raportare',
    }

    // ── D205 ───────────────────────────────────────────────────────────────
    // Potentially required if payer is legal entity. DISPUTED in practice.
    // Some accountants consider D112 sufficient; others require D205 additionally.
    // MUST be validated by accountant before enabling.
    let d205Applicable = false
    let d205Reason = ''
    const d205RequiresAccountantValidation = true

    if (!input.payerIsLegalEntity) {
      d205Reason =
        'D205 nu se aplică: plătitorul este persoană fizică. ' +
        'Persoanele fizice nu au obligație D205 pentru venituri din arendă.'
    } else {
      d205Applicable = true  // flag as potentially applicable — not confirmed
      d205Reason =
        '⚠️ D205 poate fi aplicabilă: plătitorul este persoană juridică și reține impozit la sursă. ' +
        'Există interpretări divergente în practică: unii contabili consideră că D112 acoperă obligația; ' +
        'alții că D205 este necesară suplimentar pentru raportarea anuală pe beneficiari. ' +
        'OBLIGATORIU: validați cu contabilul/consultantul fiscal înainte de generare.'
      globalWarnings.push(
        'D205: Nu activați generarea automată fără confirmare explicită din partea unui contabil autorizat.',
      )
    }

    const d205 = {
      applicable: d205Applicable,
      reason: d205Reason,
      requiresAccountantValidation: d205RequiresAccountantValidation,
      frequency: 'Anual (până la 31 ianuarie anul următor)',
    }

    // ── D394 ───────────────────────────────────────────────────────────────
    // NOT applicable to standard arendă (TVA-exempt under art.292 Cod Fiscal).
    // Only if the payer has explicitly opted for TVA on arendă operations (extremely rare).
    let d394Applicable = false
    let d394Reason = ''

    if (!input.payerIsVatRegistered) {
      d394Reason =
        'D394 nu se aplică: plătitorul nu este înregistrat în scop de TVA.'
    } else if (!input.payerHasArendaVatOption) {
      d394Reason =
        'D394 nu se aplică direct operațiunilor de arendă: arendă este scutită de TVA ' +
        'conform art. 292 alin. (2) lit. e) Cod Fiscal. ' +
        'D394 poate fi relevantă pentru alte operațiuni TVA ale entității, dar nu pentru arendă.'
    } else {
      d394Applicable = true
      d394Reason =
        '⚠️ D394 potențial aplicabilă: entitatea este plătitoare TVA și a optat pentru taxare pe arendă. ' +
        'Această situație este extrem de rară. Validați obligatoriu baza legală cu consultantul fiscal.'
      globalWarnings.push(
        'D394: Opțiunea pentru TVA pe arendă este excepțională și necesită confirmare documentară.',
      )
    }

    const d394 = { applicable: d394Applicable, reason: d394Reason }

    // ── APIA ───────────────────────────────────────────────────────────────
    const apia = {
      relevant: input.hasParcels,
      reason: input.hasParcels
        ? 'Export APIA relevant: sistemul conține date de parcele și contracte utilizabile pentru ' +
          'listele suport campanie agricolă APIA. Verificați că suprafețele și titularii corespund ' +
          'declarațiilor individuale depuse de arendatori la APIA.'
        : 'Nu există parcele înregistrate în sistem.',
      frequency: 'Anual — campanie APIA (de regulă mai-iunie)',
    }

    // ── CASS ───────────────────────────────────────────────────────────────
    const cass = {
      warningRequired: true,
      reason:
        'CASS: Sistemul generează doar avertizări orientative. ' +
        'Obligația finală CASS a arendatorilor necesită analiza totală a veniturilor lor din toate sursele. ' +
        'Arendatorul depune D212 individual — sistemul nu poate genera D212.',
    }

    return {
      d112,
      d205,
      d394,
      apia,
      cass,
      globalWarnings,
      isDraft: true,
    }
  }
}
