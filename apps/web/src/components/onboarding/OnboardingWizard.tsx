'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  STEPS,
  STEP_LABELS,
  stepIndex,
  type Step,
  type OnboardingData,
  type OnboardingState,
} from './types'
import { AccountTypeStep } from './AccountTypeStep'
import { FiscalDataStep } from './FiscalDataStep'
import { ImportParcelsStep } from './ImportParcelsStep'
import { ImportContractsStep } from './ImportContractsStep'
import { AlertPreferencesStep } from './AlertPreferencesStep'

export function OnboardingWizard() {
  const router = useRouter()
  const [state, setState] = useState<OnboardingState | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Local navigation index — allows "back" without server round-trip
  const [localStepIdx, setLocalStepIdx] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/onboarding/state')
      .then(r => r.json())
      .then((s: OnboardingState) => {
        if (s.completed_at) {
          router.replace('/dashboard')
          return
        }
        setState(s)
        setLocalStepIdx(stepIndex(s.current_step))
      })
      .catch(() => setError('Nu s-a putut încărca starea onboarding-ului.'))
      .finally(() => setLoading(false))
  }, [router])

  async function handleNext(stepData: Partial<OnboardingData>) {
    if (!state) return
    setSaving(true)
    setError(null)

    // The server step we're submitting is the one persisted in DB (not local)
    const serverStep = state.current_step

    try {
      const res = await fetch('/api/onboarding/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: serverStep, data: stepData }),
      })
      const json = await res.json() as { current_step: Step; data: OnboardingData; completed: boolean; error?: string }

      if (!res.ok) {
        setError(json.error ?? 'A apărut o eroare la salvare.')
        return
      }

      if (json.completed) {
        router.replace('/dashboard')
        return
      }

      setState(prev => prev ? { ...prev, current_step: json.current_step, data: json.data } : prev)
      setLocalStepIdx(stepIndex(json.current_step))
    } catch {
      setError('Eroare de rețea. Încearcă din nou.')
    } finally {
      setSaving(false)
    }
  }

  function handleBack() {
    setLocalStepIdx(prev => (prev !== null && prev > 0 ? prev - 1 : 0))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!state) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-red-600">{error ?? 'Eroare necunoscută.'}</p>
      </div>
    )
  }

  const currentIdx = localStepIdx ?? stepIndex(state.current_step)
  const currentStep: Step = STEPS[currentIdx] ?? state.current_step
  const progressPct = Math.round(((currentIdx) / STEPS.length) * 100)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-4">
        <span className="font-bold text-xl text-brand-700 tracking-tight">ArendaPro</span>
        <span className="text-gray-400 text-sm ml-auto">Configurare cont</span>
      </header>

      {/* ── Progress bar ────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3">
        <div className="max-w-2xl mx-auto">
          {/* Step labels */}
          <div className="flex justify-between mb-2">
            {STEPS.map((s, i) => (
              <span
                key={s}
                className={`text-[11px] font-medium transition-colors ${
                  i < currentIdx
                    ? 'text-brand-600'
                    : i === currentIdx
                    ? 'text-gray-800'
                    : 'text-gray-400'
                }`}
              >
                {STEP_LABELS[s]}
              </span>
            ))}
          </div>
          {/* Bar */}
          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-600 rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Step content ────────────────────────────────────────────────── */}
      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-2xl">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
              {error}
            </div>
          )}

          {currentStep === 'account_type' && (
            <AccountTypeStep
              data={state.data}
              saving={saving}
              onNext={handleNext}
            />
          )}

          {currentStep === 'fiscal_data' && (
            <FiscalDataStep
              data={state.data}
              saving={saving}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}

          {currentStep === 'import_parcels' && (
            <ImportParcelsStep
              data={state.data}
              saving={saving}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}

          {currentStep === 'import_contracts' && (
            <ImportContractsStep
              data={state.data}
              saving={saving}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}

          {currentStep === 'alert_preferences' && (
            <AlertPreferencesStep
              data={state.data}
              saving={saving}
              onNext={handleNext}
              onBack={handleBack}
            />
          )}
        </div>
      </main>
    </div>
  )
}
