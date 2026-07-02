'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, LogOut, Clock, Plus } from 'lucide-react'

interface ImpersonationStatus {
  active: true
  sessionId: string
  adminEmail: string | null
  targetEmail: string | null
  targetDisplayName: string | null
  expiresAt: string
}

const EXTEND_OPTIONS = [
  { label: '+30 min', value: 30 },
  { label: '+1h', value: 60 },
  { label: '+2h', value: 120 },
  { label: '+4h', value: 240 },
]

function useCountdown(expiresAt: string | null): string {
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    if (!expiresAt) return

    function update() {
      const diff = new Date(expiresAt!).getTime() - Date.now()
      if (diff <= 0) { setRemaining('Expirat'); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setRemaining(h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`)
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
  const [extending, setExtending] = useState(false)
  const [showExtend, setShowExtend] = useState(false)

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
      // Silently ignore
    }
  }, [])

  useEffect(() => {
    fetchStatus()
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
        alert(`Eroare: ${data.error ?? 'unknown'}`)
        setStopping(false)
      }
    } catch {
      alert('Eroare de rețea.')
      setStopping(false)
    }
  }

  async function handleExtend(minutes: number) {
    if (extending) return
    setExtending(true)
    setShowExtend(false)
    try {
      const res = await fetch('/api/admin/impersonate/extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalMinutes: minutes }),
      })
      const data = await res.json()
      if (res.ok && data.expiresAt) {
        setStatus(prev => prev ? { ...prev, expiresAt: data.expiresAt } : prev)
      } else {
        alert(`Eroare la prelungire: ${data.error ?? 'unknown'}`)
      }
    } catch {
      alert('Eroare de rețea la prelungire.')
    } finally {
      setExtending(false)
    }
  }

  if (!status) return null

  const displayName = status.targetDisplayName ?? status.targetEmail ?? 'utilizator necunoscut'

  return (
    <div className="w-full bg-red-600 text-white flex items-center gap-3 px-4 py-2 text-sm flex-shrink-0 relative">
      <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden />

      <span className="flex-1 min-w-0 truncate">
        <strong>CONTROL TOTAL</strong>
        {' — '}acționezi ca{' '}
        <strong className="font-semibold">{displayName}</strong>.
        {' '}Toate acțiunile sunt înregistrate.
      </span>

      {countdown && (
        <span className="flex items-center gap-1 text-red-100 text-xs flex-shrink-0 tabular-nums">
          <Clock className="w-3.5 h-3.5" />
          {countdown}
        </span>
      )}

      {/* Extend button */}
      <div className="relative flex-shrink-0">
        <button
          onClick={() => setShowExtend(v => !v)}
          disabled={extending || stopping}
          className="flex items-center gap-1 px-2.5 py-1 bg-red-500 hover:bg-red-400 text-white rounded text-xs font-medium transition-colors disabled:opacity-60"
          title="Prelungește sesiunea"
        >
          <Plus className="w-3.5 h-3.5" />
          {extending ? '...' : 'Extinde'}
        </button>

        {showExtend && (
          <div className="absolute right-0 top-8 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 min-w-[100px]">
            {EXTEND_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleExtend(opt.value)}
                className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-amber-50 hover:text-amber-700 font-medium"
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

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
