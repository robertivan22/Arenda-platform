/**
 * GET  /api/farm-members  — list members of current user's farm
 * POST /api/farm-members  — invite by email OR create user directly
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

// ── GET ──────────────────────────────────────────────────────

export async function GET() {
  const db = await createClient()
  const { data: { user }, error } = await db.auth.getUser()
  if (!user || error) {
    return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  }

  const { data: members, error: dbErr } = await db
    .from('farm_members')
    .select('id, member_id, role, invited_email, invited_by, status, section_permissions, created_at, updated_at')
    .eq('farm_owner_id', user.id)
    .order('created_at', { ascending: true })

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  // Enrich with display names from profiles where member_id is set
  const memberIds = (members ?? []).filter((m: any) => m.member_id).map((m: any) => m.member_id as string)
  let profileMap: Record<string, { email: string; display_name: string | null }> = {}

  if (memberIds.length > 0) {
    const { data: profiles } = await db
      .from('profiles')
      .select('id, email, display_name')
      .in('id', memberIds)
    for (const p of profiles ?? []) {
      profileMap[p.id] = { email: p.email ?? '', display_name: p.display_name }
    }
  }

  const enriched = (members ?? []).map((m: any) => ({
    ...m,
    display_name: m.member_id ? (profileMap[m.member_id]?.display_name ?? null) : null,
    email: m.member_id ? (profileMap[m.member_id]?.email ?? m.invited_email) : m.invited_email,
  }))

  return NextResponse.json({ members: enriched })
}

// ── POST ─────────────────────────────────────────────────────

interface InviteBody {
  mode: 'invite' | 'create'
  email: string
  role: 'administrator' | 'contabil' | 'operator' | 'vizualizare'
  sectionPermissions?: Record<string, boolean>
  // only for mode = 'create'
  password?: string
  displayName?: string
}

const VALID_ROLES = ['administrator', 'contabil', 'operator', 'vizualizare']

const DEFAULT_SECTION_PERMS = {
  can_dashboard: true,
  can_arendasi: true,
  can_contracte: true,
  can_parcele: true,
  can_tranzactii: true,
  can_facturi: true,
  can_rapoarte: true,
  can_declaratii: true,
  can_fitosanitar: true,
  can_setari: false,
}

export async function POST(req: NextRequest) {
  const db = await createClient()
  const { data: { user }, error } = await db.auth.getUser()
  if (!user || error) {
    return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  }

  let body: InviteBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Body invalid' }, { status: 400 })
  }

  const { mode, email, role, sectionPermissions, password, displayName } = body

  if (!email || !role) {
    return NextResponse.json({ error: 'Email și rol sunt obligatorii' }, { status: 400 })
  }

  const emailNorm = email.trim().toLowerCase()
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(emailNorm)) {
    return NextResponse.json({ error: 'Adresă email invalidă' }, { status: 400 })
  }

  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Rol invalid' }, { status: 400 })
  }

  // Cannot add yourself
  if (emailNorm === (user.email ?? '').toLowerCase()) {
    return NextResponse.json({ error: 'Nu poți adăuga propriul tău email' }, { status: 400 })
  }

  // Check for existing membership
  const { data: existing } = await db
    .from('farm_members')
    .select('id, status')
    .eq('farm_owner_id', user.id)
    .ilike('invited_email', emailNorm)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: `Un utilizator cu acest email există deja (${existing.status})` },
      { status: 409 }
    )
  }

  const perms = sectionPermissions ?? DEFAULT_SECTION_PERMS

  // Service role key required for user creation / invitation
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json({ error: 'Configurare server incompletă' }, { status: 500 })
  }

  if (mode === 'invite') {
    // ── Invite via email ──────────────────────────────────────
    // Trigger Supabase invite email — user sets their own password
    const inviteRes = await fetch(`${supabaseUrl}/auth/v1/admin/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        email: emailNorm,
        data: {
          invited_by_farm: user.id,
          farm_name: '', // filled in by the trigger
        },
      }),
    })

    let newUserId: string | null = null
    if (inviteRes.ok) {
      const inviteData = await inviteRes.json() as { id?: string }
      newUserId = inviteData.id ?? null
    }
    // If invite fails it may be because user already exists — that's OK,
    // the trigger will link them anyway.

    // Insert pending farm_members row
    const { data: inserted, error: insertErr } = await db
      .from('farm_members')
      .insert({
        farm_owner_id: user.id,
        member_id: newUserId,
        role,
        invited_email: emailNorm,
        invited_by: user.id,
        status: newUserId ? 'active' : 'pending',
        section_permissions: perms,
      })
      .select()
      .single()

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    // If the user already existed (newUserId != null from invite endpoint), also sync
    // their user_permissions so the sidebar works correctly
    if (newUserId) {
      await syncMemberPermissions(db, newUserId, perms, supabaseUrl, serviceKey)
    }

    return NextResponse.json({ ok: true, member: inserted })
  }

  if (mode === 'create') {
    // ── Direct creation ───────────────────────────────────────
    if (!password || password.length < 8) {
      return NextResponse.json({ error: 'Parola trebuie să aibă minim 8 caractere' }, { status: 400 })
    }

    // Create the user via Admin API
    const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        email: emailNorm,
        password,
        email_confirm: true,
        user_metadata: { display_name: displayName ?? '' },
      }),
    })

    if (!createRes.ok) {
      const errData = await createRes.json() as { message?: string; msg?: string }
      const errMsg = errData.message ?? errData.msg ?? 'Eroare la crearea utilizatorului'
      return NextResponse.json({ error: errMsg }, { status: 400 })
    }

    const newUser = await createRes.json() as { id: string }

    // Update display_name in profiles (trigger creates the row, we just update)
    if (displayName) {
      await db
        .from('profiles')
        .update({ display_name: displayName })
        .eq('id', newUser.id)
    }

    // Insert active farm_members row (user exists, immediately active)
    const { data: inserted, error: insertErr } = await db
      .from('farm_members')
      .insert({
        farm_owner_id: user.id,
        member_id: newUser.id,
        role,
        invited_email: emailNorm,
        invited_by: user.id,
        status: 'active',
        section_permissions: perms,
      })
      .select()
      .single()

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    // Sync user_permissions so sidebar reflects section visibility
    await syncMemberPermissions(db, newUser.id, perms, supabaseUrl, serviceKey)

    return NextResponse.json({ ok: true, member: inserted })
  }

  return NextResponse.json({ error: 'Mod invalid. Folosește "invite" sau "create"' }, { status: 400 })
}

// ── Sync section_permissions → user_permissions table ────────

async function syncMemberPermissions(
  db: any,
  memberId: string,
  perms: Record<string, boolean>,
  _supabaseUrl: string,
  _serviceKey: string
) {
  await db
    .from('user_permissions')
    .upsert(
      { user_id: memberId, ...perms, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
}
