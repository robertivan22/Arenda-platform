/**
 * D112 Preparation Dataset Generator.
 *
 * Generates a structured dataset for each lessor/payment in the period.
 * This is NOT the final ANAF XML — that must be created using ANAF-certified software.
 *
 * Why no XML:
 *   The D112 XML schema changes annually and requires certification.
 *   Generating XML here would risk using an outdated/invalid schema.
 *   Use this dataset as input for the official ANAF D112 application.
 *
 * ⚠️ ALL OUTPUT IS DRAFT — requires accountant review before use.
 */
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import { WithholdingEngine, WithholdingResult } from '../engines/withholding.engine'
import { TaxRulesService } from '../tax-rules/tax-rules.service'

export interface D112Row {
  lessorCnp: string
  lessorLastName: string
  lessorFirstName: string
  lessorAddress?: string
  contractId: string
  paymentIds: string[]
  paymentType: string
  grossAmountRon: number
  flatDeductionRon: number
  netTaxableRon: number
  withholdingTaxRon: number
  periodYear: number
  periodMonth: number
  warnings: string[]
  requiresReview: boolean
  legalBasis: string
  ruleVersionId: string
  isComplete: boolean
}

export interface D112Dataset {
  tenantId: string
  declarationType: 'D112'
  periodYear: number
  periodMonth: number
  rows: D112Row[]
  totalGrossRon: number
  totalWithholdingTaxRon: number
  rowsWithWarnings: number
  rowsIncomplete: number
  applicabilityNotes: string[]
  warnings: string[]
  generatedAt: Date
  status: 'DRAFT'
  requiresAccountantReview: true
}

@Injectable()
export class D112Generator {
  private readonly withholdingEngine = new WithholdingEngine()

  constructor(
    private readonly prisma: PrismaService,
    private readonly taxRulesService: TaxRulesService,
  ) {}

  async generate(tenantId: string, year: number, month: number): Promise<D112Dataset> {
    const periodFrom = new Date(year, month - 1, 1)
    const periodTo = new Date(year, month, 0, 23, 59, 59)

    // Fetch rule valid for this specific period — ensures historical correctness
    const rule = await this.taxRulesService.getRuleForPeriod('ARENDA_WITHHOLDING', periodFrom)
    if (!rule) {
      throw new Error(
        `Lipsesc regulile fiscale pentru tipul ARENDA_WITHHOLDING, perioada ${year}-${month}. ` +
        'Adăugați regulile în Administrare → Reguli fiscale înainte de generare.',
      )
    }

    const rulePayload = rule.payloadJson as {
      flatDeductionPct: number
      withholdingRate: number
      effectiveTaxRate: number
      legalBasis: string
    }

    // Fetch completed payments in period
    const payments = await this.prisma.payment.findMany({
      where: {
        tenantId,
        status: { in: ['COMPLETED', 'APPROVED'] },
        periodFrom: { gte: periodFrom },
        periodTo: { lte: periodTo },
      },
      include: {
        lessor: {
          include: {
            address: {
              include: { locality: { include: { county: true } } },
            },
          },
        },
        contract: true,
        productPayment: true,
      },
    })

    const rows: D112Row[] = []

    for (const payment of payments) {
      const countyCode = payment.lessor.address?.locality?.county?.code
      const isInKind = !!payment.productPayment
      const paymentType = isInKind ? 'IN_KIND' : (payment.paymentMethodId ? 'CASH' : 'CASH')

      let productPricePerKg: number | undefined
      if (isInKind && countyCode) {
        const priceRecord = await this.prisma.countyAgriculturePrice.findFirst({
          where: {
            countyCode,
            year,
            validFrom: { lte: periodFrom },
            OR: [{ validTo: null }, { validTo: { gte: periodFrom } }],
          },
          orderBy: { validFrom: 'desc' },
        })
        productPricePerKg = priceRecord ? Number(priceRecord.pricePerKg) : undefined
      }

      const grossAmountRon = isInKind
        ? Number(payment.productPayment?.totalValue ?? 0)
        : Number(payment.amountRon ?? 0)

      const result: WithholdingResult = this.withholdingEngine.compute(
        {
          grossAmountRon,
          paymentType: isInKind ? 'IN_KIND' : 'CASH',
          productQuantityKg: payment.productPayment
            ? Number(payment.productPayment.quantity)
            : undefined,
          productPricePerKg,
          countyCode,
        },
        rulePayload,
        rule.id,
      )

      const addressParts = [
        payment.lessor.address?.streetName,
        payment.lessor.address?.number,
        payment.lessor.address?.locality?.name,
        payment.lessor.address?.locality?.county?.name,
      ].filter(Boolean)

      rows.push({
        lessorCnp: payment.lessor.cnpCui,
        lessorLastName: payment.lessor.lastName,
        lessorFirstName: payment.lessor.firstName ?? '',
        lessorAddress: addressParts.join(', ') || undefined,
        contractId: payment.contractId ?? '',
        paymentIds: [payment.id],
        paymentType,
        grossAmountRon: result.grossAmountRon,
        flatDeductionRon: result.flatDeductionRon,
        netTaxableRon: result.netTaxableRon,
        withholdingTaxRon: result.withholdingTaxRon,
        periodYear: year,
        periodMonth: month,
        warnings: result.warnings,
        requiresReview: result.warnings.length > 0 || !result.isComplete,
        legalBasis: result.legalBasis,
        ruleVersionId: result.ruleVersionId,
        isComplete: result.isComplete,
      })
    }

    const totalGrossRon = rows.reduce((s, r) => s + r.grossAmountRon, 0)
    const totalWithholdingTaxRon = rows.reduce((s, r) => s + r.withholdingTaxRon, 0)
    const rowsWithWarnings = rows.filter(r => r.warnings.length > 0).length
    const rowsIncomplete = rows.filter(r => !r.isComplete).length

    return {
      tenantId,
      declarationType: 'D112',
      periodYear: year,
      periodMonth: month,
      rows,
      totalGrossRon: Math.round(totalGrossRon * 100) / 100,
      totalWithholdingTaxRon: Math.round(totalWithholdingTaxRon * 100) / 100,
      rowsWithWarnings,
      rowsIncomplete,
      applicabilityNotes: [
        'D112 se depune lunar de plătitorul de arendă (arendașul).',
        `Termen limită: 25 ${getMonthName(month + 1)} ${month === 12 ? year + 1 : year}.`,
        `Baza de calcul: Venit brut × (1 − ${rulePayload.flatDeductionPct}%) × ${rulePayload.withholdingRate}% = ${rulePayload.effectiveTaxRate}% din brut.`,
        'Plăți în natură: valorificate la prețul mediu județean publicat de ANAF/MADR.',
        '⚠️ Verificați că CUI-ul plătitorului și CNP-urile beneficiarilor sunt corecte.',
      ],
      warnings: [
        '⚠️ DRAFT — set de date orientativ, necesită validare contabil autorizat.',
        '⚠️ Sistemul NU generează fișierul XML final. Utilizați software-ul oficial ANAF D112 pentru transmitere.',
        ...(rowsIncomplete > 0
          ? [`⚠️ ${rowsIncomplete} înregistrări incomplete (lipsesc prețuri pentru plăți în natură).`]
          : []),
      ],
      generatedAt: new Date(),
      status: 'DRAFT',
      requiresAccountantReview: true,
    }
  }
}

function getMonthName(month: number): string {
  const m = month > 12 ? 1 : month
  return ['', 'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
    'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'][m]
}
