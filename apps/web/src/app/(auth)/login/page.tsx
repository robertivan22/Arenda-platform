'use client'

import { useState } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { Eye, EyeOff, Loader2, Mail, Lock } from 'lucide-react'
import { toast } from 'sonner'

export default function LoginPage() {
  const { signInWithPassword } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await signInWithPassword(email, password)
      window.location.href = '/dashboard'
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Date de autentificare invalide.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ─────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col relative overflow-hidden">
        {/* Background photo */}
        <img
          src="https://images.unsplash.com/photo-1717702576954-c07131c54169?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwzfHxhZ3JpY3VsdHVyYWwlMjB0cmFjdG9yJTIwZmllbGQlMjBnb2xkZW58ZW58MXx8fHwxNzc5OTY0ODI2fDA&ixlib=rb-4.1.0&q=80&w=1080"
          alt="Tractor pe câmp la apus"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Dark green overlay */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, rgba(22,42,22,0.93) 0%, rgba(26,51,32,0.82) 45%, rgba(15,34,16,0.72) 100%)' }} />
        {/* Logo */}
        <div className="px-10 pt-10 flex items-center gap-3 relative z-10">
          <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C8.5 2 6 4.5 6 4.5S3 7 3 10.5c0 2.8 1.8 5.2 4 6.5V20h2v-2h6v2h2v-3c2.2-1.3 4-3.7 4-6.5C21 7 18 2 12 2zm-2 14H8v-1.5C6.8 13.6 6 12.1 6 10.5 6 8 7.8 5.5 10 4.3V16zm6 0h-2V4.3c2.2 1.2 4 3.7 4 6.2 0 1.6-.8 3.1-2 4V16z"/>
            </svg>
          </div>
          <span className="text-xl font-bold text-white">Arenda<span className="text-amber-400">Pro</span></span>
        </div>

        {/* Center content */}
        <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-10">
          <h2 className="text-3xl font-bold text-white text-center mb-3 leading-tight drop-shadow-lg">
            Platforma ta de<br />management agricol
          </h2>
          <p className="text-[#74c69d] text-center text-sm leading-relaxed max-w-xs drop-shadow">
            Gestionează arendatorii, contractele și parcelele din un singur loc, rapid și eficient.
          </p>
        </div>

        {/* Feature pills */}
        <div className="px-10 pb-10 flex flex-wrap gap-2 relative z-10">
          {['Contracte digitale', 'Declarații', 'Plăți automate', 'Rapoarte'].map(t => (
            <span key={t} className="px-3 py-1 rounded-full border border-[#2d6a4f] text-[#74c69d] text-xs font-medium">{t}</span>
          ))}
        </div>

        {/* Footer */}
        <div className="px-10 pb-4 text-[#52b788] text-xs relative z-10">
          © 2026 ArendaPro — Toate drepturile rezervate
        </div>

      </div>

      {/* ── Right panel ────────────────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#faf7f2]">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex justify-center mb-8 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M12 2C8.5 2 6 4.5 6 4.5S3 7 3 10.5c0 2.8 1.8 5.2 4 6.5V20h2v-2h6v2h2v-3c2.2-1.3 4-3.7 4-6.5C21 7 18 2 12 2zm-2 14H8v-1.5C6.8 13.6 6 12.1 6 10.5 6 8 7.8 5.5 10 4.3V16zm6 0h-2V4.3c2.2 1.2 4 3.7 4 6.2 0 1.6-.8 3.1-2 4V16z"/></svg>
              </div>
              <span className="text-xl font-bold text-[#1e3a22]">Arenda<span className="text-amber-500">Pro</span></span>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-1">Bun venit înapoi</h1>
          <p className="text-sm text-gray-500 mb-8">Intră în contul tău pentru a continua</p>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Adresă de email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="exemplu@arenda.ro"
                  className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2d6a4f] focus:border-transparent transition placeholder:text-gray-300"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-700">Parolă</label>
                <button type="button" className="text-xs text-[#2d6a4f] hover:underline font-medium">Ai uitat parola?</button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-3 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2d6a4f] focus:border-transparent transition"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={remember}
                onChange={e => setRemember(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[#2d6a4f] focus:ring-[#2d6a4f]"
              />
              <span className="text-sm text-gray-600">Ține-mă minte</span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 bg-[#1e3a22] hover:bg-[#2d6a4f] text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-60"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Se procesează...' : 'Conectează-te →'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Nu ai cont?{' '}
            <a href="mailto:admin@arenda.ro" className="text-[#2d6a4f] hover:underline font-medium">Contactează administratorul</a>
          </p>
        </div>
      </div>
    </div>
  )
}
