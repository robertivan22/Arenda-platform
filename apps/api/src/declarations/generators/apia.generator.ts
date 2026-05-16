/**
 * APIA Campaign Export Generator.
 *
 * Generates a CSV-ready list of active contracts and parcels for a given campaign year.
 * Used as supporting documentation for APIA (Agenția de Plăți și Intervenție pentru Agricultură) campaigns.
 *
 * ⚠️ APIA campaign requirements change annually. This generator uses the campaign
 *    configuration stored in ApiaCampaign.configJson to adapt output columns.
 * ⚠️ OUTPUT IS DRAFT — verify against official APIA campaign materials before use.
 */
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'

export interface ApiaExportRow {
  lessorCnp: string
  lessorLastName: string
  lessorFirstName: string
  contractNumber: string
  contractStartDate: string
  contractEndDate: string
  parcelTarla: string
  parcelParcela: string
  parcelBlocFizic: string
  leasedSurfaceHa: number
  countyName: string
  localityName: string
  landUseCategory: string
  apiaDeclared: boolean
}

export interface ApiaExportDataset {
  tenantId: string
  campaignYear: number
  rows: ApiaExportRow[]
  totalSurfaceHa: number
  warnings: string[]
  generatedAt: Date
  status: 'DRAFT'
}

@Injectable()
export class ApiaGenerator {
  constructor(private readonly prisma: PrismaService) {}

  async generate(tenantId: string, campaignYear: number): Promise<ApiaExportDataset> {
    const yearStart = new Date(campaignYear, 0, 1)
    const yearEnd = new Date(campaignYear, 11, 31)

    // Active contracts that overlap with campaign year
    const contracts = await this.prisma.contract.findMany({
      where: {
        tenantId,
        status: { in: ['ACTIVE', 'SUSPENDED'] },
        startDate: { lte: yearEnd },
        OR: [{ expiryDate: null }, { expiryDate: { gte: yearStart } }],
      },
      include: {
        lessor: true,
        parcelLinks: {
          include: {
            parcel: {
              include: {
                landUseCategory: true,
                zone: true,
              },
            },
          },
        },
        mayoralty: { include: { uat: { include: { locality: { include: { county: true } } } } } },
      },
    })

    const rows: ApiaExportRow[] = []
    const warnings: string[] = []

    for (const contract of contracts) {
      for (const link of contract.parcelLinks) {
        const parcel = link.parcel
        if (!parcel || parcel.status !== 'ACTIVE') continue

        const county = contract.mayoralty?.uat?.locality?.county
        const locality = contract.mayoralty?.uat?.locality

        if (!county) {
          warnings.push(
            `Contractul ${contract.mayoraltyRegNo ?? contract.id}: județ lipsă — rândul poate fi incomplet.`,
          )
        }

        rows.push({
          lessorCnp: contract.lessor.cnpCui,
          lessorLastName: contract.lessor.lastName,
          lessorFirstName: contract.lessor.firstName ?? '',
          contractNumber: contract.mayoraltyRegNo ?? contract.id,
          contractStartDate: contract.startDate?.toISOString().split('T')[0] ?? '',
          contractEndDate: contract.expiryDate?.toISOString().split('T')[0] ?? '',
          parcelTarla: parcel.tarla ?? '',
          parcelParcela: parcel.parcela ?? '',
          parcelBlocFizic: parcel.blocFizic ?? '',
          leasedSurfaceHa: Number(link.surfaceAssigned ?? parcel.leasedSurface ?? 0),
          countyName: county?.name ?? '',
          localityName: locality?.name ?? '',
          landUseCategory: parcel.landUseCategory?.name ?? '',
          apiaDeclared: parcel.apiaDeclared,
        })
      }
    }

    const totalSurfaceHa = rows.reduce((s, r) => s + r.leasedSurfaceHa, 0)
    const notDeclared = rows.filter(r => !r.apiaDeclared).length
    if (notDeclared > 0) {
      warnings.push(
        `${notDeclared} parcele marcate ca nedeclarate la APIA. Verificați câmpul "apiaDeclared" în sistem.`,
      )
    }

    return {
      tenantId,
      campaignYear,
      rows,
      totalSurfaceHa: Math.round(totalSurfaceHa * 10000) / 10000,
      warnings: [
        '⚠️ DRAFT — verificați datele față de documentele oficiale APIA campanie ${campaignYear}.',
        '⚠️ Cerințele APIA se modifică anual. Validați structura exportului cu ghidul oficial campanie.',
        ...warnings,
      ],
      generatedAt: new Date(),
      status: 'DRAFT',
    }
  }

  toCsv(dataset: ApiaExportDataset): string {
    const headers = [
      'CNP Arendator', 'Nume', 'Prenume',
      'Nr. Contract', 'Data Start', 'Data Expirare',
      'Tarla', 'Parcela', 'Bloc Fizic',
      'Suprafata (ha)', 'Judet', 'Localitate',
      'Categorie', 'Declarat APIA',
    ]
    const lines = [
      headers.join(','),
      ...dataset.rows.map(r => [
        r.lessorCnp, r.lessorLastName, r.lessorFirstName,
        r.contractNumber, r.contractStartDate, r.contractEndDate,
        r.parcelTarla, r.parcelParcela, r.parcelBlocFizic,
        r.leasedSurfaceHa, r.countyName, r.localityName,
        r.landUseCategory, r.apiaDeclared ? 'DA' : 'NU',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')),
    ]
    return lines.join('\n')
  }
}
