'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { Building2, Eye, EyeOff, Loader2, Mail, Lock, User } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

export default function SignupPage() {
  const router = useRouter()
  const { signUp } = useAuthStore()

  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirm: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password !== form.confirm) {
      toast.error('Parolele nu coincid.')
      return
    }
    if (form.password.length < 8) {
      toast.error('Parola trebuie să aibă cel puțin 8 caractere.')
      return
    }
    setLoading(true)
    try {
      await signUp(form.email, form.password, form.fullName)
      setDone(true)
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Eroare la crearea contului.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="bg-white rounded-xl shadow-xl p-8 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
          <Mail className="w-7 h-7 text-green-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-800">Verificați emailul</h2>
        <p className="text-sm text-gray-500">
          Am trimis un email de confirmare la <strong>{form.email}</strong>. Dați click pe linkul din email pentru a activa contul.
        </p>
        <Link href="/login" className="inline-block text-sm text-brand-500 hover:underline">
          Înapoi la autentificare
        </Link>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-xl p-8">
      <div className="flex justify-center mb-6">
        <div className="flex items-center gap-2">
          <Building2 className="w-7 h-7 text-brand-500" />
          <span className="text-xl font-semibold text-brand-800">
            Arenda<span className="text-brand-500">Pro</span>
          </span>
        </div>
      </div>

      <h1 className="text-center text-lg font-semibold text-gray-800 mb-1">Creare cont</h1>
      <p className="text-center text-sm text-gray-500 mb-6">Completați datele pentru a vă înregistra</p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Nume complet</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={form.fullName}
              onChange={e => setForm(p => ({ ...p, fullName: e.target.value }))}
              placeholder="Ion Popescu"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Adresă email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="email"
              value={form.email}
              onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              placeholder="utilizator@firma.ro"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
              required
              autoComplete="email"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Parolă</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={form.password}
              onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              placeholder="Minim 8 caractere"
              className="w-full pl-9 pr-10 py-2 text-sm rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
              required
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Confirmare parolă</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="password"
              value={form.confirm}
              onChange={e => setForm(p => ({ ...p, confirm: e.target.value }))}
              placeholder="••••••••"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
              required
              autoComplete="new-password"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-medium py-2.5 rounded-md text-sm transition disabled:opacity-60"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Se creează contul...' : 'Creare cont'}
        </button>
      </form>

      <p className="text-center text-xs text-gray-400 mt-6">
        Aveți deja cont?{' '}
        <Link href="/login" className="text-brand-500 hover:underline">
          Autentificați-vă
        </Link>
      </p>
    </div>
  )
}
