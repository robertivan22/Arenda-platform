export interface PaginatedResult<T> {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface PaginationQuery {
  page?: number
  limit?: number
  sortBy?: string
  sortDir?: 'asc' | 'desc'
  search?: string
}

export interface ApiError {
  statusCode: number
  message: string
  errors?: { field: string; message: string }[]
  requestId?: string
}

export interface AsyncJobResult {
  jobId: string
  status: 'queued'
  estimatedAt?: string
}

export interface TenantContext {
  tenantId: string
  tenantSlug: string
}

export interface AuthenticatedUser {
  sub: string
  tenantId: string
  email: string
  roles: string[]
  permissions: string[]
}
