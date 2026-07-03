'use client'

import type { OnboardingData } from './types'

interface Props {
  data: OnboardingData
  saving: boolean
  onNext: (data: Partial<OnboardingData>) => void
  onBack: () => void
}

// Placeholder — completed in Livrabil 5
export function ImportParcelsStep(_props: Props) {
  return <div className="text-gray-400 text-sm p-8 text-center">ImportParcelsStep — coming in Livrabil 5</div>
}
