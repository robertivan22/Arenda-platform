'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Mail, Phone, MapPin, User, Building2, MessageSquare, Send, CheckCircle2 } from 'lucide-react'

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [company, setCompany] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { error } = await createClient()
      .from('contact_messages')
      .insert({ name, email, phone: phone || null, company: company || null, message })
    setLoading(false)
    if (error) {
      alert('Eroare la trimitere. Încearcă din nou.')
      return
    }
    setShowModal(true)
  }

  return (
    <div className="min-h-screen flex">

      {/* ── Success Modal ─────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.55)' }}>
          <div className="bg-white rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircle2 className="w-9 h-9 text-emerald-500" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Mesaj trimis!</h2>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Mesajul a fost trimis. Echipa noastră vă va contacta în cel mai scurt timp.
            </p>
            <button
              onClick={() => { setShowModal(false); window.location.href = '/login' }}
              className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-colors"
              style={{ background: '#1a3a0e' }}
            >
              Înapoi la login
            </button>
          </div>
        </div>
      )}

      {/* ── Left panel ─────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col relative overflow-hidden" style={{ background: '#0d2010' }}>
        <img
          src="https://plus.unsplash.com/premium_photo-1661963674367-2be0751cce72?q=80&w=1535&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
          alt="Combina pe câmp"
          className="absolute inset-0 w-full h-full object-cover object-center"
          style={{ opacity: 0.45 }}
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(8,24,10,0.55) 0%, rgba(10,28,12,0.7) 60%, rgba(6,18,8,0.92) 100%)' }} />

        {/* Logo */}
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

        {/* Hero */}
        <div className="flex-1 flex flex-col justify-center relative z-10 px-10">
          <div className="inline-block mb-5">
            <span className="px-3 py-1.5 rounded-full border border-amber-500/40 text-amber-400 text-xs font-semibold tracking-wider uppercase">
              Suntem aici pentru tine
            </span>
          </div>
          <h2 className="text-4xl font-extrabold text-white leading-tight mb-4">
            Hai să vorbim<br />
            <span style={{ color: '#4ade80' }}>despre terenurile</span><br />
            tale agricole
          </h2>
          <p className="text-white/55 text-sm leading-relaxed max-w-xs mb-8">
            Echipa noastră îți răspunde în maximum 24 de ore.<br />
            Completează formularul și te contactăm noi.
          </p>

          {/* Contact info */}
          <div className="space-y-3">
            {[
              { icon: Mail, text: 'admin@arendapro.com' },
              { icon: Phone, text: '0720809872' },
              { icon: MapPin, text: 'București, România' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.25)' }}>
                  <Icon className="w-4 h-4 text-[#4ade80]" />
                </div>
                <span className="text-white/70 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Wheat illustration */}
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

      {/* ── Right panel ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-between p-8 bg-white min-h-screen overflow-y-auto">
        <div className="w-full max-w-sm flex-1 flex flex-col justify-center py-6">

          {/* Logo */}
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
              <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white"><path d="M17,8C8,10,5.9,16.17,3.82,21.34L5.71,22l1-2.3A4.49,4.49,0,0,0,8,20C19,20,22,3,22,3,21,5,14,5.25,9,6.25S2,11.5,2,13.5a6.22,6.22,0,0,0,.05,1A10.66,10.66,0,0,1,8.26,9.4C8.26,9.4,4,11,4,13h0c0-2,7-4.9,13-5C17,8,17,8,17,8Z"/></svg>
            </div>
            <span className="font-bold text-gray-800">ArendaPro</span>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-1">Contactează-ne</h1>
          <p className="text-sm text-gray-400 mb-6">
            Mesajul tău va fi trimis direct către{' '}
            <span className="text-[#16a34a] font-medium">admin@arendapro.com</span>
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Numele tău */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Numele tău <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  placeholder="Ion Popescu"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2d6a4f] focus:border-transparent transition"
                  required />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Email <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="ion@firma.ro"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2d6a4f] focus:border-transparent transition"
                  required />
              </div>
            </div>

            {/* Telefon */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Număr de telefon</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+40 700 000 000"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2d6a4f] focus:border-transparent transition" />
              </div>
            </div>

            {/* Firma */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Firma</label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" value={company} onChange={e => setCompany(e.target.value)}
                  placeholder="Agro SRL"
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2d6a4f] focus:border-transparent transition" />
              </div>
            </div>

            {/* Mesaj */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Mesaj <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <MessageSquare className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                <textarea value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="Descrie pe scurt cum te putem ajuta..."
                  rows={4}
                  className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#2d6a4f] focus:border-transparent transition resize-none"
                  required />
              </div>
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading}
              className="w-full flex justify-center items-center gap-2 text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-60"
              style={{ background: '#1a3a0e' }}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {loading ? 'Se trimite...' : 'Trimite mesajul'}
            </button>

            <p className="text-center text-xs text-gray-400">
              Îți răspundem în maximum <span className="font-semibold text-gray-600">24 de ore</span>
            </p>
          </form>
        </div>

        {/* Footer */}
        <div className="w-full flex items-center justify-between pt-6 border-t border-gray-100">
          <p className="text-xs text-gray-400">· © 2026 ArendaPro · Toate drepturile rezervate ·</p>
          <button className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-gray-600 text-xs font-bold">?</button>
        </div>
      </div>
    </div>
  )
}
