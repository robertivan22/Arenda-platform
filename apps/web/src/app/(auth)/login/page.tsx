'use client'

import { useState } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2, Mail, Lock } from 'lucide-react'
import { toast } from 'sonner'

// ─── Agricultural dawn SVG animation ─────────────────────────────────────────

function AgriLandscape() {
  const stalks = Array.from({ length: 46 })
  const particles = Array.from({ length: 14 })

  return (
    <div className="w-full h-full" style={{ minHeight: 400, position: 'relative' }}>
      <style>{`
        @keyframes ap-sway-a { 0%,100%{transform:rotate(-2.5deg)}50%{transform:rotate(2.5deg)} }
        @keyframes ap-sway-b { 0%,100%{transform:rotate(-3.5deg)}50%{transform:rotate(3.5deg)} }
        @keyframes ap-cloud-a { 0%{transform:translateX(0)}100%{transform:translateX(38px)} }
        @keyframes ap-cloud-b { 0%{transform:translateX(0)}100%{transform:translateX(-26px)} }
        @keyframes ap-tractor { 0%{transform:translateX(895px)}100%{transform:translateX(-115px)} }
        @keyframes ap-glow-pulse { 0%,100%{opacity:.78}50%{opacity:1} }
        @keyframes ap-smoke { 0%{transform:translateY(0) scale(1);opacity:.45}100%{transform:translateY(-22px) scale(2.2);opacity:0} }
        @keyframes ap-bird { 0%{transform:translate(0,0)}100%{transform:translate(130px,-18px)} }
        @keyframes ap-pollen { 0%{transform:translateY(0);opacity:.8}100%{transform:translateY(-40px);opacity:0} }
        @keyframes ap-beacon { 0%,100%{opacity:.6}50%{opacity:1} }
        .ap-stalk { transform-box:fill-box; transform-origin:bottom center; }
      `}</style>
      <svg viewBox="0 0 900 480" xmlns="http://www.w3.org/2000/svg" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="apl-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0b1828" />
            <stop offset="38%" stopColor="#4a1e00" stopOpacity=".9" />
            <stop offset="68%" stopColor="#c05500" />
            <stop offset="88%" stopColor="#e8820a" />
            <stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
          <radialGradient id="apl-sun-aura" cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor="#fff7aa" stopOpacity=".95" />
            <stop offset="30%" stopColor="#fbbf24" stopOpacity=".55" />
            <stop offset="70%" stopColor="#f59e0b" stopOpacity=".18" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="apl-horizon-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%"  stopColor="#f59e0b" stopOpacity=".3" />
            <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="apl-hills-far" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#183a14" />
            <stop offset="100%" stopColor="#0c2309" />
          </linearGradient>
          <linearGradient id="apl-hills-mid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e5218" />
            <stop offset="100%" stopColor="#12360d" />
          </linearGradient>
          <linearGradient id="apl-field" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c28018" />
            <stop offset="100%" stopColor="#6e3e05" />
          </linearGradient>
          <linearGradient id="apl-ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4a2c05" />
            <stop offset="100%" stopColor="#2e1a02" />
          </linearGradient>
          <filter id="apl-blur"><feGaussianBlur stdDeviation="2" /></filter>
        </defs>

        {/* Sky */}
        <rect width="900" height="480" fill="url(#apl-sky)" />
        {/* Horizon glow */}
        <ellipse cx="450" cy="308" rx="520" ry="90" fill="url(#apl-horizon-glow)" />
        {/* Sun aura */}
        <circle cx="760" cy="108" r="108" fill="url(#apl-sun-aura)" style={{ animation: 'ap-glow-pulse 4.5s ease-in-out infinite' }} />
        {/* Sun disc */}
        <circle cx="760" cy="108" r="50" fill="#fef3c7" opacity=".96">
          <animate attributeName="r" values="49;52;49" dur="4.5s" repeatCount="indefinite" />
        </circle>
        <circle cx="760" cy="108" r="30" fill="#ffffff" opacity=".7" />
        <rect x="0" y="304" width="900" height="3" fill="#f59e0b" opacity=".22" />

        {/* Cloud 1 */}
        <g style={{ animation: 'ap-cloud-a 15s ease-in-out infinite alternate' }}>
          <ellipse cx="155" cy="76" rx="76" ry="24" fill="rgba(255,180,90,.38)" />
          <ellipse cx="128" cy="88" rx="46" ry="19" fill="rgba(255,160,70,.3)" />
          <ellipse cx="184" cy="86" rx="54" ry="18" fill="rgba(255,160,70,.3)" />
        </g>
        {/* Cloud 2 */}
        <g style={{ animation: 'ap-cloud-b 20s ease-in-out infinite alternate' }}>
          <ellipse cx="435" cy="50" rx="62" ry="18" fill="rgba(255,160,70,.28)" />
          <ellipse cx="410" cy="61" rx="38" ry="16" fill="rgba(255,160,70,.22)" />
          <ellipse cx="460" cy="59" rx="44" ry="15" fill="rgba(255,160,70,.22)" />
        </g>

        {/* Birds */}
        <g style={{ animation: 'ap-bird 25s linear infinite' }}>
          <path d="M70,145 Q74,140 78,145" stroke="rgba(255,160,50,.65)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <path d="M83,136 Q87,131 91,136" stroke="rgba(255,160,50,.65)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <path d="M96,143 Q100,138 104,143" stroke="rgba(255,160,50,.5)" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </g>
        <g style={{ animation: 'ap-bird 32s 6s linear infinite' }}>
          <path d="M190,108 Q194,104 198,108" stroke="rgba(255,160,50,.55)" strokeWidth="1.3" fill="none" strokeLinecap="round" />
          <path d="M204,100 Q208,96 212,100" stroke="rgba(255,160,50,.55)" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </g>

        {/* Far hills */}
        <path d="M0,305 Q100,260 210,285 Q340,248 460,278 Q580,252 710,272 Q810,254 900,265 L900,480 L0,480 Z" fill="url(#apl-hills-far)" opacity=".93" />
        {/* Mid hills */}
        <path d="M0,345 Q130,310 270,332 Q410,308 540,328 Q670,304 820,322 Q868,312 900,316 L900,480 L0,480 Z" fill="url(#apl-hills-mid)" />
        {/* Wheat field */}
        <path d="M0,392 Q220,370 450,380 Q700,370 900,376 L900,480 L0,480 Z" fill="url(#apl-field)" />
        {/* Ground */}
        <path d="M0,434 L900,428 L900,480 L0,480 Z" fill="url(#apl-ground)" />
        {/* Plough rows */}
        {Array.from({ length: 7 }).map((_, i) => (
          <path key={i} d={`M${i * 145 - 10},480 Q${i * 145 + 62},${434 + i % 3} ${i * 145 + 155},480`} stroke="#5e3806" strokeWidth="1.2" fill="none" opacity=".55" />
        ))}

        {/* Wheat stalks */}
        {stalks.map((_, i) => {
          const xPos = 10 + (i / 45) * 880
          const height = 52 + Math.sin(i * 1.76) * 13 + (i % 4) * 3
          const delay = ((i * 0.16) % 2.8).toFixed(2)
          const dur = (1.9 + (i % 6) * 0.21).toFixed(2)
          const useB = i % 3 === 1
          const hc = ['#d4a017','#c8911a','#b87e14','#daa820'][i % 4]
          return (
            <g key={i} transform={`translate(${xPos},402)`}>
              <g className="ap-stalk" style={{ animation: `${useB ? 'ap-sway-b' : 'ap-sway-a'} ${dur}s ${delay}s ease-in-out infinite` }}>
                <line x1="0" y1="0" x2="0" y2={-height} stroke="#8b6914" strokeWidth="1.6" />
                <ellipse cx="0" cy={-height * 0.56} rx="1.5" ry="2.2" fill="#7a5a10" />
                <path d={`M0,${-height * 0.44} Q7,${-height * 0.52} 3.5,${-height * 0.63}`} stroke="#4a7a14" strokeWidth="1.3" fill="none" />
                <ellipse cx="0" cy={-height - 8} rx="3.4" ry="9.5" fill={hc} />
                <line x1="0" y1={-height + 1} x2="-6" y2={-height - 9}  stroke="#a07018" strokeWidth=".9" />
                <line x1="0" y1={-height - 1} x2="6"  y2={-height - 9}  stroke="#a07018" strokeWidth=".9" />
                <line x1="0" y1={-height - 4} x2="-5" y2={-height - 13} stroke="#a07018" strokeWidth=".75" />
                <line x1="0" y1={-height - 4} x2="5"  y2={-height - 13} stroke="#a07018" strokeWidth=".75" />
                <line x1="0" y1={-height - 7} x2="-3" y2={-height - 16} stroke="#a07018" strokeWidth=".6" />
                <line x1="0" y1={-height - 7} x2="3"  y2={-height - 16} stroke="#a07018" strokeWidth=".6" />
              </g>
            </g>
          )
        })}

        {/* Pollen */}
        {particles.map((_, i) => {
          const xP = 40 + (i / 13) * 820
          const yP = 385 + (i % 4) * 9
          const d = (2.8 + (i % 5) * 0.65).toFixed(1)
          const dl = ((i * 0.55) % 3.2).toFixed(1)
          return <circle key={i} cx={xP} cy={yP} r="1.6" fill="#fbbf24" opacity=".7" style={{ animation: `ap-pollen ${d}s ${dl}s ease-in-out infinite` }} />
        })}

        {/* Tractor */}
        <g style={{ animation: 'ap-tractor 24s linear infinite' }}>
          <ellipse cx="52" cy="436" rx="48" ry="5.5" fill="rgba(0,0,0,.28)" filter="url(#apl-blur)" />
          {/* Rear wheel */}
          <circle cx="62" cy="414" r="27" fill="#0c0804" />
          <circle cx="62" cy="414" r="21" fill="#1a1008" />
          <circle cx="62" cy="414" r="7" fill="#0c0804" />
          {Array.from({ length: 8 }).map((_, wi) => { const a = (wi / 8) * Math.PI * 2; return <line key={wi} x1={62 + Math.cos(a) * 12} y1={414 + Math.sin(a) * 12} x2={62 + Math.cos(a) * 24} y2={414 + Math.sin(a) * 24} stroke="#0c0804" strokeWidth="3.2" /> })}
          <path d="M34,396 Q50,386 72,390 Q86,391 88,398 L88,403 Q85,396 72,393 Q50,389 34,401 Z" fill="#0c0804" />
          <rect x="22" y="398" width="66" height="20" rx="3" fill="#0c0804" />
          <rect x="6" y="398" width="24" height="19" rx="2.5" fill="#0c0804" />
          {Array.from({ length: 4 }).map((_, gi) => <line key={gi} x1={9} y1={402 + gi * 3.5} x2={27} y2={402 + gi * 3.5} stroke="#1e1208" strokeWidth="1" opacity=".7" />)}
          <rect x="18" y="382" width="5" height="18" rx="2" fill="#0c0804" />
          <rect x="15" y="380" width="11" height="5" rx="2" fill="#0c0804" />
          <circle cx="21" cy="377" r="4.5" fill="rgba(60,40,15,.45)" style={{ animation: 'ap-smoke 2.1s 0s ease-out infinite' }} />
          <circle cx="23" cy="368" r="3.8" fill="rgba(60,40,15,.3)" style={{ animation: 'ap-smoke 2.1s .75s ease-out infinite' }} />
          <circle cx="20" cy="360" r="3" fill="rgba(60,40,15,.18)" style={{ animation: 'ap-smoke 2.1s 1.5s ease-out infinite' }} />
          <rect x="48" y="372" width="42" height="28" rx="3" fill="#0c0804" />
          <rect x="52" y="376" width="15" height="20" rx="2" fill="rgba(90,160,230,.22)" />
          <rect x="68" y="376" width="18" height="20" rx="2" fill="rgba(90,160,230,.17)" />
          <rect x="47" y="369" width="44" height="5" rx="2.5" fill="#0c0804" />
          <circle cx="78" cy="368" r="3.5" fill="#f59e0b" style={{ animation: 'ap-beacon 1.6s ease-in-out infinite' }} />
          {/* Front wheel */}
          <circle cx="14" cy="420" r="14.5" fill="#0c0804" />
          <circle cx="14" cy="420" r="10" fill="#1a1008" />
          <circle cx="14" cy="420" r="4" fill="#0c0804" />
          {Array.from({ length: 6 }).map((_, wi) => { const a = (wi / 6) * Math.PI * 2; return <line key={wi} x1={14 + Math.cos(a) * 6} y1={420 + Math.sin(a) * 6} x2={14 + Math.cos(a) * 12} y2={420 + Math.sin(a) * 12} stroke="#0c0804" strokeWidth="2.5" /> })}
          <rect x="10" y="415" width="16" height="4" rx="1.5" fill="#0c0804" />
          <line x1="88" y1="410" x2="100" y2="422" stroke="#0c0804" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="88" y1="416" x2="100" y2="428" stroke="#0c0804" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="94" y1="407" x2="100" y2="415" stroke="#0c0804" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  )
}

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
      <div className="hidden lg:flex lg:w-1/2 flex-col relative overflow-hidden" style={{ background: '#0b1828' }}>
        {/* Animated agricultural landscape */}
        <div className="absolute inset-0">
          <AgriLandscape />
        </div>
        {/* Subtle gradient overlay for text readability */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, rgba(10,16,10,0.35) 0%, transparent 100%)' }} />

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

          <div className="text-center mt-6 space-y-2">
            <p className="text-sm text-gray-400">Nu ai cont?</p>
            <a
              href="/contact"
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg border-2 text-sm font-semibold transition-all"
              style={{
                borderColor: '#1a3a0e',
                color: '#1a3a0e',
                background: 'transparent'
              }}
              onMouseEnter={e => {
                const el = e.currentTarget as HTMLElement
                el.style.background = '#1a3a0e'
                el.style.color = 'white'
              }}
              onMouseLeave={e => {
                const el = e.currentTarget as HTMLElement
                el.style.background = 'transparent'
                el.style.color = '#1a3a0e'
              }}
            >
              Contactează-ne
            </a>
          </div>
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
