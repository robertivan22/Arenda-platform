/**
 * Server-side Supabase client for Server Components and Route Handlers.
 * Reads/writes session from cookies — never exposes the session to the client
 * without going through Supabase's own cookie mechanism.
 * Edge-runtime compatible (required for Cloudflare Pages).
 */
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // setAll called from a Server Component — cookies can only be
            // mutated from middleware or route handlers. Silently ignore here
            // because the middleware will handle the refresh.
          }
        },
      },
    },
  )
}
