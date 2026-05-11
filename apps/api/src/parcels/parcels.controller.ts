import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { ParcelsService } from './parcels.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RbacGuard } from '../common/guards/rbac.guard'
import { TenantGuard } from '../common/guards/tenant.guard'
import { RequirePermission } from '../common/decorators/require-permission.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { PERMISSIONS, CreateParcelSchema, UpdateParcelSchema, ParcelFiltersSchema } from '@arenda/shared'
import type { AuthenticatedUser } from '@arenda/shared'

@ApiTags('Parcele')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RbacGuard)
@Controller('parcels')
export class ParcelsController {
  constructor(private readonly service: ParcelsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.PARCEL_READ)
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: Record<string, string>) {
    const filters = ParcelFiltersSchema.parse(query)
    return this.service.findAll(user.tenantId, filters)
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.PARCEL_READ)
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.findById(user.tenantId, id)
  }

  @Post()
  @RequirePermission(PERMISSIONS.PARCEL_CREATE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const dto = CreateParcelSchema.parse(body)
    return this.service.create(user.tenantId, dto, user.sub)
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.PARCEL_UPDATE)
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: unknown) {
    const dto = UpdateParcelSchema.parse(body)
    return this.service.update(user.tenantId, id, dto, user.sub)
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.PARCEL_ARCHIVE)
  @HttpCode(HttpStatus.NO_CONTENT)
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.archive(user.tenantId, id, user.sub)
  }

  @Post(':id/link-lessor')
  @RequirePermission(PERMISSIONS.PARCEL_UPDATE)
  linkLessor(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { lessorId: string; ownershipShare?: number },
  ) {
    return this.service.linkToLessor(user.tenantId, id, body.lessorId, body.ownershipShare)
  }
}
