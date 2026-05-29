'use client'

/**
 * Auth callback page — handles BOTH Supabase auth flows:
 *
 * 1. PKCE flow (modern):  URL has ?code=XXX
 *    → exchangeCodeForSession(code) then redirect to `next`
 *
 * 2. Implicit/token flow (older Supabase projects):
 *    URL hash has #access_token=XXX&refresh_token=YYY&type=recovery
 *    → setSession({ access_token, refresh_token }) then redirect to `next`
 *
 * This page must be client-side because hash fragments are never sent to the server.
 */

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2 } from 'lucide-react'

export default function AuthCallbackPage() {
  const searchParams = useSearchParams()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()

    const code = searchParams.get('code')
    const rawNext = searchParams.get('next') ?? '/dashboard'
    const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard'

    async function handle() {
      // ── PKCE flow: ?code= in query string ───────────────────────────
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          setError('Link invalid sau expirat. Solicitați un nou link de resetare.')
          return
        }
        window.location.replace(next)
        return
      }

      // ── Implicit flow: #access_token= in URL hash ────────────────────
      const hash = window.location.hash.substring(1) // strip leading '#'
      if (hash) {
        const params = new URLSearchParams(hash)
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        const type = params.get('type') // 'recovery' for password reset

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          })
          if (error) {
            setError('Sesiune invalidă. Solicitați un nou link de resetare.')
            return
          }
          // For recovery type, always go to reset-password regardless of `next`
          const destination = type === 'recovery' ? '/reset-password' : next
          window.location.replace(destination)
          return
        }
      }

      // ── No code and no hash — something went wrong ───────────────────
      setError('Link invalid. Solicitați un nou link de resetare.')
    }

    handle()
  }, [searchParams])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f1f10]">
        <div className="bg-white/5 border border-white/10 rounded-xl p-8 max-w-sm w-full text-center">
          <p className="text-red-400 font-medium mb-4">{error}</p>
          <a
            href="/login"
            className="inline-block px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Înapoi la login
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f1f10]">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
        <p className="text-white/60 text-sm">Se autentifică...</p>
      </div>
    </div>
  )
}
