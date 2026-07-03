export const runtime = 'edge'

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/onboarding/state
 * Returns the current onboarding state for the authenticated user.
 * If no row exists yet, returns default initial state (does NOT insert).
 */
export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('onboarding_state')
    .select('current_step, data, completed_at, tour_seen_at, updated_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // No row yet — return defaults without writing to DB
  if (!data) {
    return NextResponse.json({
      current_step: 'account_type',
      data: {},
      completed_at: null,
      tour_seen_at: null,
    })
  }

  return NextResponse.json(data)
}
