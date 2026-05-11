import { Injectable, ConflictException, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service'
import * as bcrypt from 'bcryptjs'
import { TenantScope, buildPagination, buildPaginatedResult } from '../common/utils/tenant-scope.util'

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string, page = 1, limit = 25) {
    const { skip, take } = buildPagination(page, limit)
    const where = TenantScope.where(tenantId)
    const [data, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
          userRoles: { include: { role: { select: { code: true, name: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ])
    return buildPaginatedResult(data, total, page, limit)
  }

  async findById(tenantId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: TenantScope.where<{ id: string }>(tenantId, { id }),
      include: {
        userRoles: { include: { role: true } },
      },
    })
    if (!user) throw new NotFoundException('Utilizatorul nu a fost găsit')
    return user
  }

  async create(tenantId: string, dto: {
    email: string
    password: string
    firstName: string
    lastName: string
    roleCode?: string
  }) {
    const existing = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email: dto.email } },
    })
    if (existing) throw new ConflictException('Email-ul este deja folosit')

    const passwordHash = await bcrypt.hash(dto.password, 12)
    const user = await this.prisma.user.create({
      data: { tenantId, email: dto.email, passwordHash, firstName: dto.firstName, lastName: dto.lastName },
    })

    if (dto.roleCode) {
      const role = await this.prisma.role.findUnique({ where: { code: dto.roleCode } })
      if (role) {
        await this.prisma.userRole.create({
          data: { userId: user.id, roleId: role.id, tenantId },
        })
      }
    }

    return user
  }

  async update(tenantId: string, id: string, dto: Partial<{
    firstName: string
    lastName: string
    status: string
  }>) {
    await this.findById(tenantId, id)
    return this.prisma.user.update({ where: { id }, data: dto })
  }

  async delete(tenantId: string, id: string, deletedBy: string) {
    await this.findById(tenantId, id)
    return this.prisma.user.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date() },
    })
  }
}
