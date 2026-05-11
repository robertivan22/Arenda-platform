// System role codes — must match roles table seed data
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  TENANT_ADMIN: 'TENANT_ADMIN',
  CONTRACTS_OP: 'CONTRACTS_OP',
  PAYMENTS_OP: 'PAYMENTS_OP',
  ACCOUNTANT: 'ACCOUNTANT',
  REPORTING_OP: 'REPORTING_OP',
  VIEWER: 'VIEWER',
  SUPPORT_ADMIN: 'SUPPORT_ADMIN',
} as const

export type RoleCode = (typeof ROLES)[keyof typeof ROLES]
