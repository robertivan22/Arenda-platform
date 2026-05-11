import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'
import type { AuthenticatedUser } from '@arenda/shared'

/**
 * TenantGuard validates that the tenant referenced in the URL param
 * matches the authenticated user's tenant (or allows SUPER_ADMIN).
 *
 * Attach to controllers/routes that operate on a specific tenant.
 * The guard reads :tenantId from route params if present.
 */
@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest()
    const user: AuthenticatedUser = request.user

    if (!user) {
      throw new ForbiddenException('Acces interzis: utilizator neautentificat')
    }

    // Super Admin can access any tenant
    if (user.roles.includes('SUPER_ADMIN')) return true

    // Verify user's tenant is still ACTIVE
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: user.tenantId },
      select: { status: true },
    })

    if (!tenant || tenant.status !== 'ACTIVE') {
      throw new ForbiddenException('Tenant suspendat sau inexistent')
    }

    // If route has :tenantId param, ensure it matches
    const routeTenantId = request.params?.tenantId
    if (routeTenantId && routeTenantId !== user.tenantId) {
      throw new ForbiddenException('Acces interzis la resursele altui tenant')
    }

    return true
  }
}
