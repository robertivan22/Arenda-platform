/**
 * Generator PDF D112 — replică layout-ul oficial ANAF D112Pdf.jar (P3.0.x)
 * Folosește jspdf + jspdf-autotable, pur client-side (compatibil Cloudflare Pages edge)
 *
 * Structura PDF urmărește formularul oficial:
 *   Antet: Date angajator (CIF, denumire, casă asigurare, perioadă)
 *   Declarant: Nume, prenume, funcție
 *   Anexa — Secțiunea C (C_1=26 arendare):
 *     Tabel per arendator: CNP, Nume, Venit brut, Deducere 40%, Baza imp., Impozit reținut, CASS
 *   Totaluri: Impozit 619, CASS 469, Total plată
 *   Footer: Semnătură, dată, DRAFT
 */

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface D112PdfInput {
  luna_r: number
  an_r: number
  payer: {
    cif: string
    den: string
    caen: string
    casaAng: string
    numeDeclar: string
    prenumeDeclar: string
    functieDeclar: string
  }
  rows: Array<{
    cnp: string
    numeAsig: string
    prenAsig: string
    brut: number
    deducere: number
    netTaxable: number
    impozit: number
    cass: number
  }>
  totalBrut: number
  totalDeducere: number
  totalNet: number
  totalImpozit: number
  totalCASS: number
  totalPlata: number
}

const MONTHS_RO = [
  '', 'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
]

function ron(n: number): string {
  return n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function ronInt(n: number): string {
  return Math.round(n).toLocaleString('ro-RO')
}

export function generateD112Pdf(input: D112PdfInput): void {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = 297
  const pageH = 210
  const margin = 10

  // ── Culori brand ANAF ──────────────────────────────────────────────────
  const ANAF_BLUE: [number, number, number]   = [0, 70, 127]
  const ANAF_LBLUE: [number, number, number]  = [220, 232, 245]
  const GRAY_BG: [number, number, number]     = [245, 245, 245]
  const DARK: [number, number, number]        = [30, 30, 30]
  const RED_DRAFT: [number, number, number]   = [200, 30, 30]

  // ════════════════════════════════════════════════════════════════════════
  // PAGINA 1 — ANTET + DATE ANGAJATOR + TABEL PRINCIPAL
  // ════════════════════════════════════════════════════════════════════════

  // Header bar albastru
  doc.setFillColor(...ANAF_BLUE)
  doc.rect(0, 0, pageW, 18, 'F')

  // Titlu
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(13)
  doc.setFont('helvetica', 'bold')
  doc.text('DECLARAȚIE 112', margin, 11)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Declarație privind obligațiile de plată a contribuțiilor sociale, a impozitului pe venit', margin + 45, 8)
  doc.text('și evidența nominală a persoanelor asigurate', margin + 45, 13)

  // Perioadă (dreapta)
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  const perioadaText = `${String(input.luna_r).padStart(2, '0')} / ${input.an_r}`
  doc.text(perioadaText, pageW - margin - 30, 11)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.text('LUNA / ANUL', pageW - margin - 28, 15.5)

  // DRAFT watermark pe header
  doc.setTextColor(...RED_DRAFT)
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('DRAFT', pageW - margin - 5, 11, { align: 'right' })

  let y = 22

  // ── Secțiunea: Date angajator ──────────────────────────────────────────
  doc.setFillColor(...ANAF_LBLUE)
  doc.rect(margin, y, pageW - 2 * margin, 7, 'F')
  doc.setTextColor(...ANAF_BLUE)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('DATE PLĂTITOR (ANGAJATOR)', margin + 2, y + 5)
  y += 9

  doc.setTextColor(...DARK)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')

  // Grid date angajator — 3 coloane
  const col1 = margin
  const col2 = margin + 90
  const col3 = margin + 180

  // Rand 1
  doc.setFont('helvetica', 'bold')
  doc.text('Cod de identificare fiscală (CIF):', col1, y + 4)
  doc.setFont('helvetica', 'normal')
  doc.text(input.payer.cif || '—', col1 + 52, y + 4)

  doc.setFont('helvetica', 'bold')
  doc.text('Denumire / Nume și Prenume:', col2, y + 4)
  doc.setFont('helvetica', 'normal')
  doc.text(input.payer.den || '—', col2 + 46, y + 4)

  doc.setFont('helvetica', 'bold')
  doc.text('Cod CAEN:', col3, y + 4)
  doc.setFont('helvetica', 'normal')
  doc.text(input.payer.caen || '—', col3 + 22, y + 4)
  y += 8

  // Rand 2
  doc.setFont('helvetica', 'bold')
  doc.text('Casă asigurare sănătate:', col1, y + 4)
  doc.setFont('helvetica', 'normal')
  doc.text(input.payer.casaAng || '—', col1 + 42, y + 4)

  doc.setFont('helvetica', 'bold')
  doc.text('Perioadă raportare:', col2, y + 4)
  doc.setFont('helvetica', 'normal')
  doc.text(`${MONTHS_RO[input.luna_r]} ${input.an_r}`, col2 + 34, y + 4)

  doc.setFont('helvetica', 'bold')
  doc.text('Tip declarație:', col3, y + 4)
  doc.setFont('helvetica', 'normal')
  doc.text('0 — Inițială', col3 + 26, y + 4)
  y += 8

  // Rand 3 — declarant
  doc.setFont('helvetica', 'bold')
  doc.text('Nume declarant:', col1, y + 4)
  doc.setFont('helvetica', 'normal')
  doc.text(input.payer.numeDeclar || '—', col1 + 28, y + 4)

  doc.setFont('helvetica', 'bold')
  doc.text('Prenume declarant:', col2, y + 4)
  doc.setFont('helvetica', 'normal')
  doc.text(input.payer.prenumeDeclar || '—', col2 + 32, y + 4)

  doc.setFont('helvetica', 'bold')
  doc.text('Funcție:', col3, y + 4)
  doc.setFont('helvetica', 'normal')
  doc.text(input.payer.functieDeclar || '—', col3 + 16, y + 4)
  y += 11

  // ── Secțiunea C — Arendare (C_1=26) ───────────────────────────────────
  doc.setFillColor(...ANAF_LBLUE)
  doc.rect(margin, y, pageW - 2 * margin, 7, 'F')
  doc.setTextColor(...ANAF_BLUE)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('SECȚIUNEA C — VENITURI DIN ARENDAREA BUNURILOR AGRICOLE  (C_1 = 26, art.84 CF, deducere forfetar 40%, cotă 10%)', margin + 2, y + 5)
  y += 9

  // ── Tabel arendatori ──────────────────────────────────────────────────
  const tableRows = input.rows.map((r, i) => [
    String(i + 1),
    r.cnp || '—',
    `${r.numeAsig} ${r.prenAsig}`.trim(),
    ronInt(r.brut),
    ronInt(r.deducere),
    ronInt(r.netTaxable),
    ronInt(r.impozit),
    ronInt(r.cass),
  ])

  // Rând total
  tableRows.push([
    '', 'TOTAL', '',
    ronInt(input.totalBrut),
    ronInt(input.totalDeducere),
    ronInt(input.totalNet),
    ronInt(input.totalImpozit),
    ronInt(input.totalCASS),
  ])

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [[
      'Nr.',
      'CNP',
      'Nume și Prenume',
      'Venit brut\n(C_19) RON',
      'Deducere\n40% RON',
      'Bază\nimpozabilă RON',
      'Impozit\nreținut RON',
      'CASS\n10% RON',
    ]],
    body: tableRows,
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      lineColor: [180, 180, 180],
      lineWidth: 0.2,
      textColor: DARK,
    },
    headStyles: {
      fillColor: ANAF_BLUE,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      fontSize: 7,
      cellPadding: 2.5,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 30, font: 'courier', fontSize: 7 },
      2: { cellWidth: 55 },
      3: { halign: 'right', cellWidth: 28 },
      4: { halign: 'right', cellWidth: 24 },
      5: { halign: 'right', cellWidth: 28 },
      6: { halign: 'right', cellWidth: 26, fontStyle: 'bold' },
      7: { halign: 'right', cellWidth: 24 },
    },
    alternateRowStyles: { fillColor: GRAY_BG },
    // Ultimul rând = total — stil diferit
    didParseCell: (data) => {
      if (data.row.index === tableRows.length - 1) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = ANAF_LBLUE
        data.cell.styles.textColor = ANAF_BLUE
      }
    },
  })

  const afterTable = (doc as any).lastAutoTable.finalY + 6

  // ── Secțiunea obligații plată ──────────────────────────────────────────
  const oblY = afterTable

  // Box obligații
  doc.setFillColor(...ANAF_LBLUE)
  doc.rect(margin, oblY, 130, 6, 'F')
  doc.setTextColor(...ANAF_BLUE)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.text('OBLIGAȚII DE PLATĂ', margin + 2, oblY + 4.5)

  autoTable(doc, {
    startY: oblY + 7,
    margin: { left: margin, right: margin + 130 },
    head: [['Cod obligație', 'Denumire', 'Suma datorată (RON)', 'Suma scutită (RON)', 'Suma de plată (RON)']],
    body: [
      ['619', 'Impozit venituri arendare (cod bugetar 5503XXXXXX)', ronInt(input.totalImpozit), '0', ronInt(input.totalImpozit)],
      ['469', 'CASS arendare (cod bugetar 5503XXXXXX)', ronInt(input.totalCASS), '0', ronInt(input.totalCASS)],
      ['', 'TOTAL PLATĂ (totalPlata_A)', '', '', ronInt(input.totalPlata)],
    ],
    styles: { fontSize: 7.5, cellPadding: 1.8, lineColor: [180, 180, 180], lineWidth: 0.2, textColor: DARK },
    headStyles: { fillColor: ANAF_BLUE, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7, halign: 'center' },
    columnStyles: {
      0: { halign: 'center', cellWidth: 20 },
      1: { cellWidth: 80 },
      2: { halign: 'right', cellWidth: 30 },
      3: { halign: 'right', cellWidth: 20 },
      4: { halign: 'right', cellWidth: 25, fontStyle: 'bold' },
    },
    didParseCell: (data) => {
      if (data.row.index === 2) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = ANAF_LBLUE
        data.cell.styles.textColor = ANAF_BLUE
      }
    },
  })

  const finalY = (doc as any).lastAutoTable.finalY + 5

  // ── Footer ─────────────────────────────────────────────────────────────
  const footerY = Math.max(finalY, pageH - 28)

  // Linie separator
  doc.setDrawColor(...ANAF_BLUE)
  doc.setLineWidth(0.4)
  doc.line(margin, footerY, pageW - margin, footerY)

  doc.setTextColor(...DARK)
  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')

  // Coloana stânga — semnătură
  doc.text('Semnătură și ștampilă plătitor:', margin, footerY + 5)
  doc.line(margin, footerY + 14, margin + 60, footerY + 14)

  // Coloana mijloc — declarant
  doc.text(`Declarant: ${input.payer.numeDeclar} ${input.payer.prenumeDeclar}`, pageW / 2 - 30, footerY + 5)
  doc.text(`Funcție: ${input.payer.functieDeclar}`, pageW / 2 - 30, footerY + 9)
  doc.line(pageW / 2 - 30, footerY + 14, pageW / 2 + 30, footerY + 14)

  // Coloana dreapta — dată + nr. pagini
  const today = new Date()
  const dateStr = `${String(today.getDate()).padStart(2,'0')}.${String(today.getMonth()+1).padStart(2,'0')}.${today.getFullYear()}`
  doc.text(`Data: ${dateStr}`, pageW - margin - 50, footerY + 5)
  doc.text(`Generat de: Arenda Platform (DRAFT)`, pageW - margin - 50, footerY + 9)

  // DRAFT stamp diagonal
  doc.setTextColor(...RED_DRAFT)
  doc.setFontSize(40)
  doc.setFont('helvetica', 'bold')
  doc.setGState(new (doc as any).GState({ opacity: 0.08 }))
  doc.text('DRAFT', pageW / 2, pageH / 2, { align: 'center', angle: 35 })
  doc.setGState(new (doc as any).GState({ opacity: 1 }))

  // Notă legală
  doc.setTextColor(100, 100, 100)
  doc.setFontSize(6)
  doc.setFont('helvetica', 'italic')
  doc.text(
    'Acest document este generat automat cu titlu informativ (DRAFT). ' +
    'Validați cu software-ul oficial ANAF D112 înainte de depunere. ' +
    'Nu trimiteți direct la ANAF.',
    pageW / 2, footerY + 20, { align: 'center' }
  )

  // ── Număr pagini ───────────────────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setTextColor(150, 150, 150)
    doc.setFontSize(6)
    doc.setFont('helvetica', 'normal')
    doc.text(`Pagina ${i} din ${totalPages}`, pageW - margin, pageH - 3, { align: 'right' })
    doc.text(`D112 | ${MONTHS_RO[input.luna_r]} ${input.an_r} | CIF: ${input.payer.cif}`, margin, pageH - 3)
  }

  // ── Salvare ────────────────────────────────────────────────────────────
  const filename = `D112_${input.an_r}_${String(input.luna_r).padStart(2, '0')}_${input.payer.cif || 'DRAFT'}.pdf`
  doc.save(filename)
}

/** Construiește inputul PDF din dataset + payer */
export function buildD112PdfInput(
  dataset: {
    periodYear: number
    periodMonth: number
    rows: Array<{
      lessorCnp: string
      lessorLastName: string
      lessorFirstName: string
      grossAmountRon: number
      flatDeductionRon: number
      netTaxableRon: number
      withholdingTaxRon: number
    }>
    totalGrossRon: number
    totalWithholdingTaxRon: number
  },
  payer: {
    cif: string
    den: string
    caen: string
    casaAng: string
    numeDeclar: string
    prenumeDeclar: string
    functieDeclar: string
  }
): D112PdfInput {
  // Agregare per CNP
  const byLessor = new Map<string, { last: string; first: string; brut: number; ded: number; net: number; imp: number }>()
  for (const r of dataset.rows) {
    const key = r.lessorCnp || `NECNP_${r.lessorLastName}`
    const ex = byLessor.get(key)
    if (ex) { ex.brut += r.grossAmountRon; ex.ded += r.flatDeductionRon; ex.net += r.netTaxableRon; ex.imp += r.withholdingTaxRon }
    else byLessor.set(key, { last: r.lessorLastName, first: r.lessorFirstName, brut: r.grossAmountRon, ded: r.flatDeductionRon, net: r.netTaxableRon, imp: r.withholdingTaxRon })
  }

  const rows = [...byLessor.entries()].map(([cnp, d]) => ({
    cnp,
    numeAsig: d.last.toUpperCase(),
    prenAsig: d.first.toUpperCase(),
    brut: Math.round(d.brut),
    deducere: Math.round(d.ded),
    netTaxable: Math.round(d.net),
    impozit: Math.round(d.imp),
    cass: Math.round(Math.round(d.brut) * 0.10),
  }))

  const totalBrut = Math.round(dataset.totalGrossRon)
  const totalImpozit = Math.round(dataset.totalWithholdingTaxRon)
  const totalDeducere = Math.round(totalBrut * 0.40)
  const totalNet = totalBrut - totalDeducere
  const totalCASS = rows.reduce((s, r) => s + r.cass, 0)

  return {
    luna_r: dataset.periodMonth,
    an_r: dataset.periodYear,
    payer,
    rows,
    totalBrut,
    totalDeducere,
    totalNet,
    totalImpozit,
    totalCASS,
    totalPlata: totalImpozit + totalCASS,
  }
}
