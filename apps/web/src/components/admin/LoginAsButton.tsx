'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserCheck, X } from 'lucide-react'

interface Props {
  userId: string
  email: string | null
}

export function LoginAsButton({ userId, email }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openModal() {
    setReason('')
    setError(null)
    setOpen(true)
  }

  function closeModal() {
    if (loading) return
    setOpen(false)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (reason.trim().length < 10) {
      setError('Motivul trebuie să aibă minimum 10 caractere.')
      return
    }
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/admin/impersonate/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: userId, reason: reason.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Eroare necunoscută.')
        setLoading(false)
        return
      }

      // Session switched — navigate to dashboard as target user
      setOpen(false)
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Eroare de rețea. Încearcă din nou.')
      setLoading(false)
    }
  }

  const displayEmail = email ?? 'utilizator fără email'

  return (
    <>
      <button
        onClick={openModal}
        title={`Login ca ${displayEmail}`}
        className="flex items-center gap-1 px-2 py-1 text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded font-medium transition-colors"
      >
        <UserCheck className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Login ca</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="font-semibold text-gray-900 text-sm">Accesare cont</h2>
                <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[280px]">{displayEmail}</p>
              </div>
              <button
                onClick={closeModal}
                disabled={loading}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
                <strong>Atenție:</strong> Vei prelua complet sesiunea acestui utilizator.
                Toate acțiunile efectuate vor fi înregistrate în audit log.
                Sesiunea expiră automat după 30 de minute.
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Motivul accesării <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Ex: Investigare problemă raportată de utilizator în ticket #1234"
                  rows={3}
                  disabled={loading}
                  autoFocus
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-gray-50"
                />
                <p className={`text-xs mt-0.5 ${reason.trim().length < 10 ? 'text-gray-400' : 'text-green-600'}`}>
                  {reason.trim().length}/10 caractere minim
                </p>
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                  {error}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={loading}
                  className="flex-1 px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition-colors disabled:opacity-60"
                >
                  Anulează
                </button>
                <button
                  type="submit"
                  disabled={loading || reason.trim().length < 10}
                  className="flex-1 px-4 py-2 text-sm text-white bg-red-600 hover:bg-red-700 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {loading ? 'Se procesează...' : 'Confirmă și intră'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
