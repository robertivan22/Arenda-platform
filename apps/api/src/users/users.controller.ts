import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { UsersService } from './users.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RbacGuard } from '../common/guards/rbac.guard'
import { TenantGuard } from '../common/guards/tenant.guard'
import { RequirePermission } from '../common/decorators/require-permission.decorator'
import { CurrentUser } from '../common/decorators/current-user.decorator'
import { PERMISSIONS } from '@arenda/shared'
import type { AuthenticatedUser } from '@arenda/shared'

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, RbacGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  @RequirePermission(PERMISSIONS.ADMIN_USERS_MANAGE)
  findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.service.findAll(user.tenantId, page, limit)
  }

  @Get(':id')
  @RequirePermission(PERMISSIONS.ADMIN_USERS_MANAGE)
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.findById(user.tenantId, id)
  }

  @Post()
  @RequirePermission(PERMISSIONS.ADMIN_USERS_MANAGE)
  create(@CurrentUser() user: AuthenticatedUser, @Body() body: {
    email: string; password: string; firstName: string; lastName: string; roleCode?: string
  }) {
    return this.service.create(user.tenantId, body)
  }

  @Patch(':id')
  @RequirePermission(PERMISSIONS.ADMIN_USERS_MANAGE)
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() body: { firstName?: string; lastName?: string; status?: string },
  ) {
    return this.service.update(user.tenantId, id, body)
  }

  @Delete(':id')
  @RequirePermission(PERMISSIONS.ADMIN_USERS_MANAGE)
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.service.delete(user.tenantId, id, user.sub)
  }
}
