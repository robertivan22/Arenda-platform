import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service'
import { ApplicabilityEngine } from './engines/applicability.engine'
import { CassEngine } from './engines/cass.engine'
import { D112Generator } from './generators/d112.generator'
import { ApiaGenerator } from './generators/apia.generator'
import { TaxRulesService } from './tax-rules/tax-rules.service'

export interface CheckApplicabilityDto {
  payerIsLegalEntity: boolean
  payerIsVatRegistered: boolean
  payerHasArendaVatOption?: boolean
}

export interface GenerateD112Dto {
  year: number
  month: number
}

export interface GenerateApiaDto {
  campaignYear: number
}

export interface ApproveRunDto {
  notes?: string
}

@Injectable()
export class DeclarationsService {
  private readonly applicabilityEngine = new ApplicabilityEngine()
  private readonly cassEngine = new CassEngine()

  constructor(
    private readonly prisma: PrismaService,
    private readonly d112Generator: D112Generator,
    private readonly apiaGenerator: ApiaGenerator,
    private readonly taxRulesService: TaxRulesService,
  ) {}

  async checkApplicability(tenantId: string, dto: CheckApplicabilityDto) {
    const [contractCount, parcelCount] = await Promise.all([
      this.prisma.contract.count({ where: { tenantId, status: { in: ['ACTIVE', 'SUSPENDED'] } } }),
      this.prisma.parcel.count({ where: { tenantId, status: 'ACTIVE' } }),
    ])

    return this.applicabilityEngine.evaluate({
      payerIsLegalEntity: dto.payerIsLegalEntity,
      payerIsVatRegistered: dto.payerIsVatRegistered,
      payerHasArendaVatOption: dto.payerHasArendaVatOption ?? false,
      hasActiveContracts: contractCount > 0,
      hasParcels: parcelCount > 0,
    })
  }

  async generateD112Run(tenantId: string, dto: GenerateD112Dto, userId: string) {
    const { year, month } = dto
    const period = `${year}-${String(month).padStart(2, '0')}`

    // Check for existing run to avoid duplicates
    const existing = await this.prisma.declarationRun.findFirst({
      where: { tenantId, declarationType: 'D112', period },
    })
    if (existing) {
      throw new ForbiddenException(
        `Există deja un set D112 pentru ${period} (ID: ${existing.id}). ` +
        'Arhivați sau ștergeți setul existent înainte de regenerare.',
      )
    }

    const dataset = await this.d112Generator.generate(tenantId, year, month)

    // Persist the run and its items
    const run = await this.prisma.declarationRun.create({
      data: {
        tenantId,
        declarationType: 'D112',
        period,
        status: 'DRAFT',
        createdById: userId,
        metadataJson: {
          totalGrossRon: dataset.totalGrossRon,
          totalWithholdingTaxRon: dataset.totalWithholdingTaxRon,
          rowsWithWarnings: dataset.rowsWithWarnings,
          rowsIncomplete: dataset.rowsIncomplete,
          warnings: dataset.warnings,
          applicabilityNotes: dataset.applicabilityNotes,
          generatedAt: dataset.generatedAt,
        },
        items: {
          create: dataset.rows.map(row => ({
            entityType: 'PAYMENT',
            entityId: row.paymentIds[0] ?? '',
            computedValue: { withholdingTaxRon: row.withholdingTaxRon } as any,
            status: row.isComplete && row.warnings.length === 0 ? 'COMPUTED' : 'NEEDS_REVIEW',
            metadataJson: {
              lessorCnp: row.lessorCnp,
              lessorName: `${row.lessorLastName} ${row.lessorFirstName}`,
              contractId: row.contractId,
              paymentIds: row.paymentIds,
              paymentType: row.paymentType,
              grossAmountRon: row.grossAmountRon,
              flatDeductionRon: row.flatDeductionRon,
              netTaxableRon: row.netTaxableRon,
              withholdingTaxRon: row.withholdingTaxRon,
              warnings: row.warnings,
              legalBasis: row.legalBasis,
              ruleVersionId: row.ruleVersionId,
              isComplete: row.isComplete,
            },
          })),
        },
      },
      include: { items: { include: { detail: true } } },
    })

    return { run, dataset }
  }

  async generateApiaRun(tenantId: string, dto: GenerateApiaDto, userId: string) {
    const dataset = await this.apiaGenerator.generate(tenantId, dto.campaignYear)

    // Persist the campaign record
    let campaign = await this.prisma.apiaCampaign.findFirst({
      where: { tenantId, campaignYear: dto.campaignYear },
    })
    if (!campaign) {
      campaign = await this.prisma.apiaCampaign.create({
        data: {
          tenantId,
          campaignYear: dto.campaignYear,
          status: 'DRAFT',
        },
      })
    }

    const export_ = await this.prisma.apiaExport.create({
      data: {
        campaignId: campaign.id,
        status: 'DRAFT',
        createdById: userId,
        rowCount: dataset.rows.length,
        totalSurfaceHa: dataset.totalSurfaceHa,
        warnings: dataset.warnings,
        exportJson: dataset.rows as unknown as any,
      },
    })

    return { campaign, export: export_, dataset }
  }

  async listRuns(tenantId: string, type?: string) {
    return this.prisma.declarationRun.findMany({
      where: {
        tenantId,
        ...(type ? { declarationType: type } : {}),
      },
      orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
      include: {
        _count: { select: { items: true } },
      },
    })
  }

  async getRunById(tenantId: string, runId: string) {
    const run = await this.prisma.declarationRun.findFirst({
      where: { id: runId, tenantId },
      include: {
        items: {
          include: { detail: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    if (!run) throw new NotFoundException(`Setul de declarații cu ID ${runId} nu există.`)
    return run
  }

  async approveRun(tenantId: string, runId: string, userId: string, dto: ApproveRunDto) {
    const run = await this.prisma.declarationRun.findFirst({
      where: { id: runId, tenantId },
    })
    if (!run) throw new NotFoundException(`Setul cu ID ${runId} nu există.`)
    if (run.status === 'APPROVED') {
      throw new ForbiddenException('Setul este deja aprobat.')
    }
    if (run.status === 'SUBMITTED') {
      throw new ForbiddenException('Setul a fost deja transmis.')
    }

    return this.prisma.declarationRun.update({
      where: { id: runId },
      data: {
        status: 'APPROVED',
        approvedById: userId,
        approvedAt: new Date(),
        reviewNotes: dto.notes,
      },
    })
  }

  async getApiaExportDataset(exportId: string, tenantId: string) {
    const export_ = await this.prisma.apiaExport.findFirst({
      where: { id: exportId, campaign: { tenantId } },
      include: { campaign: true },
    })
    if (!export_) throw new NotFoundException(`Export APIA ${exportId} nu există.`)
    return export_
  }

  async deleteRun(tenantId: string, runId: string) {
    const run = await this.prisma.declarationRun.findFirst({
      where: { id: runId, tenantId },
    })
    if (!run) throw new NotFoundException(`Setul cu ID ${runId} nu există.`)
    if (run.status === 'APPROVED' || run.status === 'SUBMITTED') {
      throw new ForbiddenException(
        'Nu se poate șterge un set aprobat sau transmis. Contactați administratorul.',
      )
    }
    await this.prisma.declarationRun.delete({ where: { id: runId } })
    return { deleted: runId }
  }
}
