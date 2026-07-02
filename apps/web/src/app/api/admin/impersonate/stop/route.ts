/**
 * POST /api/admin/impersonate/stop
 *
 * Terminates an active impersonation session:
 * 1. Read impersonation_session_id cookie
 * 2. Fetch session from DB — get encrypted admin refresh token
 * 3. Decrypt token, exchange it for a fresh admin session
 * 4. Restore admin session cookies
 * 5. Mark session as ended, clear impersonation cookie
 */
export const runtime = 'edge'

import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { decrypt } from '@/lib/crypto/encryption'
import { IMPERSONATION_COOKIE } from '@/lib/admin/sensitive-fields'
import { jsonError, jsonResponse } from '@/lib/api/response'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  // 1. Read impersonation cookie
  const sessionId = cookieStore.get(IMPERSONATION_COOKIE)?.value
  if (!sessionId) {
    return jsonError(request, 'Nicio sesiune de impersonare activă', 400)
  }

  const serviceClient = createServiceClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 2. Fetch session record from DB
  const { data: session, error: fetchError } = await serviceClient
    .from('admin_impersonation_sessions')
    .select('id, admin_user_id, admin_refresh_token_encrypted, ended_at, expires_at')
    .eq('id', sessionId)
    .single()

  if (fetchError || !session) {
    // Session not found — clear cookie and exit cleanly
    cookieStore.set(IMPERSONATION_COOKIE, '', { maxAge: 0, path: '/' })
    return jsonResponse(request, { success: true })
  }

  if (session.ended_at) {
    // Already ended — just clear the cookie
    cookieStore.set(IMPERSONATION_COOKIE, '', { maxAge: 0, path: '/' })
    return jsonResponse(request, { success: true })
  }

  // 3. Decrypt admin's refresh token
  let adminRefreshToken: string
  try {
    adminRefreshToken = await decrypt(session.admin_refresh_token_encrypted)
  } catch {
    // Decryption failed (e.g. wrong key) — still clear the cookie
    cookieStore.set(IMPERSONATION_COOKIE, '', { maxAge: 0, path: '/' })
    await serviceClient
      .from('admin_impersonation_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionId)
    return jsonError(request, 'Eroare la decriptarea tokenului admin', 500)
  }

  // 4. Exchange admin's refresh token for a fresh session via Supabase Auth REST
  const tokenRes = await fetch(
    `${supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
    {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refresh_token: adminRefreshToken }),
    },
  )

  if (!tokenRes.ok) {
    const err = await tokenRes.text()
    // Refresh failed — clear impersonation cookie anyway
    cookieStore.set(IMPERSONATION_COOKIE, '', { maxAge: 0, path: '/' })
    await serviceClient
      .from('admin_impersonation_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', sessionId)
    return jsonError(request, `Eroare la restaurarea sesiunii admin: ${err}`, 500)
  }

  const tokens = await tokenRes.json() as {
    access_token: string
    refresh_token: string
  }

  // 5. Restore admin session cookies via SSR client
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options)
        })
      },
    },
  })

  await supabase.auth.setSession({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  })

  // 6. Clear impersonation cookie
  cookieStore.set(IMPERSONATION_COOKIE, '', { maxAge: 0, path: '/' })

  // 7. Mark session as ended
  await serviceClient
    .from('admin_impersonation_sessions')
    .update({ ended_at: new Date().toISOString() })
    .eq('id', sessionId)

  return jsonResponse(request, { success: true })
}
