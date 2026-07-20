'use client'

import { create } from 'zustand'

export type FarmRole = 'proprietar' | 'administrator' | 'contabil' | 'operator' | 'vizualizare'

export interface FarmOption {
  farmOwnerId: string
  farmName: string
  role: FarmRole
  sectionPermissions?: Record<string, boolean>
}

interface FarmStore {
  /** user_id to use for data queries — own id if owner, farm owner id if member */
  effectiveUserId: string | null
  /** own user id */
  userId: string | null
  /** active role in current farm */
  role: FarmRole
  /** all farms available to current user */
  availableFarms: FarmOption[]
  /** whether the farm context has been loaded */
  loaded: boolean

  setFarmContext: (ctx: {
    effectiveUserId: string
    userId: string
    role: FarmRole
    availableFarms: FarmOption[]
  }) => void
  switchFarm: (farmOwnerId: string | null) => Promise<void>
}

export const useFarmStore = create<FarmStore>(set => ({
  effectiveUserId: null,
  userId: null,
  role: 'proprietar',
  availableFarms: [],
  loaded: false,

  setFarmContext: ctx =>
    set({
      effectiveUserId: ctx.effectiveUserId,
      userId: ctx.userId,
      role: ctx.role,
      availableFarms: ctx.availableFarms,
      loaded: true,
    }),

  switchFarm: async farmOwnerId => {
    const res = await fetch('/api/farm-context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ farmOwnerId: farmOwnerId ?? '' }),
    })
    if (res.ok) {
      // Reload so all components re-fetch data for the new farm context
      window.location.reload()
    }
  },
}))
