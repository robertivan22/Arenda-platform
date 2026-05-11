import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { api } from '@/lib/api-client'
import type { LoginResponse } from '@arenda/shared'

interface AuthState {
  user: LoginResponse['user'] | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean

  login: (tenantSlug: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  hasPermission: (permission: string) => boolean
  hasRole: (role: string) => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      login: async (tenantSlug, email, password) => {
        const response = await api.post<LoginResponse>('/auth/login', {
          tenantSlug,
          email,
          password,
        })

        const { user, tokens } = response.data
        localStorage.setItem('access_token', tokens.accessToken)
        localStorage.setItem('refresh_token', tokens.refreshToken)

        set({
          user,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          isAuthenticated: true,
        })
      },

      logout: async () => {
        try {
          await api.post('/auth/logout')
        } catch {}
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
      },

      hasPermission: (permission: string) => {
        const { user } = get()
        if (!user) return false
        if (user.roles.includes('SUPER_ADMIN')) return true
        return user.permissions.includes(permission)
      },

      hasRole: (role: string) => {
        const { user } = get()
        return user?.roles.includes(role) ?? false
      },
    }),
    {
      name: 'arenda-auth',
      partialize: state => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)
