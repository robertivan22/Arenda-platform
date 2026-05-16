/**
 * Generator PDF D112 — layout identic cu formularul oficial ANAF
 * Portrait A4, structura dupa screenshot-urile D112Pdf.jar:
 *   Pag 1: Header "112", date platitor, Sectiunea A (creante fiscale)
 *   Pag 6 (Anexa): Tabel asigurati C_1=26 (arendare)
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

const MONTHS_RO = ['','Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie',
  'Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie']

function ronInt(n: number): string { return Math.round(n).toLocaleString('ro-RO') }

function box(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setDrawColor(0); doc.setLineWidth(0.2); doc.rect(x, y, w, h)
}

function labelVal(doc: jsPDF, label: string, val: string, x: number, y: number, lw: number, fw: number, h = 6) {
  doc.setFont('helvetica','normal'); doc.setFontSize(7)
  doc.setTextColor(80,80,80); doc.text(label, x + 1, y + h - 1.5)
  box(doc, x + lw, y, fw, h)
  doc.setTextColor(0,0,0); doc.setFont('helvetica','bold'); doc.setFontSize(8)
  if (val) doc.text(val, x + lw + 1, y + h - 1.5)
}

function sectionHeader(doc: jsPDF, title: string, y: number, pageW: number, margin: number) {
  doc.setFillColor(200, 220, 240)
  doc.rect(margin, y, pageW - 2 * margin, 6, 'F')
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(0,0,0)
  doc.text(title, margin + 2, y + 4.3)
  return y + 8
}

export function generateD112Pdf(input: D112PdfInput): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = 210
  const margin = 10
  const cW = pageW - 2 * margin  // content width = 190mm

  // ═══════════════════════════════════════════════════
  // PAGINA 1 — Header principal + Date platitor + Sec A
  // ═══════════════════════════════════════════════════

  // Antet "Anexa nr. 1" sus-dreapta
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(0,0,0)
  doc.text('Anexa nr. 1', pageW - margin, 10, { align: 'right' })

  // Titlu
  doc.setFont('helvetica','bold'); doc.setFontSize(11)
  doc.text('DECLARATIE PRIVIND OBLIGATIILE DE PLATA', pageW / 2, 16, { align: 'center' })
  doc.setFontSize(9)
  doc.text('A CONTRIBUTIILOR SOCIALE, A IMPOZITULUI PE VENIT SI EVIDENTA NOMINALA', pageW / 2, 21, { align: 'center' })
  doc.text('A PERSOANELOR ASIGURATE', pageW / 2, 26, { align: 'center' })

  // Box "112"
  doc.setFillColor(255,255,255); doc.setDrawColor(0); doc.setLineWidth(0.5)
  doc.rect(margin, 10, 18, 18)
  doc.setFont('helvetica','bold'); doc.setFontSize(16)
  doc.text('112', margin + 9, 21.5, { align: 'center' })

  // Perioada de raportare (dreapta sus)
  doc.setFont('helvetica','normal'); doc.setFontSize(7)
  doc.text('Perioada de raportare', pageW - margin - 32, 16)
  doc.setFont('helvetica','normal'); doc.setFontSize(7)
  doc.text('Luna', pageW - margin - 32, 21)
  box(doc, pageW - margin - 24, 17.5, 10, 6)
  doc.setFont('helvetica','bold'); doc.setFontSize(8)
  doc.text(String(input.luna_r).padStart(2,'0'), pageW - margin - 19, 22, { align: 'center' })
  doc.setFont('helvetica','normal'); doc.setFontSize(7)
  doc.text('An', pageW - margin - 12, 21)
  box(doc, pageW - margin - 8, 17.5, 18, 6)
  doc.setFont('helvetica','bold'); doc.setFontSize(8)
  doc.text(String(input.an_r), pageW - margin + 1, 22, { align: 'right' })

  let y = 32

  // Declaratie (initiala/rectificativa)
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(0)
  doc.text('Declaratie ( initiala/rectificativa ) (d_rec)', margin, y + 4)
  box(doc, margin + 60, y, 50, 6)
  doc.setFont('helvetica','bold'); doc.setFontSize(7.5)
  doc.text('0-Declaratie initiala', margin + 62, y + 4.3)
  y += 9

  // Tip declaratiei
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5)
  doc.text('Tipul declaratiei  (tip_rec)', margin, y + 4)
  box(doc, margin + 45, y, cW - 45, 6)
  y += 9

  // Nota info
  doc.setFontSize(6.5); doc.setFont('helvetica','normal'); doc.setTextColor(40,40,40)
  doc.text('d_rec=0 pt. tip_rec = (3,5,null)', margin, y + 3)
  doc.text('d_rec=1 pt. tip_rec > 0 sau null', margin, y + 6)
  doc.text('tip_rec=7 pt. AJOFM,CNAS, CNP,ANPIS', margin, y + 9)

  // Box "Declaratie depusa..." dreapta
  box(doc, margin + 65, y, cW - 65, 12)
  doc.setTextColor(0); doc.setFontSize(7)
  doc.text('Declaratie depusa potrivit art.90 alin.(4) din Codul de procedura fiscala', margin + 67, y + 4)
  doc.setFontSize(7)
  doc.text('Cod de identificare fiscala succesor (cifS)', margin + 67, y + 9)
  box(doc, margin + 127, y + 6, 30, 5)
  y += 15

  // ── DATE DE IDENTIFICARE A PLATITORULUI ────────────────────────────────
  y = sectionHeader(doc, 'DATE DE IDENTIFICARE A PLATITORULUI', y, pageW, margin)

  // CIF
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(0)
  doc.text('Cod de identificare fiscala', margin, y + 4)
  // CIF boxes (13 individual squares)
  const cifStart = margin + 48
  for (let i = 0; i < 13; i++) {
    box(doc, cifStart + i * 6, y, 6, 6)
    if (input.payer.cif && input.payer.cif[i]) {
      doc.setFont('helvetica','bold'); doc.setFontSize(8)
      doc.text(input.payer.cif[i], cifStart + i * 6 + 3, y + 4.3, { align: 'center' })
    }
  }
  y += 8

  // Denumire
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5); doc.setTextColor(0)
  doc.text('Denumire', margin, y + 4)
  box(doc, margin + 25, y, cW - 25, 6)
  doc.setFont('helvetica','bold'); doc.setFontSize(8)
  doc.text(input.payer.den || '', margin + 27, y + 4.3)
  y += 8

  // Adresa domiciliu fiscal
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5)
  doc.text('Adresa domiciliu fiscal', margin, y + 4)
  box(doc, margin + 38, y, cW - 38, 6)
  y += 8

  // Telefon / Fax / Email
  doc.text('Telefon', margin, y + 4); box(doc, margin + 15, y, 33, 6)
  doc.text('Fax', margin + 53, y + 4); box(doc, margin + 60, y, 40, 6)
  doc.text('E-mail', margin + 105, y + 4); box(doc, margin + 117, y, cW - 107, 6)
  y += 8

  // CAEN row
  doc.setFontSize(7)
  doc.text('Activitatea principala (cod si denumire clasa CAEN)', margin + 15, y + 3.5)
  box(doc, margin, y, cW - 60, 14)
  // CAEN 2024 / 2025
  doc.setFontSize(7.5)
  doc.text('CAEN 2024', margin + 1, y + 5)
  doc.text('CAEN 2025', margin + 1, y + 11)
  box(doc, margin + 18, y + 2, 60, 5)
  box(doc, margin + 18, y + 8, 60, 5)
  doc.setFont('helvetica','bold')
  doc.text(input.payer.caen || '', margin + 20, y + 5.5)

  // Datoreaza CAM
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5)
  doc.text('Datoreaza CAM (D/N) (datCAM)', pageW - margin - 58, y + 5)
  box(doc, pageW - margin - 15, y + 1, 8, 6)
  doc.setFont('helvetica','bold'); doc.text('D', pageW - margin - 11, y + 5.5)
  y += 17

  // ── SECTIUNEA A — Creante fiscale ─────────────────────────────────────
  y = sectionHeader(doc, 'SECTIUNEA A - Creante fiscale', y, pageW, margin)

  // Nr. Crt / Denumire creanta fiscala header
  box(doc, margin, y, 20, 6); doc.setFont('helvetica','normal'); doc.setFontSize(7)
  doc.text('Nr. Crt', margin + 1, y + 4.2)
  box(doc, margin + 20, y, 8, 6)
  doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.text('1', margin + 24, y + 4.2, { align: 'center' })
  box(doc, margin + 28, y, cW - 28, 6)
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5)
  doc.text('Denumire creanta fiscala', margin + 30, y + 4.2)
  y += 6

  // Dropdown row (creanta fiscala)
  box(doc, margin, y, cW, 6)
  y += 6

  // Cod bugetar + Suma box
  box(doc, margin, y, 35, 30)
  doc.setFont('helvetica','normal'); doc.setFontSize(7)
  doc.text('Cod bugetar', margin + 1, y + 5)
  box(doc, margin + 1, y + 6, 32, 6)

  // Butoane + / -
  box(doc, margin + 5, y + 20, 10, 6); doc.text('+', margin + 10, y + 24, { align: 'center' })
  box(doc, margin + 18, y + 20, 10, 6); doc.text('-', margin + 23, y + 24, { align: 'center' })

  // Suma dreapta
  const sumX = margin + 37
  doc.text('Suma', sumX + 40, y + 4, { align: 'center' })
  const sumRows = ['1. Datorata','2. Deductibila','3. Scutita','4. De plata (4=1-2-3 >=0)']
  for (let i = 0; i < sumRows.length; i++) {
    const rowY = y + 6 + i * 6
    box(doc, sumX, rowY, cW - 37, 6)
    doc.setFont('helvetica','normal'); doc.setFontSize(7)
    doc.text(sumRows[i], sumX + 1, rowY + 4.2)
    box(doc, sumX + cW - 37 - 20, rowY, 20, 6)
    doc.setFont('helvetica','bold'); doc.text('0', sumX + cW - 37 - 2, rowY + 4.2, { align: 'right' })
  }
  y += 32

  // Total obligatii de plata
  box(doc, margin, y, cW - 20, 6); box(doc, margin + cW - 20, y, 20, 6)
  doc.setFont('helvetica','normal'); doc.setFontSize(7)
  doc.text('Total obligatii de plata   (suma de control)', margin + 2, y + 4.2)
  doc.setFont('helvetica','bold'); doc.setFontSize(8)
  doc.text('0', pageW - margin - 2, y + 4.2, { align: 'right' })
  y += 10

  // Nota legala
  doc.setFont('helvetica','italic'); doc.setFontSize(6.5); doc.setTextColor(40,40,40)
  doc.text('Prezenta declaratie reprezinta titlu de creanta si produce efectele juridice ale instiintarii de plata de la data depunerii acesteia, in conditiile legii', margin, y + 3)
  y += 8

  // Butoane 1.ACTUALIZEAZA / 2.VALIDARE
  doc.setFillColor(245,200,100)
  doc.rect(margin + 10, y, 55, 8, 'F')
  doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(0)
  doc.text('1.ACTUALIZEAZA ANGAJATOR', margin + 37, y + 5.2, { align: 'center' })
  doc.setFontSize(6.5); doc.setFont('helvetica','normal')
  doc.text('(inainte de VALIDARE)', margin + 37, y + 7.5, { align: 'center' })

  doc.setFillColor(245,140,50)
  doc.rect(margin + 10, y + 10, 55, 8, 'F')
  doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(0)
  doc.text('2.VALIDARE', margin + 37, y + 16, { align: 'center' })
  y += 22

  // Semnatura
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(0)
  doc.text('Sub sanctiunile aplicate faptei de fals in acte publice, declar ca datele din aceasta declaratie sunt corecte si complete.', margin, y + 4)
  y += 8

  box(doc, margin, y, 45, 12); doc.text('Nume,', margin + 2, y + 4)
  if (input.payer.numeDeclar) { doc.setFont('helvetica','bold'); doc.text(input.payer.numeDeclar, margin + 2, y + 9) }
  box(doc, margin + 50, y, 45, 6); doc.setFont('helvetica','normal'); doc.text('Prenume,', margin + 52, y + 4)
  if (input.payer.prenumeDeclar) { doc.setFont('helvetica','bold'); doc.text(input.payer.prenumeDeclar, margin + 52, y + 4) }

  box(doc, margin + 110, y, cW - 110, 12)
  doc.setFont('helvetica','normal'); doc.text('Semnatura si stampila', margin + 112, y + 4)
  y += 14

  box(doc, margin, y, 45, 6); doc.setFont('helvetica','normal'); doc.setFontSize(7.5)
  doc.text('Functia / calitatea', margin + 2, y + 4)
  if (input.payer.functieDeclar) { doc.setFont('helvetica','bold'); doc.text(input.payer.functieDeclar, margin + 2, y + 9) }
  y += 10

  // Loc rezervat autoritatii
  doc.setFont('helvetica','bold'); doc.setFontSize(8)
  doc.text('Loc rezervat autoritatii competente', margin, y + 4)
  y += 6
  box(doc, margin, y, cW - 40, 6); doc.setFont('helvetica','normal'); doc.setFontSize(7.5)
  doc.text('Numar de inregistrare', margin + 2, y + 4.2)
  box(doc, pageW - margin - 38, y, 38, 6)
  doc.text('Din data', pageW - margin - 36, y + 4.2)
  box(doc, pageW - margin - 20, y, 20, 6)
  y += 10

  // Footer pag 1
  doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(80,80,80)
  doc.text('Document care contine date cu caracter personal protejate de prevederile Regulamentului UE 2016/679', margin, 285)
  doc.text('PAG', margin, 290); doc.setFont('helvetica','bold'); doc.text('1', margin + 9, 290)
  doc.text('03.03.2026', pageW - margin, 290, { align: 'right' })

  // ═══════════════════════════════════════════════════════
  // PAGINA 2 — Anexa 1.1 Angajator (date identificare)
  // ═══════════════════════════════════════════════════════
  doc.addPage()

  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(0)
  doc.text('Anexa nr. 1.1 - Angajator', pageW - margin, 10, { align: 'right' })

  y = 14
  y = sectionHeader(doc, 'SECTIUNEA A - ALTE DATE DE IDENTIFICARE A PLATITORULUI', y, pageW, margin)

  labelVal(doc, 'Nr. ordine registrul comertului', '', margin, y, 55, cW - 55); y += 8
  labelVal(doc, 'Adresa sediu social', '', margin, y, 35, cW - 35); y += 8

  doc.setFont('helvetica','normal'); doc.setFontSize(7.5)
  doc.text('Telefon', margin, y + 4); box(doc, margin + 15, y, 33, 6)
  doc.text('Fax', margin + 53, y + 4); box(doc, margin + 60, y, 40, 6)
  doc.text('E-mail', margin + 105, y + 4); box(doc, margin + 117, y, cW - 107, 6)
  y += 8

  doc.text('Casa de asigurari de sanatate angajator (casaAng)', margin, y + 4)
  box(doc, margin + 80, y, 30, 6)
  doc.setFont('helvetica','bold'); doc.setFontSize(8)
  doc.text(input.payer.casaAng || '', margin + 82, y + 4.3)
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5)
  doc.text('Datoreaza CAM (D/N) (datCAM)', margin + 120, y + 4)
  box(doc, margin + 165, y, 8, 6); doc.setFont('helvetica','bold'); doc.text('D', margin + 167, y + 4.3)
  y += 10

  y = sectionHeader(doc, 'SECTIUNEA B - Indicatori statistici', y, pageW, margin)

  const bRows = [
    '1. Numar de asigurati somaj (B_cnp) pt. cnp unic',
    '2. Numar de asigurati concedii medicale si indemnizatii (B_sanatate)',
    '3. Numar de asigurati pentru care se datoreaza CAS (B_pense)\n   pt.A_14>0, B4_8>0, B4_20>0, B4_28>0',
    '4. Total fond de salarii brute (B_brutSalarii) (C3_13-C3_14) + Sum.A_11+Sum.B4_5+Sum.B3_12',
    '5. Numar salariati (B_sal) pt.A_1,81_1=(1,2,8,10,25,27,28,48,46,38,51,52,54) si cnp unic',
    '6. Numar asigurati Legea 111/2022 care datoreaza CAS',
    '7. Numar asigurati Legea 111/2022 care indeplinesc conditia de la art 3 alin (7) (8)',
    '8. Total Baza lunara de calcul CAS',
    '9. Total CAS',
    '10. Numar asigurati Legea 111/2022 care indeplinesc conditia de la art 9 alin (5)',
  ]
  for (const r of bRows) {
    box(doc, margin, y, cW - 20, 6); box(doc, margin + cW - 20, y, 20, 6)
    doc.setFont('helvetica','normal'); doc.setFontSize(6.5); doc.setTextColor(0)
    doc.text(r.split('\n')[0], margin + 1, y + 4.2)
    y += 6
  }

  // Footer
  doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(80,80,80)
  doc.text('PAG', margin, 290); doc.setFont('helvetica','bold'); doc.text('2', margin + 9, 290)
  doc.text('03.03.2026', pageW - margin, 290, { align: 'right' })

  // ═══════════════════════════════════════════════════════
  // PAGINA 6 — Asigurat C_1=26 (arendare)
  // ═══════════════════════════════════════════════════════
  doc.addPage()
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(0)
  doc.text('Perioada de raportare', pageW / 2 - 20, 10)
  box(doc, pageW / 2 + 15, 7, 10, 6)
  doc.setFont('helvetica','bold'); doc.text(String(input.luna_r).padStart(2,'0'), pageW / 2 + 20, 11.5, { align: 'center' })
  doc.setFont('helvetica','normal'); doc.text('/', pageW / 2 + 27, 11.5)
  box(doc, pageW / 2 + 30, 7, 18, 6)
  doc.setFont('helvetica','bold'); doc.text(String(input.an_r), pageW / 2 + 39, 11.5, { align: 'center' })
  doc.setFont('helvetica','normal'); doc.setFontSize(8)
  doc.text('Nr. crt.', pageW - margin - 20, 10)
  box(doc, pageW - margin - 8, 7, 8, 6)
  doc.setFont('helvetica','bold'); doc.text('1', pageW - margin - 4, 11.5, { align: 'center' })

  // Titlu
  doc.setFont('helvetica','bold'); doc.setFontSize(10)
  doc.text('DECLARATIE PRIVIND OBLIGATIILE DE PLATA', pageW / 2, 20, { align: 'center' })
  doc.setFontSize(8)
  doc.text('A CONTRIBUTIILOR SOCIALE, A IMPOZITULUI PE VENIT SI EVIDENTA NOMINALA', pageW / 2, 25, { align: 'center' })
  doc.text('A PERSOANELOR ASIGURATE', pageW / 2, 30, { align: 'center' })

  y = 36

  y = sectionHeader(doc, 'DATE DE IDENTIFICARE ASIGURAT', y, pageW, margin)

  // CNP/NIF
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5)
  doc.text('1.CNP / NIF', margin, y + 4)
  for (let i = 0; i < 13; i++) box(doc, margin + 22 + i * 6, y, 6, 6)
  doc.text('2.CNP / NIF anterior', margin + 110, y + 4)
  for (let i = 0; i < 13; i++) box(doc, margin + 140 + i * 6, y, 6, 6)
  y += 8

  doc.text('3.Nume', margin, y + 4); box(doc, margin + 15, y, 75, 6)
  doc.text('4.Nume anterior', margin + 95, y + 4); box(doc, margin + 120, y, 70, 6)
  y += 8
  doc.text('Prenume', margin, y + 4); box(doc, margin + 15, y, 75, 6)
  doc.text('Prenume anterior', margin + 95, y + 4); box(doc, margin + 125, y, 65, 6)
  y += 8
  doc.setFontSize(7)
  doc.text('5.Data intrare in categ. de asigurat (dataAng)', margin, y + 4); box(doc, margin + 72, y, 35, 6)
  doc.text('6.Data iesire din categ. de asigurat (dataSf)', margin + 115, y + 4); box(doc, margin + 163, y, 27, 6)
  y += 8

  // Sectiunile A / B / C selector
  doc.setFont('helvetica','bold'); doc.setFontSize(9)
  doc.text('ALEGETI UNA/DOUA DIN SECTIUNILE DE MAI JOS PENTRU ASIGURATUL CURENT (CNP unic)', pageW/2, y + 4, { align: 'center' })
  y += 8
  doc.setFont('helvetica','normal'); doc.setFontSize(8)
  doc.text('O Sectiunea A', margin + 10, y + 4)
  doc.text('O Sectiunea B', margin + 60, y + 4)
  doc.setFont('helvetica','bold')
  doc.text('● Sectiunea C', margin + 110, y + 4)
  doc.setFont('helvetica','normal'); doc.setFontSize(7.5)
  doc.text('Numarul de zile lucratoare (tfNZL)', margin + 145, y + 4)
  box(doc, pageW - margin - 15, y, 15, 6)
  y += 10

  // ── SECTIUNEA C — Tabel arendatori ────────────────────────────────────
  y = sectionHeader(doc, 'SECTIUNEA C — Venituri din arendarea bunurilor agricole (C_1=26, art.84 CF, deducere 40%, cota 10%)', y, pageW, margin)

  const tableRows = input.rows.map((r, i) => [
    String(i + 1),
    r.cnp || '—',
    r.numeAsig,
    r.prenAsig,
    ronInt(r.brut),
    ronInt(r.deducere),
    ronInt(r.netTaxable),
    ronInt(r.impozit),
    ronInt(r.cass),
  ])
  tableRows.push([
    '', 'TOTAL', '', '',
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
      'Nume',
      'Prenume',
      'Venit brut\n(C_19) RON',
      'Deducere\n40% RON',
      'Baza\nimp. RON',
      'Impozit\nRON',
      'CASS\n10% RON',
    ]],
    body: tableRows,
    styles: { fontSize: 7, cellPadding: 1.8, lineColor: [0,0,0], lineWidth: 0.2, textColor: [0,0,0] },
    headStyles: { fillColor: [200,220,240], textColor: [0,0,0], fontStyle: 'bold', halign: 'center', fontSize: 7 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8 },
      1: { halign: 'center', cellWidth: 28, font: 'courier', fontSize: 6.5 },
      2: { cellWidth: 28 },
      3: { cellWidth: 28 },
      4: { halign: 'right', cellWidth: 22 },
      5: { halign: 'right', cellWidth: 20 },
      6: { halign: 'right', cellWidth: 22 },
      7: { halign: 'right', cellWidth: 20, fontStyle: 'bold' },
      8: { halign: 'right', cellWidth: 20 },
    },
    didParseCell: (data) => {
      if (data.row.index === tableRows.length - 1) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [220,235,248]
      }
    },
  })

  const finalY = (doc as any).lastAutoTable.finalY + 8

  // Total plata
  const totY = finalY
  box(doc, margin, totY, cW - 30, 6)
  doc.setFont('helvetica','bold'); doc.setFontSize(8)
  doc.text('Total obligatii de plata (impozit + CASS):', margin + 2, totY + 4.2)
  box(doc, pageW - margin - 28, totY, 28, 6)
  doc.text(ronInt(input.totalPlata), pageW - margin - 2, totY + 4.2, { align: 'right' })

  // Footer
  doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(80,80,80)
  doc.text('D112_A7.2.5', margin, 283)
  box(doc, margin, 285, 30, 7)
  doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(0)
  doc.text('Versiuni', margin + 15, 289.5, { align: 'center' })
  doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(80,80,80)
  doc.text('PAG', margin, 296); doc.setFont('helvetica','bold'); doc.text('6', margin + 9, 296)
  doc.text('03.03.2026', pageW - margin, 296, { align: 'right' })

  const today = new Date()
  const dateStr = `${String(today.getDate()).padStart(2,'0')}.${String(today.getMonth()+1).padStart(2,'0')}.${today.getFullYear()}`
  doc.setFont('helvetica','normal'); doc.setFontSize(7); doc.setTextColor(120,120,120)
  doc.text(`Generat: ${dateStr} | DRAFT — Validati cu soft ANAF inainte de depunere`, pageW/2, 300, { align: 'center' })

  const filename = `D112_${input.an_r}_${String(input.luna_r).padStart(2,'0')}_${input.payer.cif || 'DRAFT'}.pdf`
  doc.save(filename)
}

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
