/**
 * GET /api/farm-context
 * Returns the farms available to the current user (own farm + member farms).
 *
 * POST /api/farm-context
 * Switches the active farm by setting arenda_active_farm cookie.
 * Body: { farmOwnerId: string }  — use null/"" to switch back to own farm.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { FARM_COOKIE } from '@/lib/farm'

export const runtime = 'edge'

export async function GET() {
  const db = await createClient()
  const { data: { user }, error } = await db.auth.getUser()
  if (!user || error) {
    return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  }

  // Own farm name
  const { data: ownSettings } = await db
    .from('company_settings')
    .select('name')
    .eq('user_id', user.id)
    .maybeSingle()

  // Farms where user is a member
  const { data: memberships } = await db
    .from('farm_members')
    .select('id, farm_owner_id, role, section_permissions, status')
    .eq('member_id', user.id)
    .eq('status', 'active')

  // For each membership, fetch the farm name
  const memberFarms = await Promise.all(
    (memberships ?? []).map(async (m: any) => {
      const { data: cs } = await db
        .from('company_settings')
        .select('name')
        .eq('user_id', m.farm_owner_id)
        .maybeSingle()
      const { data: profile } = await db
        .from('profiles')
        .select('email')
        .eq('id', m.farm_owner_id)
        .maybeSingle()
      return {
        farmOwnerId: m.farm_owner_id,
        farmName: cs?.name || profile?.email || m.farm_owner_id,
        role: m.role,
        sectionPermissions: m.section_permissions,
      }
    })
  )

  return NextResponse.json({
    ownFarm: {
      farmOwnerId: user.id,
      farmName: ownSettings?.name || user.email || user.id,
      role: 'proprietar',
    },
    memberFarms,
  })
}

export async function POST(req: NextRequest) {
  const db = await createClient()
  const { data: { user }, error } = await db.auth.getUser()
  if (!user || error) {
    return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  }

  const body = await req.json() as { farmOwnerId?: string }
  const targetFarmOwnerId = body.farmOwnerId

  // Switching back to own farm
  if (!targetFarmOwnerId || targetFarmOwnerId === user.id) {
    const res = NextResponse.json({ ok: true, activeFarmOwnerId: user.id })
    res.cookies.set(FARM_COOKIE, '', { maxAge: 0, path: '/' })
    return res
  }

  // Validate that the user is actually an active member of that farm
  const { data: membership } = await db
    .from('farm_members')
    .select('id, role')
    .eq('farm_owner_id', targetFarmOwnerId)
    .eq('member_id', user.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!membership) {
    return NextResponse.json({ error: 'Nu ești membru al acestei ferme' }, { status: 403 })
  }

  const res = NextResponse.json({ ok: true, activeFarmOwnerId: targetFarmOwnerId })
  res.cookies.set(FARM_COOKIE, targetFarmOwnerId, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })
  return res
}
