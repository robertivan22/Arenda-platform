'use client'

import { useState } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { createClient } from '@/lib/supabase/client'
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

  async function handleForgotPassword() {
    if (!email) { toast.error('Introduceți email-ul mai întâi.'); return }
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) toast.error(error.message)
    else toast.success('Email de resetare trimis! Verificați căsuța poștală și urmați linkul.')
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ─────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col relative overflow-hidden" style={{ background: '#0d2010' }}>
        {/* Background photo */}
        <img
          src="https://plus.unsplash.com/premium_photo-1661963674367-2be0751cce72?q=80&w=1535&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
          alt="Combina pe câmp"
          className="absolute inset-0 w-full h-full object-cover object-center"
          style={{ opacity: 0.45 }}
        />
        {/* Dark overlay */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(8,24,10,0.55) 0%, rgba(10,28,12,0.7) 60%, rgba(6,18,8,0.92) 100%)' }} />

        {/* Logo top-left */}
        <div className="px-10 pt-10 flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M17,8C8,10,5.9,16.17,3.82,21.34L5.71,22l1-2.3A4.49,4.49,0,0,0,8,20C19,20,22,3,22,3,21,5,14,5.25,9,6.25S2,11.5,2,13.5a6.22,6.22,0,0,0,.05,1A10.66,10.66,0,0,1,8.26,9.4C8.26,9.4,4,11,4,13h0c0-2,7-4.9,13-5C17,8,17,8,17,8Z"/>
            </svg>
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-xl font-extrabold text-white tracking-wide">ArendaPro</span>
            <span className="text-[10px] font-semibold text-amber-400/80 tracking-[0.2em] uppercase mt-0.5">Platformă agricolă</span>
          </div>
        </div>

        {/* Center hero */}
        <div className="flex-1 flex flex-col justify-center relative z-10 px-10">
          <div className="inline-block mb-5">
            <span className="px-3 py-1.5 rounded-full border border-amber-500/40 text-amber-400 text-xs font-semibold tracking-wider uppercase">
              Platformă dedicată arendatorilor
            </span>
          </div>
          <h2 className="text-4xl font-extrabold text-white leading-tight mb-4">
            Gestionează<br />
            <span style={{ color: '#4ade80' }}>terenurile agricole</span><br />
            cu ușurință
          </h2>
          <p className="text-white/55 text-sm leading-relaxed max-w-xs mb-8">
            Contracte, arendatori, parcele și plăți — totul centralizat într-o singură platformă modernă.
          </p>
          {/* Feature pills */}
          <div className="flex flex-wrap gap-2">
            {['Contracte digitale', 'Hartă parcele', 'Plăți restante', 'Rapoarte'].map(t => (
              <span key={t} className="px-3 py-1.5 rounded-full border border-white/20 text-white/70 text-xs font-medium">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Wheat illustration at bottom */}
        <div className="relative z-10 pointer-events-none select-none" style={{ height: 90 }}>
          <svg viewBox="0 0 700 90" fill="none" xmlns="http://www.w3.org/2000/svg" width="100%" height="90" preserveAspectRatio="xMidYMax meet">
            <rect x="0" y="72" width="700" height="18" fill="#061208"/>
            {[35,90,145,200,255,310,365,420,475,530,585,640].map((x, i) => {
              const h = 12 + (i % 3) * 8
              const top = 72 - h
              return (
                <g key={x}>
                  <line x1={x} y1="72" x2={x} y2={top + 4} stroke="#c8973a" strokeWidth="1.5" strokeLinecap="round"/>
                  <ellipse cx={x - 5} cy={top + 7} rx="4" ry="2.5" fill="#e8b84b" transform={`rotate(-30 ${x - 5} ${top + 7})`}/>
                  <ellipse cx={x + 5} cy={top + 7} rx="4" ry="2.5" fill="#e8b84b" transform={`rotate(30 ${x + 5} ${top + 7})`}/>
                  <ellipse cx={x - 5} cy={top + 17} rx="4" ry="2.5" fill="#d4a035" transform={`rotate(-30 ${x - 5} ${top + 17})`}/>
                  <ellipse cx={x + 5} cy={top + 17} rx="4" ry="2.5" fill="#d4a035" transform={`rotate(30 ${x + 5} ${top + 17})`}/>
                  <line x1={x} y1={top + 4} x2={x + 2} y2={top - 8} stroke="#c8a020" strokeWidth="1" strokeLinecap="round"/>
                </g>
              )
            })}
          </svg>
        </div>
      </div>

      {/* ── Right panel ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-between p-8 bg-white min-h-screen">
        <div className="w-full max-w-sm flex-1 flex flex-col justify-center">
          {/* Mobile logo */}
          <div className="flex justify-center mb-8 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M17,8C8,10,5.9,16.17,3.82,21.34L5.71,22l1-2.3A4.49,4.49,0,0,0,8,20C19,20,22,3,22,3,21,5,14,5.25,9,6.25S2,11.5,2,13.5a6.22,6.22,0,0,0,.05,1A10.66,10.66,0,0,1,8.26,9.4C8.26,9.4,4,11,4,13h0c0-2,7-4.9,13-5C17,8,17,8,17,8Z"/></svg>
              </div>
              <div>
                <span className="text-lg font-extrabold text-gray-900">ArendaPro</span>
              </div>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-1">Bun venit înapoi</h1>
          <p className="text-sm text-gray-400 mb-8">Autentifică-te în contul tău ArendaPro</p>

          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Adresă email</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="adresa ta de email"
                  className="w-full pl-10 pr-4 py-3 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2d6a4f] focus:border-transparent transition placeholder:text-gray-300"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-700">Parolă</label>
                <button type="button" className="text-xs text-[#16a34a] hover:underline font-medium" onClick={handleForgotPassword}>Ai uitat parola?</button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-3 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2d6a4f] focus:border-transparent transition"
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
                className="w-4 h-4 rounded border-gray-300 text-[#16a34a] focus:ring-[#16a34a]"
              />
              <span className="text-sm text-gray-600">Ține-mă conectat</span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center gap-2 text-white font-semibold py-3 rounded-lg text-sm transition-colors disabled:opacity-60"
              style={{ background: loading ? '#2d5a1b' : '#1a3a0e' }}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {loading ? 'Se procesează...' : 'Autentificare →'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-400 mt-6">
            Nu ai cont?{' '}
            <a href="mailto:Admin@ArendaPro.com" className="text-[#16a34a] hover:underline font-semibold">Contactează-ne pe email la Admin@ArendaPro.com pentru ofertă detaliată</a>
          </p>
        </div>

        {/* Footer */}
        <div className="w-full flex items-center justify-between pt-6 border-t border-gray-100">
          <p className="text-xs text-gray-400">© 2026 ArendaPro · Toate drepturile rezervate</p>
          <button className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 text-xs font-bold">?</button>
        </div>
      </div>
    </div>
  )
}
