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
            {/* Body */}
            <rect x="80" y="80" width="130" height="70" rx="8" fill="#2d6a4f"/>
            <rect x="80" y="80" width="130" height="70" rx="8" fill="url(#tractorBody)"/>
            {/* Cabin */}
            <rect x="155" y="50" width="75" height="50" rx="6" fill="#1b4332"/>
            <rect x="163" y="58" width="55" height="30" rx="3" fill="#74c69d" opacity="0.5"/>
            {/* Hood */}
            <rect x="80" y="90" width="80" height="40" rx="4" fill="#1b4332"/>
            {/* Exhaust */}
            <rect x="130" y="40" width="8" height="20" rx="4" fill="#1b4332"/>
            <ellipse cx="134" cy="38" rx="6" ry="4" fill="#333" opacity="0.6"/>
            {/* Big rear wheel */}
            <circle cx="115" cy="155" r="42" fill="#1a1a1a"/>
            <circle cx="115" cy="155" r="34" fill="#2d2d2d"/>
            <circle cx="115" cy="155" r="24" fill="#1a1a1a"/>
            <circle cx="115" cy="155" r="10" fill="#555"/>
            {/* Wheel spokes */}
            {[0,45,90,135,180,225,270,315].map((a,i) => (
              <line key={i} x1="115" y1="155"
                x2={115 + 28*Math.cos(a*Math.PI/180)}
                y2={155 + 28*Math.sin(a*Math.PI/180)}
                stroke="#555" strokeWidth="3"/>
            ))}
            {/* Small front wheel */}
            <circle cx="225" cy="163" r="24" fill="#1a1a1a"/>
            <circle cx="225" cy="163" r="18" fill="#2d2d2d"/>
            <circle cx="225" cy="163" r="12" fill="#1a1a1a"/>
            <circle cx="225" cy="163" r="5" fill="#555"/>
            {/* Ground line */}
            <line x1="50" y1="197" x2="290" y2="197" stroke="#2d6a4f" strokeWidth="2" opacity="0.6"/>
            {/* Wheat / crop decorations */}
            {[40,55,270,285].map((x,i) => (
              <g key={i}>
                <line x1={x} y1="197" x2={x} y2="170" stroke="#52b788" strokeWidth="2"/>
                <ellipse cx={x} cy="166" rx="5" ry="9" fill="#52b788" opacity="0.8"/>
              </g>
            ))}
            <defs>
              <linearGradient id="tractorBody" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fff" stopOpacity="0.05"/>
                <stop offset="100%" stopColor="#000" stopOpacity="0.1"/>
              </linearGradient>
            </defs>
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
}(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await signInWithPassword(email, password)
      router.replace('/dashboard')
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Date de autentificare invalide.')
    } finally { setLoading(false) }
  }

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await signInWithMagicLink(email)
      setMagicSent(true)
    } catch (err: unknown) {
      toast.error((err as Error)?.message || 'Eroare la trimiterea linkului.')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-brand-900 via-brand-800 to-brand-700 flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <Building2 className="w-8 h-8 text-white" />
          <span className="text-2xl font-bold text-white">Arenda<span className="text-brand-300">Pro</span></span>
        </div>
        <div>
          <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
            Gestionati arenda<br />cu incredere
          </h1>
          <p className="text-brand-200 text-lg mb-10">
            Platforma completa pentru administrarea contractelor de arenda, arendatorilor si declaratiilor fiscale.
          </p>
          <div className="space-y-4">
            {[
              { icon: MapPin, text: 'Evidenta parcele si contracte' },
              { icon: FileText, text: 'Generare automata declaratie D112' },
              { icon: Shield, text: 'Date securizate, acces individual' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-brand-200" />
                </div>
                <span className="text-brand-100 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-brand-400 text-xs">© 2026 ArendaPro. Toate drepturile rezervate.</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex justify-center mb-8 lg:hidden">
            <div className="flex items-center gap-2">
              <Building2 className="w-7 h-7 text-brand-500" />
              <span className="text-xl font-semibold text-brand-800">Arenda<span className="text-brand-500">Pro</span></span>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Buna ziua</h2>
            <p className="text-sm text-gray-500 mb-6">Conectati-va la contul dumneavoastra</p>

            {/* Tabs */}
            <div className="flex rounded-lg bg-gray-100 p-1 mb-6">
              <button onClick={() => { setTab('password'); setMagicSent(false) }}
                className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${tab === 'password' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                Parola
              </button>
              <button onClick={() => { setTab('magic'); setMagicSent(false) }}
                className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${tab === 'magic' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                Link magic
              </button>
            </div>

            {tab === 'password' && (
              <form onSubmit={handlePasswordLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Adresa email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="utilizator@firma.ro"
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                      required autoComplete="email" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Parola</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                      className="w-full pl-9 pr-10 py-2.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                      required autoComplete="current-password" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading} className="w-full flex justify-center items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-lg text-sm transition disabled:opacity-60">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? 'Se proceseaza...' : 'Autentificare'}
                </button>
              </form>
            )}

            {tab === 'magic' && !magicSent && (
              <form onSubmit={handleMagicLink} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Adresa email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="utilizator@firma.ro"
                      className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition"
                      required autoComplete="email" />
                  </div>
                </div>
                <p className="text-xs text-gray-500">Nu este necesara o parola. Vei primi un link de autentificare pe email.</p>
                <button type="submit" disabled={loading} className="w-full flex justify-center items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-lg text-sm transition disabled:opacity-60">
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? 'Se trimite...' : 'Trimite link magic'}
                </button>
              </form>
            )}

            {tab === 'magic' && magicSent && (
              <div className="text-center py-4 space-y-3">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <Mail className="w-6 h-6 text-green-600" />
                </div>
                <p className="font-medium text-gray-800">Verificati emailul!</p>
                <p className="text-sm text-gray-500">Am trimis un link la <strong>{email}</strong>. Dati click pentru a va conecta.</p>
                <button onClick={() => setMagicSent(false)} className="text-xs text-brand-500 hover:underline">Trimite din nou</button>
              </div>
            )}

            <p className="text-center text-xs text-gray-400 mt-6">
              Nu aveti cont?{' '}
              <Link href="/signup" className="text-brand-500 hover:underline font-medium">Creati cont</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
