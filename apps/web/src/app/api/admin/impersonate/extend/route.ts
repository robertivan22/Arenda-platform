/**
 * POST /api/admin/impersonate/extend
 *
 * Body: { additionalMinutes: number }
 * Extinde sesiunea de impersonare activă cu N minute suplimentare.
 * Poate fi apelat de orice număr de ori cât sesiunea e activă.
 */
export const runtime = 'edge'

import { NextRequest } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { IMPERSONATION_COOKIE } from '@/lib/admin/sensitive-fields'
import { jsonError, jsonResponse } from '@/lib/api/response'

const MAX_DURATION_MINUTES = 8 * 60 // 8 ore maxim

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return jsonError(request, 'Configurație server incompletă', 500)
  }

  const sessionId = cookieStore.get(IMPERSONATION_COOKIE)?.value
  if (!sessionId) {
    return jsonError(request, 'Nicio sesiune de impersonare activă', 400)
  }

  let additionalMinutes: number
  try {
    const body = await request.json()
    additionalMinutes = Number(body.additionalMinutes)
  } catch {
    return jsonError(request, 'Body invalid', 400)
  }

  if (!additionalMinutes || additionalMinutes < 1 || additionalMinutes > MAX_DURATION_MINUTES) {
    return jsonError(request, `Durată invalidă (1–${MAX_DURATION_MINUTES} minute)`, 400)
  }

  const serviceClient = createServiceClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Fetch session
  const { data: session, error } = await serviceClient
    .from('admin_impersonation_sessions')
    .select('id, expires_at, ended_at')
    .eq('id', sessionId)
    .single()

  if (error || !session) {
    return jsonError(request, 'Sesiunea nu a fost găsită', 404)
  }
  if (session.ended_at) {
    return jsonError(request, 'Sesiunea a fost deja terminată', 400)
  }
  if (new Date(session.expires_at) < new Date()) {
    return jsonError(request, 'Sesiunea a expirat', 400)
  }

  // Calculăm noua expirare: max(expires_at_curent, now) + additionalMinutes
  const currentExpiry = new Date(session.expires_at)
  const base = currentExpiry > new Date() ? currentExpiry : new Date()
  const newExpiry = new Date(base.getTime() + additionalMinutes * 60 * 1000)

  const { error: updateError } = await serviceClient
    .from('admin_impersonation_sessions')
    .update({ expires_at: newExpiry.toISOString() })
    .eq('id', sessionId)

  if (updateError) {
    return jsonError(request, 'Eroare la actualizarea sesiunii', 500)
  }

  // Actualizează și cookie-ul (extinde maxAge)
  const remainingMs = newExpiry.getTime() - Date.now()
  cookieStore.set(IMPERSONATION_COOKIE, sessionId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: Math.floor(remainingMs / 1000),
  })

  return jsonResponse(request, { success: true, expiresAt: newExpiry.toISOString() })
}
