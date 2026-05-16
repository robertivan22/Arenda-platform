/**
 * CASS Engine for venituri din arendă.
 *
 * ⚠️ HIGH COMPLEXITY — THIS ENGINE PRODUCES WARNINGS ONLY, NOT FINAL VALUES.
 *
 * Why it cannot produce a final CASS value:
 *   The final CASS obligation for a lessor depends on ALL their income sources,
 *   not only arendă. The system cannot know cumulative income from other sources
 *   (salaries, dividends, rents, etc.). Only the lessor or their accountant
 *   can determine the final CASS obligation via D212.
 *
 * What this engine does:
 *   - Computes a potential CASS base for THIS arendă income only
 *   - Issues clear warnings about what the system cannot determine
 *   - Flags whether the payer-side withholding may be applicable
 *   - Provides the legal basis for each finding
 *
 * Legal basis (as of 2024):
 *   Legea 227/2015 (Codul Fiscal), art. 155 — persoane obligate la CASS
 *   art. 170 — baza de calcul CASS pentru alte venituri
 *   OUG 115/2023 — modificări aplicabile 2024
 *
 * ⚠️ OUTPUT IS ALWAYS DRAFT — requires accountant validation.
 */

export interface CassInput {
  netArendaIncomeRon: number  // net taxable arendă income for the YEAR
  period: string              // 'YYYY'
  lessorId: string
}

export interface CassRulePayload {
  cassRate: number              // e.g. 10
  minBaseMultiplier: number     // e.g. 6 (× min wage)
  maxBaseMultiplier: number     // e.g. 60 (× min wage)
  minWage: number               // national min wage for this year
  applicabilityNote: string
  legalBasis: string
}

export type CassApplicabilityStatus =
  | 'NOT_DETERMINABLE'        // system cannot determine without full income picture
  | 'POTENTIALLY_APPLICABLE'  // arendă income alone exceeds CASS threshold
  | 'BELOW_THRESHOLD'         // arendă income alone is below minimum CASS base
  | 'NOT_APPLICABLE'          // zero income

export interface CassResult {
  potentialCassBaseRon: number
  potentialCassAmountRon: number
  cassRate: number
  applicabilityStatus: CassApplicabilityStatus
  minCassBase: number
  maxCassBase: number
  warnings: string[]
  requiresAccountantValidation: true
  legalBasis: string
  ruleVersionId: string
  isDraft: true
}

export class CassEngine {
  compute(
    input: CassInput,
    rule: CassRulePayload,
    ruleVersionId: string,
  ): CassResult {
    const minCassBase = rule.minBaseMultiplier * rule.minWage
    const maxCassBase = rule.maxBaseMultiplier * rule.minWage

    const warnings: string[] = [
      `⚠️ CASS: Sistemul calculează ORIENTATIV pe baza venitului din arendă din această perioadă.`,
      `Obligația finală CASS a arendatorului depinde de TOATE veniturile sale anuale din TOATE sursele.`,
      `Sistemul NU poate emite D212 (declarația personală CASS). Arendatorul sau contabilul său ` +
        `trebuie să depună D212 dacă venitul total depășește pragul minim.`,
      `Prag minim CASS ${input.period}: ${rule.minBaseMultiplier} × ${rule.minWage} RON = ${minCassBase} RON`,
      `Prag maxim CASS ${input.period}: ${rule.maxBaseMultiplier} × ${rule.minWage} RON = ${maxCassBase} RON`,
    ]

    if (input.netArendaIncomeRon <= 0) {
      return {
        potentialCassBaseRon: 0,
        potentialCassAmountRon: 0,
        cassRate: rule.cassRate,
        applicabilityStatus: 'NOT_APPLICABLE',
        minCassBase,
        maxCassBase,
        warnings: [...warnings, 'Venit net zero — CASS nu se aplică pentru această perioadă.'],
        requiresAccountantValidation: true,
        legalBasis: rule.legalBasis,
        ruleVersionId,
        isDraft: true,
      }
    }

    let applicabilityStatus: CassApplicabilityStatus
    let potentialCassBase: number

    if (input.netArendaIncomeRon < minCassBase) {
      // Income below threshold — but may still be combined with other income
      applicabilityStatus = 'NOT_DETERMINABLE'
      potentialCassBase = minCassBase  // minimum applies if any CASS is due
      warnings.push(
        `Venitul din arendă (${input.netArendaIncomeRon} RON) este sub pragul minim CASS (${minCassBase} RON). ` +
          `Totuși, dacă arendatorul are și alte venituri, pragul poate fi depășit — verificați cu contabilul.`,
      )
    } else {
      applicabilityStatus = 'POTENTIALLY_APPLICABLE'
      potentialCassBase = Math.min(input.netArendaIncomeRon, maxCassBase)
      warnings.push(
        `Venitul din arendă (${input.netArendaIncomeRon} RON) depășește pragul minim CASS. ` +
          `CASS potențial aplicabil — validați obligatoriu cu contabilul.`,
      )
    }

    const potentialCassAmountRon = potentialCassBase * (rule.cassRate / 100)

    return {
      potentialCassBaseRon: round2(potentialCassBase),
      potentialCassAmountRon: round2(potentialCassAmountRon),
      cassRate: rule.cassRate,
      applicabilityStatus,
      minCassBase,
      maxCassBase,
      warnings,
      requiresAccountantValidation: true,
      legalBasis: rule.legalBasis,
      ruleVersionId,
      isDraft: true,
    }
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
