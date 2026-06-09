'use client'

export const runtime = 'edge'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * /campanie — redirects to /campanie/[year] for the user's active campaign.
 * Falls back to the current calendar year if no campaign is found.
 */
export default function CampanieRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    const db = createClient()
    db.from('campaigns')
      .select('year')
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => {
        const year = data?.year ?? new Date().getFullYear()
        router.replace(`/campanie/${year}`)
      })
  }, [router])

  return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
      Se încarcă campania activă...
    </div>
  )
}
