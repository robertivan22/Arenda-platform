'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Search, X, MapPin, Loader2 } from 'lucide-react'

interface SirutaRow {
  code: string
  name: string | null
  type: string | null
  county: string | null
}

interface Props {
  county: string       // pre-filter by county (from form)
  locality: string     // pre-filter by locality (from form)
  value: string        // current SIRUTA code
  onChange: (code: string, name: string) => void
  inputClassName?: string
}

export default function SirutaLookup({ county, locality, value, onChange, inputClassName }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [countyFilter, setCountyFilter] = useState('')
  const [localityFilter, setLocalityFilter] = useState('')
  const [results, setResults] = useState<SirutaRow[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedName, setSelectedName] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // When modal opens, pre-fill filters from parent form
  function openModal() {
    setCountyFilter(county)
    setLocalityFilter(locality)
    setQuery('')
    setOpen(true)
  }

  // Auto-search whenever filters change (with debounce)
  const doSearch = useCallback(async (q: string, cf: string, lf: string) => {
    setLoading(true)
    const db = createClient()
    let builder = db
      .from('siruta')
      .select('code, name, type, county')
      .order('county', { ascending: true })
      .order('name', { ascending: true })
      .limit(80)

    if (cf.trim()) builder = builder.ilike('county', `%${cf.trim()}%`)
    if (q.trim()) {
      builder = builder.ilike('name', `%${q.trim()}%`)
    } else if (lf.trim()) {
      builder = builder.ilike('name', `%${lf.trim()}%`)
    }

    const { data, error } = await builder
    if (!error) setResults((data ?? []) as SirutaRow[])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!open) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      void doSearch(query, countyFilter, localityFilter)
    }, 250)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [open, query, countyFilter, localityFilter, doSearch])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50)
  }, [open])

  function handleSelect(row: SirutaRow) {
    onChange(row.code, row.name ?? '')
    setSelectedName(row.name ?? '')
    setOpen(false)
  }

  function clearValue() {
    onChange('', '')
    setSelectedName('')
  }

  return (
    <>
      {/* ── Inline field ── */}
      <div className="flex gap-1.5">
        <input
          type="text"
          readOnly
          value={value ? `${value}${selectedName ? ` — ${selectedName}` : ''}` : ''}
          placeholder="Cod SIRUTA..."
          className={`flex-1 ${inputClassName ?? 'w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none'} bg-gray-50 cursor-default`}
          onClick={openModal}
        />
        {value && (
          <button type="button" onClick={clearValue}
            className="px-2 text-gray-400 hover:text-red-500 transition-colors border border-gray-300 rounded text-xs">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <button
          type="button"
          onClick={openModal}
          className="px-3 py-1.5 text-xs font-semibold text-white rounded transition-colors whitespace-nowrap"
          style={{ background: '#1a3a0e' }}
        >
          <span className="flex items-center gap-1">
            <MapPin className="w-3.5 h-3.5" />
            Lookup
          </span>
        </button>
      </div>

      {/* ── Modal ── */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col" style={{ maxHeight: '85vh' }}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <div>
                <h3 className="font-semibold text-gray-800 text-sm">Caută cod SIRUTA</h3>
                <p className="text-xs text-gray-400 mt-0.5">Baza de date SIRUTA 2025 — INS România</p>
              </div>
              <button onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filters */}
            <div className="px-4 py-3 border-b border-gray-100 space-y-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Județ</label>
                  <input
                    type="text"
                    value={countyFilter}
                    onChange={e => setCountyFilter(e.target.value)}
                    placeholder="ex: PRAHOVA"
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Localitate / Căutare</label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                      ref={inputRef}
                      type="text"
                      value={query || localityFilter}
                      onChange={e => {
                        setQuery(e.target.value)
                        setLocalityFilter('')
                      }}
                      placeholder="ex: Rafov"
                      className="w-full pl-8 pr-2.5 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              </div>
              {countyFilter && (
                <p className="text-[11px] text-emerald-600 font-medium">
                  Filtrare activă: <span className="font-bold">{countyFilter.toUpperCase()}</span>
                  {(query || localityFilter) && <> › <span className="font-bold">{query || localityFilter}</span></>}
                </p>
              )}
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 text-green-600 animate-spin mr-2" />
                  <span className="text-sm text-gray-400">Se caută...</span>
                </div>
              ) : results.length === 0 ? (
                <div className="py-12 text-center text-sm text-gray-400">
                  Niciun rezultat.{' '}
                  {!countyFilter && <span>Introdu un județ pentru a filtra.</span>}
                </div>
              ) : (
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Cod</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Denumire</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tip</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Județ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map(row => (
                      <tr
                        key={row.code}
                        onClick={() => handleSelect(row)}
                        className={`border-b border-gray-50 cursor-pointer transition-colors hover:bg-green-50 ${
                          row.code === value ? 'bg-green-50 font-semibold' : ''
                        }`}
                      >
                        <td className="px-4 py-2 font-mono text-xs text-gray-600 whitespace-nowrap">
                          {row.code}
                          {row.code === value && <span className="ml-1.5 text-[10px] text-green-600">✓</span>}
                        </td>
                        <td className="px-4 py-2 text-gray-800">{row.name ?? '—'}</td>
                        <td className="px-4 py-2 text-xs text-gray-400">{row.type ?? '—'}</td>
                        <td className="px-4 py-2 text-xs text-gray-500">{row.county ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {results.length === 80 && (
                <p className="text-center text-xs text-gray-400 py-2">
                  Afișate primele 80 rezultate — restrânge căutarea pentru mai multă precizie.
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400">{results.length} rezultate</p>
              <button onClick={() => setOpen(false)}
                className="px-4 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Închide
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
