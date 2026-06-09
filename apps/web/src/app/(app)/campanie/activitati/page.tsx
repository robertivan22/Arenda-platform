'use client'

export const runtime = 'edge'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ActivitatiRedirectPage() {
  const router = useRouter()
  useEffect(() => {
    createClient()
      .from('campaigns')
      .select('year')
      .eq('is_active', true)
      .maybeSingle()
      .then(({ data }) => {
        const year = data?.year ?? new Date().getFullYear()
        router.replace(`/campanie/${year}/activitati`)
      })
  }, [router])
  return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
      Se încarcă campania activă...
    </div>
  )
}
