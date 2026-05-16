/**
 * Generator PDF D112 — layout identic cu formularul oficial ANAF D112Pdf.jar
 * Pagini:
 *   1 (Anexa 1)   — Header 112, Date platitor, Sec A creante fiscale, semnatura
 *   2 (Anexa 1.1) — Alte date angajator, Sec B indicatori statistici, Sec C1 conditii munca
 *   3             — Sec C2 indemnizatii OUG 158/2005, Sec C3 accidente munca, Sec C4 CAM
 *   4             — Sec D,E indicatori, Sec F impozit sediu principal + secundar
 *   5             — F.2 Sedii secundare
 *   6             — Asigurat C_1=26 (arendare) — tabel per persoana
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

// ── Helpers ────────────────────────────────────────────────────────────────

function ronInt(n: number): string {
  return Math.round(n).toLocaleString('ro-RO')
}

/** Draw a thin border rect */
function rect(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setDrawColor(0, 0, 0)
  doc.setLineWidth(0.2)
  doc.rect(x, y, w, h)
}

/** Section header bar (light blue fill) */
function sectionBar(doc: jsPDF, title: string, x: number, y: number, w: number): number {
  doc.setFillColor(210, 225, 242)
  doc.rect(x, y, w, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(0, 0, 0)
  doc.text(title, x + 1.5, y + 4.3)
  return y + 7
}

/** Small label above a field */
function field(doc: jsPDF, label: string, value: string, x: number, y: number, w: number, h = 6) {
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(80, 80, 80)
  doc.text(label, x, y + 3.5)
  rect(doc, x, y + 4, w, h)
  if (value) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(0, 0, 0)
    doc.text(value, x + 1, y + 4 + h - 1.8)
  }
}

/** Row of key-value inside a border box */
function infoRow(doc: jsPDF, label: string, value: string, x: number, y: number, totalW: number, labelW: number, h = 6) {
  rect(doc, x, y, totalW, h)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(60, 60, 60)
  doc.text(label, x + 1, y + h - 1.8)
  if (value) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(0, 0, 0)
    doc.text(value, x + labelW, y + h - 1.8)
  }
}

/** CIF individual squares */
function cifBoxes(doc: jsPDF, cif: string, x: number, y: number) {
  for (let i = 0; i < 13; i++) {
    rect(doc, x + i * 5.5, y, 5.5, 6)
    if (cif[i]) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(8)
      doc.setTextColor(0, 0, 0)
      doc.text(cif[i], x + i * 5.5 + 2.75, y + 4.3, { align: 'center' })
    }
  }
}

/** Page footer */
function footer(doc: jsPDF, pageNum: number, pageW: number, margin: number) {
  const date = '03.03.2026'
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(80, 80, 80)
  doc.text('Document care contine date cu caracter personal protejate de prevederile Regulamentului UE 2016/679', margin, 284)
  doc.text('PAG', margin, 290)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text(String(pageNum), margin + 9, 290)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(0, 0, 0)
  doc.text(date, pageW - margin, 290, { align: 'right' })
}

/** Blank stat row — label left, empty value box right */
function statRow(doc: jsPDF, label: string, x: number, y: number, w: number, h = 5.5): number {
  rect(doc, x, y, w - 22, h)
  rect(doc, x + w - 22, y, 22, h)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.5)
  doc.setTextColor(0, 0, 0)
  doc.text(label, x + 1, y + h - 1.5)
  return y + h
}

// ══════════════════════════════════════════════════════════════════════════════
export function generateD112Pdf(input: D112PdfInput): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const PW = 210
  const M = 10
  const CW = PW - 2 * M  // 190mm

  // ══════════════════════════════════════════════════════════════════════════
  // PAGINA 1 — Anexa nr. 1
  // ══════════════════════════════════════════════════════════════════════════

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(0, 0, 0)
  doc.text('Anexa nr. 1', PW - M, 8, { align: 'right' })

  // Box "112"
  rect(doc, M, 8, 20, 20)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text('112', M + 10, 21, { align: 'center' })

  // Titlu
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.text('DECLARATIE PRIVIND OBLIGATIILE DE PLATA', PW / 2, 13, { align: 'center' })
  doc.setFontSize(9)
  doc.text('A CONTRIBUTIILOR SOCIALE, A IMPOZITULUI PE VENIT SI EVIDENTA NOMINALA', PW / 2, 18, { align: 'center' })
  doc.text('A PERSOANELOR ASIGURATE', PW / 2, 23, { align: 'center' })

  // Instructiuni (left orange box)
  doc.setFillColor(255, 220, 180)
  doc.rect(M, 30, 38, 8, 'F')
  rect(doc, M, 30, 38, 8)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.text('INSTRUCTIUNI DE COMPLETARE', M + 19, 35, { align: 'center' })

  // Info text blue
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6)
  doc.setTextColor(0, 0, 200)
  doc.text('NU IMPORTATI decat XML-URI D112 generate prin functia ADOBE READER', M + 42, 33)
  doc.text("'ExportData'!  Pentru a vizualiza starea declaratiei dupa depunere, accesati", M + 42, 36)
  doc.text('link-ul: http://www.anaf.mfinante.gov.ro/StareD112', M + 42, 39)
  doc.text('(versiune valabila incepand cu luna de raportare  01/2026)', M + 42, 42)

  // Modifica automat
  doc.setFillColor(255, 220, 180)
  doc.rect(PW - M - 38, 30, 38, 8, 'F')
  rect(doc, PW - M - 38, 30, 38, 8)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.setTextColor(0, 0, 0)
  doc.text('Modifica automat A,B,A_6', PW - M - 19, 34, { align: 'center' })
  doc.text('dupa ce se schimba LUNA', PW - M - 19, 37.5, { align: 'center' })

  let y = 46

  // Declaratie initiala row
  infoRow(doc, 'Declaratie ( initiala/rectificativa ) (d_rec)', '0-Declaratie initiala', M, y, CW * 0.6, 48, 7)

  // Perioada de raportare (right)
  rect(doc, M + CW * 0.62, y, CW * 0.38, 7)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(0)
  doc.text('Perioada de raportare', M + CW * 0.62 + 1, y + 4.5)
  doc.text('Luna', M + CW * 0.62 + 1, y + 9)
  rect(doc, M + CW * 0.62 + 12, y + 6, 10, 6)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
  doc.text(String(input.luna_r).padStart(2, '0'), M + CW * 0.62 + 17, y + 11, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
  doc.text('An', M + CW * 0.62 + 26, y + 9)
  rect(doc, M + CW * 0.62 + 30, y + 6, 20, 6)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
  doc.text(String(input.an_r), M + CW * 0.62 + 40, y + 11, { align: 'center' })
  y += 16

  // Tip declaratiei
  infoRow(doc, 'Tipul declaratiei  (tip_rec)', '', M, y, CW, 50, 7)
  y += 8

  // Note stanga
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6); doc.setTextColor(0)
  doc.text('d_rec=0 pt. tip_rec = (3,5,null)', M, y + 3)
  doc.text('d_rec=1 pt. tip_rec > 0 sau null', M, y + 6)
  doc.text('tip_rec=7 pt. AJOFM,CNAS, CNP,ANPIS', M, y + 9)

  // Declaratie depusa + CIF succesor
  rect(doc, M + 60, y, CW - 60, 14)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(0)
  doc.text('Declaratie depusa potrivit art.90 alin.(4) din Codul de procedura fiscala', M + 62, y + 5)
  doc.text('Cod de identificare fiscala succesor (cifS)', M + 62, y + 10)
  rect(doc, M + 130, y + 7, 30, 5)
  y += 18

  // ── DATE DE IDENTIFICARE A PLATITORULUI ─────────────────────────────────
  y = sectionBar(doc, 'DATE DE IDENTIFICARE A PLATITORULUI', M, y, CW)

  // CIF
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(0)
  doc.text('Cod de identificare fiscala', M, y + 5)
  cifBoxes(doc, input.payer.cif || '', M + 46, y)
  y += 9

  // Denumire
  infoRow(doc, 'Denumire', input.payer.den || '', M, y, CW, 22, 7)
  y += 9

  // Adresa
  infoRow(doc, 'Adresa domiciliu fiscal', '', M, y, CW, 40, 7)
  y += 9

  // Telefon / Fax / Email
  rect(doc, M, y, CW, 7)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(0)
  doc.text('Telefon', M + 1, y + 4.8)
  rect(doc, M + 14, y, 30, 7)
  doc.text('Fax', M + 50, y + 4.8)
  rect(doc, M + 56, y, 35, 7)
  doc.text('E-mail', M + 96, y + 4.8)
  rect(doc, M + 107, y, CW - 107, 7)
  y += 9

  // CAEN row
  rect(doc, M, y, CW - 55, 16)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5)
  doc.text('Activitatea principala (cod si denumire clasa CAEN)', M + 20, y + 4)
  doc.setFontSize(7.5)
  doc.text('CAEN 2024', M + 1, y + 7)
  rect(doc, M + 18, y + 3, 60, 5); doc.setFont('helvetica', 'normal')
  doc.text('CAEN 2025', M + 1, y + 13)
  rect(doc, M + 18, y + 9, 60, 5)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
  doc.text(input.payer.caen || '', M + 20, y + 12.5)

  // Datoreaza CAM
  rect(doc, PW - M - 52, y, 52, 16)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
  doc.text('Datoreaza CAM (D/N) (datCAM)', PW - M - 51, y + 5)
  rect(doc, PW - M - 10, y + 6, 8, 6)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
  doc.text('D', PW - M - 6, y + 11, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5)
  doc.text('Unitate Speciala', PW - M - 51, y + 13)
  y += 19

  // ── SECTIUNEA A — Creante fiscale ──────────────────────────────────────
  y = sectionBar(doc, 'SECTIUNEA A - Creante fiscale', M, y, CW)

  // Header row
  rect(doc, M, y, 20, 7); doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
  doc.text('Nr. Crt', M + 1, y + 5)
  rect(doc, M + 20, y, 10, 7); doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
  doc.text('1', M + 25, y + 5, { align: 'center' })
  rect(doc, M + 30, y, CW - 30, 7); doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
  doc.text('Denumire creanta fiscala', M + 32, y + 5)
  y += 7

  // Creanta selector dropdown empty row
  rect(doc, M, y, CW, 7)
  y += 7

  // Cod bugetar + Suma
  rect(doc, M, y, 38, 32)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
  doc.text('Cod bugetar', M + 1, y + 5)
  rect(doc, M + 1, y + 6, 36, 7)
  rect(doc, M + 5, y + 20, 13, 7); doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
  doc.text('+', M + 11, y + 25, { align: 'center' })
  rect(doc, M + 22, y + 20, 13, 7)
  doc.text('-', M + 28, y + 25, { align: 'center' })

  const sx = M + 40
  const sw = CW - 40
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
  doc.text('Suma', sx + sw / 2, y + 4, { align: 'center' })
  const sumLabels = ['1. Datorata', '2. Deductibila', '3. Scutita', '4. De plata (4=1-2-3 >=0)']
  for (let i = 0; i < 4; i++) {
    const ry = y + 6 + i * 6.5
    rect(doc, sx, ry, sw - 20, 6.5)
    rect(doc, sx + sw - 20, ry, 20, 6.5)
    doc.setFontSize(7)
    doc.text(sumLabels[i], sx + 1, ry + 4.5)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
    doc.text('0', sx + sw - 2, ry + 4.5, { align: 'right' })
    doc.setFont('helvetica', 'normal')
  }
  y += 34

  // Total obligatii
  rect(doc, M, y, CW - 22, 7); rect(doc, PW - M - 22, y, 22, 7)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
  doc.text('Total obligatii de plata   (suma de control)', M + 1, y + 5)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
  doc.text('0', PW - M - 2, y + 5, { align: 'right' })
  y += 10

  // Nota legala
  doc.setFont('helvetica', 'italic'); doc.setFontSize(6.5); doc.setTextColor(40, 40, 40)
  doc.text('Prezenta declaratie reprezinta titlu de creanta si produce efectele juridice ale instiintarii de plata de la data depunerii acesteia, in conditiile legii', M, y + 3)
  y += 8

  // Butoane ACTUALIZEAZA / VALIDARE
  doc.setFillColor(255, 200, 100)
  doc.rect(M + 5, y, 60, 9, 'F')
  rect(doc, M + 5, y, 60, 9)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(0)
  doc.text('1.ACTUALIZEAZA ANGAJATOR', M + 35, y + 5, { align: 'center' })
  doc.setFontSize(6.5); doc.setFont('helvetica', 'normal')
  doc.text('(inainte de VALIDARE)', M + 35, y + 7.5, { align: 'center' })

  doc.setFillColor(255, 140, 50)
  doc.rect(M + 5, y + 11, 60, 10, 'F')
  rect(doc, M + 5, y + 11, 60, 10)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(0)
  doc.text('2.VALIDARE', M + 35, y + 18, { align: 'center' })
  y += 25

  // Sub sanctiunile...
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(0)
  doc.text('Sub sanctiunile aplicate faptei de fals in acte publice, declar ca datele din aceasta declaratie sunt corecte si complete.', M, y + 4)
  y += 8

  // Semnatura
  rect(doc, M, y, 50, 14)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5)
  doc.text('Nume,', M + 1, y + 5)
  doc.setFont('helvetica', 'bold')
  doc.text(input.payer.numeDeclar || '', M + 1, y + 11)

  rect(doc, M + 55, y, 45, 7)
  doc.setFont('helvetica', 'normal')
  doc.text('Prenume,', M + 56, y + 5)

  rect(doc, M + 105, y, CW - 105, 14)
  doc.setFont('helvetica', 'normal')
  doc.text('Semnatura si stampila', M + 106, y + 5)
  y += 16

  rect(doc, M, y, 50, 7)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5)
  doc.text('Functia / calitatea', M + 1, y + 5)

  // Loc rezervat
  y += 10
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
  doc.text('Loc rezervat autoritatii competente', M, y)
  y += 4
  rect(doc, M, y, CW - 45, 7)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
  doc.text('Numar de inregistrare', M + 1, y + 5)
  rect(doc, PW - M - 43, y, 43, 7)
  doc.text('Din data', PW - M - 42, y + 5)
  rect(doc, PW - M - 22, y, 22, 7)

  footer(doc, 1, PW, M)

  // ══════════════════════════════════════════════════════════════════════════
  // PAGINA 2 — Anexa 1.1 - Angajator
  // ══════════════════════════════════════════════════════════════════════════
  doc.addPage()
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(0)
  doc.text('Anexa nr. 1.1 - Angajator', PW - M, 8, { align: 'right' })

  y = 12
  y = sectionBar(doc, 'SECTIUNEA A - ALTE DATE DE IDENTIFICARE A PLATITORULUI', M, y, CW)

  infoRow(doc, 'Nr. ordine registrul comertului', '', M, y, CW, 55, 7); y += 9
  infoRow(doc, 'Adresa sediu social', '', M, y, CW, 35, 7); y += 9

  rect(doc, M, y, CW, 7); doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
  doc.text('Telefon', M + 1, y + 5); rect(doc, M + 14, y, 30, 7)
  doc.text('Fax', M + 50, y + 5); rect(doc, M + 56, y, 35, 7)
  doc.text('E-mail', M + 96, y + 5); rect(doc, M + 107, y, CW - 107, 7)
  y += 9

  rect(doc, M, y, CW, 7)
  doc.text('Casa de asigurari de sanatate angajator (casaAng)', M + 1, y + 5)
  rect(doc, M + 82, y, 25, 7)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
  doc.text(input.payer.casaAng || '', M + 84, y + 5)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
  doc.text('Datoreaza CAM (D/N) (datCAM)', M + 115, y + 5)
  rect(doc, M + 158, y, 8, 7)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9)
  doc.text('D', M + 162, y + 5, { align: 'center' })
  y += 10

  y = sectionBar(doc, 'SECTIUNEA B - Indicatori statistici', M, y, CW)

  const bRows = [
    '1. Numar de asigurati somaj (B_cnp) pt. cnp unic',
    '2. Numar de asigurati concedii medicale si indemnizatii (B_sanatate)',
    '3. Numar de asigurati pentru care se datoreaza CAS (B_pense)  pt.A_14>0, B4_8>0, B4_20>0, B4_28>0',
    '4. Total fond de salarii brute (B_brutSalarii) (C3_13-C3_14) + Sum.A_11+Sum.B4_5+Sum.B3_12',
    '5. Numar salariati (B_sal) pt.A_1,81_1=(1,2,8,10,25,27,28,48,46,38,51,52,54) si cnp unic',
    '6. Numar asigurati Legea 111/2022 care datoreaza CAS',
    '7. Numar asigurati Legea 111/2022 care indeplinesc conditia de la art 3 alin (7) (8)',
    '8. Total Baza lunara de calcul CAS',
    '9. Total CAS',
    '10. Numar asigurati Legea 111/2022 care indeplinesc conditia de la art 9 alin (5)',
  ]
  for (const label of bRows) {
    y = statRow(doc, label, M, y, CW)
  }

  doc.setFont('helvetica', 'italic'); doc.setFontSize(6)
  doc.text('*) rd.6-10 se raporteaza de catre ANOFM (din 2024) (nrSal1_111, nrSal2_111, nrSal3_111, bazaCAS_111, CAS_111)', M, y + 4)
  y += 8

  y = sectionBar(doc, 'SECTIUNEA C', M, y, CW)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(0)
  doc.text('C.1. Conditii de munca', M, y + 4); y += 8

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M },
    head: [['Nr. Crt.', 'Conditii de munca', '1.Total baza de calcul CAS\n(C1_11,C1_21,C1_31,C1_T1)', '2.Total baza de calcul CAS afer. indemniz.\n(C1_12,C1_22,C1_32,C1_T2)', '3.Scutiri angajator\n(C1_13,C1_23,C1_33,C1_T)', '4.CAS - angajator (C1_T3)']],
    body: [['1', 'normale', '', '', '', ''], ['2', 'deosebite', '', '', '', ''], ['3', 'speciale', '', '', '', ''], ['4', 'Total', '', '', '', '']],
    styles: { fontSize: 6.5, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 6.5, halign: 'center' },
    columnStyles: { 0: { cellWidth: 12, halign: 'center' }, 1: { cellWidth: 22 } },
  })

  y = (doc as any).lastAutoTable.finalY + 3
  y = statRow(doc, '5   Baza calcul punctaj somaj tehnic beneficiar de scutire (C1_5)', M, y, CW)
  y = statRow(doc, '6   Total suma CAS-angajator de recuperat aferenta lunii de raportare (C1_7)', M, y, CW, 9)
  y += 4

  footer(doc, 2, PW, M)

  // ══════════════════════════════════════════════════════════════════════════
  // PAGINA 3 — C2 indemnizatii, C3 accidente, C4 CAM, D, E
  // ══════════════════════════════════════════════════════════════════════════
  doc.addPage()
  y = 10

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(0)
  doc.text('C.2. Indemnizatii sanatate cf. OUG 158/2005 (aprobata prin L399/2006) si OUG 89/2025', M, y); y += 6

  autoTable(doc, {
    startY: y, margin: { left: M, right: M },
    head: [['Nr. Crt.', 'Tip indemnizatie', '1.Nr. cazuri', '2.Total zile prestatii', '3.Zile prestatii sup. de angajator', '4.Zile prestatii sup.din FNUASS', '5.Suma suportata de angajator', '6.Suma suportata din FNUASS']],
    body: [
      ['1', 'Incapacitate temporara de munca, din care:', '', '', '', '', '', ''],
      ['1.1', '- pentru boli infecto-contagioase cu izolare (05,51)', '', '', '', '', '', ''],
      ['1.2', '- boala obisnuita/ accid. 55% CM <=7zile (01)', '', '', '', '', '', ''],
      ['1.3', '- boala obisnuita/ accid. 65% 8zile<=CM<=14zile (01)', '', '', '', '', '', ''],
      ['1.4', '- boala obisnuita/ accid. 75% CM >=15zile (01)', '', '', '', '', '', ''],
      ['2', 'Prevenire imbolnavire, din care: (07,10)', '', '', '', '', '', ''],
      ['2.2', '- carantina (07)', '', '', '', '', '', ''],
      ['3', 'Sarcina si lauzie (08)', '', '', '', '', '', ''],
      ['4', 'Ingrijire copil bolnav (09,91,92)', '', '', '', '', '', ''],
      ['4.1', 'Ingrijire pacient cu afectiuni oncologice (17)', '', '', '', '', '', ''],
      ['5', 'Risc maternal (15)', '', '', '', '', '', ''],
      ['6', 'Total', '', '', '', '', '', ''],
      ['7', 'Total cuantum prestatii de suportat din bug. FNUASS pt. contributii pentru concedii si indemnizatii', '', '', '', '', '', ''],
      ['8', 'Total suma de recuperat de la FNUASS pentru concedii si indemnizatii (C2_140)', '', '', '', '', '', ''],
    ],
    styles: { fontSize: 6, cellPadding: 1.2, lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 6, halign: 'center' },
    columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 50 } },
  })

  y = (doc as any).lastAutoTable.finalY + 4

  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(0)
  doc.text('C.3. Indemnizatii pentru accidente de munca si boli profesionale, cf.legii nr.346/2002', M, y); y += 5

  autoTable(doc, {
    startY: y, margin: { left: M, right: M },
    head: [['Nr. Crt.', 'Tip indemnizatie', '1.Numar cazuri', '2.Zile prestatii', '3.Suma totala accidente de munca si boli profesionale', '4.Suma suportata din sumele prev.pt. asigurarea pt. accidente de munca si boli profesionale in BAS']],
    body: [
      ['1', 'Incapacitate temporara de munca (01,02,03,04,05,06,12,13,14)', '', '', '', ''],
      ['2', 'Trecerea temporara la alt loc de munca (11)', '', '', '', ''],
      ['3', 'Reducerea timpului de munca (10)', '', '', '', ''],
      ['4', 'Cursuri de calificare si reconversie profesionala', '', '', '', ''],
      ['5', 'Total', '', '','0', '0'],
    ],
    styles: { fontSize: 6.5, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 6.5, halign: 'center' },
    columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 50 } },
  })

  y = (doc as any).lastAutoTable.finalY + 4

  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5)
  doc.text('SECTIUNEA C.4* Contributie asiguratorie pentru munca (CAM)', M, y)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5)
  doc.text('(CAM%=2.25 prev.la art.220^3 alin.(1) CF)', M, y + 4)
  rect(doc, M + 100, y, 50, 9); doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
  doc.text('Baza de calcul (C4_baza)', M + 102, y + 4)
  rect(doc, M + 155, y, 35, 9)
  doc.text('Suma CAM (C4_ct)', M + 157, y + 4)
  y += 13

  footer(doc, 3, PW, M)

  // ══════════════════════════════════════════════════════════════════════════
  // PAGINA 4 — Sectiunile D, E, F
  // ══════════════════════════════════════════════════════════════════════════
  doc.addPage()
  y = 10

  doc.setFont('helvetica', 'italic'); doc.setFontSize(7); doc.setTextColor(0)
  doc.text('Sectiunile D si E se completeaza numai de institutii asimilate angajatorilor.', M, y); y += 4
  doc.text('D2=n C_1=(2,10,13,14,15,17,30,38) si C_11>0 si C_8+C_4>0.', M, y); y += 4
  doc.text('D3=n C_1=(2,10,13,14,15,17,30,38) si C_11>0 si cu conditia sa nu existe asiguratA sau asiguratB pt. acel cnp_asig', M, y); y += 7

  y = sectionBar(doc, 'SECTIUNEA D. - Indicatori statistici', M, y, CW)
  y = statRow(doc, '1. Numar de asigurati (concedii si indemnizatii) (D2)', M, y, CW)
  y = statRow(doc, '2. Numar de asigurati care datoreaza sau pentru care exista obligatia platii CAS (D3)', M, y, CW)
  y += 5

  y = sectionBar(doc, 'SECTIUNEA E', M, y, CW)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5)
  doc.text('E.1. Conditii de munca', M, y + 4); y += 8

  autoTable(doc, {
    startY: y, margin: { left: M, right: M },
    head: [['Conditii de munca', 'Total venit realizat (E1_venit)', 'Total baza de calcul a contributiei la BASS aferente indemnizatiei cf. OUG. 158/2005 (aprob.prin L399/ 2006) (E1_baza)']],
    body: [['normale', '', '']],
    styles: { fontSize: 7, cellPadding: 2, lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 6.5, halign: 'center' },
    columnStyles: { 0: { cellWidth: 30 } },
  })

  y = (doc as any).lastAutoTable.finalY + 4

  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5)
  doc.text('E.2. Indemnizatii sanatate cf. OUG 158/2005 (aprobata prin L399/2006) (pt.asigurat C_1=2)', M, y); y += 5

  autoTable(doc, {
    startY: y, margin: { left: M, right: M },
    head: [['Nr. crt.', 'Tip indemnizatie', '1.Nr. cazuri', '2.Total zile prestatii', '4.Zile prestatii sup.din FNUASS', '6.Suma suportata din FNUASS']],
    body: [
      ['1', 'Incapacitate temporara de munca, din care:', '', '', '', ''],
      ['1.1', '- pentru boli infecto-contagioase cu izolare (05,51)', '', '', '', ''],
      ['1.3', '- boala obisnuita/ accid. in afara muncii (65%) 8zile<=CM<=14zile (01)', '', '', '', ''],
      ['1.4', '- boala obisnuita/ accid. in afara muncii (75%) CM >=15zile (01)', '', '', '', ''],
      ['2', 'Prevenire imbolnavire, din care: (07,10)', '', '', '', ''],
      ['2.2', '- carantina (07)', '', '', '', ''],
      ['3', 'Sarcina si lauzie (08)', '', '', '', ''],
      ['4', 'Ingrijire copil bolnav (09,91,92)', '', '', '', ''],
      ['4.1', 'Ingrijire pacient cu afectiuni oncologice (17)', '', '', '', ''],
      ['5', 'Risc maternal (15)', '', '', '', ''],
      ['6', 'Total', '', '', '', '0'],
      ['7', 'Total cuantum prestatii de suportat din bug. FNUASS pt. contributii pentru concedii si indemnizatii (E2_10)', '', '', '', ''],
      ['8', 'Total suma de recuperat de la FNUASS pentru concedii si indemnizatii (E2_140)', '', '', '', ''],
    ],
    styles: { fontSize: 6.5, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 6.5, halign: 'center' },
    columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 55 } },
  })

  y = (doc as any).lastAutoTable.finalY + 4

  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5)
  doc.text('E.3. Indemnizatii pentru accidente de munca si boli profesionale, cf.legii nr.346/2002  (pt. asigurat C_1=2,11)', M, y); y += 5

  autoTable(doc, {
    startY: y, margin: { left: M, right: M },
    head: [['Nr. Crt.', 'Tip indemnizatie', '1.Numar cazuri', '2.Zile prestatii', '3.Suma totala accidente de munca si boli profesionale', '4.Suma suportata']],
    body: [
      ['1', 'Incapacitate temporara de munca (01,02,03,04,05,06,12,13,14)', '', '', '', ''],
      ['2', 'Trecerea la alt loc de munca (11)', '', '', '', ''],
      ['3', 'Reducerea timpului de munca (10)', '', '', '', ''],
      ['4', 'Cursuri de calificare si reconversie profesionala', '', '', '', ''],
      ['5', 'Total', '', '', '0', '0'],
    ],
    styles: { fontSize: 6.5, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.2 },
    headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 6.5, halign: 'center' },
    columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 50 } },
  })

  y = (doc as any).lastAutoTable.finalY + 4

  y = sectionBar(doc, 'SECTIUNEA F - Impozit pe venitul din salarii si alte venituri asimilate salariilor, defalcat pe sediul principal si sediile secundare', M, y, CW)

  // Completare automata F1+F2
  doc.setFillColor(255, 220, 240)
  doc.rect(M + 30, y, CW - 30, 7, 'F')
  rect(doc, M + 30, y, CW - 30, 7)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7); doc.setTextColor(0)
  doc.text('Completare automata F1+F2  (din sectiunea E3 asigurat)', M + CW / 2 + 15, y + 5, { align: 'center' })
  y += 9

  const fRows = ['1. Suma datorata', '2. Suma deductibila', '3. Suma scutita', '4. Suma de plata (4=1-2-3>=0)']
  for (const label of fRows) {
    rect(doc, M + 30, y, CW - 50, 6); rect(doc, PW - M - 20, y, 20, 6)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
    doc.text(label, M + 32, y + 4.2)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
    doc.text('0', PW - M - 2, y + 4.2, { align: 'right' })
    y += 6
  }
  y += 4

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
  doc.text('F.1. Sediu principal', M, y); y += 5

  for (const label of fRows) {
    rect(doc, M + 30, y, CW - 50, 6); rect(doc, PW - M - 20, y, 20, 6)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
    doc.text(label, M + 32, y + 4.2)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
    doc.text('0', PW - M - 2, y + 4.2, { align: 'right' })
    y += 6
  }

  footer(doc, 4, PW, M)

  // ══════════════════════════════════════════════════════════════════════════
  // PAGINA 5 — F.2 Sedii secundare
  // ══════════════════════════════════════════════════════════════════════════
  doc.addPage()
  y = 12
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(0)
  doc.text('F.2. Sedii secundare', M, y)

  // Buton Adauga
  doc.setFillColor(220, 240, 220)
  doc.rect(M + 55, y - 5, 50, 8, 'F')
  rect(doc, M + 55, y - 5, 50, 8)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7)
  doc.text('( Adauga sediu secundar, daca este cazul )', M + 80, y, { align: 'center' })
  y += 10

  const f2Rows = ['1.Total suma datorata (sedii secundare)', '2.Total suma deductibila (sedii secundare)', '3.Total suma scutita (sedii secundare)', '4.Total suma de plata (sedii secundare)']
  for (const label of f2Rows) {
    rect(doc, M, y, CW - 45, 7); rect(doc, PW - M - 43, y, 43, 7)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
    doc.text(label, M + 1, y + 4.8)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
    doc.text('0', PW - M - 46, y + 4.8, { align: 'right' })
    y += 7
  }

  footer(doc, 5, PW, M)

  // ══════════════════════════════════════════════════════════════════════════
  // PAGINA 6 — Asigurat C_1=26 (arendare)
  // ══════════════════════════════════════════════════════════════════════════
  doc.addPage()

  // Header periada + nr crt
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(0)
  doc.text('Perioada de raportare', M + 30, 8)
  rect(doc, M + 62, 5, 10, 6)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
  doc.text(String(input.luna_r).padStart(2, '0'), M + 67, 9.5, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  doc.text('/', M + 74, 9.5)
  rect(doc, M + 77, 5, 18, 6)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
  doc.text(String(input.an_r), M + 86, 9.5, { align: 'center' })
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5)
  doc.text('Nr. crt.', PW - M - 22, 8)
  rect(doc, PW - M - 10, 5, 10, 6)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
  doc.text('1', PW - M - 5, 9.5, { align: 'center' })

  // Titlu
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
  doc.text('DECLARATIE PRIVIND OBLIGATIILE DE PLATA', PW / 2, 17, { align: 'center' })
  doc.setFontSize(8)
  doc.text('A CONTRIBUTIILOR SOCIALE, A IMPOZITULUI PE VENIT SI EVIDENTA NOMINALA', PW / 2, 22, { align: 'center' })
  doc.text('A PERSOANELOR ASIGURATE', PW / 2, 27, { align: 'center' })

  y = 32
  y = sectionBar(doc, 'DATE DE IDENTIFICARE ASIGURAT', M, y, CW)

  // CNP + CNP anterior
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5)
  doc.text('1.CNP / NIF', M, y + 5)
  cifBoxes(doc, '', M + 20, y)
  doc.text('2.CNP / NIF anterior', M + 97, y + 5)
  cifBoxes(doc, '', M + 130, y)
  y += 9

  infoRow(doc, '3.Nume', '', M, y, 85, 15, 7)
  infoRow(doc, '4.Nume anterior', '', M + 90, y, CW - 90, 32, 7)
  y += 9

  infoRow(doc, 'Prenume', '', M, y, 85, 20, 7)
  infoRow(doc, 'Prenume anterior', '', M + 90, y, CW - 90, 35, 7)
  y += 9

  rect(doc, M, y, CW, 7)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
  doc.text('5.Data intrare in categ. de asigurat (dataAng)', M + 1, y + 4.8)
  rect(doc, M + 75, y, 30, 7)
  doc.text('6.Data iesire din categ. de asigurat (dataSf)', M + 115, y + 4.8)
  rect(doc, M + 163, y, 27, 7)
  y += 9

  // Casuta asigurari
  rect(doc, M, y, CW, 7)
  doc.text('Cod unic de identificare din sistemul de asigurari de sanatate (CIS) (cisAsig)', M + 1, y + 4.8)
  rect(doc, M + 120, y, 30, 7)
  y += 9

  rect(doc, M, y, CW, 7)
  doc.text('7.Casa de asigurari de sanatate a asiguratului (casaSn)', M + 1, y + 4.8)
  rect(doc, M + 90, y, 25, 7)
  y += 9

  // Rows 8-12
  const asigRows = [
    '8.Asigurat / neasigurat pentru concedii si indemnizatii de asigurari sociale de sanatate (asigCI)',
    '9.Asigurat/neasigurat in sistemul de asigurari pentru somaj (asigSO)',
    '10. PF scutita de la plata impozitului pe venit (asigScu)',
    '11. Salariat exceptat de la plata CAS si CASS la nivelul salariului minim - cf.art.146(5^7) si art.168(6^1) din CF (asigExc)',
    '12. Motiv exceptare de la plata CAS si CASS la nivelul salariului minim - cf.art.146(5^7) din CF, daca e cazul (motivExc)',
  ]
  for (const label of asigRows) {
    rect(doc, M, y, CW - 40, 7); rect(doc, PW - M - 38, y, 38, 7)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5)
    doc.text(label, M + 1, y + 4.8)
    y += 7
  }
  y += 3

  // Sectiunile A/B/C selector
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5)
  doc.text('ALEGETI UNA/DOUA DIN SECTIUNILE DE MAI JOS PENTRU ASIGURATUL CURENT (CNP unic)', M, y + 4)
  y += 8
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
  doc.text('O  Sectiunea A', M + 5, y + 4)
  doc.text('O  Sectiunea B', M + 55, y + 4)
  doc.setFont('helvetica', 'bold')
  doc.text('(*)  Sectiunea C', M + 105, y + 4)
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5)
  doc.text('Numarul de zile lucratoare (tfNZL)', M + 148, y + 4)
  rect(doc, PW - M - 12, y, 12, 7)
  y += 11

  // ── Tabel asigurati C_1=26 ─────────────────────────────────────────────
  y = sectionBar(doc, 'SECTIUNEA C — Venituri din arendarea bunurilor agricole (C_1=26, art.84 CF, deducere 40%, cota imp. 10%)', M, y, CW)

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
  tableRows.push(['', 'TOTAL', '', '',
    ronInt(input.totalBrut), ronInt(input.totalDeducere),
    ronInt(input.totalNet), ronInt(input.totalImpozit), ronInt(input.totalCASS),
  ])

  autoTable(doc, {
    startY: y, margin: { left: M, right: M },
    head: [['Nr.', 'CNP', 'Nume', 'Prenume', 'Venit brut RON', 'Deducere 40%', 'Baza imp. RON', 'Impozit RON', 'CASS 10%']],
    body: tableRows,
    styles: { fontSize: 7, cellPadding: 1.8, lineColor: [0, 0, 0], lineWidth: 0.2, textColor: [0, 0, 0] },
    headStyles: { fillColor: [210, 225, 242], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', fontSize: 7 },
    columnStyles: {
      0: { halign: 'center', cellWidth: 9 },
      1: { halign: 'center', cellWidth: 27, font: 'courier', fontSize: 6.5 },
      2: { cellWidth: 26 },
      3: { cellWidth: 26 },
      4: { halign: 'right', cellWidth: 22 },
      5: { halign: 'right', cellWidth: 20 },
      6: { halign: 'right', cellWidth: 22 },
      7: { halign: 'right', cellWidth: 20, fontStyle: 'bold' },
      8: { halign: 'right', cellWidth: 20 },
    },
    didParseCell: (data) => {
      if (data.row.index === tableRows.length - 1) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [220, 235, 248]
      }
    },
  })

  const finalY = (doc as any).lastAutoTable.finalY + 6

  rect(doc, M, finalY, CW - 25, 7)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8)
  doc.text('Total obligatii de plata (impozit + CASS):', M + 2, finalY + 5)
  rect(doc, PW - M - 23, finalY, 23, 7)
  doc.text(ronInt(input.totalPlata), PW - M - 2, finalY + 5, { align: 'right' })

  // Version info
  const vy = 278
  doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(80, 80, 80)
  doc.text('D112_A7.2.5', M, vy)
  rect(doc, M, vy + 3, 28, 7)
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(0)
  doc.text('Versiuni', M + 14, vy + 8, { align: 'center' })

  footer(doc, 6, PW, M)

  const filename = `D112_${input.an_r}_${String(input.luna_r).padStart(2, '0')}_${input.payer.cif || 'DRAFT'}.pdf`
  doc.save(filename)
}

// ── Build input from dataset ──────────────────────────────────────────────
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
    if (ex) {
      ex.brut += r.grossAmountRon; ex.ded += r.flatDeductionRon
      ex.net += r.netTaxableRon; ex.imp += r.withholdingTaxRon
    } else {
      byLessor.set(key, { last: r.lessorLastName, first: r.lessorFirstName, brut: r.grossAmountRon, ded: r.flatDeductionRon, net: r.netTaxableRon, imp: r.withholdingTaxRon })
    }
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
