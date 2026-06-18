import {
  CanActivate, ExecutionContext, Injectable, UnauthorizedException, Logger,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { createHmac, timingSafeEqual } from 'crypto'

// Minimal JWT decode without full verification for header/payload extraction
function decodeJwtParts(token: string): { header: Record<string, unknown>; payload: Record<string, unknown> } | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const decode = (s: string) => JSON.parse(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
    return { header: decode(parts[0]), payload: decode(parts[1]) }
  } catch {
    return null
  }
}

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function verifyHs256(token: string, secret: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const decoded = decodeJwtParts(token)
  if (!decoded) return null

  const signingInput = `${parts[0]}.${parts[1]}`
  const expectedSig = base64UrlEncode(createHmac('sha256', secret).update(signingInput).digest())
  const actualSig = Buffer.from(parts[2].replace(/-/g, '+').replace(/_/g, '/'), 'base64')
  const expectedBuf = Buffer.from(expectedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64')

  if (actualSig.length !== expectedBuf.length) return null
  if (!timingSafeEqual(actualSig, expectedBuf)) return null

  // Check expiry
  const payload = decoded.payload
  const exp = typeof payload['exp'] === 'number' ? payload['exp'] : null
  if (exp && exp * 1000 < Date.now()) return null

  return payload
}

export interface SupabaseTokenPayload {
  sub: string
  email?: string
  role?: string
  app_metadata?: { tenant_id?: string }
  user_metadata?: Record<string, unknown>
}

@Injectable()
export class SupabaseJwtGuard implements CanActivate {
  private readonly logger = new Logger(SupabaseJwtGuard.name)
  private readonly secret: string | undefined

  constructor(private readonly config: ConfigService) {
    this.secret = config.get<string>('SUPABASE_JWT_SECRET')
  }

  canActivate(ctx: ExecutionContext): boolean {
    if (!this.secret) {
      this.logger.warn('SUPABASE_JWT_SECRET not configured — rejecting request')
      throw new UnauthorizedException('OCR service not configured')
    }

    const req = ctx.switchToHttp().getRequest<Request & { supabaseUser?: SupabaseTokenPayload }>()
    const authHeader = (req.headers as Record<string, string>)['authorization'] ?? ''
    if (!authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing Bearer token')
    }

    const token = authHeader.slice(7)
    const payload = verifyHs256(token, this.secret)
    if (!payload) {
      throw new UnauthorizedException('Invalid or expired token')
    }

    req.supabaseUser = payload as unknown as SupabaseTokenPayload
    return true
  }
}
