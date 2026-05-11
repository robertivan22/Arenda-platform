import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service'
import { AuditService } from '../audit/audit.service'
import { TenantScope, buildPagination, buildPaginatedResult } from '../common/utils/tenant-scope.util'
import { AuditAction } from '@arenda/shared'
import type { CreateContractDto, UpdateContractDto, ContractFiltersDto } from '@arenda/shared'

@Injectable()
export class ContractsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(tenantId: string, filters: ContractFiltersDto) {
    const { page = 1, limit = 25, search, status, lessorId, mayoraltyId, sortBy = 'createdAt', sortDir = 'desc' } = filters
    const { skip, take } = buildPagination(page, limit)

    const where: Record<string, unknown> = {
      ...TenantScope.where(tenantId),
      ...(status && { status }),
      ...(lessorId && { lessorId }),
      ...(mayoraltyId && { mayoraltyId }),
    }

    if (search) {
      where.OR = [
        { mayoraltyRegNo: { contains: search, mode: 'insensitive' } },
        { observations: { contains: search, mode: 'insensitive' } },
        { lessor: { lastName: { contains: search, mode: 'insensitive' } } },
      ]
    }

    const [data, total] = await Promise.all([
      this.prisma.contract.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortDir },
        include: {
          lessor: { select: { id: true, lastName: true, firstName: true, cnpCui: true } },
          mayoralty: { select: { id: true, name: true } },
          contractType: { select: { id: true, name: true } },
          rates: { orderBy: { validFrom: 'desc' }, take: 1 },
          _count: { select: { parcelLinks: true } },
        },
      }),
      this.prisma.contract.count({ where }),
    ])

    return buildPaginatedResult(data, total, page, limit)
  }

  async findById(tenantId: string, id: string) {
    const contract = await this.prisma.contract.findFirst({
      where: TenantScope.where<{ id: string }>(tenantId, { id }),
      include: {
        lessor: { include: { contact: true, bankAccounts: { where: { isPrimary: true } } } },
        mayoralty: true,
        contractType: true,
        rates: { orderBy: { validFrom: 'desc' } },
        versions: { orderBy: { versionNo: 'desc' }, take: 5 },
        addenda: { orderBy: { addendumNo: 'desc' } },
        termination: true,
        statusHistory: { orderBy: { changedAt: 'desc' }, take: 10 },
        parcelLinks: {
          include: { parcel: { include: { zone: true, landUseCategory: true } } },
        },
      },
    })

    if (!contract) throw new NotFoundException('Contractul nu a fost găsit')
    return contract
  }

  async create(tenantId: string, dto: CreateContractDto, userId: string) {
    const { rates, ...contractData } = dto

    // Create snapshot version
    const contract = await this.prisma.contract.create({
      data: {
        tenantId,
        ...contractData,
        createdBy: userId,
        updatedBy: userId,
        ...(rates?.length && {
          rates: { create: rates },
        }),
        versions: {
          create: {
            versionNo: 1,
            payloadSnapshot: contractData as object,
            createdBy: userId,
          },
        },
      },
      include: {
        lessor: { select: { id: true, lastName: true, cnpCui: true } },
        rates: true,
      },
    })

    await this.audit.log({
      tenantId, userId, action: AuditAction.CREATE,
      entityType: 'Contract', entityId: contract.id,
      newValue: { lessorId: contract.lessorId, status: contract.status },
    })

    return contract
  }

  async update(tenantId: string, id: string, dto: UpdateContractDto, userId: string) {
    const existing = await this.findById(tenantId, id)
    const { rates, ...contractData } = dto

    // Auto-version on every update
    const latestVersion = await this.prisma.contractVersion.findFirst({
      where: { contractId: id },
      orderBy: { versionNo: 'desc' },
    })
    const nextVersion = (latestVersion?.versionNo ?? 0) + 1

    const updated = await this.prisma.contract.update({
      where: { id },
      data: {
        ...contractData,
        updatedBy: userId,
        versions: {
          create: {
            versionNo: nextVersion,
            payloadSnapshot: contractData as object,
            createdBy: userId,
          },
        },
      },
    })

    const { old, new: newVal } = this.audit.diff(
      existing as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>,
    )

    await this.audit.log({
      tenantId, userId, action: AuditAction.UPDATE,
      entityType: 'Contract', entityId: id,
      oldValue: old, newValue: newVal,
    })

    return updated
  }

  async changeStatus(tenantId: string, id: string, toStatus: string, reason: string, userId: string) {
    const contract = await this.findById(tenantId, id)
    const fromStatus = contract.status

    await this.prisma.$transaction([
      this.prisma.contract.update({
        where: { id },
        data: { status: toStatus as never, updatedBy: userId },
      }),
      this.prisma.contractStatusHistory.create({
        data: { contractId: id, fromStatus, toStatus, changedBy: userId, reason },
      }),
    ])

    await this.audit.log({
      tenantId, userId, action: AuditAction.UPDATE,
      entityType: 'Contract', entityId: id,
      oldValue: { status: fromStatus }, newValue: { status: toStatus },
    })

    return this.findById(tenantId, id)
  }

  async createAddendum(tenantId: string, contractId: string, dto: {
    description?: string; effectiveDate?: string
  }, userId: string) {
    await this.findById(tenantId, contractId)

    const lastAddendum = await this.prisma.contractAddendum.findFirst({
      where: { contractId },
      orderBy: { addendumNo: 'desc' },
    })

    return this.prisma.contractAddendum.create({
      data: {
        contractId,
        addendumNo: (lastAddendum?.addendumNo ?? 0) + 1,
        description: dto.description,
        effectiveDate: dto.effectiveDate ? new Date(dto.effectiveDate) : undefined,
        createdBy: userId,
      },
    })
  }

  async createTermination(tenantId: string, contractId: string, dto: {
    terminationDate: string; reason?: string
  }, userId: string) {
    const contract = await this.findById(tenantId, contractId)

    if (contract.termination) {
      throw new BadRequestException('Contractul are deja o reziliere înregistrată')
    }

    const termination = await this.prisma.contractTermination.create({
      data: {
        contractId,
        terminationDate: new Date(dto.terminationDate),
        reason: dto.reason,
        createdBy: userId,
      },
    })

    // Auto-update status to TERMINATED
    await this.changeStatus(tenantId, contractId, 'TERMINATED', 'Reziliere', userId)

    return termination
  }

  async attachParcel(tenantId: string, contractId: string, parcelId: string, surfaceAssigned?: number) {
    await this.findById(tenantId, contractId)

    // Verify parcel belongs to same tenant
    const parcel = await this.prisma.parcel.findFirst({
      where: { id: parcelId, tenantId, isDeleted: false },
    })
    if (!parcel) throw new NotFoundException('Parcela nu a fost găsită')

    return this.prisma.parcelContractLink.upsert({
      where: { parcelId_contractId: { parcelId, contractId } },
      update: { surfaceAssigned: surfaceAssigned ? surfaceAssigned as unknown as never : undefined },
      create: { parcelId, contractId, surfaceAssigned: surfaceAssigned as unknown as never },
    })
  }

  async detachParcel(tenantId: string, contractId: string, parcelId: string) {
    await this.findById(tenantId, contractId)
    return this.prisma.parcelContractLink.delete({
      where: { parcelId_contractId: { parcelId, contractId } },
    })
  }

  async getParcels(tenantId: string, contractId: string) {
    await this.findById(tenantId, contractId)
    return this.prisma.parcelContractLink.findMany({
      where: { contractId },
      include: {
        parcel: {
          include: { zone: true, landUseCategory: true },
        },
      },
    })
  }
}
