'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, X, ChevronRight, User, Building2, Users } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import type { LandlordSearchResult, LessorType } from '@/types/distribuire'

interface Props {
  onSelect: (landlord: LandlordSearchResult) => void
  selectedId?: string | null
  onClear?: () => void
}

type FilterType = 'ALL' | 'PF' | 'PJ'

function getInitials(l: LandlordSearchResult): string {
  if (l.type === 'LEGAL') {
    return (l.company_name ?? 'SC').slice(0, 2).toUpperCase()
  }
  const first = (l.first_name ?? '').charAt(0).toUpperCase()
  const last = (l.last_name ?? '').charAt(0).toUpperCase()
  return `${last}${first}`
}

function getDisplayName(l: LandlordSearchResult): string {
  if (l.type === 'LEGAL') return l.company_name ?? ''
  return `${l.last_name} ${l.first_name}`.trim()
}

const AVATAR_COLORS: Record<LessorType, string> = {
  NATURAL: 'bg-brand-100 text-brand-700',
  PFA: 'bg-blue-100 text-blue-700',
  LEGAL: 'bg-purple-100 text-purple-700',
}

export function SearchArendator({ onSelect, selectedId, onClear }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterType>('ALL')
  const [results, setResults] = useState<LandlordSearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [selectedLandlord, setSelectedLandlord] = useState<LandlordSearchResult | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const doSearch = useCallback(
    async (q: string, f: FilterType) => {
      if (q.trim().length < 1) {
        setResults([])
        setOpen(false)
        return
      }
      setLoading(true)
      try {
        const supabase = createClient()
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let dbQuery: any = supabase
          .from('lessors')
          .select('id, code, type, first_name, last_name, company_name, cnp, county, locality, status')
          .eq('status', 'ACTIVE')
          .limit(20)
        if (f === 'PF') dbQuery = dbQuery.in('type', ['NATURAL', 'PFA'])
        else if (f === 'PJ') dbQuery = dbQuery.eq('type', 'LEGAL')
        const isNumeric = /^\d+$/.test(q.trim())
        if (isNumeric) {
          dbQuery = dbQuery.ilike('cnp', `${q.trim()}%`)
        } else {
          dbQuery = dbQuery.or(
            `last_name.ilike.%${q.trim()}%,first_name.ilike.%${q.trim()}%,company_name.ilike.%${q.trim()}%,locality.ilike.%${q.trim()}%`,
          )
        }
        const { data } = await dbQuery
        setResults((data ?? []) as LandlordSearchResult[])
        setOpen(true)
      } catch {
        setResults([])
        setOpen(true)
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void doSearch(query, filter)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, filter, doSearch])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleSelect(l: LandlordSearchResult) {
    setSelectedLandlord(l)
    setQuery('')
    setOpen(false)
    setResults([])
    onSelect(l)
  }

  function handleClear() {
    setSelectedLandlord(null)
    setQuery('')
    setResults([])
    setOpen(false)
    onClear?.()
  }

  const FILTER_BUTTONS: { key: FilterType; label: string }[] = [
    { key: 'ALL', label: 'Toți' },
    { key: 'PF', label: 'PF' },
    { key: 'PJ', label: 'PJ' },
  ]

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center">
            <span className="text-white text-xs">✓</span>
          </div>
          <span className="text-sm font-semibold text-gray-700">Caută arendator</span>
        </div>
        {selectedLandlord && (
          <button
            onClick={handleClear}
            className="text-xs text-brand-600 hover:text-brand-800 font-medium transition-colors"
          >
            × Schimbă
          </button>
        )}
      </div>

      {/* Filter buttons */}
      <div className="flex gap-1 mb-3">
        {FILTER_BUTTONS.map((btn) => (
          <button
            key={btn.key}
            onClick={() => setFilter(btn.key)}
            className={clsx(
              'px-3 py-1 text-xs font-semibold rounded transition-colors',
              filter === btn.key
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Search input */}
      <div ref={containerRef} className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.trim().length >= 1 && results.length > 0 && setOpen(true)}
            placeholder="Caută după CNP, nume sau localitate"
            className="w-full pl-9 pr-9 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setResults([]); setOpen(false) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Dropdown results */}
        {open && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
            {loading && (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">Se caută...</div>
            )}
            {!loading && results.length === 0 && (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                Niciun arendator găsit
              </div>
            )}
            {!loading &&
              results.map((l) => (
                <button
                  key={l.id}
                  onClick={() => handleSelect(l)}
                  className="w-full text-left px-3 py-2.5 hover:bg-gray-50 flex items-center gap-3 border-b border-gray-100 last:border-0 transition-colors"
                >
                  {/* Avatar */}
                  <div
                    className={clsx(
                      'w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                      AVATAR_COLORS[l.type],
                    )}
                  >
                    {getInitials(l)}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {getDisplayName(l)}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">{l.cnp}</span>
                      <span className="text-gray-300">·</span>
                      <span className="text-xs text-gray-500">{l.county}</span>
                      {l.locality && (
                        <>
                          <span className="text-gray-300">,</span>
                          <span className="text-xs text-gray-500">{l.locality}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Type badge */}
                  <span
                    className={clsx(
                      'px-1.5 py-0.5 text-2xs font-semibold rounded flex-shrink-0',
                      l.type === 'LEGAL'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-brand-100 text-brand-700',
                    )}
                  >
                    {l.type === 'LEGAL' ? 'PJ' : 'PF'}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                </button>
              ))}
          </div>
        )}
      </div>

      {/* Selected landlord card */}
      {selectedLandlord && (
        <div className="mt-3 flex items-center gap-3 p-3 bg-brand-50 rounded-lg border border-brand-200">
          <div
            className={clsx(
              'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
              AVATAR_COLORS[selectedLandlord.type],
            )}
          >
            {getInitials(selectedLandlord)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-gray-900">{getDisplayName(selectedLandlord)}</div>
            <div className="text-xs text-gray-500">
              {selectedLandlord.cnp} · {selectedLandlord.county}, {selectedLandlord.locality}
            </div>
          </div>
          {selectedLandlord.type === 'LEGAL' ? (
            <Building2 className="w-5 h-5 text-purple-500 flex-shrink-0" />
          ) : (
            <User className="w-5 h-5 text-brand-500 flex-shrink-0" />
          )}
        </div>
      )}
    </div>
  )
}
