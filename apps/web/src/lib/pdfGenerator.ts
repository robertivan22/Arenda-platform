import { createClient } from '@/lib/supabase/client'

interface LessorForPdf {
  id: string; type: string; first_name: string; last_name: string; company_name: string | null
  cnp: string; county: string; locality: string; address: string | null
  mobile: string | null; email: string | null; iban: string | null; bank_name: string | null
}

interface ContractForPdf {
  contract_number: string; contract_type: string; start_date: string; end_date: string
  annual_rent: number; status: string
}

interface ParcelForPdf {
  parcel_code: string | null; tarla_nr: string | null; parcel_nr: string | null
  county: string; locality: string; land_use_category: string | null; surface: number
}

export async function generateLessorPDF(lessorId: string) {
  const db = createClient()
  const [{ data: lessorData }, { data: contractsData }, { data: parcelsData }] = await Promise.all([
    db.from('lessors').select('*').eq('id', lessorId).single(),
    db.from('contracts').select('contract_number, contract_type, start_date, end_date, annual_rent, status').eq('lessor_id', lessorId),
    db.from('parcels').select('parcel_code, tarla_nr, parcel_nr, county, locality, land_use_category, surface').eq('lessor_id', lessorId),
  ])
  if (!lessorData) return

  const lessor = lessorData as LessorForPdf
  const displayName = lessor.type === 'LEGAL' ? (lessor.company_name ?? '') : `${lessor.last_name} ${lessor.first_name}`.trim()
  const lessorContracts = (contractsData ?? []) as ContractForPdf[]
  const lessorParcels = (parcelsData ?? []) as ParcelForPdf[]
  const today = new Date().toLocaleDateString('ro-RO')
  const totalSurface = lessorParcels.reduce((s, p) => s + Number(p.surface || 0), 0).toFixed(4)
  const totalRent = lessorContracts.reduce((s, c) => s + Number(c.annual_rent || 0), 0).toFixed(2)

  const contractRows = lessorContracts.map(c => `
    <tr>
      <td style="padding:6px 8px;border:1px solid #ddd">${c.contract_number}</td>
      <td style="padding:6px 8px;border:1px solid #ddd">${c.contract_type}</td>
      <td style="padding:6px 8px;border:1px solid #ddd">${c.start_date}</td>
      <td style="padding:6px 8px;border:1px solid #ddd">${c.end_date}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;text-align:right">${Number(c.annual_rent).toFixed(2)} RON</td>
      <td style="padding:6px 8px;border:1px solid #ddd;text-align:center">${c.status}</td>
    </tr>`).join('') || '<tr><td colspan="6" style="padding:6px 8px;border:1px solid #ddd;text-align:center;color:#999">Niciun contract</td></tr>'

  const parcelRows = lessorParcels.map(p => `
    <tr>
      <td style="padding:6px 8px;border:1px solid #ddd">${p.parcel_code ?? ''}</td>
      <td style="padding:6px 8px;border:1px solid #ddd">${p.tarla_nr ?? ''}</td>
      <td style="padding:6px 8px;border:1px solid #ddd">${p.parcel_nr ?? ''}</td>
      <td style="padding:6px 8px;border:1px solid #ddd">${p.county} / ${p.locality}</td>
      <td style="padding:6px 8px;border:1px solid #ddd">${p.land_use_category ?? ''}</td>
      <td style="padding:6px 8px;border:1px solid #ddd;text-align:right">${Number(p.surface).toFixed(4)} ha</td>
    </tr>`).join('') || '<tr><td colspan="6" style="padding:6px 8px;border:1px solid #ddd;text-align:center;color:#999">Nicio parcelă</td></tr>'

  const html = `<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8">
  <title>Contract arendă — ${displayName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 11pt; color: #222; padding: 40px; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2c5f2e; padding-bottom: 16px; }
    .header h1 { font-size: 18pt; color: #2c5f2e; }
    .header p { font-size: 10pt; color: #666; margin-top: 4px; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 12pt; font-weight: bold; color: #2c5f2e; border-bottom: 1px solid #2c5f2e; padding-bottom: 4px; margin-bottom: 10px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 20px; margin-bottom: 12px; }
    .field { display: flex; flex-direction: column; }
    .field label { font-size: 8pt; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
    .field span { font-size: 10pt; font-weight: 500; border-bottom: 1px dotted #ccc; padding-bottom: 2px; min-height: 18px; }
    table { width: 100%; border-collapse: collapse; font-size: 9pt; margin-top: 8px; }
    th { background: #2c5f2e; color: white; padding: 6px 8px; text-align: left; font-size: 9pt; }
    .summary-box { background: #f0f7f0; border: 1px solid #2c5f2e; border-radius: 4px; padding: 12px 16px; margin-top: 16px; }
    .summary-box .row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 10pt; }
    .summary-box .row.total { font-weight: bold; font-size: 11pt; border-top: 1px solid #2c5f2e; margin-top: 4px; padding-top: 6px; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 50px; }
    .sig-box { text-align: center; }
    .sig-line { border-top: 1px solid #333; margin-top: 50px; padding-top: 6px; font-size: 9pt; color: #555; }
    .clause { font-size: 9pt; color: #444; line-height: 1.6; margin-bottom: 8px; text-align: justify; }
    .clause strong { color: #222; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>

<div class="header">
  <h1>CONTRACT DE ARENDĂ</h1>
  <p>Nr. ${lessorContracts[0]?.contractNumber || '___________'} / ${today}</p>
  <p style="margin-top:6px;font-size:9pt;color:#888">Generat automat de ArendaPro Platform</p>
</div>

<div class="section">
  <div class="section-title">I. PĂRȚILE CONTRACTANTE</div>
  <p class="clause"><strong>ARENDATORUL:</strong> ${displayName}, ${lessor.type === 'NATURAL' ? 'persoană fizică' : lessor.type === 'PFA' ? 'PFA' : 'persoană juridică'}, 
  ${lessor.type !== 'LEGAL' ? `CNP: ${lessor.cnp}` : `CUI: ${lessor.cnp}`}, 
  domiciliat/ă în ${lessor.locality}, ${lessor.county}, ${lessor.address || ''}, 
  ${lessor.mobile ? `tel: ${lessor.mobile}` : ''}${lessor.email ? `, email: ${lessor.email}` : ''},
  IBAN: ${lessor.iban || '___________________________'}, Bancă: ${lessor.bank_name || '_______________'}.</p>

  <p class="clause" style="margin-top:10px"><strong>ARENDAȘUL:</strong> S.C. __________________________ S.R.L., CUI __________________, 
  cu sediul în ______________________________, reprezentată prin ______________________________, 
  în calitate de Administrator, denumit în continuare „Arendaș".</p>
</div>

<div class="section">
  <div class="section-title">II. OBIECTUL CONTRACTULUI</div>
  <p class="clause">Arendatorul dă în arendă Arendașului terenul/terenurile agricole descrise în Anexa nr. 1 la prezentul contract, 
  în suprafață totală de <strong>${totalSurface} ha</strong>, situate în județul ${lessor.county}, 
  localitatea ${lessor.locality}, în scopul desfășurării activităților agricole.</p>
</div>

<div class="section">
  <div class="section-title">III. DURATA CONTRACTULUI</div>
  ${lessorContracts.length > 0 ? `
  <p class="clause">Contractul se încheie pe o perioadă de <strong>${Math.ceil((new Date(lessorContracts[0].endDate).getTime() - new Date(lessorContracts[0].startDate).getTime()) / (365.25*24*60*60*1000))} ani</strong>, 
  de la data de <strong>${lessorContracts[0].startDate}</strong> până la data de <strong>${lessorContracts[0].endDate}</strong>, 
  cu posibilitate de prelungire prin acordul ambelor părți.</p>
  ` : '<p class="clause">Durata contractului se va stabili prin act adițional.</p>'}
</div>

<div class="section">
  <div class="section-title">IV. PREȚUL ARENDEI</div>
  <p class="clause">Prețul arendei este de <strong>${totalRent} RON/an</strong>, plătibil în două tranșe egale: 
  prima tranșă până la data de <strong>30 septembrie</strong> a anului agricol curent, 
  iar a doua tranșă până la data de <strong>28 februarie</strong> a anului următor. 
  Plata se va efectua prin virament bancar în contul IBAN <strong>${lessor.iban || '___________________________'}</strong>.</p>
</div>

<div class="section">
  <div class="section-title">V. OBLIGAȚIILE ARENDAȘULUI</div>
  <p class="clause">1. Să plătească arenda la termenele și în condițiile stabilite prin prezentul contract.</p>
  <p class="clause">2. Să folosească terenul arendat ca un bun proprietar și exclusiv în scopul exploatării agricole.</p>
  <p class="clause">3. Să mențină și să restituie terenul în aceeași stare de productivitate, suportând toate cheltuielile necesare.</p>
  <p class="clause">4. Să nu subînchirieze sau să cedeze contractul fără acordul scris al Arendatorului.</p>
  <p class="clause">5. Să permită Arendatorului să verifice starea terenului cu notificare prealabilă de minimum 48 ore.</p>
  <p class="clause">6. Să achite impozitele și taxele locale aferente terenului pe durata contractului.</p>
</div>

<div class="section">
  <div class="section-title">VI. OBLIGAȚIILE ARENDATORULUI</div>
  <p class="clause">1. Să predea Arendașului terenul în stare corespunzătoare folosinței agricole.</p>
  <p class="clause">2. Să garanteze Arendașul de orice tulburare din fapt sau de drept.</p>
  <p class="clause">3. Să nu înstrăineze terenul pe durata contractului fără notificarea prealabilă a Arendașului.</p>
</div>

<div class="section">
  <div class="section-title">VII. FORȚA MAJORĂ ȘI CAZUL FORTUIT</div>
  <p class="clause">Nici una dintre părți nu răspunde pentru neexecutarea la termen sau/și de executarea în mod necorespunzător, 
  total sau parțial, a oricărei obligații care îi revine în baza prezentului contract, dacă neexecutarea sau executarea 
  necorespunzătoare a obligației respective a fost cauzată de forță majoră. Partea care invocă forța majoră este obligată 
  să notifice celeilalte părți, în termen de 5 zile de la data apariției respectivului caz de forță majoră.</p>
</div>

<div class="section">
  <div class="section-title">VIII. LITIGII</div>
  <p class="clause">Orice litigiu decurgând din sau în legătură cu prezentul contract, privind validitatea, interpretarea, 
  executarea ori desființarea lui, va fi soluționat pe cale amiabilă. În cazul în care acest lucru nu este posibil, 
  litigiul va fi dedus spre soluționare instanțelor judecătorești competente conform legii române.</p>
</div>

<div class="section">
  <div class="section-title">ANEXA 1 — CONTRACTE</div>
  <table>
    <thead>
      <tr>
        <th>Nr. contract</th><th>Tip</th><th>De la</th><th>Până la</th><th>Arendă/an</th><th>Status</th>
      </tr>
    </thead>
    <tbody>${contractRows}</tbody>
  </table>
</div>

<div class="section">
  <div class="section-title">ANEXA 2 — PARCELE ARENDATE</div>
  <table>
    <thead>
      <tr>
        <th>Cod parcelă</th><th>Tarla</th><th>Parcelă</th><th>Județ/Localitate</th><th>Cat. folosință</th><th>Suprafață</th>
      </tr>
    </thead>
    <tbody>${parcelRows}</tbody>
  </table>

  <div class="summary-box" style="margin-top:12px">
    <div class="row"><span>Total parcele:</span><span>${lessorParcels.length}</span></div>
    <div class="row"><span>Suprafață totală arendată:</span><span>${totalSurface} ha</span></div>
    <div class="row total"><span>Arendă anuală totală:</span><span>${totalRent} RON</span></div>
  </div>
</div>

<div class="signatures">
  <div class="sig-box">
    <p style="font-size:10pt;font-weight:bold">ARENDATOR</p>
    <p style="font-size:9pt;color:#555;margin-top:4px">${displayName}</p>
    <div class="sig-line">Semnătură și ștampilă</div>
    <div class="sig-line">Data: _______________</div>
  </div>
  <div class="sig-box">
    <p style="font-size:10pt;font-weight:bold">ARENDAȘ</p>
    <p style="font-size:9pt;color:#555;margin-top:4px">S.C. __________________ S.R.L.</p>
    <div class="sig-line">Semnătură și ștampilă</div>
    <div class="sig-line">Data: _______________</div>
  </div>
</div>

<p style="margin-top:30px;font-size:8pt;color:#aaa;text-align:center">
  Document generat de ArendaPro Platform — ${today} — Valabil numai cu semnăturile originale ale părților
</p>

<script>window.onload = () => window.print()</script>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  if (win) win.focus()
}
