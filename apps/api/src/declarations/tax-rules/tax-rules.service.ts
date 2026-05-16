/**
 * Tax Rules Service — versioned rule lookup.
 *
 * IMPORTANT: Always queries by effective date, never just "latest".
 * This ensures historical correctness — a declaration for an old period
 * will always use the legal rules that were valid for that period.
 */
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../database/prisma.service'

@Injectable()
export class TaxRulesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the rule of the given type that was valid on the given date.
   * Throws if no rule exists — caller must handle this as a configuration error.
   */
  async getRuleForPeriod(ruleType: string, date: Date) {
    return this.prisma.taxRuleVersion.findFirst({
      where: {
        ruleType,
        validFrom: { lte: date },
        OR: [{ validTo: null }, { validTo: { gte: date } }],
      },
      orderBy: { validFrom: 'desc' },
    })
  }

  async getAllRules(ruleType?: string) {
    return this.prisma.taxRuleVersion.findMany({
      where: ruleType ? { ruleType } : undefined,
      orderBy: [{ ruleType: 'asc' }, { validFrom: 'desc' }],
    })
  }

  async createRule(data: {
    ruleType: string
    validFrom: Date
    validTo?: Date
    payloadJson: Record<string, unknown>
    description?: string
    createdBy?: string
  }) {
    return this.prisma.taxRuleVersion.create({
      data: {
        ruleType: data.ruleType,
        validFrom: data.validFrom,
        validTo: data.validTo,
        payloadJson: data.payloadJson,
        description: data.description,
        createdBy: data.createdBy,
      },
    })
  }
}
