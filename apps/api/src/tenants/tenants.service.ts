import { Injectable } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service'

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() { return this.prisma.tenant.findMany({ orderBy: { name: 'asc' } }) }
  findById(id: string) { return this.prisma.tenant.findUniqueOrThrow({ where: { id } }) }
  getSettings(tenantId: string) { return this.prisma.tenantSetting.findMany({ where: { tenantId } }) }
}
