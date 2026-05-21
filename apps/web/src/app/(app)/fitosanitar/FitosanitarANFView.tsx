'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Plus, Search, Download, Upload, ChevronLeft, ChevronRight, Eye, Copy, RefreshCw, Leaf,
} from 'lucide-react'
import {
  RegistruFitosanitar, formatDateRO, TIP_UTILIZARE_OPTIONS,
} from '@/lib/bbch-data'
import { FitosanitarModal } from './FitosanitarModal'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ─── Helper: strip Romanian diacritics so jsPDF's built-in fonts render correctly
// (Helvetica/Times/Courier only support Latin-1; ă ș ț î â are outside that range)
function ro(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/ă/g, 'a').replace(/Ă/g, 'A')
    .replace(/â/g, 'a').replace(/Â/g, 'A')
    .replace(/î/g, 'i').replace(/Î/g, 'I')
    .replace(/ș/g, 's').replace(/Ș/g, 'S')
    .replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ț/g, 't').replace(/Ț/g, 'T')
    .replace(/ţ/g, 't').replace(/Ţ/g, 'T')
}

// ─── PDF export ───────────────────────────────────────────────────────────────
function generateANFPdf(
  entries: RegistruFitosanitar[],
  user: { name: string; address: string },
) {
  // Landscape A4: 297 × 210 mm
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()   // 297 mm
  const pageH = doc.internal.pageSize.getHeight()  // 210 mm
  const margin = 10                                 // left & right margin

  const now = new Date()
  const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

  // ── Title ──────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(0, 0, 0)
  const titleLines = doc.splitTextToSize(
    ro('Registrul de evidenta a tratamentelor cu produse de protectie a plantelor'),
    pageW - 2 * margin,
  )
  doc.text(titleLines, pageW / 2, margin + 6, { align: 'center' })

  // ── Info block ─────────────────────────────────────────────────────────────
  // Split label / value side by side; each row 5.5 mm tall
  const ROW_H    = 5.5
  const LABEL_W  = 90
  const VALUE_W  = pageW - 2 * margin - LABEL_W
  let infoY = margin + 6 + titleLines.length * 5 + 3

  const infoRows: [string, string][] = [
    [ro('Nume si prenume persoana juridica/PFA/II/IF/PF'), ro(user.name)],
    [ro('Domiciliu persoana juridica/PFA/II/IF/PF'),      ro(user.address)],
    [ro('Denumire spatiu/suprafata'),                      ''],
    ['Data generare',                                     dateStr],
  ]

  for (const [label, value] of infoRows) {
    // Label cell — light grey background, red bold text
    doc.setFillColor(240, 240, 240)
    doc.setDrawColor(200, 200, 200)
    doc.rect(margin, infoY, LABEL_W, ROW_H, 'FD')
    doc.setTextColor(180, 30, 30)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.text(label, margin + 1.5, infoY + ROW_H / 2 + 1, { baseline: 'middle' })

    // Value cell — white background, black normal text
    doc.setFillColor(255, 255, 255)
    doc.rect(margin + LABEL_W, infoY, VALUE_W, ROW_H, 'FD')
    doc.setTextColor(0, 0, 0)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.text(value, margin + LABEL_W + 1.5, infoY + ROW_H / 2 + 1, { baseline: 'middle', maxWidth: VALUE_W - 3 })

    infoY += ROW_H
  }

  // ── Table ──────────────────────────────────────────────────────────────────
  // Total usable width = 297 - 2×10 = 277 mm → column widths must sum to 277
  autoTable(doc, {
    startY: infoY + 3,
    head: [[
      ro('Tipul utilizarii'),
      'Denumire',
      ro('Substanta activa'),
      ro('Doza de aplicare'),
      ro('Cultura / Locul terenului'),
      ro('Organism daunat or'),
      ro('Cantitate utilizata'),
      ro('Momentul utilizarii'),
      ro('Suprafata (ha)'),
      'Localizare',
      ro('Observatii'),
      ro('Data'),
    ]],
    body: entries.map(row => [
      ro(row.tip_utilizare) || '-',
      ro(row.denumire_produs),
      ro(row.substanta_activa),
      `${row.doza_folosita} ${row.unitate_doza}`,
      ro(row.cultura) + (row.locul_terenului ? ` / ${ro(row.locul_terenului)}` : ''),
      ro(row.agent_daunare),
      `${row.cantitate_utilizata} ${row.unitate_cantitate === 'litri' ? 'L' : 'kg'}`,
      formatDateRO(row.data_tratament) + (row.ora_tratament ? ` ${row.ora_tratament}` : ''),
      row.suprafata_tratata.toString(),
      ro(row.locul_terenului),
      ro(row.observatii),
      formatDateRO(row.data_tratament),
    ]),
    styles: {
      font: 'helvetica',
      fontSize: 6.5,
      cellPadding: 1.2,
      overflow: 'linebreak',
      halign: 'left',
      valign: 'top',
      textColor: [30, 30, 30],
    },
    headStyles: {
      fillColor: [30, 95, 164],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 6.5,
      halign: 'center',
      valign: 'middle',
      cellPadding: 1.5,
      minCellHeight: 8,
    },
    alternateRowStyles: { fillColor: [245, 248, 252] },
    // Column widths: must sum to 277 mm (= 297 - 2×10 margins)
    columnStyles: {
      0:  { cellWidth: 38 },   // Tipul utilizarii  (can be long)
      1:  { cellWidth: 26 },   // Denumire
      2:  { cellWidth: 23 },   // Substanta activa
      3:  { cellWidth: 15 },   // Doza
      4:  { cellWidth: 32 },   // Cultura / Locul
      5:  { cellWidth: 22 },   // Organism
      6:  { cellWidth: 18 },   // Cantitate
      7:  { cellWidth: 22 },   // Momentul
      8:  { cellWidth: 12 },   // Suprafata
      9:  { cellWidth: 22 },   // Localizare
      10: { cellWidth: 30 },   // Observatii (wider for notes)
      11: { cellWidth: 17 },   // Data
    },
    margin: { left: margin, right: margin, top: margin + 5, bottom: 12 },
    didDrawPage: () => {
      const totalPages = (doc as unknown as { internal: { getNumberOfPages(): number } }).internal.getNumberOfPages()
      const currentPage = doc.getCurrentPageInfo().pageNumber
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6)
      doc.setTextColor(130, 130, 130)
      doc.text(
        `Pagina ${currentPage} din ${totalPages}  |  Generat de ArendaPro  |  ${dateStr}`,
        pageW / 2,
        pageH - 4,
        { align: 'center' },
      )
    },
  })

  doc.save('registru-fitosanitar-anf.pdf')
}

// ─── Component ────────────────────────────────────────────────────────────────
export function FitosanitarANFView() {
  const [rows, setRows] = useState<RegistruFitosanitar[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  // Filters
  const [filterTipUtilizare, setFilterTipUtilizare] = useState('')
  const [filterLocalizare, setFilterLocalizare] = useState('')
  const [filterDenumire, setFilterDenumire] = useState('')
  const [filterSubstanta, setFilterSubstanta] = useState('')
  const [filterCultura, setFilterCultura] = useState('')
  const [filterOrganism, setFilterOrganism] = useState('')
  const [filterMomentFrom, setFilterMomentFrom] = useState('')
  const [filterMomentTo, setFilterMomentTo] = useState('')

  // Pagination
  const PAGE_SIZE = 20
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)

  // Modal
  const [modalMode, setModalMode] = useState<'add' | 'view' | 'correct' | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<RegistruFitosanitar | undefined>()

  // ── Load ────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    const db = createClient()

    let q = db
      .from('registru_fitosanitar')
      .select('*', { count: 'exact' })
      .eq('is_deleted', false)
      .order('data_tratament', { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

    if (filterTipUtilizare) q = q.eq('tip_utilizare', filterTipUtilizare)
    if (filterDenumire.trim()) q = q.ilike('denumire_produs', `%${filterDenumire.trim()}%`)
    if (filterSubstanta.trim()) q = q.ilike('substanta_activa', `%${filterSubstanta.trim()}%`)
    if (filterCultura.trim()) q = q.ilike('cultura', `%${filterCultura.trim()}%`)
    if (filterOrganism.trim()) q = q.ilike('agent_daunare', `%${filterOrganism.trim()}%`)
    if (filterLocalizare.trim()) q = q.ilike('locul_terenului', `%${filterLocalizare.trim()}%`)
    if (filterMomentFrom) q = q.gte('data_tratament', filterMomentFrom)
    if (filterMomentTo) q = q.lte('data_tratament', filterMomentTo)

    const { data, error, count } = await q
    if (error) {
      toast.error('Eroare la încărcare: ' + error.message)
      setLoading(false)
      return
    }
    setRows((data ?? []) as RegistruFitosanitar[])
    setTotalCount(count ?? 0)
    setLoading(false)
  }, [page, filterTipUtilizare, filterDenumire, filterSubstanta, filterCultura, filterOrganism, filterLocalizare, filterMomentFrom, filterMomentTo])

  useEffect(() => { setPage(0) }, [filterTipUtilizare, filterDenumire, filterSubstanta, filterCultura, filterOrganism, filterLocalizare, filterMomentFrom, filterMomentTo])
  useEffect(() => { void load() }, [load])

  // ── Reset filters ────────────────────────────────────────────────────────────
  function resetFilters() {
    setFilterTipUtilizare('')
    setFilterLocalizare('')
    setFilterDenumire('')
    setFilterSubstanta('')
    setFilterCultura('')
    setFilterOrganism('')
    setFilterMomentFrom('')
    setFilterMomentTo('')
  }

  // ── PDF Export ───────────────────────────────────────────────────────────────
  async function handleExportPDF() {
    setExporting(true)
    try {
      const db = createClient()
      let q = db
        .from('registru_fitosanitar')
        .select('*')
        .eq('is_deleted', false)
        .order('data_tratament', { ascending: true })
        .limit(10000)

      if (filterTipUtilizare) q = q.eq('tip_utilizare', filterTipUtilizare)
      if (filterDenumire.trim()) q = q.ilike('denumire_produs', `%${filterDenumire.trim()}%`)
      if (filterSubstanta.trim()) q = q.ilike('substanta_activa', `%${filterSubstanta.trim()}%`)
      if (filterCultura.trim()) q = q.ilike('cultura', `%${filterCultura.trim()}%`)
      if (filterOrganism.trim()) q = q.ilike('agent_daunare', `%${filterOrganism.trim()}%`)
      if (filterLocalizare.trim()) q = q.ilike('locul_terenului', `%${filterLocalizare.trim()}%`)
      if (filterMomentFrom) q = q.gte('data_tratament', filterMomentFrom)
      if (filterMomentTo) q = q.lte('data_tratament', filterMomentTo)

      const { data: allEntries, error } = await q
      if (error || !allEntries) {
        toast.error('Eroare la export PDF: ' + (error?.message ?? 'date lipsă'))
        setExporting(false)
        return
      }

      const { data: settings } = await db.from('company_settings').select('name, address').maybeSingle()
      generateANFPdf(allEntries as RegistruFitosanitar[], {
        name: settings?.name ?? '',
        address: settings?.address ?? '',
      })
      toast.success(`Export PDF finalizat: ${allEntries.length} înregistrări.`)
    } catch {
      toast.error('Eroare la generarea PDF-ului.')
    }
    setExporting(false)
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)
  const inputCls = 'w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500'
  const thCls = 'px-2 py-2 text-center text-[10px] font-semibold text-white leading-tight'
  const tdCls = 'px-2 py-2 text-xs text-gray-800 border-b border-gray-100 align-top'

  return (
    <div>
      {/* ── Filter panel (ANF layout) ──────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">

          {/* Row 1 */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Tipul utilizării:</label>
            <div className="relative">
              <select
                value={filterTipUtilizare}
                onChange={e => setFilterTipUtilizare(e.target.value)}
                className={inputCls}
              >
                <option value="">Selectează...</option>
                {TIP_UTILIZARE_OPTIONS.map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Selectează spații/suprafețe:</label>
            <input
              type="text"
              placeholder="Locul terenului..."
              value={filterLocalizare}
              onChange={e => setFilterLocalizare(e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Row 2 */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Denumire produs de protecție a plantelor utilizat:</label>
            <input
              type="text"
              placeholder=""
              value={filterDenumire}
              onChange={e => setFilterDenumire(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Substanță activă:</label>
            <input
              type="text"
              placeholder=""
              value={filterSubstanta}
              onChange={e => setFilterSubstanta(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Doza de aplicare:</label>
            <input type="text" placeholder="" disabled className={inputCls + ' bg-gray-50 cursor-not-allowed'} />
          </div>

          {/* Row 3 */}
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Cultura sau situația/utilizarea terenului:</label>
            <input
              type="text"
              placeholder=""
              value={filterCultura}
              onChange={e => setFilterCultura(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Organismul dăunător:</label>
            <input
              type="text"
              placeholder=""
              value={filterOrganism}
              onChange={e => setFilterOrganism(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Cantitate produs de protecție a plantelor utilizată:</label>
            <input type="text" placeholder="" disabled className={inputCls + ' bg-gray-50 cursor-not-allowed'} />
          </div>

          {/* Row 4 */}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Momentul utilizării (de la):</label>
            <input
              type="date"
              value={filterMomentFrom}
              onChange={e => setFilterMomentFrom(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Momentul utilizării (până la):</label>
            <input
              type="date"
              value={filterMomentTo}
              onChange={e => setFilterMomentTo(e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Dimensiunea sau volumul zonei sau unității tratate:</label>
            <input type="text" placeholder="" disabled className={inputCls + ' bg-gray-50 cursor-not-allowed'} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Localizarea sau identificarea zonei/unității tratate:</label>
            <input type="text" placeholder="" disabled className={inputCls + ' bg-gray-50 cursor-not-allowed'} />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex justify-center gap-3 mt-4">
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-5 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 font-medium"
          >
            <Search className="w-3.5 h-3.5" /> Căutare
          </button>
          <button
            onClick={resetFilters}
            className="flex items-center gap-1.5 px-5 py-1.5 border border-gray-300 text-gray-600 text-sm rounded hover:bg-gray-50"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Resetare
          </button>
        </div>
      </div>

      {/* ── Toolbar ────────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => { setSelectedEntry(undefined); setModalMode('add') }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 font-medium"
        >
          <Plus className="w-3.5 h-3.5" /> Adaugă
        </button>

        <h3 className="text-sm font-semibold text-gray-700 text-center hidden md:block">
          Registrul de evidență a tratamentelor cu produse de protecție a plantelor
        </h3>

        <div className="flex gap-2">
          <button className="flex items-center gap-1.5 px-3 py-1.5 border border-green-600 text-green-700 text-sm rounded hover:bg-green-50 font-medium">
            <Upload className="w-3.5 h-3.5" /> Încarcă document
          </button>
          <button
            onClick={handleExportPDF}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded hover:bg-green-700 font-medium disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? 'Se exportă...' : 'Export registru'}
          </button>
        </div>
      </div>

      {/* ── Table ──────────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-sm text-gray-400">Se încarcă registrul...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: '1360px' }}>
              <thead>
                <tr style={{ backgroundColor: '#1e5fa4' }}>
                  <th rowSpan={2} className={thCls} style={{ borderRight: '1px solid #2d7dd4', width: 110 }}>
                    Tipul<br />utilizării
                  </th>
                  <th colSpan={6} className={thCls} style={{ borderRight: '1px solid #2d7dd4', borderBottom: '1px solid #2d7dd4' }}>
                    Produsul de protecție a plantelor utilizat
                  </th>
                  <th rowSpan={2} className={thCls} style={{ borderRight: '1px solid #2d7dd4', width: 88 }}>
                    Momentul<br />utilizării
                  </th>
                  <th rowSpan={2} className={thCls} style={{ borderRight: '1px solid #2d7dd4', width: 90 }}>
                    Dimensiunea sau volumul<br />zonei sau unității tratate
                  </th>
                  <th rowSpan={2} className={thCls} style={{ borderRight: '1px solid #2d7dd4', width: 110 }}>
                    Localizarea sau identificarea<br />zonei sau a unităților tratate
                  </th>
                  <th rowSpan={2} className={thCls} style={{ borderRight: '1px solid #2d7dd4', width: 80 }}>
                    Observații
                  </th>
                  <th rowSpan={2} className={thCls} style={{ borderRight: '1px solid #2d7dd4', width: 72 }}>
                    Dată
                  </th>
                  <th rowSpan={2} className={thCls} style={{ width: 60 }}>
                    Acțiuni
                  </th>
                </tr>
                <tr style={{ backgroundColor: '#2568b0' }}>
                  <th className={thCls} style={{ borderRight: '1px solid #2d7dd4', width: 100 }}>Denumire</th>
                  <th className={thCls} style={{ borderRight: '1px solid #2d7dd4', width: 90 }}>Substanță<br />activă</th>
                  <th className={thCls} style={{ borderRight: '1px solid #2d7dd4', width: 76 }}>Doză de<br />aplicare</th>
                  <th className={thCls} style={{ borderRight: '1px solid #2d7dd4', width: 100 }}>Cultura sau situația/<br />utilizarea terenului</th>
                  <th className={thCls} style={{ borderRight: '1px solid #2d7dd4', width: 90 }}>Organismul<br />dăunător</th>
                  <th className={thCls} style={{ borderRight: '1px solid #2d7dd4', width: 90 }}>Cantitate produs de<br />protecție a plantelor<br />utilizată</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="py-16 text-center text-sm text-gray-400">
                      <Leaf className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                      Nu există înregistrări.
                    </td>
                  </tr>
                ) : rows.map(row => (
                  <tr
                    key={row.id}
                    className="border-b border-gray-100 hover:bg-green-50/30 cursor-pointer"
                    onClick={() => { setSelectedEntry(row); setModalMode('view') }}
                  >
                    <td className={tdCls + ' text-[11px] text-gray-600'}>{row.tip_utilizare ?? '-'}</td>
                    <td className={tdCls + ' font-medium'}>{row.denumire_produs}</td>
                    <td className={tdCls}>{row.substanta_activa}</td>
                    <td className={tdCls + ' whitespace-nowrap'}>{row.doza_folosita} {row.unitate_doza}</td>
                    <td className={tdCls}>
                      <div className="font-medium">{row.cultura}</div>
                      {row.locul_terenului && <div className="text-[11px] text-gray-500 truncate max-w-[95px]">{row.locul_terenului}</div>}
                    </td>
                    <td className={tdCls}>{row.agent_daunare}</td>
                    <td className={tdCls + ' whitespace-nowrap'}>{row.cantitate_utilizata} {row.unitate_cantitate === 'litri' ? 'L' : 'kg'}</td>
                    <td className={tdCls + ' whitespace-nowrap'}>
                      {formatDateRO(row.data_tratament)}
                      {row.ora_tratament && <div className="text-[11px] text-gray-500">{row.ora_tratament}</div>}
                    </td>
                    <td className={tdCls + ' whitespace-nowrap'}>{row.suprafata_tratata} ha</td>
                    <td className={tdCls + ' text-[11px] truncate max-w-[105px]'}>{row.locul_terenului ?? ''}</td>
                    <td className={tdCls + ' text-[11px] text-gray-500 truncate max-w-[75px]'}>{row.observatii ?? ''}</td>
                    <td className={tdCls + ' whitespace-nowrap'}>{formatDateRO(row.data_tratament)}</td>
                    <td className={tdCls} onClick={e => e.stopPropagation()}>
                      <div className="flex gap-1">
                        <button
                          onClick={() => { setSelectedEntry(row); setModalMode('view') }}
                          className="p-1 rounded hover:bg-blue-50 text-blue-500"
                          title="Vizualizează"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => { setSelectedEntry(row); setModalMode('correct') }}
                          className="p-1 rounded hover:bg-amber-50 text-amber-500"
                          title="Corectează"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Pagination ─────────────────────────────────────────────────────────── */}
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

      {/* ── Modal ──────────────────────────────────────────────────────────────── */}
      {modalMode !== null && (
        <FitosanitarModal
          mode={modalMode}
          initialData={selectedEntry}
          onClose={() => { setModalMode(null); setSelectedEntry(undefined) }}
          onSaved={load}
        />
      )}
    </div>
  )
}
