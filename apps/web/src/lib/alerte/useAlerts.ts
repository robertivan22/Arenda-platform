'use client'

import { useState, useEffect, useCallback } from 'react'
import type { AlerteResponse } from './types'

export interface AlertSummary {
  totalCritice: number
  totalMedii: number
  total: number
  data: AlerteResponse | null
  loading: boolean
}

// Module-level cache so multiple subscribers share one fetch
let cache: AlerteResponse | null = null
let cacheTime = 0
const STALE_MS = 60_000 // 1 minute
const listeners = new Set<() => void>()

function notify() { listeners.forEach(fn => fn()) }

export function useAlerts(): AlertSummary {
  const [, rerender] = useState(0)

  const refresh = useCallback(() => rerender(n => n + 1), [])

  useEffect(() => {
    listeners.add(refresh)
    return () => { listeners.delete(refresh) }
  }, [refresh])

  useEffect(() => {
    if (cache && Date.now() - cacheTime < STALE_MS) return
    void (async () => {
      try {
        const res = await fetch('/api/alerte', { cache: 'no-store' })
        const json: AlerteResponse = await res.json()
        if (json.ok) { cache = json; cacheTime = Date.now(); notify() }
      } catch { /* silent */ }
    })()
  }, [])

  const d = cache
  const contracteCritice = (d?.contracte ?? []).filter(c => c.priority === 'inalta').length
  const contracteMedii   = (d?.contracte ?? []).filter(c => c.priority === 'medie').length
  const stocuriCritice   = (d?.stocuri   ?? []).filter(s => s.priority === 'inalta').length
  const stocuriMedii     = (d?.stocuri   ?? []).filter(s => s.priority === 'medie').length
  const utilajeCritice   = (d?.utilaje   ?? []).filter(u => u.overall_priority === 'high').length
  const utilajeMedii     = (d?.utilaje   ?? []).filter(u => u.overall_priority === 'medium').length
  const txCritice        = (d?.tranzactii ?? []).filter(t => t.is_overdue && !t.is_paid).length
  const txMedii          = (d?.tranzactii ?? []).filter(t => !t.is_overdue && !t.is_paid).length

  const totalCritice = contracteCritice + stocuriCritice + utilajeCritice + txCritice
  const totalMedii   = contracteMedii   + stocuriMedii   + utilajeMedii   + txMedii

  return {
    totalCritice,
    totalMedii,
    total: totalCritice + totalMedii,
    data: d,
    loading: !d,
  }
}
