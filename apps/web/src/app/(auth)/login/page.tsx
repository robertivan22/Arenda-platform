'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { Eye, EyeOff, Loader2, Mail, Lock } from 'lucide-react'
import { toast } from 'sonner'

export default function LoginPage() {
  const router = useRouter()
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
      router.replace('/dashboard')
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Date de autentificare invalide.')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ─────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#1e3a22] flex-col relative overflow-hidden">
        {/* Logo */}
        <div className="px-10 pt-10 flex items-center gap-3 relative z-10">
          <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C8.5 2 6 4.5 6 4.5S3 7 3 10.5c0 2.8 1.8 5.2 4 6.5V20h2v-2h6v2h2v-3c2.2-1.3 4-3.7 4-6.5C21 7 18 2 12 2zm-2 14H8v-1.5C6.8 13.6 6 12.1 6 10.5 6 8 7.8 5.5 10 4.3V16zm6 0h-2V4.3c2.2 1.2 4 3.7 4 6.2 0 1.6-.8 3.1-2 4V16z"/>
            </svg>
          </div>
          <span className="text-xl font-bold text-white">Arenda<span className="text-amber-400">Pro</span></span>
        </div>

        {/* Center illustration */}
        <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-10">
          {/* Tractor SVG illustration */}
          <svg viewBox="0 0 320 200" className="w-72 mb-8 drop-shadow-2xl" xmlns="http://www.w3.org/2000/svg">
            <rect x="80" y="82" width="130" height="68" rx="8" fill="#2d6a4f"/>
            <rect x="155" y="50" width="75" height="50" rx="6" fill="#1b4332"/>
            <rect x="163" y="58" width="55" height="30" rx="3" fill="#52b788" opacity="0.45"/>
            <rect x="80" y="92" width="80" height="38" rx="4" fill="#1b4332"/>
            <rect x="128" y="36" width="9" height="26" rx="4" fill="#333"/>
            <circle cx="132" cy="33" r="6" fill="#555" opacity="0.55"/>
            <circle cx="137" cy="27" r="4" fill="#555" opacity="0.35"/>
            <circle cx="115" cy="158" r="42" fill="#b45309"/>
            <circle cx="115" cy="158" r="33" fill="#f59e0b"/>
            <circle cx="115" cy="158" r="22" fill="#b45309"/>
            <circle cx="115" cy="158" r="9" fill="#fbbf24"/>
            {[0,60,120,180,240,300].map((a,i) => (
              <line key={i} x1="115" y1="158"
                x2={115 + 27*Math.cos(a*Math.PI/180)}
                y2={158 + 27*Math.sin(a*Math.PI/180)}
                stroke="#92400e" strokeWidth="4"/>
            ))}
            <circle cx="230" cy="166" r="25" fill="#b45309"/>
            <circle cx="230" cy="166" r="19" fill="#f59e0b"/>
            <circle cx="230" cy="166" r="12" fill="#b45309"/>
            <circle cx="230" cy="166" r="5" fill="#fbbf24"/>
            {[0,90,180,270].map((a,i) => (
              <line key={i} x1="230" y1="166"
                x2={230 + 15*Math.cos(a*Math.PI/180)}
                y2={166 + 15*Math.sin(a*Math.PI/180)}
                stroke="#92400e" strokeWidth="3"/>
            ))}
            <line x1="50" y1="197" x2="290" y2="197" stroke="#2d6a4f" strokeWidth="2" opacity="0.6"/>
            {[40,55,270,285].map((x,i) => (
              <g key={i}>
                <line x1={x} y1="197" x2={x} y2="170" stroke="#52b788" strokeWidth="2"/>
                <ellipse cx={x} cy="166" rx="5" ry="9" fill="#52b788" opacity="0.8"/>
              </g>
            ))}
          </svg>

          <h2 className="text-3xl font-bold text-white text-center mb-3 leading-tight">
            Platforma ta de<br />management agricol
          </h2>
          <p className="text-[#74c69d] text-center text-sm leading-relaxed max-w-xs">
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

        {/* BG circles */}
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-[#2d6a4f] opacity-30 pointer-events-none"/>
        <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-[#1b4332] opacity-50 pointer-events-none"/>
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
