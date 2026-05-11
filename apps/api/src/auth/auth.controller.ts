import {
  Controller, Post, Body, Req, Res, HttpCode, HttpStatus, Get, UseGuards
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { Request, Response } from 'express'
import { AuthService } from './auth.service'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { LoginSchema, ForgotPasswordSchema, ResetPasswordSchema } from '@arenda/shared'
import type { AuthenticatedUser } from '@arenda/shared'

class LoginDto {
  tenantSlug!: string
  email!: string
  password!: string
}

class RefreshDto {
  refreshToken!: string
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autentificare utilizator' })
  async login(@Body() body: LoginDto, @Req() req: Request) {
    // Validate with Zod
    const parsed = LoginSchema.safeParse(body)
    if (!parsed.success) {
      return { statusCode: 400, message: 'Date invalide', errors: parsed.error.errors }
    }

    return this.authService.login(
      body.tenantSlug,
      body.email,
      body.password,
      req.ip,
      req.headers['user-agent'],
    )
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reînnoire token acces' })
  async refresh(@Body() body: RefreshDto) {
    return this.authService.refreshToken(body.refreshToken)
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async logout(@Req() req: Request & { user: AuthenticatedUser }) {
    await this.authService.logout(req.user.sub, req.user.tenantId, req.ip)
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() body: { email: string; tenantSlug: string }) {
    return this.authService.forgotPassword(body.email, body.tenantSlug)
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Date utilizator curent' })
  async me(@Req() req: Request & { user: AuthenticatedUser }) {
    return { data: req.user }
  }
}
