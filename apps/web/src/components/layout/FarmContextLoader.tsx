'use client'

/**
 * FarmContextLoader — mounted once in app layout.
 * Fetches available farms from /api/farm-context and populates the farm store.
 * Renders nothing (null).
 */
import { useEffect } from 'react'
import { useFarmStore, type FarmOption, type FarmRole } from '@/store/farm.store'
import { createClient } from '@/lib/supabase/client'

export function FarmContextLoader() {
  const setFarmContext = useFarmStore(s => s.setFarmContext)

  useEffect(() => {
    async function load() {
      const db = createClient()
      const { data: { user } } = await db.auth.getUser()
      if (!user) return

      const res = await fetch('/api/farm-context')
      if (!res.ok) return

      const { ownFarm, memberFarms } = await res.json() as {
        ownFarm: { farmOwnerId: string; farmName: string; role: string }
        memberFarms: FarmOption[]
      }

      // Get active farm from cookie (read via a tiny endpoint or just check document.cookie)
      const activeFarmCookie = getCookie('arenda_active_farm')

      const allFarms: FarmOption[] = [
        { ...ownFarm, role: 'proprietar' as FarmRole },
        ...memberFarms,
      ]

      let effectiveUserId = user.id
      let activeRole: FarmRole = 'proprietar'

      if (activeFarmCookie && activeFarmCookie !== user.id) {
        const matched = memberFarms.find(f => f.farmOwnerId === activeFarmCookie)
        if (matched) {
          effectiveUserId = matched.farmOwnerId
          activeRole = matched.role as FarmRole
        }
      }

      setFarmContext({
        effectiveUserId,
        userId: user.id,
        role: activeRole,
        availableFarms: allFarms,
      })
    }

    load()
  }, [setFarmContext])

  return null
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : null
}
