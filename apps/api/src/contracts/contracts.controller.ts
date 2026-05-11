import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { ContractsService } from './contracts.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RbacGuard } from '../common/guards/rbac.guard'
import { TenantGuard } from '../common/guards/tenant.guard'
import { RequirePermission } from '../common/decorators/require-permission.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { PERMISSIONS, CreateContractSchema, UpdateContractSchema, ContractFiltersSchema } from '@arenda/shared'
import type { AuthenticatedUser } from '@arenda/shared'

@ApiTags('Contracte')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RbacGuard)
@Controller('contracts')
export class ContractsController {
  constructor(private readonly service: ContractsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.CONTRACT_READ)
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: Record<string, string>) {
    const filters = ContractFiltersSchema.parse(query)
    return this.service.findAll(user.tenantId, filters)
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.CONTRACT_READ)
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.findById(user.tenantId, id)
  }

  @Post()
  @RequirePermission(PERMISSIONS.CONTRACT_CREATE)
  @ApiOperation({ summary: 'Contract nou' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const dto = CreateContractSchema.parse(body)
    return this.service.create(user.tenantId, dto, user.sub)
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.CONTRACT_UPDATE)
  update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: unknown) {
    const dto = UpdateContractSchema.parse(body)
    return this.service.update(user.tenantId, id, dto, user.sub)
  }

  @Patch(':id/status')
  @RequirePermission(PERMISSIONS.CONTRACT_UPDATE)
  changeStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { status: string; reason?: string },
  ) {
    return this.service.changeStatus(user.tenantId, id, body.status, body.reason ?? '', user.sub)
  }

  @Post(':id/addenda')
  @RequirePermission(PERMISSIONS.CONTRACT_ADDENDUM)
  @ApiOperation({ summary: 'Act adițional nou' })
  createAddendum(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { description?: string; effectiveDate?: string },
  ) {
    return this.service.createAddendum(user.tenantId, id, body, user.sub)
  }

  @Post(':id/termination')
  @RequirePermission(PERMISSIONS.CONTRACT_TERMINATE)
  @ApiOperation({ summary: 'Reziliere contract' })
  createTermination(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { terminationDate: string; reason?: string },
  ) {
    return this.service.createTermination(user.tenantId, id, body, user.sub)
  }

  @Get(':id/parcels')
  @RequirePermission(PERMISSIONS.CONTRACT_READ)
  getParcels(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getParcels(user.tenantId, id)
  }

  @Post(':id/parcels')
  @RequirePermission(PERMISSIONS.CONTRACT_UPDATE)
  attachParcel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { parcelId: string; surfaceAssigned?: number },
  ) {
    return this.service.attachParcel(user.tenantId, id, body.parcelId, body.surfaceAssigned)
  }

  @Delete(':id/parcels/:parcelId')
  @RequirePermission(PERMISSIONS.CONTRACT_UPDATE)
  @HttpCode(HttpStatus.NO_CONTENT)
  detachParcel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('parcelId') parcelId: string,
  ) {
    return this.service.detachParcel(user.tenantId, id, parcelId)
  }
}
