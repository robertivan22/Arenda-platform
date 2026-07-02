/**
 * Next.js Middleware — runs on the Edge before every request.
 *
 * Responsibilities:
 * 1. Refresh the Supabase session token stored in cookies (prevents expiry).
 * 2. Redirect unauthenticated users away from protected routes.
 * 3. Redirect authenticated users away from auth pages (login/signup).
 * 4. Impersonation guards:
 *    a. Dacă cookie-ul `impersonation_session_id` e prezent dar sesiunea a
 *       expirat în DB, șterge cookie-ul și continuă ca utilizatorul autentificat.
 *    b. Blochează 403 rutele din PROTECTED_ROUTES_DURING_IMPERSONATION.
 *    c. Logează în `admin_impersonation_audit_log` orice metodă de scriere
 *       (POST/PUT/PATCH/DELETE) efectuată în timp ce impersonarea e activă.
 *
 * Security note:
 * - The session is verified server-side by Supabase JWT validation.
 * - We never trust just a cookie value — `getUser()` makes a network call
 *   to Supabase to validate the token on every request.
 * - Do NOT use `getSession()` here — it trusts unverified local data.
 */
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import {
  IMPERSONATION_COOKIE,
  PROTECTED_ROUTES_DURING_IMPERSONATION,
} from '@/lib/admin/sensitive-fields'

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
    pathname.startsWith('/alerte')

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

  // ── Impersonation guards ───────────────────────────────────────────────────
  const impersonationSessionId = request.cookies.get(IMPERSONATION_COOKIE)?.value

  if (impersonationSessionId) {
    // (a) Verifică expirarea sesiunii în DB
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

    if (serviceKey && supabaseUrl) {
      const checkRes = await fetch(
        `${supabaseUrl}/rest/v1/admin_impersonation_sessions?id=eq.${encodeURIComponent(impersonationSessionId)}&select=id,expires_at,ended_at`,
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
        },
      )

      if (checkRes.ok) {
        const rows = await checkRes.json() as Array<{ id: string; expires_at: string; ended_at: string | null }>
        const session = rows[0]

        const isExpired = !session ||
          session.ended_at !== null ||
          new Date(session.expires_at) < new Date()

        if (isExpired) {
          // Sesiunea a expirat sau a fost terminată — șterge cookie-ul
          supabaseResponse.cookies.set(IMPERSONATION_COOKIE, '', {
            maxAge: 0,
            path: '/',
          })
          // Continuă cererea fără impersonare (nu bloca requestul)
        } else {
          // (b) Blochează rutele protejate în mod impersonare
          const isProtected = PROTECTED_ROUTES_DURING_IMPERSONATION.some(re => re.test(pathname))
          if (isProtected) {
            return Response.json(
              { error: 'Acțiune indisponibilă în mod impersonare' },
              { status: 403 },
            )
          }

          // (c) Audit log pentru metode de scriere
          const writeMethods = ['POST', 'PUT', 'PATCH', 'DELETE']
          if (writeMethods.includes(request.method)) {
            // Fire-and-forget — nu blocăm requestul pentru logging
            fetch(`${supabaseUrl}/rest/v1/admin_impersonation_audit_log`, {
              method: 'POST',
              headers: {
                apikey: serviceKey,
                Authorization: `Bearer ${serviceKey}`,
                'Content-Type': 'application/json',
                Prefer: 'return=minimal',
              },
              body: JSON.stringify({
                session_id: impersonationSessionId,
                action: request.method,
                resource: pathname,
                record_id: null,
                detail: null,
              }),
            }).catch(() => {
              // Ignorăm erorile de logging pentru a nu afecta UX-ul
            })
          }
        }
      }
    }
  }

  // IMPORTANT: Return supabaseResponse (not NextResponse.next()) so that
  // refreshed session cookies are forwarded to the browser correctly.
  return supabaseResponse
}
