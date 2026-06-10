'use client'
export const runtime = 'edge'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function InventarRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/inventar/stoc') }, [router])
  return (
    <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
      Se incarca inventarul...
    </div>
  )
}
