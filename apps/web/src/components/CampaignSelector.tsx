'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Campaign } from '@/lib/campaign-types'
import { ChevronDown } from 'lucide-react'

interface CampaignSelectorProps {
  /** Called whenever the active campaign changes */
  onChange?: (campaign: Campaign | null) => void
  className?: string
}

/**
 * Compact campaign selector — shows the active campaign and lets the user
 * switch between campaigns.  Intended for use in page headers or filter bars.
 */
export function CampaignSelector({ onChange, className = '' }: CampaignSelectorProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selected, setSelected] = useState<Campaign | null>(null)
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    const db = createClient()
    const { data } = await db
      .from('campaigns')
      .select('*')
      .order('year', { ascending: false })
    if (data && data.length > 0) {
      const list = data as Campaign[]
      setCampaigns(list)
      const active = list.find(c => c.is_active) ?? list[0]
      setSelected(active)
      onChange?.(active)
    }
  }, [onChange])

  useEffect(() => { void load() }, [load])

  async function select(c: Campaign) {
    setSelected(c)
    setOpen(false)
    onChange?.(c)
  }

  if (campaigns.length === 0) return null

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-brand-50 border border-brand-200 text-brand-700 rounded-lg hover:bg-brand-100 transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-brand-500 flex-shrink-0" />
        {selected?.name ?? 'Campanie'}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 min-w-[180px] bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
          {campaigns.map(c => (
            <button
              key={c.id}
              onClick={() => void select(c)}
              className={`w-full text-left px-3 py-2.5 text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors ${
                selected?.id === c.id ? 'bg-brand-50 font-medium text-brand-700' : 'text-gray-700'
              }`}
            >
              {c.is_active && <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />}
              {!c.is_active && <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />}
              {c.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
