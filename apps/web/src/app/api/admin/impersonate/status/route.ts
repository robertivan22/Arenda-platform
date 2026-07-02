/**
 * GET /api/admin/impersonate/status
 *
 * Returns current impersonation session info.
 * Used by the ImpersonationBanner to know what to display.
 *
 * Response:
 *   { active: false }
 *   { active: true, sessionId, targetEmail, targetDisplayName, adminEmail, expiresAt }
 */
export const runtime = 'edge'

import { NextRequest } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { IMPERSONATION_COOKIE } from '@/lib/admin/sensitive-fields'

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get(IMPERSONATION_COOKIE)?.value

  if (!sessionId) {
    return Response.json({ active: false })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!serviceKey || !supabaseUrl) {
    return Response.json({ active: false })
  }

  const serviceClient = createServiceClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: session } = await serviceClient
    .from('admin_impersonation_sessions')
    .select('id, admin_user_id, target_user_id, expires_at, ended_at')
    .eq('id', sessionId)
    .single()

  if (!session || session.ended_at || new Date(session.expires_at) < new Date()) {
    return Response.json({ active: false })
  }

  // Fetch emails from profiles table
  const { data: profiles } = await serviceClient
    .from('profiles')
    .select('id, email, display_name')
    .in('id', [session.admin_user_id, session.target_user_id])

  const adminProfile = profiles?.find(p => p.id === session.admin_user_id)
  const targetProfile = profiles?.find(p => p.id === session.target_user_id)

  return Response.json({
    active: true,
    sessionId: session.id,
    adminEmail: adminProfile?.email ?? null,
    targetEmail: targetProfile?.email ?? null,
    targetDisplayName: targetProfile?.display_name ?? null,
    expiresAt: session.expires_at,
  })
}
