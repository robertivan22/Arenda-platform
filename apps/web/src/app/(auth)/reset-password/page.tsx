'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Eye, EyeOff, Loader2, Lock, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    const db = createClient()

    async function init() {
      // ── 1. Hash-based implicit flow (supabase.co/auth/v1/verify redirect) ──
      // Supabase appends #access_token=...&refresh_token=...&type=recovery
      const hash = window.location.hash.substring(1)
      if (hash) {
        const params = new URLSearchParams(hash)
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        if (accessToken && refreshToken) {
          const { error } = await db.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          if (!error) {
            // Clean the hash from the URL bar without triggering a reload
            window.history.replaceState(null, '', window.location.pathname)
            setSessionReady(true)
            return
          }
        }
      }

      // ── 2. PKCE flow — session already in cookies after callback ──
      const { data: { user } } = await db.auth.getUser()
      if (user) { setSessionReady(true); return }

      // ── 3. Wait for onAuthStateChange (PASSWORD_RECOVERY event) ──
      const { data: { subscription } } = db.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
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
      {/* ── Left panel (image) ── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col relative overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1717702576954-c07131c54169?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwzfHxhZ3JpY3VsdHVyYWwlMjB0cmFjdG9yJTIwZmllbGQlMjBnb2xkZW58ZW58MXx8fHwxNzc5OTY0ODI2fDA&ixlib=rb-4.1.0&q=80&w=1080"
          alt="Tractor pe câmp la apus"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, rgba(22,42,22,0.93) 0%, rgba(26,51,32,0.82) 45%, rgba(15,34,16,0.72) 100%)' }} />
        <div className="px-10 pt-10 flex items-center gap-3 relative z-10">
          <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C8.5 2 6 4.5 6 4.5S3 7 3 10.5c0 2.8 1.8 5.2 4 6.5V20h2v-2h6v2h2v-3c2.2-1.3 4-3.7 4-6.5C21 7 18 2 12 2zm-2 14H8v-1.5C6.8 13.6 6 12.1 6 10.5 6 8 7.8 5.5 10 4.3V16zm6 0h-2V4.3c2.2 1.2 4 3.7 4 6.2 0 1.6-.8 3.1-2 4V16z"/>
            </svg>
          </div>
          <span className="text-xl font-bold text-white">Arenda<span className="text-amber-400">Pro</span></span>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center relative z-10 px-10">
          <h2 className="text-3xl font-bold text-white text-center mb-3 leading-tight drop-shadow-lg">
            Securitate contului tău
          </h2>
          <p className="text-[#74c69d] text-center text-sm leading-relaxed max-w-xs drop-shadow">
            Setează o parolă nouă, sigură, pentru a-ți proteja datele agricole.
          </p>
        </div>
        <div className="px-10 pb-4 text-[#52b788] text-xs relative z-10">
          © 2026 ArendaPro — Toate drepturile rezervate
        </div>
      </div>

      {/* ── Right panel (form) ── */}
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

          {done ? (
            /* ── Success state ── */
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <CheckCircle2 className="w-16 h-16 text-emerald-500" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">Parolă actualizată!</h1>
              <p className="text-sm text-gray-500">
                Parola a fost schimbată cu succes. Vei fi redirecționat către dashboard...
              </p>
            </div>
          ) : !sessionReady ? (
            /* ── Waiting for session ── */
            <div className="text-center space-y-4">
              <Loader2 className="w-10 h-10 text-emerald-600 animate-spin mx-auto" />
              <p className="text-sm text-gray-500">Se verifică linkul de resetare...</p>
              <p className="text-xs text-gray-400">
                Dacă această pagină nu se încarcă, linkul din email poate fi expirat.{' '}
                <a href="/login" className="text-[#2d6a4f] hover:underline">Solicită un link nou</a>.
              </p>
            </div>
          ) : (
            /* ── Password form ── */
            <>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">Parolă nouă</h1>
              <p className="text-sm text-gray-500 mb-8">Introdu noua parolă pentru contul tău ArendaPro</p>

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
                      className="w-full pl-10 pr-11 py-3 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2d6a4f] focus:border-transparent transition"
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
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
                      className={`w-full pl-10 pr-11 py-3 text-sm rounded-xl border bg-white focus:outline-none focus:ring-2 focus:ring-[#2d6a4f] focus:border-transparent transition ${
                        confirm && confirm !== password ? 'border-red-300' : 'border-gray-200'
                      }`}
                      required
                      autoComplete="new-password"
                    />
                    <button type="button" onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirm && confirm !== password && (
                    <p className="text-xs text-red-500 mt-1">Parolele nu coincid</p>
                  )}
                </div>

                {/* Password strength hint */}
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
                  className="w-full flex justify-center items-center gap-2 bg-[#1e3a22] hover:bg-[#2d6a4f] text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-60"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {loading ? 'Se salvează...' : 'Setează parola nouă →'}
                </button>
              </form>
            </>
          )}

          <p className="text-center text-sm text-gray-400 mt-6">
            <a href="/login" className="hover:text-[#2d6a4f] hover:underline transition-colors">← Înapoi la autentificare</a>
          </p>
        </div>
      </div>
    </div>
  )
}
