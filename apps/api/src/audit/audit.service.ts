import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../database/prisma.service'
import { AuditAction } from '@arenda/shared'

export interface AuditLogParams {
  tenantId: string
  userId?: string
  action: AuditAction
  entityType: string
  entityId?: string
  oldValue?: Record<string, unknown>
  newValue?: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
  requestId?: string
  metadata?: Record<string, unknown>
}

// Fields to redact from audit logs for security
const REDACTED_FIELDS = ['passwordHash', 'iban', 'cnpCui']

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name)

  constructor(private readonly prisma: PrismaService) {}

  async log(params: AuditLogParams): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: params.tenantId,
          userId: params.userId,
          action: params.action,
          entityType: params.entityType,
          entityId: params.entityId,
          oldValue: params.oldValue ? this.redact(params.oldValue) : undefined,
          newValue: params.newValue ? this.redact(params.newValue) : undefined,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
          requestId: params.requestId,
          metadata: params.metadata,
        },
      })
    } catch (err) {
      // Audit failures must never break business operations
      this.logger.error('Failed to write audit log', err)
    }
  }

  // Compute diff between two objects for UPDATE operations
  diff(
    before: Record<string, unknown>,
    after: Record<string, unknown>,
  ): { old: Record<string, unknown>; new: Record<string, unknown> } {
    const old: Record<string, unknown> = {}
    const updated: Record<string, unknown> = {}

    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)])
    for (const key of allKeys) {
      if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
        old[key] = before[key]
        updated[key] = after[key]
      }
    }

    return { old, new: updated }
  }

  private redact(obj: Record<string, unknown>): Record<string, unknown> {
    const result = { ...obj }
    for (const field of REDACTED_FIELDS) {
      if (field in result) {
        result[field] = '***REDACTED***'
      }
    }
    return result
  }
}
