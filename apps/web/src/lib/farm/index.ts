/**
 * Server-side farm context helpers.
 * Resolves the "effective farm owner" for the current authenticated user.
 * - If the user owns their farm → returns their own user_id
 * - If the user is a member of another farm → returns that farm's owner_id
 *   (based on the arenda_active_farm cookie set by /api/farm-context)
 */

import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

export const FARM_COOKIE = 'arenda_active_farm' // value = farm_owner_id (uuid)

export type FarmRole = 'proprietar' | 'administrator' | 'contabil' | 'operator' | 'vizualizare'

export interface FarmMembership {
  memberId: string
  farmOwnerId: string
  farmOwnerEmail: string
  farmName: string
  role: FarmRole
  sectionPermissions: Record<string, boolean>
}

export interface FarmContext {
  /** The user_id to use for all data queries */
  effectiveUserId: string
  /** Current user's own id */
  userId: string
  /** 'proprietar' if user owns this farm, otherwise their member role */
  role: FarmRole
  /** All farms this user has access to (own + member farms) */
  availableFarms: FarmMembership[]
  /** Section-level permissions (null = use defaults / owner has all) */
  sectionPermissions: Record<string, boolean> | null
}

const DEFAULT_PERMISSIONS: Record<string, boolean> = {
  can_dashboard: true,
  can_arendasi: true,
  can_contracte: true,
  can_parcele: true,
  can_tranzactii: true,
  can_facturi: true,
  can_rapoarte: true,
  can_declaratii: true,
  can_fitosanitar: true,
  can_setari: true,
}

export async function getFarmContext(): Promise<FarmContext | null> {
  const db = await createClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return null

  const cookieStore = await cookies()
  const activeFarmCookie = cookieStore.get(FARM_COOKIE)?.value

  // Fetch all farms this user is a member of
  const { data: memberships } = await db
    .from('farm_members')
    .select(`
      id, farm_owner_id, role, section_permissions, status,
      profiles!farm_members_farm_owner_id_fkey(email, display_name),
      company_settings!farm_members_farm_owner_id_fkey(name)
    `)
    .eq('member_id', user.id)
    .eq('status', 'active')

  const availableFarms: FarmMembership[] = (memberships ?? []).map((m: any) => ({
    memberId: user.id,
    farmOwnerId: m.farm_owner_id,
    farmOwnerEmail: m.profiles?.email ?? '',
    farmName: m.company_settings?.name || m.profiles?.email || m.farm_owner_id,
    role: m.role as FarmRole,
    sectionPermissions: m.section_permissions ?? DEFAULT_PERMISSIONS,
  }))

  // Determine which farm is active
  let activeMembership: FarmMembership | undefined

  if (activeFarmCookie && activeFarmCookie !== user.id) {
    activeMembership = availableFarms.find(f => f.farmOwnerId === activeFarmCookie)
  }

  // If the cookie points to own farm OR no cookie, use own farm
  if (!activeMembership) {
    return {
      effectiveUserId: user.id,
      userId: user.id,
      role: 'proprietar',
      availableFarms,
      sectionPermissions: null, // owner has all permissions
    }
  }

  return {
    effectiveUserId: activeMembership.farmOwnerId,
    userId: user.id,
    role: activeMembership.role,
    availableFarms,
    sectionPermissions: activeMembership.sectionPermissions,
  }
}

/** Lightweight version — only returns the effective user id for quick use in API routes */
export async function getEffectiveUserId(): Promise<string | null> {
  const ctx = await getFarmContext()
  return ctx?.effectiveUserId ?? null
}
