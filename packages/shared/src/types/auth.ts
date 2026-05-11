export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn: number
}

export interface LoginResponse {
  user: {
    id: string
    email: string
    firstName: string
    lastName: string
    tenantId: string
    roles: string[]
    permissions: string[]
  }
  tokens: AuthTokens
}
