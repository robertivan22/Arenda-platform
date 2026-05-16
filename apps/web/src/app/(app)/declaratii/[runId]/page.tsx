'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function RunDetailPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/declaratii/d112')
  }, [router])

  return <div className="p-8 text-center text-sm text-gray-500">Se redirecționează...</div>
}
