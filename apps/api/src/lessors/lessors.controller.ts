import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger'
import { LessorsService } from './lessors.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RbacGuard } from '../common/guards/rbac.guard'
import { TenantGuard } from '../common/guards/tenant.guard'
import { RequirePermission } from '../common/decorators/require-permission.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { PERMISSIONS, CreateLessorSchema, UpdateLessorSchema, LessorFiltersSchema } from '@arenda/shared'
import type { AuthenticatedUser } from '@arenda/shared'

@ApiTags('Arendatori')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RbacGuard)
@Controller('lessors')
export class LessorsController {
  constructor(private readonly service: LessorsService) {}

  @Get()
  @RequirePermission(PERMISSIONS.LESSOR_READ)
  @ApiOperation({ summary: 'Lista arendatori' })
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: Record<string, string>) {
    const filters = LessorFiltersSchema.parse(query)
    return this.service.findAll(user.tenantId, filters)
  }

  @Get('check-duplicate')
  @RequirePermission(PERMISSIONS.LESSOR_READ)
  @ApiOperation({ summary: 'Verifică duplicat CNP/CUI' })
  checkDuplicate(
    @CurrentUser() user: AuthenticatedUser,
    @Query('cnpCui') cnpCui: string,
    @Query('excludeId') excludeId?: string,
  ) {
    return this.service.checkDuplicate(user.tenantId, cnpCui, excludeId)
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.LESSOR_READ)
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.findById(user.tenantId, id)
  }

  @Post()
  @RequirePermission(PERMISSIONS.LESSOR_CREATE)
  @ApiOperation({ summary: 'Adaugă arendator nou' })
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: unknown) {
    const dto = CreateLessorSchema.parse(body)
    return this.service.create(user.tenantId, dto, user.sub)
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.LESSOR_UPDATE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const dto = UpdateLessorSchema.parse(body)
    return this.service.update(user.tenantId, id, dto, user.sub)
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.LESSOR_ARCHIVE)
  @HttpCode(HttpStatus.NO_CONTENT)
  archive(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.archive(user.tenantId, id, user.sub)
  }

  @Post(':id/block-payment')
  @RequirePermission(PERMISSIONS.LESSOR_BLOCK_PAYMENT)
  @ApiOperation({ summary: 'Oprire plată arendator' })
  blockPayment(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { reason: string },
  ) {
    return this.service.blockPayment(user.tenantId, id, body.reason, user.sub)
  }

  @Post(':id/unblock-payment')
  @RequirePermission(PERMISSIONS.LESSOR_UNBLOCK_PAYMENT)
  @ApiOperation({ summary: 'Reluare plată arendator' })
  unblockPayment(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.unblockPayment(user.tenantId, id, user.sub)
  }

  @Get(':id/contracts')
  @RequirePermission(PERMISSIONS.LESSOR_READ)
  getContracts(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getContracts(user.tenantId, id)
  }

  @Get(':id/parcels')
  @RequirePermission(PERMISSIONS.LESSOR_READ)
  getParcels(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getParcels(user.tenantId, id)
  }

  @Get(':id/history')
  @RequirePermission(PERMISSIONS.LESSOR_READ)
  getHistory(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getHistory(user.tenantId, id)
  }

  @Get(':id/bank-accounts')
  @RequirePermission(PERMISSIONS.LESSOR_READ)
  getBankAccounts(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service['prisma'].lessorBankAccount.findMany({ where: { lessorId: id } })
  }

  @Post(':id/bank-accounts')
  @RequirePermission(PERMISSIONS.LESSOR_UPDATE)
  addBankAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: Record<string, unknown>,
  ) {
    return this.service.addBankAccount(user.tenantId, id, body as Parameters<typeof this.service.addBankAccount>[2])
  }

  @Get(':id/messages')
  @RequirePermission(PERMISSIONS.LESSOR_READ)
  getMessages(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getMessages(user.tenantId, id)
  }

  @Post(':id/messages')
  @RequirePermission(PERMISSIONS.LESSOR_READ)
  addMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { content: string },
  ) {
    return this.service.addMessage(user.tenantId, id, body.content, user.sub)
  }

  @Get(':id/purchase-offers')
  @RequirePermission(PERMISSIONS.LESSOR_READ)
  getPurchaseOffers(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getPurchaseOffers(user.tenantId, id)
  }

  @Get(':id/authorized-reps')
  @RequirePermission(PERMISSIONS.LESSOR_READ)
  getAuthorizedReps(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.getAuthorizedReps(user.tenantId, id)
  }
}
