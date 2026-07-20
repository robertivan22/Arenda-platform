/**
 * PATCH /api/farm-members/[id]  — update role / status / section_permissions
 * DELETE /api/farm-members/[id] — remove a member from the farm
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

// ── PATCH ─────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = await createClient()
  const { data: { user }, error } = await db.auth.getUser()
  if (!user || error) {
    return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  }

  // Fetch the member row to verify ownership
  const { data: member } = await db
    .from('farm_members')
    .select('id, farm_owner_id, role, status, member_id')
    .eq('id', id)
    .maybeSingle()

  if (!member) {
    return NextResponse.json({ error: 'Membrul nu a fost găsit' }, { status: 404 })
  }

  // Check authorization: only farm owner OR farm admin can update
  const isOwner = member.farm_owner_id === user.id
  let isAdmin = false
  if (!isOwner) {
    const { data: callerMembership } = await db
      .from('farm_members')
      .select('role')
      .eq('farm_owner_id', member.farm_owner_id)
      .eq('member_id', user.id)
      .eq('status', 'active')
      .maybeSingle()
    isAdmin = callerMembership?.role === 'administrator'
  }

  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: 'Acces interzis' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body invalid' }, { status: 400 })
  }

  const VALID_ROLES = ['administrator', 'contabil', 'operator', 'vizualizare']

  // Admin cannot escalate to a role equal/higher than their own
  if (isAdmin && !isOwner && body.role) {
    const adminRole = 'administrator'
    if (body.role === adminRole || body.role === 'proprietar') {
      return NextResponse.json({ error: 'Nu poți acorda un rol egal sau superior celui propriu' }, { status: 403 })
    }
  }

  const updatePayload: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.role !== undefined) {
    if (!VALID_ROLES.includes(body.role as string)) {
      return NextResponse.json({ error: 'Rol invalid' }, { status: 400 })
    }
    updatePayload.role = body.role
  }

  if (body.status !== undefined) {
    if (!['active', 'suspended'].includes(body.status as string)) {
      return NextResponse.json({ error: 'Status invalid' }, { status: 400 })
    }
    updatePayload.status = body.status
  }

  if (body.sectionPermissions !== undefined) {
    updatePayload.section_permissions = body.sectionPermissions
  }

  const { data: updated, error: updateErr } = await db
    .from('farm_members')
    .update(updatePayload)
    .eq('id', id)
    .select()
    .single()

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 })
  }

  // Sync updated permissions to user_permissions if member_id is set
  if (member.member_id && body.sectionPermissions) {
    const perms = body.sectionPermissions as Record<string, boolean>
    // can_setari is always false for invited members
    await db
      .from('user_permissions')
      .upsert(
        { user_id: member.member_id, ...perms, can_setari: false, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
  }

  // If suspended, also clear their active farm cookie by notifying the client
  // (we can't clear cookies from here, client must do so on 403)

  return NextResponse.json({ ok: true, member: updated })
}

// ── DELETE ────────────────────────────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const db = await createClient()
  const { data: { user }, error } = await db.auth.getUser()
  if (!user || error) {
    return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  }

  // Fetch the member row
  const { data: member } = await db
    .from('farm_members')
    .select('id, farm_owner_id, member_id')
    .eq('id', id)
    .maybeSingle()

  if (!member) {
    return NextResponse.json({ error: 'Membrul nu a fost găsit' }, { status: 404 })
  }

  // Only farm owner can delete
  if (member.farm_owner_id !== user.id) {
    return NextResponse.json({ error: 'Acces interzis — doar proprietarul poate elimina membri' }, { status: 403 })
  }

  const { error: delErr } = await db
    .from('farm_members')
    .delete()
    .eq('id', id)

  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }

  // Clean up user_permissions for removed member
  if (member.member_id) {
    await db
      .from('user_permissions')
      .delete()
      .eq('user_id', member.member_id)
  }

  return NextResponse.json({ ok: true })
}
