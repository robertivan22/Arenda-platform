'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, MessageSquare, Bot, User } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

export default function AssistantChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Salut! Sunt ArendaAI, asistentul tău agricol. Pot să răspund la întrebări despre contracte, activități de câmp, stocuri și tranzacții. Cu ce te pot ajuta?',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const q = input.trim()
    if (!q || loading) return
    setInput('')

    const userMsg: Message = { role: 'user', content: q, timestamp: new Date() }
    setMessages(prev => [...prev, userMsg])
    setLoading(true)

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'qa', question: q }),
      })
      const json = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: json.ok ? (json.answer ?? 'Nu am primit un răspuns.') : (json.error ?? 'Eroare AI.'),
        timestamp: new Date(),
      }])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Eroare la contactarea serverului AI. Încearcă din nou.',
        timestamp: new Date(),
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden h-[560px]">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 bg-brand-600 text-white flex-shrink-0">
        <Bot className="w-5 h-5" />
        <div>
          <p className="text-sm font-semibold">ArendaAI</p>
          <p className="text-xs text-brand-200">Asistent agricol inteligent</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-2 h-2 bg-green-400 rounded-full" />
          <span className="text-xs text-brand-200">Online</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
              msg.role === 'assistant' ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}>
              {msg.role === 'assistant' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>
            <div className={`max-w-[78%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-brand-600 text-white rounded-tr-sm'
                : 'bg-gray-100 text-gray-800 rounded-tl-sm'
            }`}>
              {msg.content}
              <p className={`text-[10px] mt-1 ${msg.role === 'user' ? 'text-brand-200' : 'text-gray-400'}`}>
                {msg.timestamp.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center flex-shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-3.5 py-3 flex gap-1 items-center">
              {[0, 150, 300].map(d => (
                <span key={d} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={send} className="flex items-center gap-2 p-3 border-t border-gray-100 flex-shrink-0">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={loading}
          placeholder="Scrie o întrebare despre fermă, contracte sau stocuri..."
          className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50"
        />
        <button type="submit" disabled={loading || !input.trim()}
          className="p-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl disabled:opacity-40 transition-colors flex-shrink-0">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  )
}
