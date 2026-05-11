import { Controller, Get, Param, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { TenantsService } from './tenants.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RbacGuard } from '../common/guards/rbac.guard'
import { RequirePermission } from '../common/decorators/require-permission.decorator'
import { PERMISSIONS } from '@arenda/shared'

@ApiTags('Tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RbacGuard)
@Controller('tenants')
export class TenantsController {
  constructor(private readonly service: TenantsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.TENANT_READ)
  findAll() { return this.service.findAll() }

  @Get(':id')
  @RequirePermission(PERMISSIONS.TENANT_READ)
  findOne(@Param('id') id: string) { return this.service.findById(id) }

  @Get(':id/settings')
  @RequirePermission(PERMISSIONS.TENANT_READ)
  getSettings(@Param('id') id: string) { return this.service.getSettings(id) }
}
