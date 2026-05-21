'use client'

export const runtime = 'edge'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from 'sonner'
import {
  Plus, Download, Search, Filter, ChevronLeft, ChevronRight,
  Eye, Copy, BookOpen, Leaf, AlertTriangle,
} from 'lucide-react'
import {
  RegistruFitosanitar, formatDateRO, TIP_AGENT_LABELS,
  TipAgent, CULTURA_OPTIONS,
} from '@/lib/bbch-data'
import { exportFitosanitarToExcel, ExportUserSettings } from '@/lib/fitosanitar-export'
import { FitosanitarModal } from './FitosanitarModal'
import { BBCHChart } from './BBCHChart'

// ─── Sort state ───────────────────────────────────────────────────────────────
type SortField = keyof Pick<
  RegistruFitosanitar,
  'numar_inregistrare' | 'data_tratament' | 'cultura' | 'denumire_produs' | 'suprafata_tratata'
>
type SortDir = 'asc' | 'desc'

// ─── Component ────────────────────────────────────────────────────────────────
export default function FitosanitarPage() {
  const [rows, setRows] = useState<RegistruFitosanitar[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [filterCultura, setFilterCultura] = useState('')
  const [filterTipAgent, setFilterTipAgent] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')

  // Pagination
  const PAGE_SIZE = 20
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  // Sort
  const [sortField, setSortField] = useState<SortField>('numar_inregistrare')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Modals
  const [modalMode, setModalMode] = useState<'add' | 'view' | 'correct' | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<RegistruFitosanitar | undefined>()
  const [showBBCHRef, setShowBBCHRef] = useState(false)

  // ── Load data ─────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const db = createClient()

    let q = db
      .from('registru_fitosanitar')
      .select('*', { count: 'exact' })
      .eq('is_deleted', false)
      .order(sortField, { ascending: sortDir === 'asc' })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

    if (filterCultura) q = q.eq('cultura', filterCultura)
    if (filterTipAgent) q = q.eq('tip_agent', filterTipAgent as TipAgent)
    if (filterFrom) q = q.gte('data_tratament', filterFrom)
    if (filterTo) q = q.lte('data_tratament', filterTo)
    if (search.trim()) {
      q = q.or(
        `denumire_produs.ilike.%${search.trim()}%,agent_daunare.ilike.%${search.trim()}%,locul_terenului.ilike.%${search.trim()}%`
      )
    }

    const { data, error, count } = await q

    if (error) {
      toast.error('Eroare la încărcarea registrului: ' + error.message)
      setLoading(false)
      return
    }

    setRows((data ?? []) as RegistruFitosanitar[])
    setTotalCount(count ?? 0)
    setLoading(false)
  }, [page, sortField, sortDir, filterCultura, filterTipAgent, filterFrom, filterTo, search])

  useEffect(() => {
    setPage(0) // reset page when filters change
  }, [filterCultura, filterTipAgent, filterFrom, filterTo, search, sortField, sortDir])

  useEffect(() => {
    void load()
  }, [load])

  // ── Export ────────────────────────────────────────────────────────────────
  async function handleExport() {
    setExporting(true)
    const db = createClient()

    // Fetch all (non-deleted) entries for the current filter period
    let q = db
      .from('registru_fitosanitar')
      .select('*')
      .eq('is_deleted', false)
      .order('numar_inregistrare', { ascending: true })
      .limit(10000)

    if (filterCultura) q = q.eq('cultura', filterCultura)
    if (filterTipAgent) q = q.eq('tip_agent', filterTipAgent as TipAgent)
    if (filterFrom) q = q.gte('data_tratament', filterFrom)
    if (filterTo) q = q.lte('data_tratament', filterTo)

    const { data: allEntries, error: fetchErr } = await q
    if (fetchErr || !allEntries) {
      toast.error('Eroare la export: ' + (fetchErr?.message ?? 'date lipsă'))
      setExporting(false)
      return
    }

    // Fetch user/company settings
    const { data: settings } = await db.from('company_settings').select('name, cif, reg_com, address').maybeSingle()

    const userSettings: ExportUserSettings = {
      company_name: settings?.name ?? 'Necompletat',
      cif: settings?.cif ?? null,
      reg_com: settings?.reg_com ?? null,
      address: settings?.address ?? null,
    }

    const period = filterFrom && filterTo
      ? { start: new Date(filterFrom), end: new Date(filterTo) }
      : undefined

    try {
      exportFitosanitarToExcel(allEntries as RegistruFitosanitar[], userSettings, period)
      toast.success(`Export finalizat: ${allEntries.length} înregistrări.`)
    } catch {
      toast.error('Eroare la generarea fișierului Excel.')
    }
    setExporting(false)
  }

  // ── Sort toggle ───────────────────────────────────────────────────────────
  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortField(field); setSortDir('asc') }
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <span className="text-gray-300 ml-1">↕</span>
    return <span className="text-brand-500 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  // ── Computed ──────────────────────────────────────────────────────────────
  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

  const thCls = 'px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50 whitespace-nowrap'
  const tdCls = 'px-3 py-2 text-sm text-gray-800'

  const inputCls = 'px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div>
      <PageHeader
        title="Registru Fitosanitar"
        subtitle={`${totalCount} înregistrări · conform Ordinul MADR/MMAP/ANSVSA nr. 54/570/32/2023`}
        actions={
          <div className="flex gap-2">
            <button
              onClick={() => setShowBBCHRef(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
            >
              <BookOpen className="w-3.5 h-3.5" /> Referință BBCH
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-green-600 text-green-700 rounded hover:bg-green-50 font-medium disabled:opacity-60"
            >
              <Download className="w-3.5 h-3.5" />
              {exporting ? 'Se exportă...' : 'Export Excel'}
            </button>
            <button
              onClick={() => { setSelectedEntry(undefined); setModalMode('add') }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-700 hover:bg-green-800 text-white rounded font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Adaugă Tratament
            </button>
          </div>
        }
      />

      {/* Legal notice banner */}
      <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
        <Leaf className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800">
          <strong>Document legal obligatoriu.</strong> Registrul trebuie pus la dispoziția
          autorităților APIA/ANFDF la cerere. Înregistrările sunt imutabile — corecțiile
          creează versiuni noi (OG nr. 4/1995, SMR 7 și SMR 8 APIA).
        </p>
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4 flex flex-wrap gap-3 items-end">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Caută produs, agent, teren..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500 min-w-[220px]"
          />
        </div>
        <div>
          <select
            value={filterCultura}
            onChange={e => setFilterCultura(e.target.value)}
            className={inputCls}
          >
            <option value="">Toate culturile</option>
            {CULTURA_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <select
            value={filterTipAgent}
            onChange={e => setFilterTipAgent(e.target.value)}
            className={inputCls}
          >
            <option value="">Toate tipurile</option>
            {(Object.entries(TIP_AGENT_LABELS) as [TipAgent, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">De la:</span>
          <input
            type="date"
            value={filterFrom}
            onChange={e => setFilterFrom(e.target.value)}
            className={inputCls}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Până la:</span>
          <input
            type="date"
            value={filterTo}
            onChange={e => setFilterTo(e.target.value)}
            className={inputCls}
          />
        </div>
        {(filterCultura || filterTipAgent || filterFrom || filterTo || search) && (
          <button
            onClick={() => { setFilterCultura(''); setFilterTipAgent(''); setFilterFrom(''); setFilterTo(''); setSearch('') }}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1.5 border border-gray-200 rounded hover:bg-gray-50"
          >
            ✕ Șterge filtre
          </button>
        )}
      </div>

      {/* ── Data table ──────────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="px-4 py-12 text-center text-sm text-gray-400">Se încarcă registrul...</div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <Leaf className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500 mb-1">Nicio înregistrare în registru</p>
            <p className="text-xs text-gray-400">
              Adăugați primul tratament fitosanitar cu butonul de mai sus.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1200px]">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className={thCls}>
                    <button onClick={() => toggleSort('numar_inregistrare')} className="hover:text-gray-700">
                      Nr. <SortIcon field="numar_inregistrare" />
                    </button>
                  </th>
                  <th className={thCls}>
                    <button onClick={() => toggleSort('data_tratament')} className="hover:text-gray-700">
                      Data Tratam. <SortIcon field="data_tratament" />
                    </button>
                  </th>
                  <th className={thCls}>
                    <button onClick={() => toggleSort('cultura')} className="hover:text-gray-700">
                      Cultură / Parcelă <SortIcon field="cultura" />
                    </button>
                  </th>
                  <th className={thCls}>Fenofaza BBCH</th>
                  <th className={thCls}>Agent Dăunare</th>
                  <th className={thCls}>
                    <button onClick={() => toggleSort('denumire_produs')} className="hover:text-gray-700">
                      Produs PPP <SortIcon field="denumire_produs" />
                    </button>
                  </th>
                  <th className={`${thCls} text-right`}>Doză Om.</th>
                  <th className={`${thCls} text-right`}>Doză Fol.</th>
                  <th className={`${thCls} text-right`}>
                    <button onClick={() => toggleSort('suprafata_tratata')} className="hover:text-gray-700">
                      Ha <SortIcon field="suprafata_tratata" />
                    </button>
                  </th>
                  <th className={`${thCls} text-right`}>Cantitate</th>
                  <th className={thCls}>Responsabil</th>
                  <th className={thCls}>Data Recoltare</th>
                  <th className={thCls}>Nr. Document</th>
                  <th className={thCls}></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const isOverDose =
                    row.doza_omologata_max != null && row.doza_folosita > row.doza_omologata_max
                  const isReplaced = typeof row.observatii === 'string' && row.observatii.startsWith('[ÎNLOCUIT]')
                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${isReplaced ? 'opacity-60 bg-gray-50' : ''}`}
                      onClick={() => { setSelectedEntry(row); setModalMode('view') }}
                    >
                      <td className="px-3 py-2 font-mono text-xs text-gray-500 font-medium">
                        #{row.numar_inregistrare}
                        {isReplaced && (
                          <div className="mt-0.5">
                            <span className="inline-block bg-gray-200 text-gray-600 text-[9px] font-medium px-1.5 py-0.5 rounded">
                              Inactiv
                            </span>
                          </div>
                        )}
                      </td>
                      <td className={tdCls + ' whitespace-nowrap'}>
                        {formatDateRO(row.data_tratament)}
                      </td>
                      <td className={tdCls}>
                        <div className="font-medium">{row.cultura}</div>
                        {row.locul_terenului && (
                          <div className="text-xs text-gray-400 truncate max-w-[150px]">
                            {row.locul_terenului}
                          </div>
                        )}
                      </td>
                      <td className={tdCls}>
                        <span className="font-mono text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">
                          {row.bbch_code}
                        </span>
                        <span className="text-xs text-gray-500 ml-1.5 hidden lg:inline">
                          {row.bbch_descriere?.substring(0, 30)}{row.bbch_descriere?.length > 30 ? '…' : ''}
                        </span>
                      </td>
                      <td className={tdCls}>
                        <div className="text-xs">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            row.tip_agent === 'boala' ? 'bg-purple-100 text-purple-700' :
                            row.tip_agent === 'daunator' ? 'bg-red-100 text-red-700' :
                            row.tip_agent === 'buruiana' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {TIP_AGENT_LABELS[row.tip_agent]}
                          </span>
                        </div>
                        <div className="text-xs mt-0.5 truncate max-w-[140px]">{row.agent_daunare}</div>
                      </td>
                      <td className={tdCls}>
                        <div className="font-medium truncate max-w-[150px]">{row.denumire_produs}</div>
                        {row.substanta_activa && (
                          <div className="text-xs text-gray-400 truncate max-w-[150px]">
                            {row.substanta_activa}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right text-xs text-gray-500 whitespace-nowrap">
                        {row.doza_omologata_min != null || row.doza_omologata_max != null
                          ? `${row.doza_omologata_min ?? '?'} – ${row.doza_omologata_max ?? '?'} ${row.unitate_doza}`
                          : '—'}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        <span className={`text-xs font-medium ${isOverDose ? 'text-orange-600' : 'text-gray-800'}`}>
                          {isOverDose && <AlertTriangle className="w-3 h-3 inline mr-0.5" />}
                          {row.doza_folosita} {row.unitate_doza}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right text-sm font-medium">
                        {row.suprafata_tratata.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right text-sm text-gray-600 whitespace-nowrap">
                        {row.cantitate_utilizata} {row.unitate_cantitate === 'litri' ? 'L' : 'kg'}
                      </td>
                      <td className={tdCls + ' whitespace-nowrap'}>
                        {row.nume_prenume_responsabil}
                      </td>
                      <td className={tdCls + ' whitespace-nowrap'}>
                        {formatDateRO(row.data_incepere_recoltare)}
                        {row.phi_zile != null && (
                          <span className="text-xs text-gray-400 ml-1">({row.phi_zile}z)</span>
                        )}
                      </td>
                      <td className={tdCls}>
                        {row.numar_document ?? '—'}
                      </td>
                      <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <button
                            onClick={() => { setSelectedEntry(row); setModalMode('view') }}
                            className="p-1.5 rounded hover:bg-blue-50 text-blue-500 hover:text-blue-700"
                            title="Vizualizează"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => { setSelectedEntry(row); setModalMode('correct') }}
                            className="p-1.5 rounded hover:bg-amber-50 text-amber-500 hover:text-amber-700"
                            title="Corectează (versiune nouă)"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ───────────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 px-1">
          <p className="text-xs text-gray-500">
            Pagina {page + 1} din {totalPages} · {totalCount} înregistrări totale
          </p>
          <div className="flex gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const pg = totalPages <= 7 ? i : page <= 3 ? i : page + i - 3
              if (pg >= totalPages) return null
              return (
                <button
                  key={pg}
                  onClick={() => setPage(pg)}
                  className={`w-8 h-8 text-xs rounded border transition-colors ${
                    pg === page
                      ? 'border-brand-500 bg-brand-50 text-brand-700 font-medium'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  {pg + 1}
                </button>
              )
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Form modal ───────────────────────────────────────────────────── */}
      {modalMode !== null && (
        <FitosanitarModal
          mode={modalMode}
          initialData={selectedEntry}
          onClose={() => { setModalMode(null); setSelectedEntry(undefined) }}
          onSaved={load}
        />
      )}

      {/* ── BBCH Reference overlay ───────────────────────────────────────── */}
      {showBBCHRef && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setShowBBCHRef(false)} />
          <div className="fixed inset-4 z-50 bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden">
            <BBCHChart onClose={() => setShowBBCHRef(false)} />
          </div>
        </>
      )}
    </div>
  )
}
