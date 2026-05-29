'use client'

/**
 * /auth/confirm — Supabase PKCE token exchange (recommended flow for SSR)
 *
 * Supabase email links for password reset and user invitations land here:
 *   ?token_hash=XXX&type=recovery&next=/reset-password
 *   ?token_hash=XXX&type=invite&next=/set-password
 *
 * This page calls verifyOtp() to exchange the token_hash for a session,
 * then redirects to the appropriate page based on type.
 *
 * Fallback: also handles the older #access_token implicit flow.
 */

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'
import type { EmailOtpType } from '@supabase/supabase-js'

function AuthConfirmInner() {
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function handle() {
      const tokenHash = searchParams.get('token_hash')
      const type = (searchParams.get('type') ?? '') as EmailOtpType
      const rawNext = searchParams.get('next') ?? '/dashboard'
      // Prevent open-redirect attacks — only allow relative paths
      const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard'

      // ── PKCE token_hash flow (Supabase SSR default) ─────────────────
      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
        if (error) {
          setError('Link invalid sau expirat. Solicită un nou link.')
          return
        }
        // Route based on type
        if (type === 'recovery') {
          window.location.replace('/reset-password')
        } else if (type === 'invite') {
          window.location.replace('/set-password')
        } else {
          window.location.replace(next)
        }
        return
      }

      // ── Implicit flow fallback: #access_token in URL hash ────────────
      const hash = window.location.hash.substring(1)
      if (hash) {
        const params = new URLSearchParams(hash)
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        const hashType = params.get('type')

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (error) {
            setError('Sesiune invalidă. Solicită un nou link.')
            return
          }
          if (hashType === 'recovery') {
            window.location.replace('/reset-password')
          } else if (hashType === 'invite') {
            window.location.replace('/set-password')
          } else {
            window.location.replace(next)
          }
          return
        }
      }

      setError('Link invalid. Lipsesc parametrii de autentificare.')
    }

    handle()
  }, [searchParams])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f1f10]">
        <div className="bg-white/5 border border-white/10 rounded-xl p-8 max-w-sm w-full text-center space-y-4">
          <p className="text-red-400 font-medium">{error}</p>
          <div className="flex flex-col gap-2">
            <a
              href="/login"
              className="inline-block px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Înapoi la login
            </a>
            <a
              href="mailto:Admin@ArendaPro.com"
              className="text-sm text-white/40 hover:text-white/60 transition-colors"
            >
              Contactează administratorul
            </a>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1f10]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        <p className="text-white/60 text-sm">Se verifică linkul...</p>
      </div>
    </div>
  )
}

export default function AuthConfirmPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#0f1f10]">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        </div>
      }
    >
      <AuthConfirmInner />
    </Suspense>
  )
}
