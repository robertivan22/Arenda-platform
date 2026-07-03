export const runtime = 'edge'

import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const STEP_ORDER = [
  'account_type',
  'fiscal_data',
  'import_parcels',
  'import_contracts',
  'alert_preferences',
  'completed',
] as const

type Step = typeof STEP_ORDER[number]

function nextStep(current: Step): Step {
  const idx = STEP_ORDER.indexOf(current)
  if (idx === -1 || idx >= STEP_ORDER.length - 1) return 'completed'
  return STEP_ORDER[idx + 1]
}

/**
 * POST /api/onboarding/step
 * Body: { step: Step, data: Record<string, unknown> }
 *
 * - Validates that the submitted step matches the current step (or is a re-submit of a past step).
 * - Merges `data` into the existing JSONB (does not overwrite other keys).
 * - Advances current_step to the next step.
 * - If advancing to 'completed', sets completed_at = now().
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { step: string; data: Record<string, unknown> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { step, data: stepData } = body

  if (!step || !STEP_ORDER.includes(step as Step)) {
    return NextResponse.json(
      { error: `Invalid step. Must be one of: ${STEP_ORDER.join(', ')}` },
      { status: 400 },
    )
  }

  if (typeof stepData !== 'object' || stepData === null || Array.isArray(stepData)) {
    return NextResponse.json({ error: 'data must be an object' }, { status: 400 })
  }

  // Fetch current state (if any)
  const { data: existing } = await supabase
    .from('onboarding_state')
    .select('current_step, data')
    .eq('user_id', user.id)
    .maybeSingle()

  const currentStep = (existing?.current_step ?? 'account_type') as Step
  const currentData: Record<string, unknown> = (existing?.data ?? {}) as Record<string, unknown>

  // Allow re-submitting the current step or any previous step (e.g. back navigation)
  const submittedIdx = STEP_ORDER.indexOf(step as Step)
  const currentIdx = STEP_ORDER.indexOf(currentStep)
  // Only allow advancing one step at a time or re-submitting current/previous steps
  if (submittedIdx > currentIdx) {
    return NextResponse.json(
      { error: 'Cannot skip steps. Submit steps in order.' },
      { status: 422 },
    )
  }

  const advancing = step === currentStep
  const newStep: Step = advancing ? nextStep(step as Step) : currentStep
  const mergedData = { ...currentData, ...stepData }
  const isCompleting = newStep === 'completed'

  const upsertPayload = {
    user_id: user.id,
    current_step: newStep,
    data: mergedData,
    ...(isCompleting ? { completed_at: new Date().toISOString() } : {}),
  }

  const { error: upsertError } = await supabase
    .from('onboarding_state')
    .upsert(upsertPayload, { onConflict: 'user_id' })

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  return NextResponse.json({
    current_step: newStep,
    data: mergedData,
    completed: isCompleting,
  })
}
