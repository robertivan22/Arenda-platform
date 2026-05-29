/**
 * Auth callback route handler.
 *
 * Supabase redirects here after:
 * - A user clicks a magic link
 * - A user confirms their email after signup
 *
 * The `code` search param is exchanged for a real session using the PKCE flow.
 * After exchange, the user is redirected to /dashboard (or wherever they came from).
 *
 * Must be Edge-compatible for Cloudflare Pages.
 */
export const runtime = 'edge'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next') ?? '/dashboard'
  // Validate next is a safe relative path (prevents open redirect)
  const next = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/dashboard'

  if (code) {
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          },
        },
      },
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Redirect to the intended destination after successful auth
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // If exchange failed, redirect to login with an error flag
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
