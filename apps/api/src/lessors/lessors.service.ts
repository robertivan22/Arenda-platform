import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../database/prisma.service'
import { AuditService } from '../audit/audit.service'
import { TenantScope, buildPagination, buildPaginatedResult } from '../common/utils/tenant-scope.util'
import { AuditAction } from '@arenda/shared'
import type { CreateLessorDto, UpdateLessorDto, LessorFiltersDto } from '@arenda/shared'

@Injectable()
export class LessorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(tenantId: string, filters: LessorFiltersDto) {
    const { page = 1, limit = 25, search, status, blocked, countyId, sortBy = 'createdAt', sortDir = 'desc' } = filters
    const { skip, take } = buildPagination(page, limit)

    const where: Record<string, unknown> = {
      ...TenantScope.where(tenantId),
      ...(status && { status }),
      ...(blocked !== undefined && { paymentBlocked: blocked }),
    }

    if (search) {
      where.OR = [
        { lastName: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { cnpCui: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [data, total] = await Promise.all([
      this.prisma.lessor.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortDir },
        include: {
          address: {
            include: { locality: { include: { county: true } } },
          },
          contact: true,
          _count: { select: { contracts: true, parcelLinks: true } },
        },
      }),
      this.prisma.lessor.count({ where }),
    ])

    return buildPaginatedResult(data, total, page, limit)
  }

  async findById(tenantId: string, id: string) {
    const lessor = await this.prisma.lessor.findFirst({
      where: TenantScope.where<{ id: string }>(tenantId, { id }),
      include: {
        address: { include: { locality: { include: { county: true } } } },
        contact: true,
        bankAccounts: { where: { isActive: true } },
        authorizedReps: { orderBy: { createdAt: 'desc' } },
        _count: { select: { contracts: true, parcelLinks: true, payments: true } },
      },
    })

    if (!lessor) throw new NotFoundException('Arendatorul nu a fost găsit')
    return lessor
  }

  async checkDuplicate(tenantId: string, cnpCui: string, excludeId?: string) {
    const existing = await this.prisma.lessor.findFirst({
      where: {
        tenantId,
        cnpCui,
        isDeleted: false,
        ...(excludeId && { id: { not: excludeId } }),
      },
    })
    return existing
  }

  async create(tenantId: string, dto: CreateLessorDto, userId: string) {
    // Duplicate check
    const duplicate = await this.checkDuplicate(tenantId, dto.cnpCui)
    if (duplicate) {
      throw new ConflictException(
        `Există deja un arendator cu CNP/CUI ${dto.cnpCui} (ID: ${duplicate.id})`,
      )
    }

    const { address, contact, bankAccounts, ...lessorData } = dto

    const lessor = await this.prisma.lessor.create({
      data: {
        tenantId,
        ...lessorData,
        createdBy: userId,
        updatedBy: userId,
        // Create nested address, contact, bank accounts in same transaction
        ...(address && {
          address: { create: address },
        }),
        ...(contact && {
          contact: { create: contact },
        }),
        ...(bankAccounts?.length && {
          bankAccounts: {
            create: bankAccounts.map((ba, idx) => ({
              ...ba,
              isPrimary: ba.isPrimary ?? idx === 0,
            })),
          },
        }),
      },
      include: {
        address: true,
        contact: true,
        bankAccounts: true,
      },
    })

    await this.audit.log({
      tenantId,
      userId,
      action: AuditAction.CREATE,
      entityType: 'Lessor',
      entityId: lessor.id,
      newValue: { lastName: lessor.lastName, cnpCui: lessor.cnpCui, personType: lessor.personType },
    })

    return lessor
  }

  async update(tenantId: string, id: string, dto: UpdateLessorDto, userId: string) {
    const existing = await this.findById(tenantId, id)

    if (dto.cnpCui && dto.cnpCui !== existing.cnpCui) {
      const duplicate = await this.checkDuplicate(tenantId, dto.cnpCui, id)
      if (duplicate) {
        throw new ConflictException(`Există deja un arendator cu CNP/CUI ${dto.cnpCui}`)
      }
    }

    const { address, contact, bankAccounts, ...lessorData } = dto

    const updated = await this.prisma.lessor.update({
      where: { id },
      data: {
        ...lessorData,
        updatedBy: userId,
        ...(address && {
          address: {
            upsert: { update: address, create: address },
          },
        }),
        ...(contact && {
          contact: {
            upsert: { update: contact, create: contact },
          },
        }),
      },
      include: {
        address: true,
        contact: true,
        bankAccounts: { where: { isActive: true } },
      },
    })

    const { old, new: newVal } = this.audit.diff(
      existing as unknown as Record<string, unknown>,
      updated as unknown as Record<string, unknown>,
    )

    await this.audit.log({
      tenantId,
      userId,
      action: AuditAction.UPDATE,
      entityType: 'Lessor',
      entityId: id,
      oldValue: old,
      newValue: newVal,
    })

    return updated
  }

  async archive(tenantId: string, id: string, userId: string) {
    await this.findById(tenantId, id)
    const updated = await this.prisma.lessor.update({
      where: { id },
      data: { status: 'ARCHIVED', isDeleted: true, deletedAt: new Date(), deletedBy: userId },
    })
    await this.audit.log({
      tenantId, userId, action: AuditAction.ARCHIVE,
      entityType: 'Lessor', entityId: id,
    })
    return updated
  }

  async blockPayment(tenantId: string, id: string, reason: string, userId: string) {
    await this.findById(tenantId, id)
    const updated = await this.prisma.lessor.update({
      where: { id },
      data: { paymentBlocked: true, blockReason: reason, updatedBy: userId },
    })
    await this.audit.log({
      tenantId, userId, action: AuditAction.BLOCK,
      entityType: 'Lessor', entityId: id,
      newValue: { paymentBlocked: true, blockReason: reason },
    })
    return updated
  }

  async unblockPayment(tenantId: string, id: string, userId: string) {
    await this.findById(tenantId, id)
    const updated = await this.prisma.lessor.update({
      where: { id },
      data: { paymentBlocked: false, blockReason: null, updatedBy: userId },
    })
    await this.audit.log({
      tenantId, userId, action: AuditAction.UNBLOCK,
      entityType: 'Lessor', entityId: id,
      newValue: { paymentBlocked: false },
    })
    return updated
  }

  async getContracts(tenantId: string, id: string) {
    await this.findById(tenantId, id)
    return this.prisma.contract.findMany({
      where: { tenantId, lessorId: id, isDeleted: false },
      include: {
        mayoralty: true,
        contractType: true,
        rates: { orderBy: { validFrom: 'desc' }, take: 1 },
        _count: { select: { parcelLinks: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getParcels(tenantId: string, id: string) {
    await this.findById(tenantId, id)
    return this.prisma.parcel.findMany({
      where: {
        tenantId,
        isDeleted: false,
        lessorLinks: { some: { lessorId: id } },
      },
      include: {
        zone: true,
        landUseCategory: true,
        contractLinks: { include: { contract: { select: { id: true, status: true } } } },
      },
    })
  }

  async getHistory(tenantId: string, id: string) {
    await this.findById(tenantId, id)
    return this.prisma.auditLog.findMany({
      where: { tenantId, entityType: 'Lessor', entityId: id },
      orderBy: { timestamp: 'desc' },
      take: 100,
      include: { user: { select: { firstName: true, lastName: true, email: true } } },
    })
  }

  async addBankAccount(tenantId: string, lessorId: string, dto: {
    bankName?: string; iban?: string; holderSamePerson?: boolean;
    holderName?: string; holderIdentifier?: string; isPrimary?: boolean
  }) {
    await this.findById(tenantId, lessorId)
    if (dto.isPrimary) {
      // Unset existing primary
      await this.prisma.lessorBankAccount.updateMany({
        where: { lessorId },
        data: { isPrimary: false },
      })
    }
    return this.prisma.lessorBankAccount.create({
      data: { lessorId, ...dto },
    })
  }

  async getMessages(tenantId: string, id: string) {
    await this.findById(tenantId, id)
    return this.prisma.lessorMessage.findMany({
      where: { lessorId: id },
      orderBy: { sentAt: 'desc' },
      take: 50,
    })
  }

  async addMessage(tenantId: string, id: string, content: string, userId: string) {
    await this.findById(tenantId, id)
    return this.prisma.lessorMessage.create({
      data: { lessorId: id, tenantId, userId, content, direction: 'OUTBOUND' },
    })
  }

  async getPurchaseOffers(tenantId: string, id: string) {
    await this.findById(tenantId, id)
    return this.prisma.purchaseOffer.findMany({
      where: { tenantId, lessorId: id },
      include: { parcel: { select: { id: true, tarla: true, parcela: true } } },
      orderBy: { offerDate: 'desc' },
    })
  }

  async getAuthorizedReps(tenantId: string, id: string) {
    await this.findById(tenantId, id)
    return this.prisma.authorizedRepresentative.findMany({
      where: { lessorId: id },
      orderBy: { createdAt: 'desc' },
    })
  }
}
