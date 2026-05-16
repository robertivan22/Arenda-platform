'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { User, Mail, Calendar, Shield, LogOut, Save } from 'lucide-react'
import { toast } from 'sonner'
import type { User as SupabaseUser } from '@supabase/supabase-js'

export default function ProfilPage() {
  const router = useRouter()
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setDisplayName(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? '')
      setLoading(false)
    })
  }, [])

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function handleSave() {
    if (!user) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ data: { full_name: displayName } })
    if (error) toast.error('Eroare la salvare: ' + error.message)
    else toast.success('Profil actualizat.')
    setSaving(false)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Se încarcă...
      </div>
    )
  }

  const joinedAt = user?.created_at ? new Date(user.created_at).toLocaleDateString('ro-RO', {
    day: '2-digit', month: 'long', year: 'numeric'
  }) : '—'

  const provider = user?.app_metadata?.provider ?? 'email'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <PageHeader title="Profilul meu" subtitle="Vizualizează și actualizează datele contului" />

      {/* Avatar + info principal */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
          <span className="text-white text-2xl font-bold">
            {(displayName || user?.email || 'U')[0].toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-semibold text-gray-900 truncate">
            {displayName || user?.email?.split('@')[0] || 'Utilizator'}
          </p>
          <p className="text-sm text-gray-500 truncate">{user?.email}</p>
          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 text-xs rounded-full bg-green-50 text-green-700 border border-green-200">
            <Shield className="w-3 h-3" /> Cont activ
          </span>
        </div>
      </div>

      {/* Date cont */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <div className="px-6 py-4">
          <h2 className="text-sm font-semibold text-gray-700">Informații cont</h2>
        </div>

        {/* Nume afișare */}
        <div className="px-6 py-4 flex items-start gap-3">
          <User className="w-4 h-4 text-gray-400 mt-2.5 flex-shrink-0" />
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Nume afișat</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Introdu numele tău"
              className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="mt-5 flex items-center gap-1 px-3 py-1.5 text-sm bg-brand-500 text-white rounded-md hover:bg-brand-600 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Se salvează...' : 'Salvează'}
          </button>
        </div>

        {/* Email */}
        <div className="px-6 py-4 flex items-center gap-3">
          <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Email</p>
            <p className="text-sm font-medium text-gray-900">{user?.email ?? '—'}</p>
          </div>
        </div>

        {/* Data înregistrării */}
        <div className="px-6 py-4 flex items-center gap-3">
          <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Înregistrat la</p>
            <p className="text-sm font-medium text-gray-900">{joinedAt}</p>
          </div>
        </div>

        {/* Provider */}
        <div className="px-6 py-4 flex items-center gap-3">
          <Shield className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Metoda autentificare</p>
            <p className="text-sm font-medium text-gray-900 capitalize">{provider}</p>
          </div>
        </div>

        {/* User ID */}
        <div className="px-6 py-4 flex items-center gap-3">
          <Shield className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-gray-500">ID utilizator</p>
            <p className="text-xs font-mono text-gray-600 truncate">{user?.id ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* Sign out */}
      <div className="bg-white rounded-xl border border-red-100 p-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Sesiune</h2>
        <p className="text-sm text-gray-500 mb-4">
          La deconectare vei fi redirecționat la pagina de autentificare.
        </p>
        <button
          onClick={handleSignOut}
          disabled={signingOut}
          className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 disabled:opacity-50 text-sm font-medium transition-colors"
        >
          <LogOut className="w-4 h-4" />
          {signingOut ? 'Se deconectează...' : 'Deconectare (Sign Out)'}
        </button>
      </div>
    </div>
  )
}
