import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { NomenclatureService } from './nomenclature.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import type { AuthenticatedUser } from '@arenda/shared'

@ApiTags('Nomenclatoare')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('nomenclature')
export class NomenclatureController {
  constructor(private readonly service: NomenclatureService) {}

  @Get('counties') getCounties() { return this.service.getCounties() }
  @Get('localities') getLocalities(@Query('countyId') countyId?: string) { return this.service.getLocalities(countyId) }
  @Get('uats') getUATs(@Query('localityId') localityId?: string) { return this.service.getUATs(localityId) }
  @Get('mayoralties') getMayoralties(@Query('uatId') uatId?: string) { return this.service.getMayoralties(uatId) }
  @Get('zones') getZones(@CurrentUser() user: AuthenticatedUser) { return this.service.getZones(user.tenantId) }
  @Get('land-use-categories') getLandUseCategories() { return this.service.getLandUseCategories() }
  @Get('contract-types') getContractTypes(@CurrentUser() user: AuthenticatedUser) { return this.service.getContractTypes(user.tenantId) }
  @Get('payment-methods') getPaymentMethods() { return this.service.getPaymentMethods() }
  @Get('products') getProducts(@CurrentUser() user: AuthenticatedUser) { return this.service.getProducts(user.tenantId) }
}
