import { Injectable } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service'

@Injectable()
export class NomenclatureService {
  constructor(private readonly prisma: PrismaService) {}

  getCounties() { return this.prisma.county.findMany({ orderBy: { name: 'asc' } }) }
  getLocalities(countyId?: string) {
    return this.prisma.locality.findMany({
      where: countyId ? { countyId } : undefined,
      include: { county: true },
      orderBy: { name: 'asc' },
    })
  }
  getUATs(localityId?: string) {
    return this.prisma.uAT.findMany({
      where: localityId ? { localityId } : undefined,
      orderBy: { name: 'asc' },
    })
  }
  getMayoralties(uatId?: string) {
    return this.prisma.mayoralty.findMany({
      where: uatId ? { uatId } : undefined,
      orderBy: { name: 'asc' },
    })
  }
  getZones(tenantId: string) {
    return this.prisma.zone.findMany({ where: { tenantId }, orderBy: { name: 'asc' } })
  }
  getLandUseCategories() {
    return this.prisma.landUseCategory.findMany({ orderBy: { name: 'asc' } })
  }
  getContractTypes(tenantId: string) {
    return this.prisma.contractType.findMany({
      where: { OR: [{ tenantId }, { isSystem: true }] },
      orderBy: { name: 'asc' },
    })
  }
  getPaymentMethods() {
    return this.prisma.paymentMethod.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } })
  }
  getProducts(tenantId: string) {
    return this.prisma.productCatalog.findMany({ where: { tenantId, isActive: true }, orderBy: { name: 'asc' } })
  }
}
