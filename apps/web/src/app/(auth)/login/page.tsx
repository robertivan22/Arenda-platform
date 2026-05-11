'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { Building2, Eye, EyeOff, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuthStore()

  const [form, setForm] = useState({ tenantSlug: '', email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await login(form.tenantSlug, form.email, form.password)
      router.replace('/dashboard')
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Date de autentificare invalide.'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-xl p-8">
      {/* Logo */}
      <div className="flex justify-center mb-6">
        <div className="flex items-center gap-2">
          <Building2 className="w-7 h-7 text-brand-500" />
          <span className="text-xl font-semibold text-brand-800">
            Arenda<span className="text-brand-500">Pro</span>
          </span>
        </div>
      </div>

      <h1 className="text-center text-lg font-semibold text-gray-800 mb-1">Autentificare</h1>
      <p className="text-center text-sm text-gray-500 mb-6">
        Introduceți datele de acces pentru a continua
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Tenant slug */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Organizație (slug tenant)
          </label>
          <input
            type="text"
            name="tenantSlug"
            value={form.tenantSlug}
            onChange={handleChange}
            placeholder="ex: firma-mea"
            className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
            required
            autoComplete="organization"
          />
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Adresă email</label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            placeholder="utilizator@firma.ro"
            className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
            required
            autoComplete="email"
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Parolă</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              value={form.password}
              onChange={handleChange}
              placeholder="••••••••"
              className="w-full px-3 py-2 pr-10 text-sm rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
              required
              autoComplete="current-password"
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

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white font-medium py-2.5 rounded-md text-sm transition disabled:opacity-60 disabled:cursor-not-allowed mt-2"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
          {loading ? 'Se procesează...' : 'Autentificare'}
        </button>
      </form>

      <p className="text-center text-xs text-gray-400 mt-6">
        Ai uitat parola?{' '}
        <a href="/forgot-password" className="text-brand-500 hover:underline">
          Recuperare parolă
        </a>
      </p>
    </div>
  )
}
