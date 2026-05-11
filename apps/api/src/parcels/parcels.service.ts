import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service'
import { AuditService } from '../audit/audit.service'
import { TenantScope, buildPagination, buildPaginatedResult } from '../common/utils/tenant-scope.util'
import { AuditAction } from '@arenda/shared'
import type { CreateParcelDto, UpdateParcelDto, ParcelFiltersDto } from '@arenda/shared'

@Injectable()
export class ParcelsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(tenantId: string, filters: ParcelFiltersDto) {
    const { page = 1, limit = 25, search, status, zoneId, landUseCategoryId, contractId, lessorId, apiaDeclared, sortBy = 'createdAt', sortDir = 'desc' } = filters
    const { skip, take } = buildPagination(page, limit)

    const where: Record<string, unknown> = {
      ...TenantScope.where(tenantId),
      ...(status && { status }),
      ...(zoneId && { zoneId }),
      ...(landUseCategoryId && { landUseCategoryId }),
      ...(apiaDeclared !== undefined && { apiaDeclared }),
      ...(contractId && { contractLinks: { some: { contractId } } }),
      ...(lessorId && { lessorLinks: { some: { lessorId } } }),
    }

    if (search) {
      where.OR = [
        { tarla: { contains: search, mode: 'insensitive' } },
        { parcela: { contains: search, mode: 'insensitive' } },
        { titleNumber: { contains: search, mode: 'insensitive' } },
        { titleHolder: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [data, total] = await Promise.all([
      this.prisma.parcel.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortDir },
        include: {
          zone: { select: { id: true, name: true } },
          landUseCategory: { select: { id: true, code: true, name: true } },
          _count: { select: { contractLinks: true, lessorLinks: true } },
        },
      }),
      this.prisma.parcel.count({ where }),
    ])

    return buildPaginatedResult(data, total, page, limit)
  }

  async findById(tenantId: string, id: string) {
    const parcel = await this.prisma.parcel.findFirst({
      where: TenantScope.where<{ id: string }>(tenantId, { id }),
      include: {
        zone: true,
        landUseCategory: true,
        contractLinks: {
          include: { contract: { include: { lessor: { select: { id: true, lastName: true, cnpCui: true } } } } },
        },
        lessorLinks: {
          include: { lessor: { select: { id: true, lastName: true, firstName: true, cnpCui: true } } },
        },
        history: { orderBy: { changedAt: 'desc' }, take: 20 },
        purchaseOffers: { orderBy: { offerDate: 'desc' } },
      },
    })

    if (!parcel) throw new NotFoundException('Parcela nu a fost găsită')
    return parcel
  }

  async create(tenantId: string, dto: CreateParcelDto, userId: string) {
    const { contractId, surfaceAssigned, ...parcelData } = dto

    const parcel = await this.prisma.parcel.create({
      data: {
        tenantId,
        ...parcelData,
        createdBy: userId,
        updatedBy: userId,
        ...(contractId && {
          contractLinks: {
            create: {
              contractId,
              surfaceAssigned: surfaceAssigned as unknown as never,
            },
          },
        }),
      },
      include: { zone: true, landUseCategory: true },
    })

    await this.audit.log({
      tenantId, userId, action: AuditAction.CREATE,
      entityType: 'Parcel', entityId: parcel.id,
      newValue: { tarla: parcel.tarla, parcela: parcel.parcela, leasedSurface: parcel.leasedSurface?.toString() },
    })

    return parcel
  }

  async update(tenantId: string, id: string, dto: UpdateParcelDto, userId: string) {
    const existing = await this.findById(tenantId, id)
    const { contractId, surfaceAssigned, ...parcelData } = dto

    // Record individual field changes in parcel_history
    const changedFields: Array<{ fieldName: string; oldValue: string; newValue: string }> = []
    for (const [key, value] of Object.entries(parcelData)) {
      const oldVal = (existing as Record<string, unknown>)[key]
      if (JSON.stringify(oldVal) !== JSON.stringify(value)) {
        changedFields.push({
          fieldName: key,
          oldValue: oldVal != null ? String(oldVal) : '',
          newValue: value != null ? String(value) : '',
        })
      }
    }

    const updated = await this.prisma.parcel.update({
      where: { id },
      data: {
        ...parcelData,
        updatedBy: userId,
        ...(changedFields.length && {
          history: {
            create: changedFields.map(f => ({ ...f, changedBy: userId })),
          },
        }),
      },
    })

    await this.audit.log({
      tenantId, userId, action: AuditAction.UPDATE,
      entityType: 'Parcel', entityId: id,
    })

    return updated
  }

  async archive(tenantId: string, id: string, userId: string) {
    await this.findById(tenantId, id)
    const updated = await this.prisma.parcel.update({
      where: { id },
      data: { status: 'ARCHIVED', isDeleted: true, deletedAt: new Date(), updatedBy: userId },
    })
    await this.audit.log({
      tenantId, userId, action: AuditAction.ARCHIVE,
      entityType: 'Parcel', entityId: id,
    })
    return updated
  }

  async linkToLessor(tenantId: string, parcelId: string, lessorId: string, ownershipShare?: number) {
    await this.findById(tenantId, parcelId)
    return this.prisma.parcelLessorLink.upsert({
      where: { parcelId_lessorId: { parcelId, lessorId } },
      update: { ownershipShare: ownershipShare as unknown as never },
      create: { parcelId, lessorId, ownershipShare: ownershipShare as unknown as never },
    })
  }
}
