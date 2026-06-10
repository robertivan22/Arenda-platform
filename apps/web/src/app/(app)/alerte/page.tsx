'use client'
export const runtime = 'edge'

import AlertsDashboard from '@/components/AlertsDashboard'
import AssistantChat from '@/components/AssistantChat'
import { useState } from 'react'
import { Shield, MessageSquare } from 'lucide-react'

export default function AlertePage() {
  const [tab, setTab] = useState<'alerte' | 'chat'>('alerte')

  return (
    <div>
      {/* Page sub-nav */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        <button onClick={() => setTab('alerte')}
          className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            tab === 'alerte' ? 'bg-white shadow text-brand-700' : 'text-gray-500 hover:text-gray-700'
          }`}>
          <Shield className="w-4 h-4" /> Alerte & Analiză
        </button>
        <button onClick={() => setTab('chat')}
          className={`flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
            tab === 'chat' ? 'bg-white shadow text-brand-700' : 'text-gray-500 hover:text-gray-700'
          }`}>
          <MessageSquare className="w-4 h-4" /> Chat AI
        </button>
      </div>

      {tab === 'alerte' ? <AlertsDashboard /> : <AssistantChat />}
    </div>
  )
}
