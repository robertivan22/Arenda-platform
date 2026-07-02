'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, LogOut, Clock } from 'lucide-react'

interface ImpersonationStatus {
  active: true
  sessionId: string
  adminEmail: string | null
  targetEmail: string | null
  targetDisplayName: string | null
  expiresAt: string
}

function useCountdown(expiresAt: string | null): string {
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    if (!expiresAt) return

    function update() {
      const diff = new Date(expiresAt!).getTime() - Date.now()
      if (diff <= 0) { setRemaining('Expirat'); return }
      const m = Math.floor(diff / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setRemaining(`${m}:${String(s).padStart(2, '0')}`)
    }

    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  return remaining
}

export function ImpersonationBanner() {
  const router = useRouter()
  const [status, setStatus] = useState<ImpersonationStatus | null>(null)
  const [stopping, setStopping] = useState(false)

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/impersonate/status')
      const data = await res.json()
      if (data.active) {
        setStatus(data as ImpersonationStatus)
      } else {
        setStatus(null)
      }
    } catch {
      // Silently ignore — network errors shouldn't break the UI
    }
  }, [])

  useEffect(() => {
    fetchStatus()
    // Re-check every minute in case session expires server-side
    const id = setInterval(fetchStatus, 60_000)
    return () => clearInterval(id)
  }, [fetchStatus])

  const countdown = useCountdown(status?.expiresAt ?? null)

  async function handleStop() {
    if (stopping) return
    setStopping(true)
    try {
      const res = await fetch('/api/admin/impersonate/stop', { method: 'POST' })
      if (res.ok) {
        setStatus(null)
        router.push('/admin-cp')
        router.refresh()
      } else {
        const data = await res.json()
        alert(`Eroare la terminarea sesiunii: ${data.error ?? 'unknown'}`)
        setStopping(false)
      }
    } catch {
      alert('Eroare de rețea la terminarea sesiunii.')
      setStopping(false)
    }
  }

  if (!status) return null

  const displayName = status.targetDisplayName ?? status.targetEmail ?? 'utilizator necunoscut'

  return (
    <div className="w-full bg-red-600 text-white flex items-center gap-3 px-4 py-2 text-sm flex-shrink-0">
      <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden />

      <span className="flex-1 min-w-0 truncate">
        <strong>CONTROL TOTAL</strong>
        {' — '}acționezi ca{' '}
        <strong className="font-semibold">{displayName}</strong>.
        {' '}Toate acțiunile sunt înregistrate.
        {' '}Fără acces la parole sau chei API.
      </span>

      {countdown && (
        <span className="flex items-center gap-1 text-red-100 text-xs flex-shrink-0 tabular-nums">
          <Clock className="w-3.5 h-3.5" />
          {countdown}
        </span>
      )}

      <button
        onClick={handleStop}
        disabled={stopping}
        className="flex items-center gap-1.5 px-3 py-1 bg-white text-red-700 rounded text-xs font-semibold hover:bg-red-50 transition-colors disabled:opacity-60 flex-shrink-0"
      >
        <LogOut className="w-3.5 h-3.5" />
        {stopping ? 'Se termină...' : 'Terminare sesiune'}
      </button>
    </div>
  )
}
