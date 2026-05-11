import {
  Injectable, CanActivate, ExecutionContext, ForbiddenException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator'
import { ROLES } from '@arenda/shared'
import type { AuthenticatedUser } from '@arenda/shared'

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.getAllAndOverride<string>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    )

    // No permission required — allow
    if (!requiredPermission) return true

    const request = context.switchToHttp().getRequest()
    const user: AuthenticatedUser = request.user

    if (!user) {
      throw new ForbiddenException('Acces interzis: utilizator neautentificat')
    }

    // Super Admin bypasses all permission checks
    if (user.roles.includes(ROLES.SUPER_ADMIN)) return true

    if (!user.permissions.includes(requiredPermission)) {
      throw new ForbiddenException(
        `Acces interzis: permisiunea '${requiredPermission}' este necesară`,
      )
    }

    return true
  }
}
