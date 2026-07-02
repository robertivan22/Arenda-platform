/**
 * POST /api/admin/impersonate/start
 *
 * Body: { targetUserId: string, reason: string }
 *
 * Flow:
 * 1. Verify caller is an authenticated admin
 * 2. Capture admin's current refresh token (before session switch)
 * 3. Generate a magic-link token for the target user (service_role)
 * 4. Exchange that token for target user's session → updates session cookies
 * 5. Encrypt admin's refresh token + insert impersonation session in DB
 * 6. Set impersonation_session_id cookie
 */
export const runtime = 'edge'

import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { encrypt } from '@/lib/crypto/encryption'
import { IMPERSONATION_COOKIE } from '@/lib/admin/sensitive-fields'
import { jsonError, jsonResponse } from '@/lib/api/response'

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseAnonKey || !serviceKey) {
    return jsonError(request, 'Configurație server incompletă (env vars lipsă)', 500)
  }

  if (!process.env.IMPERSONATION_ENCRYPTION_KEY) {
    return jsonError(request, 'IMPERSONATION_ENCRYPTION_KEY nu este configurat pe server', 500)
  }

  // ── SSR client — reads/writes cookies for session management ──────────────
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

  // 1. Verify admin user
  const { data: { user: adminUser }, error: authError } = await supabase.auth.getUser()
  if (!adminUser || authError) {
    return jsonError(request, 'Neautorizat', 401)
  }

  // 2. Get admin's current refresh token before session switch
  const { data: { session: adminSession } } = await supabase.auth.getSession()
  const adminRefreshToken = adminSession?.refresh_token
  if (!adminRefreshToken) {
    return jsonError(request, 'Sesiune admin invalidă. Re-autentifică-te.', 400)
  }

  // 3. Service role client (bypasses RLS)
  const serviceClient = createServiceClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // 4. Verify is_admin in profiles
  const { data: adminProfile } = await serviceClient
    .from('profiles')
    .select('is_admin')
    .eq('id', adminUser.id)
    .single()

  if (!adminProfile?.is_admin) {
    return jsonError(request, 'Acces interzis — nu ești admin', 403)
  }

  // 5. Parse + validate request body
  let targetUserId: string, reason: string
  try {
    const body = await request.json()
    targetUserId = body.targetUserId
    reason = body.reason
  } catch {
    return jsonError(request, 'Body invalid', 400)
  }

  if (!targetUserId || typeof targetUserId !== 'string') {
    return jsonError(request, 'targetUserId lipsă', 400)
  }
  if (!reason || reason.trim().length < 10) {
    return jsonError(request, 'Motivul trebuie să aibă minimum 10 caractere', 400)
  }
  if (adminUser.id === targetUserId) {
    return jsonError(request, 'Nu poți impersona propriul cont', 400)
  }

  // 6. Get target user
  const { data: targetData, error: userError } = await serviceClient.auth.admin.getUserById(targetUserId)
  if (!targetData?.user || userError) {
    return jsonError(request, 'Utilizatorul nu a fost găsit', 404)
  }
  const targetEmail = targetData.user.email
  if (!targetEmail) {
    return jsonError(request, 'Utilizatorul țintă nu are email', 400)
  }

  // 7. Generate one-time magic link token for target user
  const { data: linkData, error: linkError } = await serviceClient.auth.admin.generateLink({
    type: 'magiclink',
    email: targetEmail,
  })
  if (!linkData || linkError) {
    return jsonError(request, 'Eroare la generarea token-ului de impersonare', 500)
  }

  // 8. Exchange token hash → target user session (updates cookies via setAll)
  const { data: otpData, error: otpError } = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'email',
  })
  if (otpError || !otpData.session) {
    return jsonError(request, `Eroare la schimbarea sesiunii: ${otpError?.message ?? 'unknown'}`, 500)
  }

  // 9. Encrypt admin's refresh token for later restoration
  const encryptedToken = await encrypt(adminRefreshToken)

  // 10. Insert impersonation session record
  const { data: session, error: insertError } = await serviceClient
    .from('admin_impersonation_sessions')
    .insert({
      admin_user_id: adminUser.id,
      target_user_id: targetUserId,
      reason: reason.trim(),
      scope: 'full_control',
      ip_address:
        request.headers.get('cf-connecting-ip') ??
        request.headers.get('x-forwarded-for') ??
        null,
      user_agent: request.headers.get('user-agent'),
      admin_refresh_token_encrypted: encryptedToken,
    })
    .select('id')
    .single()

  if (insertError || !session) {
    return jsonError(request, 'Eroare la salvarea sesiunii în baza de date', 500)
  }

  // 11. Set impersonation cookie (httpOnly, 30 min)
  cookieStore.set(IMPERSONATION_COOKIE, session.id, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 60,
  })

  return jsonResponse(request, { success: true, targetEmail })
}
