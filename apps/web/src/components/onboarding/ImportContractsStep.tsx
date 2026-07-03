'use client'

import type { OnboardingData } from './types'

interface Props {
  data: OnboardingData
  saving: boolean
  onNext: (data: Partial<OnboardingData>) => void
  onBack: () => void
}

// Placeholder — completed in Livrabil 5
export function ImportContractsStep(_props: Props) {
  return <div className="text-gray-400 text-sm p-8 text-center">ImportContractsStep — coming in Livrabil 5</div>
}
