/**
 * Excel export for Registru Fitosanitar using SheetJS (xlsx 0.18.x).
 * Generates a structured workbook per legal requirements (Ordinul MADR 54/570/32/2023).
 * Note: xlsx 0.18 (free tier) does not support cell color styling —
 * column widths and number formatting are applied.
 */
import * as XLSX from 'xlsx'
import { RegistruFitosanitar, formatDateRO, TIP_AGENT_LABELS } from './bbch-data'

export interface ExportUserSettings {
  company_name: string
  cif?: string | null
  reg_com?: string | null
  address?: string | null
}

export async function exportFitosanitarToExcel(
  entries: RegistruFitosanitar[],
  userSettings: ExportUserSettings,
  period?: { start: Date; end: Date },
): Promise<void> {
  const periodLabel = period
    ? `${formatDateRO(period.start.toISOString())} - ${formatDateRO(period.end.toISOString())}`
    : 'Toate datele'

  // ── Build AOA (Array of Arrays) ─────────────────────────────────────────────
  const rows: (string | number | null)[][] = []

  // Header section (rows 0-5)
  rows.push([`REGISTRU DE EVIDENȚĂ A TRATAMENTELOR CU PRODUSE DE PROTECȚIE A PLANTELOR`])
  rows.push([`Firmă: ${userSettings.company_name}`])
  rows.push([`CIF: ${userSettings.cif ?? '-'}  |  Reg. Com.: ${userSettings.reg_com ?? '-'}`])
  rows.push([`Adresă: ${userSettings.address ?? '-'}`])
  rows.push([`Perioada: ${periodLabel}`])
  rows.push([`Baza legală: Ordinul MADR/MMAP/ANSVSA nr. 54/570/32/2023`])
  rows.push([]) // empty separator

  // Column headers (row 7)
  rows.push([
    'Nr. Crt.',
    'Nr. Înreg.',
    'Data Tratamentului',
    'Cultura',
    'Locul Terenului',
    'Nr. Parcelă',
    'Județ',
    'Fenofaza BBCH',
    'Cod BBCH',
    'Agent Dăunare',
    'Tip Agent',
    'Produs PPP',
    'Substanță Activă',
    'Nr. Omologare',
    'Doză Omologată Min',
    'Doză Omologată Max',
    'Doză Folosită',
    'Unitate Doză',
    'Suprafață Tratată (ha)',
    'Cantitate Utilizată',
    'Unitate Cantitate',
    'Responsabil',
    'Data Recoltare',
    'PHI (zile)',
    'Nr. Document',
    'Data Document',
    'Condiții Meteo',
    'Echipament',
    'Observații',
  ])

  // Data rows
  entries.forEach((e, i) => {
    const isDoseWarning =
      e.doza_omologata_max != null && e.doza_folosita > e.doza_omologata_max

    rows.push([
      i + 1,
      e.numar_inregistrare,
      formatDateRO(e.data_tratament),
      e.cultura,
      e.locul_terenului,
      e.nr_parcela ?? '-',
      e.judet ?? '-',
      e.bbch_descriere,
      e.bbch_code,
      e.agent_daunare,
      TIP_AGENT_LABELS[e.tip_agent],
      e.denumire_produs,
      e.substanta_activa ?? '-',
      e.nr_omologare ?? '-',
      e.doza_omologata_min ?? '-',
      e.doza_omologata_max ?? '-',
      isDoseWarning ? `⚠️ ${e.doza_folosita}` : e.doza_folosita,
      e.unitate_doza,
      e.suprafata_tratata,
      e.cantitate_utilizata,
      e.unitate_cantitate,
      e.nume_prenume_responsabil,
      formatDateRO(e.data_incepere_recoltare),
      e.phi_zile ?? '-',
      e.numar_document ?? '-',
      formatDateRO(e.data_document),
      e.conditii_meteo ?? '-',
      e.echipament_utilizat ?? '-',
      e.observatii ?? '-',
    ])
  })

  // Empty row after data
  rows.push([])
  rows.push([])

  // Footer
  const now = new Date().toLocaleString('ro-RO')
  rows.push([`Semnat: ________________`, null, null, null, null, null, null, null, null, null, null, null, null, null, `Ștampila societății`])
  rows.push([])
  rows.push([`Document generat de ArendaPro la ${now}. Registru conform OG nr. 4/1995 și Ordinul MADR nr. 54/570/32/2023.`])

  // ── Create workbook ────────────────────────────────────────────────────────
  const ws = XLSX.utils.aoa_to_sheet(rows)

  // Column widths (wch = width in characters)
  ws['!cols'] = [
    { wch: 8 },  // Nr. Crt.
    { wch: 10 }, // Nr. Înreg.
    { wch: 18 }, // Data Tratament
    { wch: 15 }, // Cultura
    { wch: 25 }, // Locul Terenului
    { wch: 12 }, // Nr. Parcela
    { wch: 14 }, // Judet
    { wch: 35 }, // Fenofaza BBCH
    { wch: 10 }, // Cod BBCH
    { wch: 25 }, // Agent Daunare
    { wch: 12 }, // Tip Agent
    { wch: 22 }, // Produs PPP
    { wch: 22 }, // Substanta Activa
    { wch: 14 }, // Nr. Omologare
    { wch: 14 }, // Doza Min
    { wch: 14 }, // Doza Max
    { wch: 14 }, // Doza Folosita
    { wch: 12 }, // Unitate Doza
    { wch: 18 }, // Suprafata
    { wch: 16 }, // Cantitate
    { wch: 14 }, // Unitate Cantitate
    { wch: 25 }, // Responsabil
    { wch: 16 }, // Data Recoltare
    { wch: 12 }, // PHI
    { wch: 16 }, // Nr. Document
    { wch: 14 }, // Data Document
    { wch: 20 }, // Conditii Meteo
    { wch: 20 }, // Echipament
    { wch: 30 }, // Observatii
  ]

  const year = period ? period.start.getFullYear() : new Date().getFullYear()
  const sheetName = `Registru Fitosanitar ${year}`

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)

  XLSX.writeFile(wb, `Registru_Fitosanitar_${year}.xlsx`)
}
