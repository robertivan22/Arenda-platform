import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import * as bcrypt from 'bcryptjs'
import { PrismaService } from '../database/prisma.service'
import { AuditService } from '../audit/audit.service'
import { AuditAction } from '@arenda/shared'

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  // Called by LocalStrategy — validates email/password
  async validateUser(tenantSlug: string, email: string, password: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } })
    if (!tenant || tenant.status !== 'ACTIVE') {
      throw new UnauthorizedException('Tenant invalid sau suspendat')
    }

    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId: tenant.id, email } },
      include: {
        userRoles: {
          include: {
            role: {
              include: { rolePermissions: { include: { permission: true } } },
            },
          },
        },
      },
    })

    if (!user || user.isDeleted || user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Credențiale invalide')
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash)
    if (!passwordValid) {
      throw new UnauthorizedException('Credențiale invalide')
    }

    return { user, tenant }
  }

  async login(
    tenantSlug: string,
    email: string,
    password: string,
    ipAddress?: string,
    userAgent?: string,
  ) {
    const { user, tenant } = await this.validateUser(tenantSlug, email, password)

    const roles = user.userRoles.map((ur: any) => ur.role.code)
    const permissions = [
      ...new Set(
        user.userRoles.flatMap((ur: any) =>
          ur.role.rolePermissions.map((rp: any) => rp.permission.code),
        ),
      ),
    ]

    const payload = {
      sub: user.id,
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      email: user.email,
      roles,
      permissions,
    }

    const accessToken = this.jwt.sign(payload, {
      expiresIn: this.config.get('JWT_ACCESS_EXPIRES_IN', '15m'),
    })
    const refreshToken = this.jwt.sign(
      { sub: user.id, tenantId: tenant.id, type: 'refresh' },
      { expiresIn: this.config.get('JWT_REFRESH_EXPIRES_IN', '7d') },
    )

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    // Audit log
    await this.audit.log({
      tenantId: tenant.id,
      userId: user.id,
      action: AuditAction.LOGIN,
      entityType: 'User',
      entityId: user.id,
      ipAddress,
      userAgent,
    })

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        roles,
        permissions,
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: 900, // 15 minutes in seconds
      },
    }
  }

  async logout(userId: string, tenantId: string, ipAddress?: string) {
    await this.audit.log({
      tenantId,
      userId,
      action: AuditAction.LOGOUT,
      entityType: 'User',
      entityId: userId,
      ipAddress,
    })
  }

  async refreshToken(token: string) {
    try {
      const payload = this.jwt.verify(token) as {
        sub: string
        tenantId: string
        type: string
      }

      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Token invalid')
      }

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        include: {
          userRoles: {
            include: {
              role: {
                include: { rolePermissions: { include: { permission: true } } },
              },
            },
          },
        },
      })

      if (!user || user.isDeleted || user.status !== 'ACTIVE') {
        throw new UnauthorizedException('Utilizator invalid')
      }

      const roles = user.userRoles.map((ur: any) => ur.role.code)
      const permissions = [
        ...new Set(
          user.userRoles.flatMap((ur: any) =>
            ur.role.rolePermissions.map((rp: any) => rp.permission.code),
          ),
        ),
      ]

      const newAccessToken = this.jwt.sign({
        sub: user.id,
        tenantId: payload.tenantId,
        email: user.email,
        roles,
        permissions,
      })

      return { accessToken: newAccessToken, expiresIn: 900 }
    } catch {
      throw new UnauthorizedException('Token refresh invalid')
    }
  }

  async forgotPassword(email: string, tenantSlug: string) {
    // In production: generate reset token, store hashed in DB, send email
    // For MVP: return success regardless to avoid email enumeration
    this.logger.log(`Password reset requested for ${email} on tenant ${tenantSlug}`)
    return { message: 'Dacă emailul există, vei primi instrucțiunile de resetare.' }
  }

  async resetPassword(token: string, newPassword: string) {
    // In production: verify token from DB, update password, invalidate token
    throw new BadRequestException('Funcționalitate în implementare')
  }
}
