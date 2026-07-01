/**
 * Next.js Middleware — runs on the Edge before every request.
 *
 * Responsibilities:
 * 1. Refresh the Supabase session token stored in cookies (prevents expiry).
 * 2. Redirect unauthenticated users away from protected routes.
 * 3. Redirect authenticated users away from auth pages (login/signup).
 *
 * Security note:
 * - The session is verified server-side by Supabase JWT validation.
 * - We never trust just a cookie value — `getUser()` makes a network call
 *   to Supabase to validate the token on every request.
 * - Do NOT use `getSession()` here — it trusts unverified local data.
 */
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export const config = {
  matcher: [
    // Run middleware on all paths except static assets and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Write updated cookies to both the request and response so that
          // the refreshed session is available to Server Components downstream
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANT: Always use getUser() — never getSession() — in middleware.
  // getUser() sends the JWT to Supabase for server-side verification.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Auth pages that logged-in users should not see
  const isAuthPage = pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/magic-link')

  // App pages that require authentication
  const isAppPage = pathname.startsWith('/dashboard') ||
    pathname.startsWith('/arendatori') ||
    pathname.startsWith('/contracte') ||
    pathname.startsWith('/parcele') ||
    pathname.startsWith('/plati') ||
    pathname.startsWith('/rapoarte') ||
    pathname.startsWith('/declaratii') ||
    pathname.startsWith('/profil') ||
    pathname.startsWith('/fitosanitar') ||
    pathname.startsWith('/setari') ||
    pathname.startsWith('/admin-cp') ||
    pathname.startsWith('/print') ||
    pathname.startsWith('/efactura') ||
    pathname.startsWith('/distribuire-arenda') ||
    pathname.startsWith('/campanie') ||
    pathname.startsWith('/utilaje') ||
    pathname.startsWith('/ferma') ||
    pathname.startsWith('/inventar') ||
    pathname.startsWith('/apia') ||
    pathname.startsWith('/alerte') ||
    pathname.startsWith('/etransport')

  if (!user && isAppPage) {
    // Not logged in — redirect to login
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    return NextResponse.redirect(loginUrl)
  }

  if (user && isAuthPage) {
    // Already logged in — redirect to dashboard
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/dashboard'
    return NextResponse.redirect(dashboardUrl)
  }

  // IMPORTANT: Return supabaseResponse (not NextResponse.next()) so that
  // refreshed session cookies are forwarded to the browser correctly.
  return supabaseResponse
}
