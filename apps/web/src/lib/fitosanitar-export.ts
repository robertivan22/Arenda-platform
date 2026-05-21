/**
 * Excel export for Registru Fitosanitar using ExcelJS.
 * Full styling: colored headers, alternating rows, borders, dose warnings.
 * Legal basis: Ordinul MADR/MMAP/ANSVSA nr. 54/570/32/2023.
 */
import ExcelJS from 'exceljs'
import { RegistruFitosanitar, formatDateRO, TIP_AGENT_LABELS } from './bbch-data'

export interface ExportUserSettings {
  company_name: string
  cif?: string | null
  reg_com?: string | null
  address?: string | null
}

// ARGB color palette
const C = {
  DARK_BLUE:  'FF1e3a5f',
  LIGHT_BLUE: 'FFdbeafe',
  WHITE:      'FFFFFFFF',
  CO_TEXT:    'FF1e3a5f',
  LEGAL_BG:   'FFf0fdf4',
  LEGAL_TXT:  'FF166534',
  WARN_BG:    'FFfef3c7',
  WARN_TXT:   'FF92400e',
  EVEN_ROW:   'FFf8fafc',
  BORDER:     'FFd1d5db',
  FOOTER_BG:  'FFf1f5f9',
}

type BorderStyle = ExcelJS.BorderStyle

function thinBorder(color = C.BORDER): ExcelJS.Border {
  return { style: 'thin' as BorderStyle, color: { argb: color } }
}
function allBorders(color = C.BORDER): Partial<ExcelJS.Borders> {
  const b = thinBorder(color)
  return { top: b, left: b, bottom: b, right: b }
}
function fill(cell: ExcelJS.Cell, argb: string) {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } }
}

const NCOLS = 29

export async function exportFitosanitarToExcel(
  entries: RegistruFitosanitar[],
  userSettings: ExportUserSettings,
  period?: { start: Date; end: Date },
): Promise<void> {
  const year        = period ? period.start.getFullYear() : new Date().getFullYear()
  const periodLabel = period
    ? `${formatDateRO(period.start.toISOString())} – ${formatDateRO(period.end.toISOString())}`
    : 'Toate înregistrările'

  const wb = new ExcelJS.Workbook()
  wb.creator = 'ArendaPro'
  wb.created = new Date()

  const ws = wb.addWorksheet(`Registru Fitosanitar ${year}`, {
    pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    headerFooter: { oddFooter: `&L${userSettings.company_name}&C&P / &N&RGenerat de ArendaPro` },
  })

  // ── Column widths ─────────────────────────────────────────────────────────────────
  ws.columns = [
    {width:6},{width:9},{width:15},{width:14},{width:24},{width:11},{width:13},
    {width:30},{width:9},{width:24},{width:11},{width:22},{width:20},{width:13},
    {width:12},{width:12},{width:13},{width:10},{width:14},{width:14},{width:10},
    {width:22},{width:14},{width:9},{width:14},{width:13},{width:18},{width:18},{width:28},
  ]

  // ── Helper: merged styled row ───────────────────────────────────────────────────────
  function mergedRow(
    text: string, bgArgb: string, fontArgb: string,
    opts?: { bold?: boolean; italic?: boolean; size?: number; height?: number },
  ) {
    const row  = ws.addRow([text])
    row.height = opts?.height ?? 20
    ws.mergeCells(row.number, 1, row.number, NCOLS)
    const cell = ws.getCell(row.number, 1)
    cell.value = text
    fill(cell, bgArgb)
    cell.font      = { bold: opts?.bold, italic: opts?.italic, color: { argb: fontArgb }, size: opts?.size ?? 10, name: 'Calibri' }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  }

  // ── Title ────────────────────────────────────────────────────────────────────────
  mergedRow(
    'REGISTRU DE EVIDENȞĂ A TRATAMENTELOR CU PRODUSE DE PROTECȞIE A PLANTELOR',
    C.DARK_BLUE, C.WHITE, { bold: true, size: 13, height: 30 },
  )
  mergedRow(
    `Firmă: ${userSettings.company_name}   |   CIF: ${userSettings.cif ?? '-'}   |   Reg.Com.: ${userSettings.reg_com ?? '-'}`,
    C.LIGHT_BLUE, C.CO_TEXT, { bold: true, size: 10, height: 22 },
  )
  mergedRow(`Adresă: ${userSettings.address ?? '-'}`, C.LIGHT_BLUE, C.CO_TEXT, { size: 10, height: 18 })
  mergedRow(`Perioadă: ${periodLabel}`, C.LIGHT_BLUE, C.CO_TEXT, { bold: true, size: 10, height: 18 })
  mergedRow(
    'Baza legală: Ordinul MADR/MMAP/ANSVSA nr. 54/570/32/2023 | OG nr. 4/1995 | APIA SMR 7 și SMR 8',
    C.LEGAL_BG, C.LEGAL_TXT, { italic: true, size: 9, height: 18 },
  )
  ws.addRow([])   // separator

  // ── Column header row ────────────────────────────────────────────────────────────────
  const hdrRow = ws.addRow([
    'Nr.\nCrt.','Nr.\nÎrnreg.','Data\nTratam.','Cultură','Locul\nTerenului','Nr.\nParcelă','Județ',
    'Fenofaza BBCH (descriere)','Cod\nBBCH','Agent Dăunare','Tip\nAgent',
    'Produs PPP','Substanță\nActivă','Nr.\nOmolog.',
    'Doză\nOmolog.\nMin','Doză\nOmolog.\nMax','Doză\nFolosită','Unit.\nDoză',
    'Suprafață\nTratată\n(ha)','Cantitate\nUtilizată','Unit.\nCant.',
    'Responsabil','Data\nRecoltare','PHI\n(zile)','Nr.\nDocument','Data\nDocument',
    'Condiții\nMeteo','Echipament','Observații',
  ])
  hdrRow.height = 52
  hdrRow.eachCell(cell => {
    fill(cell, C.DARK_BLUE)
    cell.font      = { bold: true, color: { argb: C.WHITE }, size: 8.5, name: 'Calibri' }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    cell.border    = allBorders('FF374151')
  })

  // ── Data rows ───────────────────────────────────────────────────────────────────────
  entries.forEach((e, i) => {
    const isWarn  = e.doza_omologata_max != null && e.doza_folosita > e.doza_omologata_max
    const rowBg   = isWarn ? C.WARN_BG : (i % 2 === 0 ? C.WHITE : C.EVEN_ROW)

    const dataRow = ws.addRow([
      i + 1, e.numar_inregistrare, formatDateRO(e.data_tratament),
      e.cultura, e.locul_terenului, e.nr_parcela ?? '—', e.judet ?? '—',
      e.bbch_descriere, e.bbch_code, e.agent_daunare,
      TIP_AGENT_LABELS[e.tip_agent], e.denumire_produs,
      e.substanta_activa ?? '—', e.nr_omologare ?? '—',
      e.doza_omologata_min ?? '—', e.doza_omologata_max ?? '—',
      isWarn ? `⚠️ ${e.doza_folosita}` : e.doza_folosita, e.unitate_doza,
      e.suprafata_tratata, e.cantitate_utilizata, e.unitate_cantitate,
      e.nume_prenume_responsabil, formatDateRO(e.data_incepere_recoltare),
      e.phi_zile ?? '—', e.numar_document ?? '—', formatDateRO(e.data_document),
      e.conditii_meteo ?? '—', e.echipament_utilizat ?? '—', e.observatii ?? '—',
    ])
    dataRow.height = 18
    dataRow.eachCell((cell, col) => {
      fill(cell, rowBg)
      cell.font = {
        color: { argb: (isWarn && col === 17) ? C.WARN_TXT : 'FF111827' },
        size: 9, name: 'Calibri', bold: col <= 2,
      }
      cell.alignment = { vertical: 'middle', wrapText: col > 6 }
      cell.border    = allBorders()
      if ([15,16,17].includes(col) && typeof cell.value === 'number') cell.numFmt = '#,##0.000'
      if ([19,20].includes(col)    && typeof cell.value === 'number') cell.numFmt = '#,##0.0000'
    })
  })

  // ── Footer ──────────────────────────────────────────────────────────────────────
  ws.addRow([])
  ws.addRow([])

  const sigRow = ws.addRow(['Data: ______________________'])
  sigRow.height = 36
  ws.mergeCells(sigRow.number, 1,  sigRow.number, 9)
  ws.mergeCells(sigRow.number, 10, sigRow.number, 20)
  ws.mergeCells(sigRow.number, 21, sigRow.number, NCOLS)
  const s1 = ws.getCell(sigRow.number, 1)
  const s2 = ws.getCell(sigRow.number, 10)
  const s3 = ws.getCell(sigRow.number, 21)
  s2.value = 'Semnătura: ______________________'
  s3.value = 'Ştampila societății'
  for (const c of [s1, s2, s3]) {
    fill(c, C.FOOTER_BG)
    c.font      = { bold: true, size: 10, name: 'Calibri' }
    c.alignment = { horizontal: 'center', vertical: 'middle' }
    c.border    = allBorders()
  }

  ws.addRow([])
  const noteRow = ws.addRow([
    `Document generat de ArendaPro la ${new Date().toLocaleString('ro-RO')}. ` +
    `Registru conform OG nr. 4/1995 și Ordinul MADR/MMAP/ANSVSA nr. 54/570/32/2023.`,
  ])
  noteRow.height = 16
  ws.mergeCells(noteRow.number, 1, noteRow.number, NCOLS)
  const nc = ws.getCell(noteRow.number, 1)
  nc.font      = { italic: true, size: 8, color: { argb: 'FF6b7280' }, name: 'Calibri' }
  nc.alignment = { horizontal: 'center', vertical: 'middle' }

  // ── Generate + download ───────────────────────────────────────────────────────────────
  const buf  = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = `Registru_Fitosanitar_${year}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
