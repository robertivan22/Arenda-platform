'use client'

export const runtime = 'edge'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fetchTemplate, renderTemplate } from '@/lib/templates'

interface CompanySettings {
  name: string; cif: string; reg_com: string; address: string
  county: string; locality: string; iban: string; bank_name: string
  phone: string; email: string; invoice_series: string; logo_url?: string
}
interface Contract {
  id: string; contract_number: string; contract_type: string
  sign_date: string | null; start_date: string; end_date: string
  primarie_nr: string | null; primarie_date: string | null
  tax_method: string; localities: string | null; zone: string | null; status: string
}
interface Lessor {
  first_name: string; last_name: string; company_name: string | null
  type: string; cnp: string; gender: string | null
  county: string; locality: string; address: string | null
  phone: string | null; mobile: string | null; email: string | null
  iban: string | null; bank_name: string | null
}
interface RentLevel {
  product_name: string; level_per_ha: number; level_type: string; tax_rate: number
}
interface Parcel {
  parcel_nr: string | null; tarla_nr: string | null; surface: number
  bloc_fizic: string | null; cadastral_nr?: string | null; popular_name?: string | null
}

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  ARENDA: 'Arendare',
  CONCESIUNE: 'Concesiune',
  COMODAT: 'Comodat',
  ASOCIERE: 'Asociere în Participațiune',
}

const TAX_MAP: Record<string, string> = {
  COTA_FORFETARA: 'Cota Forfetară (Norma de Venit)',
  SISTEM_REAL: 'Sistem Real',
  SCUTIT: 'Scutit de impozit',
}

export default function ContractPrintPage() {
  const { id } = useParams<{ id: string }>()
  const [contract, setContract] = useState<Contract | null>(null)
  const [lessor, setLessor] = useState<Lessor | null>(null)
  const [company, setCompany] = useState<CompanySettings | null>(null)
  const [rentLevels, setRentLevels] = useState<RentLevel[]>([])
  const [parcels, setParcels] = useState<Parcel[]>([])
  const [customHtml, setCustomHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const db = createClient()
    Promise.all([
      db.from('contracts').select('*, lessors(*)').eq('id', id).single(),
      db.from('company_settings').select('*').single(),
      db.from('contract_rent_levels').select('*').eq('contract_id', id).order('sort_order'),
      db.from('parcels').select('*').eq('contract_id', id),
    ]).then(async ([{ data: c }, { data: cs }, { data: levels }, { data: ps }]) => {
      if (c) {
        const l = Array.isArray((c as any).lessors) ? (c as any).lessors[0] : (c as any).lessors
        setContract(c as any)
        setLessor(l as Lessor)
      }
      if (cs) setCompany(cs as any)
      setRentLevels((levels ?? []) as RentLevel[])
      setParcels((ps ?? []) as Parcel[])
      // Check for user-specific CONTRACT template
      const { data: { user } } = await db.auth.getUser()
      if (user) {
        const tmpl = await fetchTemplate(db, user.id, 'CONTRACT')
        if (tmpl) setCustomHtml(tmpl.html_content)
      }
      setLoading(false)
    })
  }, [id])

  if (loading) return <div style={{ fontFamily: 'sans-serif', padding: 40 }}>Se încarcă...</div>
  if (!contract || !company) return (
    <div style={{ fontFamily: 'sans-serif', padding: 40, color: 'red' }}>
      Date lipsă. Asigurați-vă că setările firmei sunt completate (Setari → Date firmă).
    </div>
  )

  const totalHa = parcels.reduce((s, p) => s + Number(p.surface ?? 0), 0)
  const contractYears = new Date(contract.end_date).getFullYear() - new Date(contract.start_date).getFullYear()
  const lessorName = lessor
    ? (lessor.type === 'LEGAL' ? lessor.company_name ?? '' : `${lessor.last_name} ${lessor.first_name}`.trim())
    : '___________'
  const lessorIdLabel = lessor?.type === 'LEGAL' ? 'CIF' : 'CNP'
  const lessorId = lessor?.cnp || '___________'
  const hasCadastral = parcels.some(p => (p as any).cadastral_nr)
  const hasPopularName = parcels.some(p => (p as any).popular_name)

  // ── Custom template rendering ──────────────────────────────────────────────
  if (customHtml) {
    const tdS = 'border:1px solid #333;padding:3pt 6pt'
    const thS = 'border:1px solid #333;padding:4pt 6pt;background:#f0f0f0;font-weight:bold;text-align:center;font-size:9pt'
    const parcelsTable = parcels.length > 0
      ? `<table style="width:100%;border-collapse:collapse;margin:6pt 0;font-size:10pt"><thead><tr>
          <th style="${thS}">Nr.</th><th style="${thS}">Tarla</th><th style="${thS}">Parcel\u0103</th>
          <th style="${thS}">Nr. cadastral</th><th style="${thS}" class="right">Suprafa\u021b\u0103 (ha)</th>
          <th style="${thS}">Denumire popular\u0103</th></tr></thead><tbody>
          ${parcels.map((p, i) => `<tr>
            <td style="${tdS};text-align:center">${i + 1}</td>
            <td style="${tdS}">${p.tarla_nr ?? '\u2014'}</td>
            <td style="${tdS}">${p.parcel_nr ?? '\u2014'}</td>
            <td style="${tdS}">${(p as any).cadastral_nr ?? '\u2014'}</td>
            <td style="${tdS};text-align:right">${Number(p.surface).toFixed(4)}</td>
            <td style="${tdS}">${(p as any).popular_name ?? '\u2014'}</td>
          </tr>`).join('')}
          <tr><td style="${tdS};font-weight:bold;background:#f9f9f9;text-align:center" colspan="4">TOTAL</td>
            <td style="${tdS};font-weight:bold;background:#f9f9f9;text-align:right">${totalHa.toFixed(4)}</td>
            <td style="${tdS};background:#f9f9f9"></td></tr>
        </tbody></table>`
      : '<p>Parcelele arendate vor fi specificate prin act adi\u021bional.</p>'

    const rentTable = rentLevels.length > 0
      ? `<table style="width:100%;border-collapse:collapse;margin:6pt 0;font-size:10pt"><thead><tr>
          <th style="${thS}">Produs / Moned\u0103</th>
          <th style="${thS};text-align:right">Cantitate / ha</th>
          <th style="${thS}">Tip calcul</th>
          <th style="${thS};text-align:right">Total / an (${totalHa.toFixed(4)} ha)</th>
          <th style="${thS}">Cot\u0103 impozit</th></tr></thead><tbody>
          ${rentLevels.map(r => `<tr>
            <td style="${tdS}">${r.product_name}</td>
            <td style="${tdS};text-align:right">${Number(r.level_per_ha).toFixed(4)}</td>
            <td style="${tdS};text-align:center">${r.level_type}</td>
            <td style="${tdS};text-align:right"><strong>${(r.level_per_ha * totalHa).toFixed(2)} ${r.product_name}</strong></td>
            <td style="${tdS};text-align:center">${r.tax_rate}%</td>
          </tr>`).join('')}
        </tbody></table>`
      : '<p>Arenda se stabilete prin negociere direct\u0103.</p>'

    const filled = renderTemplate(customHtml, {
      contract_number: contract.contract_number,
      contract_type: CONTRACT_TYPE_LABELS[contract.contract_type] ?? contract.contract_type,
      sign_date: contract.sign_date ?? '',
      start_date: contract.start_date,
      end_date: contract.end_date,
      contract_years: String(contractYears),
      tax_method: TAX_MAP[contract.tax_method] ?? contract.tax_method,
      primarie_nr: contract.primarie_nr ?? '',
      primarie_date: contract.primarie_date ?? '',
      localities: contract.localities ?? '',
      zone: contract.zone ?? '',
      company_name: company.name,
      company_cif: company.cif,
      company_reg_com: company.reg_com,
      company_address: [company.address, company.locality, company.county].filter(Boolean).join(', '),
      company_iban: company.iban,
      company_bank: company.bank_name,
      company_phone: company.phone,
      company_email: company.email,
      lessor_name: lessorName,
      lessor_cnp: lessorId,
      lessor_id_label: lessorIdLabel,
      lessor_address: lessor?.address ?? '',
      lessor_county: lessor?.county ?? '',
      lessor_locality: lessor?.locality ?? '',
      lessor_phone: lessor?.phone ?? lessor?.mobile ?? '',
      lessor_email: lessor?.email ?? '',
      lessor_iban: lessor?.iban ?? '',
      lessor_bank: lessor?.bank_name ?? '',
      total_ha: totalHa.toFixed(4),
      parcel_count: String(parcels.length),
      parcels_table: parcelsTable,
      rent_table: rentTable,
      company_logo: company.logo_url
        ? `<img src="${company.logo_url}" alt="Logo" class="company-logo" style="max-height:110px;max-width:260px;object-fit:contain;display:block">`
        : '',
    })
    return (
      <>
        <div style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', gap: 8 }} className="no-print">
          <button onClick={() => window.print()} style={{ padding: '8px 16px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>
            🖨️ Printează / PDF
          </button>
          <button onClick={() => window.close()} style={{ padding: '8px 16px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14 }}>
            ✕ Închide
          </button>
        </div>
        {/* dangerouslySetInnerHTML is safe: HTML comes from admin-only template editor */}
        <div dangerouslySetInnerHTML={{ __html: filled }} />
      </>
    )
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f0f0f0; }
        .print-page {
          font-family: 'Times New Roman', Times, serif;
          font-size: 11pt;
          line-height: 1.6;
          color: #000;
          background: #fff;
          max-width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
          padding: 20mm 22mm 20mm 28mm;
        }
        .doc-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #000; padding-bottom: 8pt; margin-bottom: 12pt; }
        .company-logo { max-height: 110px; max-width: 260px; object-fit: contain; margin-bottom: 6pt; }
        .company-info { font-size: 9pt; line-height: 1.4; }
        .company-name { font-weight: bold; font-size: 11pt; }
        .doc-ref { text-align: right; font-size: 9pt; line-height: 1.6; }
        h1 { font-size: 14pt; text-align: center; text-transform: uppercase; font-weight: bold; margin: 8pt 0 2pt; letter-spacing: 1px; }
        .subtitle { text-align: center; font-size: 10pt; margin: 0 0 14pt; }
        h2 { font-size: 11pt; font-weight: bold; text-transform: uppercase; margin: 12pt 0 4pt; border-bottom: 1px solid #ccc; padding-bottom: 2pt; }
        p { margin: 4pt 0; text-align: justify; }
        table { width: 100%; border-collapse: collapse; margin: 6pt 0; font-size: 10pt; }
        th { border: 1px solid #333; padding: 4pt 6pt; background: #f0f0f0; font-weight: bold; text-align: center; font-size: 9pt; }
        td { border: 1px solid #333; padding: 3pt 6pt; }
        td.right, th.right { text-align: right; }
        td.center, th.center { text-align: center; }
        .total-row td { font-weight: bold; background: #f9f9f9; }
        .signatures { display: flex; justify-content: space-between; margin-top: 36pt; gap: 20pt; }
        .sig-block { flex: 1; }
        .sig-title { font-weight: bold; font-size: 11pt; margin-bottom: 4pt; }
        .sig-line { border-bottom: 1px solid #000; margin-top: 28pt; }
        .sig-label { font-size: 9pt; color: #555; margin-top: 2pt; }
        .no-print { position: fixed; top: 16px; right: 16px; z-index: 9999; }
        @media print {
          body { background: #fff; }
          .no-print { display: none !important; }
          .print-page { margin: 0; padding: 20mm 22mm 20mm 28mm; box-shadow: none; }
          @page { size: A4 portrait; margin: 0; }
        }
        @media screen {
          .print-page { box-shadow: 0 0 20px rgba(0,0,0,.15); margin: 24px auto; }
        }
      `}</style>

      {/* Print button (screen only) */}
      <div className="no-print">
        <button
          onClick={() => window.print()}
          style={{ padding: '10px 20px', background: '#2d6a4f', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'sans-serif', fontSize: 14, fontWeight: 600, boxShadow: '0 2px 6px rgba(0,0,0,.2)' }}
        >
          🖨 Printează / PDF
        </button>
      </div>

      <div className="print-page">
        {/* Document header */}
        <div className="doc-header">
          <div>
            {company.logo_url && <img src={company.logo_url} alt="Logo" className="company-logo" />}
            <div className="company-name">{company.name}</div>
            <div className="company-info">
              {company.cif && <div>CIF: {company.cif}{company.reg_com ? ` | Reg. Com.: ${company.reg_com}` : ''}</div>}
              <div>{[company.address, company.locality, company.county].filter(Boolean).join(', ')}</div>
              {company.iban && <div>IBAN: {company.iban}{company.bank_name ? ` — ${company.bank_name}` : ''}</div>}
              {company.phone && <div>Tel: {company.phone}</div>}
            </div>
          </div>
          <div className="doc-ref">
            <div><strong>Nr. contract:</strong> {contract.contract_number}</div>
            {contract.sign_date && <div><strong>Data:</strong> {contract.sign_date}</div>}
            {contract.primarie_nr && <div><strong>Nr. Primărie:</strong> {contract.primarie_nr}</div>}
            {contract.primarie_date && <div><strong>Data primărie:</strong> {contract.primarie_date}</div>}
          </div>
        </div>

        <h1>Contract de {CONTRACT_TYPE_LABELS[contract.contract_type] ?? contract.contract_type}</h1>
        <div className="subtitle">
          Nr. {contract.contract_number} / {contract.sign_date ?? '___________'}
        </div>

        <h2>I. Părțile Contractante</h2>
        <p>
          <strong>1.1. Arendatorul:</strong> {lessorName},{' '}
          {lessorIdLabel}: {lessorId},{' '}
          {lessor?.address ? `domiciliat(ă) în ${lessor.address}, ${lessor.locality ? lessor.locality + ', ' : ''}${lessor.county},` : `localitatea ${lessor?.locality ?? '___________'}, județul ${lessor?.county ?? '___________'},`}{' '}
          {lessor?.phone ? `tel: ${lessor.phone}, ` : ''}
          {lessor?.iban ? `IBAN: ${lessor.iban}${lessor.bank_name ? ` (${lessor.bank_name})` : ''}, ` : ''}
          denumit(ă) în continuare <strong>Arendator</strong>.
        </p>
        <p>
          <strong>1.2. Arendașul:</strong> {company.name},{' '}
          {company.cif ? `CIF ${company.cif}, ` : ''}
          {company.reg_com ? `Nr. Reg. Com. ${company.reg_com}, ` : ''}
          cu sediul în {[company.address, company.locality, company.county].filter(Boolean).join(', ')},{' '}
          {company.iban ? `IBAN: ${company.iban}${company.bank_name ? ` (${company.bank_name})` : ''}, ` : ''}
          {company.phone ? `tel: ${company.phone}, ` : ''}
          denumit(ă) în continuare <strong>Arendaș</strong>.
        </p>
        <p>
          Ambele părți au convenit să încheie prezentul contract de arendare, în temeiul
          Legii arendării nr. 16/1994, republicată, cu modificările și completările ulterioare,
          și ale Codului civil, în următoarele condiții:
        </p>

        <h2>II. Obiectul Contractului</h2>
        <p>
          Arendatorul transmite arendașului, spre folosință temporară pe durata prezentului
          contract, terenuri agricole situate în{' '}
          <strong>{contract.localities ?? contract.zone ?? 'localitatea ___________'}</strong>,
          în suprafață totală de <strong>{totalHa.toFixed(4)} ha</strong>, identificate conform
          Secțiunii V de mai jos.
        </p>

        <h2>III. Durata Contractului</h2>
        <p>
          Contractul se încheie pe o perioadă de{' '}
          <strong>{contractYears > 0 ? `${contractYears} (${numberToWords(contractYears)}) ani` : 'perioadă convenită'}</strong>,
          începând cu data de <strong>{contract.start_date}</strong> și expirând la data de{' '}
          <strong>{contract.end_date}</strong>.
        </p>
        <p>
          La expirarea termenului, contractul poate fi reînnoit prin acordul scris al ambelor părți,
          cu cel puțin 30 de zile înainte de data expirării.
        </p>

        <h2>IV. Arenda (Chiria)</h2>
        {rentLevels.length > 0 ? (
          <>
            <p>
              Arenda convenită de părți, pentru întreaga suprafață de{' '}
              <strong>{totalHa.toFixed(4)} ha</strong>, este:
            </p>
            <table>
              <thead>
                <tr>
                  <th>Produs / Monedă</th>
                  <th>Cantitate / ha</th>
                  <th>Tip calcul</th>
                  <th className="right">Total / an ({totalHa.toFixed(4)} ha)</th>
                  <th className="center">Cotă impozit</th>
                </tr>
              </thead>
              <tbody>
                {rentLevels.map((r, i) => (
                  <tr key={i}>
                    <td>{r.product_name}</td>
                    <td className="right">{Number(r.level_per_ha).toFixed(4)}</td>
                    <td className="center">{r.level_type}</td>
                    <td className="right"><strong>{(r.level_per_ha * totalHa).toFixed(2)} {r.product_name}</strong></td>
                    <td className="center">{r.tax_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              Arenda se plătește anual, prin acordul direct al părților.
              Metoda de plată a impozitului: <strong>{TAX_MAP[contract.tax_method] ?? contract.tax_method}</strong>.
            </p>
          </>
        ) : (
          <p>
            Arenda se stabilește prin negociere directă între părți și se consemnează prin
            act adițional la prezentul contract.
          </p>
        )}

        <h2>V. Terenurile Arendate</h2>
        {parcels.length > 0 ? (
          <table>
            <thead>
              <tr>
                <th className="center">Nr.</th>
                <th>Tarla</th>
                <th>Parcela</th>
                <th className="right">Suprafață (ha)</th>
                {hasCadastral && <th>Nr. cadastral</th>}
                {hasPopularName && <th>Denumire populară</th>}
              </tr>
            </thead>
            <tbody>
              {parcels.map((p, i) => (
                <tr key={i}>
                  <td className="center">{i + 1}</td>
                  <td>{p.tarla_nr ?? '—'}</td>
                  <td>{p.parcel_nr ?? '—'}</td>
                  <td className="right">{Number(p.surface).toFixed(4)}</td>
                  {hasCadastral && <td>{(p as any).cadastral_nr ?? '—'}</td>}
                  {hasPopularName && <td>{(p as any).popular_name ?? '—'}</td>}
                </tr>
              ))}
              <tr className="total-row">
                <td className="center" colSpan={3}>TOTAL</td>
                <td className="right">{totalHa.toFixed(4)}</td>
                {hasCadastral && <td></td>}
                {hasPopularName && <td></td>}
              </tr>
            </tbody>
          </table>
        ) : (
          <p>Parcelele arendate vor fi specificate prin act adițional la prezentul contract.</p>
        )}

        <h2>VI. Obligațiile Părților</h2>
        <p><strong>6.1. Arendatorul se obligă:</strong></p>
        <p>a) să predea terenul arendat în stare corespunzătoare destinației agricole;</p>
        <p>b) să garanteze liniștita posesie și folosință a terenului pe toată durata contractului;</p>
        <p>c) să achite toate taxele și impozitele legale aferente proprietății, cu excepțiile prevăzute de lege.</p>
        <p style={{ marginTop: 6 }}><strong>6.2. Arendașul se obligă:</strong></p>
        <p>a) să folosească terenul arendat ca un bun proprietar și potrivit destinației sale agricole;</p>
        <p>b) să mențină potențialul productiv al terenului și să execute lucrările de îmbunătățiri funciare;</p>
        <p>c) să plătească arenda la termenele și în condițiile stabilite prin prezentul contract;</p>
        <p>d) să nu subînchirieze terenul fără acordul scris al arendatorului;</p>
        <p>e) să restituie terenul la expirarea contractului în starea în care l-a primit.</p>

        <h2>VII. Forța Majoră și Cazul Fortuit</h2>
        <p>
          Niciuna din părți nu va fi răspunzătoare pentru neexecutarea obligațiilor sale contractuale,
          dacă aceasta se datorează unui caz de forță majoră. Partea care invocă forța majoră este
          obligată să notifice celeilalte părți, în termen de 5 zile, producerea evenimentului.
        </p>

        <h2>VIII. Clauze Finale</h2>
        <p>
          Prezentul contract a fost încheiat cu respectarea dispozițiilor Legii nr. 16/1994 a arendării
          și ale Codului civil, în <strong>3 (trei) exemplare originale</strong>, câte unul pentru
          fiecare parte contractantă și unul pentru înregistrarea la primăria comunei/orașului
          {contract.localities ? ` ${contract.localities}` : ''}.
        </p>
        {contract.primarie_nr && (
          <p>
            Înregistrat la Primărie cu nr. <strong>{contract.primarie_nr}</strong>
            {contract.primarie_date ? ` din data de ${contract.primarie_date}` : ''}.
          </p>
        )}

        <div className="signatures">
          <div className="sig-block">
            <div className="sig-title">ARENDATOR</div>
            <p>{lessorName}</p>
            {lessor?.address && <p style={{ fontSize: '9pt', color: '#555' }}>{lessor.address}, {lessor.locality}, {lessor.county}</p>}
            <div className="sig-line"></div>
            <div className="sig-label">Semnătura și ștampila</div>
          </div>
          <div className="sig-block" style={{ textAlign: 'right' }}>
            <div className="sig-title">ARENDAȘ</div>
            <p>{company.name}</p>
            {company.cif && <p style={{ fontSize: '9pt', color: '#555' }}>CIF: {company.cif}</p>}
            <div className="sig-line"></div>
            <div className="sig-label">Semnătura și ștampila</div>
          </div>
        </div>
      </div>
    </>
  )
}

function numberToWords(n: number): string {
  const words: Record<number, string> = { 1: 'unu', 2: 'doi', 3: 'trei', 4: 'patru', 5: 'cinci', 6: 'șase', 7: 'șapte', 8: 'opt', 9: 'nouă', 10: 'zece' }
  return words[n] ?? String(n)
}
