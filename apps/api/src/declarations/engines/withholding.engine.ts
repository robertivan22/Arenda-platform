/**
 * Withholding Tax Engine for venituri din arendă.
 *
 * Legal basis (as of 2024):
 *   Legea 227/2015 (Codul Fiscal), art. 83-84 — venituri din cedarea folosinței bunurilor
 *   art. 101 — reținere la sursă de către plătitor
 *   OMFP / Ordin ANAF — prețuri medii agricole județene (plăți în natură)
 *
 * Formula:
 *   net_taxable = gross × (1 − flat_deduction_pct / 100)
 *   withholding = net_taxable × withholding_rate / 100
 *
 * Standard 2024 values (sourced from TaxRuleVersion, NOT hardcoded here):
 *   flat_deduction_pct = 20%
 *   withholding_rate   = 10%
 *   effective_rate     = 8% of gross
 *
 * ⚠️ OUTPUT IS ALWAYS DRAFT — requires accountant validation before use.
 */

export interface WithholdingInput {
  grossAmountRon: number
  paymentType: 'CASH' | 'IN_KIND' | 'BANK' | 'POSTAL'
  productQuantityKg?: number    // for IN_KIND payments
  productPricePerKg?: number    // from CountyAgriculturePrice table
  countyCode?: string
}

export interface WithholdingRulePayload {
  flatDeductionPct: number
  withholdingRate: number
  effectiveTaxRate: number
  legalBasis: string
}

export interface WithholdingResult {
  grossAmountRon: number
  flatDeductionPct: number
  flatDeductionRon: number
  netTaxableRon: number
  withholdingRate: number
  withholdingTaxRon: number
  effectiveTaxRate: number
  legalBasis: string
  ruleVersionId: string
  warnings: string[]
  isComplete: boolean  // false if missing data (e.g. no county price for in-kind)
  isDraft: true
}

export class WithholdingEngine {
  compute(
    input: WithholdingInput,
    rule: WithholdingRulePayload,
    ruleVersionId: string,
  ): WithholdingResult {
    const warnings: string[] = []
    let grossAmountRon = input.grossAmountRon
    let isComplete = true

    if (input.paymentType === 'IN_KIND') {
      if (input.productQuantityKg && input.productPricePerKg) {
        // Value in-kind payment using county average price
        grossAmountRon = input.productQuantityKg * input.productPricePerKg
        warnings.push(
          `Plată în natură valorificată la prețul mediu județean: ` +
          `${input.productQuantityKg} kg × ${input.productPricePerKg} RON/kg = ${grossAmountRon.toFixed(2)} RON. ` +
          `Verificați că prețul corespunde anului fiscal curent conform publicației ANAF/MADR.`,
        )
      } else {
        isComplete = false
        warnings.push(
          '⚠️ INCOMPLETE: Plată în natură fără preț mediu județean disponibil în sistem. ' +
          'Valoarea impozabilă NU poate fi calculată. ' +
          'Adăugați prețul mediu județean în modulul Nomenclatoare → Prețuri agricole județene ' +
          'conform publicației anuale ANAF/MADR.',
        )
        return this.emptyResult(rule, ruleVersionId, warnings)
      }
    }

    if (grossAmountRon <= 0) {
      warnings.push('Suma brută este zero sau negativă — nu se calculează impozit.')
      return this.emptyResult(rule, ruleVersionId, warnings)
    }

    const flatDeductionRon = grossAmountRon * (rule.flatDeductionPct / 100)
    const netTaxableRon = grossAmountRon - flatDeductionRon
    const withholdingTaxRon = netTaxableRon * (rule.withholdingRate / 100)

    return {
      grossAmountRon: round2(grossAmountRon),
      flatDeductionPct: rule.flatDeductionPct,
      flatDeductionRon: round2(flatDeductionRon),
      netTaxableRon: round2(netTaxableRon),
      withholdingRate: rule.withholdingRate,
      withholdingTaxRon: round2(withholdingTaxRon),
      effectiveTaxRate: rule.effectiveTaxRate,
      legalBasis: rule.legalBasis,
      ruleVersionId,
      warnings,
      isComplete,
      isDraft: true,
    }
  }

  private emptyResult(
    rule: WithholdingRulePayload,
    ruleVersionId: string,
    warnings: string[],
  ): WithholdingResult {
    return {
      grossAmountRon: 0,
      flatDeductionPct: rule.flatDeductionPct,
      flatDeductionRon: 0,
      netTaxableRon: 0,
      withholdingRate: rule.withholdingRate,
      withholdingTaxRon: 0,
      effectiveTaxRate: rule.effectiveTaxRate,
      legalBasis: rule.legalBasis,
      ruleVersionId,
      warnings,
      isComplete: false,
      isDraft: true,
    }
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
