'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { Building2, Eye, EyeOff, Loader2, Mail, Lock, MapPin, FileText, Shield } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

type Tab = 'password' | 'magic'

export default function LoginPage() {
  const router = useRouter()
  const { signInWithPassword, signInWithMagicLink } = useAuthStore()
  const [tab, setTab] = useState<Tab>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [magicSent, setMagicSent] = useState(false)

  async function handlePasswordLogin(e: React.FormEvent) {
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
