'use client'

export const runtime = 'edge'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, Search, SlidersHorizontal, Columns, Download, MapIcon,
  X, ChevronUp, ChevronDown, MapPin, Users, Activity, Layers, Pencil, Trash2, Eye, AlertTriangle, Upload, Check, Loader2,
} from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import { toast } from 'sonner'

interface Parcel {
  id: string
  bloc_fizic: string | null
  tarla_nr: string | null
  parcel_nr: string | null
  nr_cadastral: string | null
  county: string | null
  locality: string | null
  surface: number
  status: string
  land_use_category: string | null
  culture: string | null
  apia_eligible: boolean | null
  siruta_code: string | null
  lat: number | null
  lng: number | null
  created_at: string
  lessor_id: string | null
  contract_id: string | null
  lessor_name: string
  contract_number: string | null
  contract_end_date: string | null
}

interface LessorOption { id: string; name: string }
interface ContractOption { id: string; contract_number: string; lessor_id: string | null }

const CULTURE_COLORS: Record<string, string> = {
  'Grau':              'bg-amber-100 text-amber-700',
  'Grâu':              'bg-amber-100 text-amber-700',
  'Porumb':            'bg-yellow-100 text-yellow-700',
  'Floarea-soarelui':  'bg-orange-100 text-orange-700',
  'Rapita':            'bg-green-100 text-green-700',
  'Rapița':            'bg-green-100 text-green-700',
  'Soia':              'bg-lime-100 text-lime-700',
  'Orz':               'bg-teal-100 text-teal-700',
  'Ovaz':              'bg-blue-100 text-blue-700',
  'Ovăz':              'bg-blue-100 text-blue-700',
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE:   'bg-green-100 text-green-700',
  INACTIVE: 'bg-gray-100 text-gray-500',
  EXPIRED:  'bg-red-100 text-red-600',
}
const STATUS_LABELS: Record<string, string> = {
  ACTIVE: 'ACTIV', INACTIVE: 'INACTIV', EXPIRED: 'EXPIRAT',
}

const ALL_COLS = [
  { key: 'bloc_fizic',       label: 'Bloc Fizic' },
  { key: 'tarla_nr',         label: 'Tarla' },
  { key: 'parcel_nr',        label: 'Nr. Parcelă' },
  { key: 'siruta_code',      label: 'Sirută' },
  { key: 'county',           label: 'Județ' },
  { key: 'locality',         label: 'Localitate' },
  { key: 'surface',          label: 'Suprafață (HA)' },
  { key: 'lessor_name',      label: 'Arendator' },
  { key: 'nr_cadastral',     label: 'Nr. Cadastral' },
  { key: 'culture',          label: 'Cultură' },
  { key: 'contract_number',  label: 'Contract' },
  { key: 'created_at',       label: 'Data Înreg.' },
  { key: 'apia_eligible',    label: 'APIA Eligibil' },
  { key: 'status',           label: 'Status' },
]

const PAGE_SIZE = 15

export default function ParceleListPage() {
  const router = useRouter()
  const [rows, setRows] = useState<Parcel[]>([])
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState({ judet: '', status: '', cultura: '', arendator: '', apiaEligibil: '' })
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [sortCol, setSortCol] = useState('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(ALL_COLS.map(c => c.key)))
  const [showColSelector, setShowColSelector] = useState(false)
  const colRef = useRef<HTMLDivElement>(null)

  // Inline editing — dropdowns
  const [editingCell, setEditingCell] = useState<{ id: string; field: 'lessor' | 'contract' } | null>(null)
  const [savingCell, setSavingCell] = useState(false)
  const [lessors, setLessors] = useState<LessorOption[]>([])
  const [contracts, setContracts] = useState<ContractOption[]>([])
  // Inline editing — text fields
  const [editingText, setEditingText] = useState<{ id: string; field: 'tarla_nr' | 'parcel_nr'; value: string } | null>(null)
  const [savingText, setSavingText] = useState(false)

  useEffect(() => {
    const db = createClient()
    // Always scope to the authenticated user (defense-in-depth on top of RLS)
    db.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      const uid = user.id
      db.from('parcels')
        .select('*, lessors(first_name, last_name, company_name, type), contracts(contract_number, end_date)')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(2000)
        .then(({ data, error }) => {
          if (error) { toast.error('Eroare la încărcarea parcelelor.'); return }
          if (data) setRows((data as any[]).map(p => ({
            ...p,
            lessor_name: p.lessors
              ? (p.lessors.type === 'LEGAL'
                  ? p.lessors.company_name
                  : `${p.lessors.last_name} ${p.lessors.first_name}`.trim())
              : '—',
            contract_number:  p.contracts?.contract_number ?? null,
            contract_end_date: p.contracts?.end_date ?? null,
          })))
        })
      // Load lessors + contracts for inline editing dropdowns
      db.from('lessors')
        .select('id, first_name, last_name, company_name, type')
        .eq('user_id', uid)
        .eq('status', 'ACTIVE')
        .order('last_name')
        .limit(500)
        .then(({ data }) => {
          if (data) setLessors((data as any[]).map(l => ({
            id: l.id,
            name: l.type === 'LEGAL'
              ? l.company_name
              : `${l.last_name} ${l.first_name}`.trim(),
          })))
        })
      db.from('contracts')
        .select('id, contract_number, lessor_id')
        .eq('user_id', uid)
        .eq('status', 'ACTIVE')
        .order('contract_number')
        .limit(500)
        .then(({ data }) => { if (data) setContracts(data as ContractOption[]) })
    })
  }, [])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (colRef.current && !colRef.current.contains(e.target as Node)) setShowColSelector(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Unique dropdown values
  const uniqueJudete    = useMemo(() => [...new Set(rows.map(r => r.county).filter(Boolean))].sort() as string[], [rows])
  const uniqueCulturi   = useMemo(() => [...new Set(rows.map(r => r.culture).filter(Boolean))].sort() as string[], [rows])
  const uniqueArendatori = useMemo(() => [...new Set(rows.map(r => r.lessor_name).filter(v => v !== '—'))].sort(), [rows])

  // Filter + search
  const filtered = useMemo(() => rows.filter(r => {
    if (filters.judet    && r.county      !== filters.judet)    return false
    if (filters.status   && r.status       !== filters.status)   return false
    if (filters.cultura  && r.culture      !== filters.cultura)  return false
    if (filters.arendator && r.lessor_name !== filters.arendator) return false
    if (filters.apiaEligibil) {
      const want = filters.apiaEligibil === 'da'
      if (r.apia_eligible !== want) return false
    }
    if (search) {
      const q = search.toLowerCase()
      return (r.bloc_fizic ?? '').toLowerCase().includes(q)
          || r.lessor_name.toLowerCase().includes(q)
          || (r.locality ?? '').toLowerCase().includes(q)
          || (r.nr_cadastral ?? '').toLowerCase().includes(q)
          || (r.county ?? '').toLowerCase().includes(q)
    }
    return true
  }), [rows, filters, search])

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const va = String((a as any)[sortCol] ?? '')
    const vb = String((b as any)[sortCol] ?? '')
    const cmp = va.localeCompare(vb, 'ro', { numeric: true })
    return sortDir === 'asc' ? cmp : -cmp
  }), [filtered, sortCol, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const selectedParcel = rows.find(r => r.id === selectedId) ?? null
  const deleteParcel = rows.find(r => r.id === deleteId) ?? null
  const isMobile = useIsMobile()

  // KPIs
  const totalHa      = rows.reduce((s, r) => s + Number(r.surface ?? 0), 0)
  const activeCount  = rows.filter(r => r.status === 'ACTIVE').length
  const inactiveCount = rows.filter(r => r.status !== 'ACTIVE').length
  const uniqueLessors = new Set(rows.filter(r => r.lessor_id).map(r => r.lessor_id)).size

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
    setPage(1)
  }

  function setFilter(key: string, value: string) {
    setFilters(p => ({ ...p, [key]: value }))
    setPage(1)
  }

  function exportCSV() {
    const visibleList = ALL_COLS.filter(c => visibleCols.has(c.key))
    const headers = visibleList.map(c => c.label)
    const csvRows = sorted.map(r => visibleList.map(c => {
      const v = (r as any)[c.key]
      if (c.key === 'apia_eligible') return v === true ? 'Da' : v === false ? 'Nu' : ''
      if (c.key === 'created_at')    return v ? String(v).split('T')[0] : ''
      if (c.key === 'status')        return STATUS_LABELS[v] ?? v ?? ''
      return v ?? ''
    }))
    const csv = [headers, ...csvRows]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\r\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `parcele-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function viewOnMap(p: Parcel) {
    if (p.lat && p.lng) {
      router.push(`/parcele/harta?lat=${p.lat}&lng=${p.lng}&zoom=15`)
    } else {
      router.push('/parcele/harta')
    }
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    const db = createClient()
    // 1. Delete associated map polygon from parcele_fitosanitar
    await db.from('parcele_fitosanitar').delete().eq('parcela_id', deleteId)
    // 2. Delete registry entry
    const { error } = await db.from('parcels').delete().eq('id', deleteId)
    setDeleting(false)
    if (error) { toast.error('Eroare la ștergere: ' + error.message); return }
    toast.success('Parcela ștearsă.')
    setRows(prev => prev.filter(r => r.id !== deleteId))
    if (selectedId === deleteId) setSelectedId(null)
    setDeleteId(null)
  }

  async function saveInlineText() {
    if (!editingText) return
    setSavingText(true)
    const db = createClient()
    const { error } = await db.from('parcels')
      .update({ [editingText.field]: editingText.value.trim() || null })
      .eq('id', editingText.id)
    if (error) { toast.error('Eroare: ' + error.message); setSavingText(false); return }
    const { id, field, value } = editingText
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value.trim() || null } : r))
    setSavingText(false)
    setEditingText(null)
    toast.success('Câmp actualizat.')
  }

  async function saveInlineEdit(id: string, field: 'lessor' | 'contract', value: string) {
    setSavingCell(true)
    const db = createClient()
    const update = field === 'lessor'
      ? { lessor_id: value || null }
      : { contract_id: value || null }
    const { error } = await db.from('parcels').update(update).eq('id', id)
    if (error) { toast.error('Eroare: ' + error.message); setSavingCell(false); return }
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r
      if (field === 'lessor') {
        const l = lessors.find(x => x.id === value)
        return { ...r, lessor_id: value || null, lessor_name: l?.name ?? '—' }
      }
      const c = contracts.find(x => x.id === value)
      return { ...r, contract_id: value || null, contract_number: c?.contract_number ?? null }
    }))
    setSavingCell(false)
    setEditingCell(null)
    toast.success(field === 'lessor' ? 'Arendator actualizat.' : 'Contract actualizat.')
  }

  const visibleList = ALL_COLS.filter(c => visibleCols.has(c.key))

  return (
    <div className="space-y-4">
      <div className="flex gap-2 mb-5">
        <span className="px-4 py-1.5 text-sm rounded-lg border border-gray-200 bg-white text-gray-700 font-medium shadow-sm">Lista parcele</span>
        <a href="/parcele/harta" className="px-4 py-1.5 text-sm rounded-lg bg-brand-600 hover:bg-brand-700 text-white font-medium transition-colors">Harta parcele</a>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={<MapPin  className="w-5 h-5 text-brand-600"  />} label="Total Parcele"      value={rows.length}                              bg="bg-brand-50"  />
        <KpiCard icon={<Layers  className="w-5 h-5 text-blue-600"   />} label="Suprafață Totală" value={`${totalHa.toLocaleString('ro', { maximumFractionDigits: 0 })} HA`} bg="bg-blue-50"   />
        <KpiCard icon={<Activity className="w-5 h-5 text-green-600" />} label="Active / Inactive" value={`${activeCount} / ${inactiveCount}`}         bg="bg-green-50"  />
        <KpiCard icon={<Users   className="w-5 h-5 text-purple-600" />} label="Arendatori"        value={uniqueLessors}                             bg="bg-purple-50" />
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-lg border border-gray-200 px-3 py-2.5 space-y-2.5">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Caută după cod, arendator, localitate..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setFiltersOpen(v => !v)}
            className="md:hidden flex items-center gap-1.5 text-xs text-gray-600 font-medium px-2.5 py-1.5 border border-gray-300 rounded hover:bg-gray-50"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Filtre
            {Object.values(filters).some(Boolean) && (
              <span className="w-1.5 h-1.5 bg-brand-500 rounded-full" />
            )}
            <ChevronDown className={`w-3 h-3 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
          </button>
          <span className="hidden md:flex text-xs text-gray-500 font-medium items-center gap-1 flex-shrink-0">
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </span>

          <div className={`${filtersOpen ? 'flex' : 'hidden'} md:flex items-center gap-2 flex-wrap w-full md:w-auto`}>

          <FilterSelect label="Județ"         value={filters.judet}         onChange={v => setFilter('judet', v)}>
            <option value="">Toate</option>
            {uniqueJudete.map(j => <option key={j} value={j}>{j}</option>)}
          </FilterSelect>

          <FilterSelect label="Status"        value={filters.status}        onChange={v => setFilter('status', v)}>
            <option value="">Toate</option>
            {(['ACTIVE','INACTIVE','EXPIRED'] as const).map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </FilterSelect>

          <FilterSelect label="Cultură"       value={filters.cultura}       onChange={v => setFilter('cultura', v)}>
            <option value="">Toate</option>
            {uniqueCulturi.map(c => <option key={c} value={c}>{c}</option>)}
          </FilterSelect>

          <FilterSelect label="Arendator"     value={filters.arendator}     onChange={v => setFilter('arendator', v)}>
            <option value="">Toți</option>
            {uniqueArendatori.map(a => <option key={a} value={a}>{a}</option>)}
          </FilterSelect>

          <FilterSelect label="APIA Eligibil" value={filters.apiaEligibil}  onChange={v => setFilter('apiaEligibil', v)}>
            <option value="">Toate</option>
            <option value="da">Da</option>
            <option value="nu">Nu</option>
          </FilterSelect>

          {Object.values(filters).some(Boolean) && (
            <button
              onClick={() => { setFilters({ judet: '', status: '', cultura: '', arendator: '', apiaEligibil: '' }); setPage(1) }}
              className="text-xs text-red-500 hover:text-red-700 underline"
            >
              Resetează
            </button>
          )}

          </div>{/* end collapsible filters */}

          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            <div className="relative" ref={colRef}>
              <button
                onClick={() => setShowColSelector(v => !v)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
              >
                <Columns className="w-3.5 h-3.5" /> Coloane
              </button>
              {showColSelector && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-20 min-w-[180px] p-2">
                  {ALL_COLS.map(col => (
                    <label key={col.key} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={visibleCols.has(col.key)}
                        onChange={e => setVisibleCols(prev => {
                          const s = new Set(prev)
                          e.target.checked ? s.add(col.key) : s.delete(col.key)
                          return s
                        })}
                        className="rounded"
                      />
                      {col.label}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>

            <a
              href="/parcele/harta?openImport=1"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs border border-orange-300 rounded hover:bg-orange-50 text-orange-700 font-medium"
              title="Import parcele din Shapefile APIA / GeoJSON"
            >
              <Upload className="w-3.5 h-3.5" /> Import
            </a>

            <button
              onClick={() => router.push('/parcele/nou')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-brand-500 hover:bg-brand-600 text-white rounded font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Parcelă nouă
            </button>
          </div>
        </div>
      </div>

      {/* Mobile cards */}
      {isMobile && (
        <div className="space-y-3">
          {sorted.length === 0 && (
            <div className="py-10 text-center text-sm text-gray-400">Nicio parcelă găsită</div>
          )}
          {sorted.map(row => {
            const cultureClass = row.culture ? (CULTURE_COLORS[row.culture] ?? 'bg-gray-100 text-gray-600') : ''
            return (
              <div key={row.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{row.bloc_fizic ?? '—'}{row.parcel_nr ? ` / ${row.parcel_nr}` : ''}</p>
                    {(row.locality || row.county) && (
                      <p className="text-xs text-gray-500 mt-0.5">{[row.locality, row.county].filter(Boolean).join(', ')}</p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${STATUS_STYLES[row.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {STATUS_LABELS[row.status] ?? row.status}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs mb-3">
                  {row.surface != null && (
                    <span className="font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded">
                      {Number(row.surface).toFixed(2)} HA
                    </span>
                  )}
                  {row.culture && (
                    <span className={`px-2 py-0.5 rounded-full font-medium ${cultureClass}`}>🌾 {row.culture}</span>
                  )}
                  {row.lessor_name && row.lessor_name !== '—' && (
                    <span className="text-brand-700 font-medium">{row.lessor_name}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => viewOnMap(row)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium bg-brand-50 text-brand-700 rounded-lg"
                  >
                    <MapIcon className="w-4 h-4" /> Hartă
                  </button>
                  <button
                    onClick={() => router.push(`/parcele/${row.id}`)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium bg-gray-50 text-gray-600 rounded-lg"
                  >
                    <Eye className="w-4 h-4" /> Editează
                  </button>
                  <button
                    onClick={() => setDeleteId(row.id)}
                    className="px-4 flex items-center justify-center py-2.5 text-sm font-medium bg-red-50 text-red-600 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Table — desktop only */}
      <div className={`bg-white rounded-lg border border-gray-200 overflow-hidden${isMobile ? ' hidden' : ''}`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="w-8 px-3 py-2">
                  <input type="checkbox" className="rounded" />
                </th>
                {visibleList.map(col => (
                  <th
                    key={col.key}
                    onClick={() => toggleSort(col.key)}
                    className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none whitespace-nowrap group hover:text-gray-700"
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      <span className="opacity-0 group-hover:opacity-50 transition-opacity">
                        {sortCol === col.key
                          ? (sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
                          : <ChevronDown className="w-3 h-3" />}
                      </span>
                    </span>
                  </th>
                ))}
                <th className="w-8 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 && (
                <tr>
                  <td colSpan={visibleList.length + 1} className="px-3 py-8 text-center text-sm text-gray-400">
                    Nicio parcelă găsită
                  </td>
                </tr>
              )}
              {paged.map(row => (
                <tr
                  key={row.id}
                  onClick={() => setSelectedId(row.id === selectedId ? null : row.id)}
                  className={`border-b border-gray-100 cursor-pointer transition-colors ${
                    row.id === selectedId ? 'bg-brand-50 border-l-2 border-l-brand-500' : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" className="rounded" />
                  </td>
                  {visibleCols.has('bloc_fizic') && (
                    <td className="px-3 py-2 font-mono text-xs font-semibold text-gray-700">{row.bloc_fizic ?? '—'}</td>
                  )}
                  {visibleCols.has('tarla_nr') && (
                    <td className="px-3 py-2" onClick={e => { e.stopPropagation(); setEditingText({ id: row.id, field: 'tarla_nr', value: row.tarla_nr ?? '' }) }}>
                      {editingText?.id === row.id && editingText.field === 'tarla_nr' ? (
                        <input
                          autoFocus
                          value={editingText.value}
                          onChange={e => setEditingText(p => p ? { ...p, value: e.target.value } : p)}
                          onBlur={() => void saveInlineText()}
                          onKeyDown={e => { if (e.key === 'Enter') void saveInlineText(); if (e.key === 'Escape') setEditingText(null) }}
                          onClick={e => e.stopPropagation()}
                          className="text-xs border border-brand-400 rounded px-1.5 py-1 w-20 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                      ) : (
                        <span className="group flex items-center gap-1 text-gray-600 cursor-pointer">
                          {row.tarla_nr ?? '—'}
                          <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-40 flex-shrink-0" />
                        </span>
                      )}
                    </td>
                  )}
                  {visibleCols.has('parcel_nr') && (
                    <td className="px-3 py-2" onClick={e => { e.stopPropagation(); setEditingText({ id: row.id, field: 'parcel_nr', value: row.parcel_nr ?? '' }) }}>
                      {editingText?.id === row.id && editingText.field === 'parcel_nr' ? (
                        <input
                          autoFocus
                          value={editingText.value}
                          onChange={e => setEditingText(p => p ? { ...p, value: e.target.value } : p)}
                          onBlur={() => void saveInlineText()}
                          onKeyDown={e => { if (e.key === 'Enter') void saveInlineText(); if (e.key === 'Escape') setEditingText(null) }}
                          onClick={e => e.stopPropagation()}
                          className="text-xs border border-brand-400 rounded px-1.5 py-1 w-20 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                      ) : (
                        <span className="group flex items-center gap-1 text-brand-600 font-semibold cursor-pointer">
                          {row.parcel_nr ?? '—'}
                          <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-40 flex-shrink-0" />
                        </span>
                      )}
                    </td>
                  )}
                  {visibleCols.has('siruta_code') && (
                    <td className="px-3 py-2 font-mono text-xs text-gray-400">{row.siruta_code ?? '—'}</td>
                  )}
                  {visibleCols.has('county') && (
                    <td className="px-3 py-2 text-gray-700">{row.county ?? '—'}</td>
                  )}
                  {visibleCols.has('locality') && (
                    <td className="px-3 py-2 text-gray-700">{row.locality ?? '—'}</td>
                  )}
                  {visibleCols.has('surface') && (
                    <td className="px-3 py-2 font-semibold text-gray-800">
                      {Number(row.surface ?? 0).toLocaleString('ro', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </td>
                  )}
                  {visibleCols.has('lessor_name') && (
                    <td
                      className="px-3 py-2"
                      onClick={e => { e.stopPropagation(); setEditingCell({ id: row.id, field: 'lessor' }) }}
                    >
                      {editingCell?.id === row.id && editingCell.field === 'lessor' ? (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <select
                            autoFocus
                            defaultValue={row.lessor_id ?? ''}
                            onChange={e => void saveInlineEdit(row.id, 'lessor', e.target.value)}
                            onBlur={() => !savingCell && setEditingCell(null)}
                            className="text-xs border border-brand-400 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white max-w-[160px]"
                          >
                            <option value="">— Fără arendator —</option>
                            {lessors.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                          </select>
                          {savingCell && <Loader2 className="w-3 h-3 animate-spin text-brand-500 flex-shrink-0" />}
                        </div>
                      ) : (
                        <span className="group flex items-center gap-1 text-brand-700 font-medium cursor-pointer hover:text-brand-900">
                          {row.lessor_name}
                          <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-40 flex-shrink-0" />
                        </span>
                      )}
                    </td>
                  )}
                  {visibleCols.has('nr_cadastral') && (
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{row.nr_cadastral ?? '—'}</td>
                  )}
                  {visibleCols.has('culture') && (
                    <td className="px-3 py-2">
                      {row.culture ? (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CULTURE_COLORS[row.culture] ?? 'bg-gray-100 text-gray-600'}`}>
                          🌾 {row.culture}
                        </span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                  )}
                  {visibleCols.has('contract_number') && (
                    <td
                      className="px-3 py-2"
                      onClick={e => { e.stopPropagation(); setEditingCell({ id: row.id, field: 'contract' }) }}
                    >
                      {editingCell?.id === row.id && editingCell.field === 'contract' ? (
                        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                          <select
                            autoFocus
                            defaultValue={row.contract_id ?? ''}
                            onChange={e => void saveInlineEdit(row.id, 'contract', e.target.value)}
                            onBlur={() => !savingCell && setEditingCell(null)}
                            className="text-xs border border-brand-400 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-brand-500 bg-white max-w-[160px]"
                          >
                            <option value="">— Fără contract —</option>
                            {contracts
                              .filter(c => !row.lessor_id || c.lessor_id === row.lessor_id || !c.lessor_id)
                              .map(c => <option key={c.id} value={c.id}>{c.contract_number}</option>)}
                          </select>
                          {savingCell && <Loader2 className="w-3 h-3 animate-spin text-brand-500 flex-shrink-0" />}
                        </div>
                      ) : (
                        <span className="group flex items-center gap-1 cursor-pointer">
                          {row.contract_number ? (
                            <span
                              onClick={e => { e.stopPropagation(); router.push(`/contracte/${row.contract_id}`) }}
                              className="text-brand-600 font-medium hover:underline"
                            >
                              {row.contract_number}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                          <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-40 flex-shrink-0" />
                        </span>
                      )}
                    </td>
                  )}
                  {visibleCols.has('created_at') && (
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {row.created_at ? String(row.created_at).split('T')[0] : '—'}
                    </td>
                  )}
                  {visibleCols.has('apia_eligible') && (
                    <td className="px-3 py-2">
                      {row.apia_eligible === true  ? <span className="text-xs text-green-700 font-medium">📄 Da</span>
                      : row.apia_eligible === false ? <span className="text-xs text-gray-400">✕ Nu</span>
                      : <span className="text-gray-300">—</span>}
                    </td>
                  )}
                  {visibleCols.has('status') && (
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STATUS_STYLES[row.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {STATUS_LABELS[row.status] ?? row.status}
                      </span>
                    </td>
                  )}
                  <td className="px-2 py-2" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => setDeleteId(row.id)}
                      className="p-1.5 text-gray-300 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                      title="Șterge parcela"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            {sorted.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 border-t border-gray-200">
                  <td className="px-3 py-2 text-xs font-bold text-gray-500 uppercase tracking-wide">TOTAL</td>
                  {visibleList.map(col => (
                    <td key={col.key} className="px-3 py-2">
                      {col.key === 'surface' && (
                        <span className="text-sm font-bold text-brand-700">
                          {sorted.reduce((s, r) => s + Number(r.surface ?? 0), 0).toLocaleString('ro', { maximumFractionDigits: 0 })} HA
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-2.5 border-t border-gray-100 flex items-center justify-between bg-gray-50 text-xs text-gray-500">
          <span>
            {sorted.length === 0
              ? '0 înregistrări'
              : `${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, sorted.length)} din ${sorted.length} înregistrări`}
          </span>
          <div className="flex items-center gap-1">
            <PagBtn onClick={() => setPage(1)}             disabled={page === 1}>«</PagBtn>
            <PagBtn onClick={() => setPage(p => p - 1)}   disabled={page === 1}>‹</PagBtn>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4))
              const p = start + i
              return (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-7 h-7 rounded text-xs font-medium ${p === page ? 'bg-brand-500 text-white' : 'hover:bg-gray-200 text-gray-600'}`}
                >
                  {p}
                </button>
              )
            })}
            <PagBtn onClick={() => setPage(p => p + 1)}   disabled={page === totalPages}>›</PagBtn>
            <PagBtn onClick={() => setPage(totalPages)}    disabled={page === totalPages}>»</PagBtn>
          </div>
        </div>
      </div>

      {/* Side panel */}
      {selectedParcel && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <div className="fixed inset-0 bg-black/20" onClick={() => setSelectedId(null)} />
          <div className="relative bg-white w-[380px] max-w-full h-full shadow-2xl flex flex-col overflow-hidden">
            {/* Panel header */}
            <div className="bg-brand-700 text-white px-5 py-4 flex justify-between items-start flex-shrink-0">
              <div>
                <p className="font-bold text-base leading-tight">{selectedParcel.bloc_fizic ?? 'Parcelă'}</p>
                <p className="text-brand-200 text-xs mt-0.5">Nr. Parcelă: {selectedParcel.parcel_nr ?? '—'}</p>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <button
                  onClick={() => { setSelectedId(null); router.push(`/parcele/${selectedParcel.id}`) }}
                  className="text-brand-200 hover:text-white"
                  title="Editează"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => setSelectedId(null)} className="text-brand-200 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Status indicator */}
            <div className="flex border-b border-gray-200 flex-shrink-0">
              {(['ACTIVE','INACTIVE','EXPIRED'] as const).map(s => (
                <div
                  key={s}
                  className={`flex-1 py-2 text-center text-xs font-bold tracking-wide border-b-2 transition-colors ${
                    selectedParcel.status === s
                      ? 'border-brand-500 text-brand-700 bg-white'
                      : 'border-transparent text-gray-300 bg-gray-50'
                  }`}
                >
                  {STATUS_LABELS[s]}
                </div>
              ))}
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto">
              <DetailSection title="Identificare" rows={[
                ['Bloc Fizic',    selectedParcel.bloc_fizic],
                ['Tarla',         selectedParcel.tarla_nr],
                ['Nr. Parcelă',   selectedParcel.parcel_nr],
                ['Nr. Cadastral', selectedParcel.nr_cadastral],
                ['Sirută',        selectedParcel.siruta_code],
              ]} />
              <DetailSection title="Localizare" rows={[
                ['Județ',      selectedParcel.county],
                ['Localitate', selectedParcel.locality],
                ['Coordonate', selectedParcel.lat && selectedParcel.lng
                    ? `${Number(selectedParcel.lat).toFixed(4)}, ${Number(selectedParcel.lng).toFixed(4)}`
                    : null],
              ]} />
              <DetailSection title="Suprafață & Cultură" rows={[
                ['Suprafață (HA)', selectedParcel.surface ? `${Number(selectedParcel.surface).toFixed(4)} ha` : null],
                ['Categorie',      selectedParcel.land_use_category],
                ['Cultură',        selectedParcel.culture],
                ['APIA Eligibil',  selectedParcel.apia_eligible === true  ? 'Da ✓'
                                 : selectedParcel.apia_eligible === false ? 'Nu'
                                 : null],
              ]} />
              <DetailSection title="Arendare & Contract" rows={[
                ['Arendator',          selectedParcel.lessor_name !== '—' ? selectedParcel.lessor_name : null],
                ['Contract',           selectedParcel.contract_number],
                ['Expiră',             selectedParcel.contract_end_date],
                ['Data înregistrării', selectedParcel.created_at ? String(selectedParcel.created_at).split('T')[0] : null],
              ]} />
            </div>

            {/* Footer buttons */}
            <div className="flex gap-2 p-4 border-t border-gray-200 flex-shrink-0 bg-white">
              <button
                onClick={() => viewOnMap(selectedParcel)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded transition-colors"
              >
                <MapIcon className="w-4 h-4" /> Hartă
              </button>
              <button
                onClick={() => { setSelectedId(null); router.push(`/parcele/${selectedParcel.id}`) }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium rounded transition-colors"
              >
                <Pencil className="w-4 h-4" /> Editează
              </button>
              <button
                onClick={() => { setDeleteId(selectedParcel.id) }}
                className="px-4 flex items-center justify-center py-2.5 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded transition-colors border border-red-200"
                title="Șterge parcela"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteId && deleteParcel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setDeleteId(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-100 rounded-full">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-bold text-gray-800">Șterge parcela</p>
                <p className="text-sm text-gray-500">Această acțiune nu poate fi anulată.</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
              <span className="font-semibold">{deleteParcel.bloc_fizic ?? '—'}</span>
              {deleteParcel.locality && <span className="text-gray-500"> · {deleteParcel.locality}</span>}
              {deleteParcel.surface != null && <span className="text-gray-500"> · {Number(deleteParcel.surface).toFixed(2)} HA</span>}
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg disabled:opacity-50"
              >
                {deleting ? 'Se șterge...' : 'Șterge definitiv'}
              </button>
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
              >
                Anulează
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, bg }: {
  icon: React.ReactNode; label: string; value: React.ReactNode; bg: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-lg ${bg}`}>{icon}</div>
      <div>
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-xl font-bold text-gray-800 leading-tight">{value}</p>
      </div>
    </div>
  )
}

function FilterSelect({ label, value, onChange, children }: {
  label: string; value: string; onChange: (v: string) => void; children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-gray-500">{label}:</span>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="text-xs border border-gray-300 rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand-500 text-gray-700"
      >
        {children}
      </select>
    </div>
  )
}

function DetailSection({ title, rows }: { title: string; rows: [string, React.ReactNode][] }) {
  return (
    <div className="px-5 py-3.5 border-b border-gray-100">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">{title}</p>
      <div className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between items-start gap-3">
            <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
            <span className="text-xs font-semibold text-gray-800 text-right">
              {value ?? <span className="text-gray-300 font-normal">—</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PagBtn({ onClick, disabled, children }: {
  onClick: () => void; disabled: boolean; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-7 h-7 rounded text-xs hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed text-gray-600"
    >
      {children}
    </button>
  )
}
