/**
 * TenantScope utility — ensures all Prisma queries always filter by tenantId
 * and exclude soft-deleted records.
 *
 * Usage:
 *   this.prisma.lessor.findMany({
 *     where: TenantScope.where(tenantId, { status: 'ACTIVE' })
 *   })
 */
export class TenantScope {
  static where<T extends Record<string, unknown>>(
    tenantId: string,
    extra?: T,
  ): T & { tenantId: string; isDeleted: boolean } {
    return {
      tenantId,
      isDeleted: false,
      ...(extra ?? {}),
    } as T & { tenantId: string; isDeleted: boolean }
  }

  // For entities that don't have isDeleted
  static tenantOnly(tenantId: string) {
    return { tenantId }
  }
}

// Standard pagination helper
export function buildPagination(page = 1, limit = 25) {
  const safeLimit = Math.min(limit, 200)
  const safePage = Math.max(page, 1)
  return {
    skip: (safePage - 1) * safeLimit,
    take: safeLimit,
  }
}

export function buildPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
) {
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  }
}
