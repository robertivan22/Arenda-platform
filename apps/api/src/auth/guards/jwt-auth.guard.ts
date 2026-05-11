import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context)
  }

  handleRequest(err: unknown, user: unknown) {
    if (err || !user) {
      throw new UnauthorizedException('Token de autentificare lipsă sau invalid')
    }
    return user
  }
}
