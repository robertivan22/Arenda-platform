/**
 * Supabase-based auth store.
 * Replaces the previous NestJS JWT implementation.
 *
 * - Uses the browser Supabase client (anon key only — safe in browser)
 * - Session is persisted in cookies by @supabase/ssr, NOT localStorage
 * - The middleware handles session refresh on every request
 */
'use client'

import { create } from 'zustand'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  loading: boolean

  signInWithPassword: (email: string, password: string) => Promise<void>
  signInWithMagicLink: (email: string) => Promise<void>
  signUp: (email: string, password: string, fullName?: string) => Promise<void>
  signOut: () => Promise<void>
  loadUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  loadUser: async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    set({ user, loading: false })
  },

  signInWithPassword: async (email, password) => {
    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    set({ user: data.user })
  },

  signInWithMagicLink: async (email) => {
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw error
  },

  signUp: async (email, password, fullName) => {
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName ?? '' },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) throw error
    set({ user: data.user })
  },

  signOut: async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    set({ user: null })
    window.location.href = '/login'
  },
}))
