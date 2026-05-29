'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2, Lock, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

export default function SetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [userEmail, setUserEmail] = useState('')

  useEffect(() => {
    const db = createClient()

    async function init() {
      // Hash-based implicit flow: #access_token=...&type=invite
      const hash = window.location.hash.substring(1)
      if (hash) {
        const params = new URLSearchParams(hash)
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        if (accessToken && refreshToken) {
          const { data, error } = await db.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          if (!error && data.user) {
            window.history.replaceState(null, '', window.location.pathname)
            setUserEmail(data.user.email ?? '')
            setSessionReady(true)
            return
          }
        }
      }

      // PKCE flow — session already set via /auth/callback
      const { data: { user } } = await db.auth.getUser()
      if (user) {
        setUserEmail(user.email ?? '')
        setSessionReady(true)
        return
      }

      // Wait for auth state change
      const { data: { subscription } } = db.auth.onAuthStateChange((event, session) => {
        if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user) {
          setUserEmail(session.user.email ?? '')
          setSessionReady(true)
        }
      })
      return () => subscription.unsubscribe()
    }

    init()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { toast.error('Parola trebuie să aibă minim 8 caractere.'); return }
    if (password !== confirm) { toast.error('Parolele nu coincid.'); return }
    setLoading(true)
    const { error } = await createClient().auth.updateUser({ password })
    setLoading(false)
    if (error) { toast.error('Eroare: ' + error.message); return }
    setDone(true)
    setTimeout(() => { window.location.href = '/dashboard' }, 2500)
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col relative overflow-hidden" style={{ background: '#0d2010' }}>
        <img
          src="https://plus.unsplash.com/premium_photo-1661963674367-2be0751cce72?q=80&w=1535&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
          alt="Combina pe câmp"
          className="absolute inset-0 w-full h-full object-cover object-center"
          style={{ opacity: 0.45 }}
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(8,24,10,0.55) 0%, rgba(10,28,12,0.7) 60%, rgba(6,18,8,0.92) 100%)' }} />

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

        <div className="flex-1 flex flex-col justify-center relative z-10 px-10">
          <h2 className="text-4xl font-extrabold text-white leading-tight mb-4">
            Bun venit în<br />
            <span style={{ color: '#4ade80' }}>echipa ArendaPro</span>
          </h2>
          <p className="text-white/55 text-sm leading-relaxed max-w-xs">
            Contul tău a fost creat de administrator. Setează o parolă pentru a accesa platforma.
          </p>
        </div>

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

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col items-center justify-between p-8 bg-white min-h-screen">
        <div className="w-full max-w-sm flex-1 flex flex-col justify-center">

          {done ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle2 className="w-16 h-16 text-emerald-500" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Cont activat!</h1>
              <p className="text-sm text-gray-500">
                Parola a fost setată cu succes. Vei fi redirecționat către dashboard...
              </p>
            </div>
          ) : !sessionReady ? (
            <div className="text-center space-y-4">
              <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mx-auto" />
              <p className="text-sm text-gray-500">Se verifică invitația...</p>
              <p className="text-xs text-gray-400">
                Dacă această pagină nu se încarcă, linkul din email poate fi expirat.{' '}
                <a href="mailto:Admin@ArendaPro.com" className="text-[#2d6a4f] hover:underline">Contactează administratorul</a>.
              </p>
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">Activează contul</h1>
              <p className="text-sm text-gray-400 mb-2">
                {userEmail && <span className="font-medium text-gray-600">{userEmail}</span>}
              </p>
              <p className="text-sm text-gray-400 mb-8">Setează o parolă pentru a-ți activa contul ArendaPro</p>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Parolă nouă</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="minim 8 caractere"
                      className="w-full pl-10 pr-11 py-3 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2d6a4f] focus:border-transparent transition"
                      required minLength={8} autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirmă parola</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirm}
                      onChange={e => setConfirm(e.target.value)}
                      placeholder="repetă parola"
                      className={`w-full pl-10 pr-11 py-3 text-sm rounded-lg border bg-white focus:outline-none focus:ring-2 focus:ring-[#2d6a4f] focus:border-transparent transition ${confirm && confirm !== password ? 'border-red-300' : 'border-gray-200'}`}
                      required autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirm && confirm !== password && (
                    <p className="text-xs text-red-500 mt-1">Parolele nu coincid</p>
                  )}
                </div>

                {password.length > 0 && (
                  <div className="flex gap-1.5 items-center">
                    {[password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password)].map((ok, i) => (
                      <div key={i} className={`flex-1 h-1 rounded-full transition-colors ${ok ? 'bg-emerald-500' : 'bg-gray-200'}`} />
                    ))}
                    <span className="text-xs text-gray-400 ml-1 whitespace-nowrap">
                      {password.length < 8 ? 'Prea scurtă' : /[A-Z]/.test(password) && /[0-9]/.test(password) ? 'Puternică' : 'Acceptabilă'}
                    </span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !password || password !== confirm}
                  className="w-full flex justify-center items-center gap-2 text-white font-semibold py-3 rounded-lg text-sm transition-colors disabled:opacity-60"
                  style={{ background: '#1a3a0e' }}
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? 'Se activează...' : 'Activează contul →'}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="w-full flex items-center justify-between pt-6 border-t border-gray-100">
          <p className="text-xs text-gray-400">© 2026 ArendaPro · Toate drepturile rezervate</p>
          <button className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 text-xs font-bold">?</button>
        </div>
      </div>
    </div>
  )
}
