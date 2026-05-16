'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/auth.store'

/**
 * AuthProvider — listens for Supabase auth state changes.
 *
 * When the user changes (login, logout, token refresh, user switch):
 * - updates the Zustand auth store
 * - invalidates ALL React Query caches (so pages refetch for the new user)
 * - clears any user-namespaced localStorage that might leak across sessions
 *
 * Must be rendered inside QueryProvider.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const prevUserIdRef = useRef<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    // Initial load
    supabase.auth.getUser().then(({ data: { user } }) => {
      useAuthStore.setState({ user, loading: false })
      prevUserIdRef.current = user?.id ?? null
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const newUser = session?.user ?? null
        const newUserId = newUser?.id ?? null
        const prevUserId = prevUserIdRef.current

        // Update auth store
        useAuthStore.setState({ user: newUser, loading: false })

        // If user actually changed (different user or signed out), reset everything
        if (prevUserId !== newUserId) {
          // Clear all React Query caches — ensures no stale data from previous user
          queryClient.clear()

          prevUserIdRef.current = newUserId
        }
      },
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [queryClient])

  return <>{children}</>
}
