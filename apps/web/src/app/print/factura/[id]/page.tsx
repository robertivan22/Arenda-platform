'use client'

export const runtime = 'edge'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { fetchTemplate, renderTemplate } from '@/lib/templates'

interface Invoice {
  id: string; invoice_number: string; invoice_series: string
  invoice_date: string; due_date: string | null
  total_ron: number; tva_amount: number; tva_rate: number
  doc_type: string; status: string; lessor_id: string
}
interface Company {
  name: string; cif: string; reg_com: string; address: string
  county: string; locality: string; iban: string; bank_name: string
  phone: string; email: string; logo_url?: string
}
interface Lessor {
  first_name: string; last_name: string; company_name: string | null; type: string
  cnp: string | null; address: string | null; iban: string | null; bank_name: string | null
  phone: string | null; mobile: string | null; email: string | null
}
interface Transaction {
  id: string; product_name: string; kg_net: number; price_per_unit: number
  ron_net: number; campaign_year: number; contract_id: string
  contracts: { contract_number: string; sign_date: string | null } | null
}

export default function PrintFacturaPage() {
  const { id } = useParams<{ id: string }>()
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [lessor, setLessor] = useState<Lessor | null>(null)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [customHtml, setCustomHtml] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const db = createClient()
    db.from('invoices').select('*').eq('id', id).single().then(async ({ data: inv }) => {
      if (!inv) return
      setInvoice(inv as Invoice)
      const { data: { user } } = await db.auth.getUser()
      const [{ data: cs }, { data: les }, { data: txns }] = await Promise.all([
        db.from('company_settings').select('*').single(),
        db.from('lessors').select('*').eq('id', inv.lessor_id).single(),
        db.from('transactions').select('*, contracts(contract_number, sign_date)').eq('invoice_id', id),
      ])
      if (cs) setCompany(cs as Company)
      if (les) setLessor(les as Lessor)
      setTransactions((txns ?? []) as Transaction[])
      // Check for user-specific template
      if (user) {
        const docType = inv.doc_type === 'AVIZ' ? 'AVIZ' : 'FACTURA'
        const tmpl = await fetchTemplate(db, user.id, docType)
        if (tmpl) setCustomHtml(tmpl.html_content)
      }
      setLoading(false)
    })
  }, [id])

  if (loading) return <div className="p-8 text-center text-gray-400">Se incarca...</div>
  if (!invoice || !company || !lessor) return <div className="p-8 text-red-400">Date incomplete pentru factura.</div>

  const isAviz = invoice.doc_type === 'AVIZ'
  const lessorName = lessor.type === 'LEGAL' ? lessor.company_name ?? '' : `${lessor.last_name} ${lessor.first_name}`.trim()
  const totalFaraTva = invoice.total_ron
  const total = totalFaraTva + invoice.tva_amount

  // ── Custom template rendering ─────────────────────────────────────────────
  if (customHtml) {
    const productsRows = transactions.map((t, i) =>
      `<tr><td>${i + 1}</td><td>${t.product_name} (conform contractului de arendare nr. ${(t.contracts as any)?.contract_number ?? ''})</td><td>Kg.</td><td>${t.kg_net.toLocaleString('ro-RO')}</td>${!isAviz ? `<td>${t.price_per_unit}</td><td>${t.ron_net.toLocaleString('ro-RO', { minimumFractionDigits: 2 })}</td>` : ''}</tr>`
    ).join('')
    const productsTable = `<table style="width:100%;border-collapse:collapse;margin:12px 0"><thead><tr style="background:#f5f5f5"><th style="border:1px solid #ccc;padding:6px 10px">Nr.</th><th style="border:1px solid #ccc;padding:6px 10px">Denumire</th><th style="border:1px solid #ccc;padding:6px 10px">U.M.</th><th style="border:1px solid #ccc;padding:6px 10px">Cant.</th>${!isAviz ? '<th style="border:1px solid #ccc;padding:6px 10px">Preț/kg</th><th style="border:1px solid #ccc;padding:6px 10px">Valoare RON</th>' : ''}</tr></thead><tbody>${productsRows}</tbody></table>`

    const filled = renderTemplate(customHtml, {
      invoice_number: invoice.invoice_number,
      invoice_series: invoice.invoice_series,
      aviz_number: invoice.invoice_number,
      aviz_series: invoice.invoice_series,
      invoice_date: invoice.invoice_date,
      aviz_date: invoice.invoice_date,
      due_date: invoice.due_date ?? '',
      company_name: company.name,
      company_cif: company.cif ?? '',
      company_reg_com: company.reg_com ?? '',
      company_address: [company.address, company.locality, company.county].filter(Boolean).join(', '),
      company_iban: company.iban ?? '',
      company_bank: company.bank_name ?? '',
      company_phone: company.phone ?? '',
      company_email: company.email ?? '',
      client_name: lessorName,
      client_cnp: lessor.cnp ?? '',
      client_address: lessor.address ?? '',
      client_iban: lessor.iban ?? '',
      client_bank: lessor.bank_name ?? '',
      client_phone: lessor.phone ?? lessor.mobile ?? '',
      client_email: lessor.email ?? '',
      products_table: productsTable,
      total_kg: transactions.reduce((s, t) => s + t.kg_net, 0).toLocaleString('ro-RO'),
      total_ron: totalFaraTva.toLocaleString('ro-RO', { minimumFractionDigits: 2 }),
      total_fara_tva: totalFaraTva.toLocaleString('ro-RO', { minimumFractionDigits: 2 }),
      tva_rate: String(invoice.tva_rate),
      tva_amount: invoice.tva_amount.toLocaleString('ro-RO', { minimumFractionDigits: 2 }),
      total_cu_tva: total.toLocaleString('ro-RO', { minimumFractionDigits: 2 }),
      company_logo: company.logo_url
        ? `<img src="${company.logo_url}" alt="Logo" style="max-height:100px;max-width:240px;object-fit:contain;display:block">`
        : '',
    })
    return (
      <>
        <div className="no-print fixed top-4 right-4 flex gap-2 z-50" style={{ position: 'fixed', top: 16, right: 16, zIndex: 9999, display: 'flex', gap: 8 }}>
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
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
          .page { box-shadow: none !important; margin: 0 !important; }
        }
        body { background: #f3f4f6; font-family: Arial, sans-serif; }
        .page { background: white; max-width: 210mm; margin: 20px auto; padding: 20mm; box-shadow: 0 0 20px rgba(0,0,0,0.1); }
      `}</style>

      {/* Print button */}
      <div className="no-print fixed top-4 right-4 flex gap-2 z-50">
        <button onClick={() => window.print()} className="px-4 py-2 bg-blue-600 text-white rounded shadow text-sm font-medium hover:bg-blue-700">
          🖨️ Printeaza / Salveaza PDF
        </button>
        <button onClick={() => window.close()} className="px-4 py-2 bg-gray-200 text-gray-700 rounded shadow text-sm hover:bg-gray-300">
          ✕ Inchide
        </button>
      </div>

      <div className="page">
        {/* Header: Logo | Title | Meta table — 3-column layout */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 8 }}>
          <div style={{ minWidth: 170, maxWidth: 200 }}>
            {company.logo_url
              ? <img src={company.logo_url} alt="Logo" style={{ maxHeight: 100, maxWidth: 240, objectFit: 'contain', display: 'block' }} />
              : <div style={{ width: 170 }} />}
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <h1 className="text-xl font-bold uppercase tracking-wide">
              {isAviz ? 'AVIZ DE ÎNSOȚIRE A MĂRFII' : 'FACTURĂ FISCALĂ'}
            </h1>
          </div>
          <div style={{ minWidth: 180 }}>
            <table className="text-sm border border-gray-300" style={{ marginLeft: 'auto' }}>
              <tbody>
                <tr><td className="px-3 py-1 font-semibold bg-gray-50 border-b border-r border-gray-300">Nr.</td><td className="px-3 py-1 border-b border-gray-300">{invoice.invoice_number}</td></tr>
                <tr><td className="px-3 py-1 font-semibold bg-gray-50 border-b border-r border-gray-300">Serie</td><td className="px-3 py-1 border-b border-gray-300">{invoice.invoice_series}</td></tr>
                <tr><td className="px-3 py-1 font-semibold bg-gray-50 border-b border-r border-gray-300">Data</td><td className="px-3 py-1 border-b border-gray-300">{invoice.invoice_date}</td></tr>
                {invoice.due_date && <tr><td className="px-3 py-1 font-semibold bg-gray-50 border-b border-r border-gray-300">Scadenta</td><td className="px-3 py-1 border-b border-gray-300">{invoice.due_date}</td></tr>}
                {!isAviz && <tr><td className="px-3 py-1 font-semibold bg-gray-50 border-r border-gray-300">Cota TVA</td><td className="px-3 py-1">{invoice.tva_rate}% Redus</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {/* Furnizor / Client */}
        <div className="grid grid-cols-2 gap-6 mb-6 text-sm">
          <div>
            <p className="font-bold text-gray-500 uppercase text-xs mb-2">Furnizor:</p>
            <p className="font-bold text-blue-700 text-base">{company.name}</p>
            {company.cif && <p>CIF: {company.cif}</p>}
            {company.reg_com && <p>Reg. com.: {company.reg_com}</p>}
            {company.address && <p>Adresa: {company.address}{company.locality ? `, ${company.locality}` : ''}</p>}
            {company.iban && <p>IBAN: {company.iban}</p>}
            {company.bank_name && <p>Banca: {company.bank_name}</p>}
            {company.phone && <p>Tel.: {company.phone}</p>}
            {company.email && <p>Email: {company.email}</p>}
          </div>
          <div>
            <p className="font-bold text-gray-500 uppercase text-xs mb-2">Client:</p>
            <p className="font-bold text-blue-700 text-base">{lessorName}</p>
            {lessor.cnp && <p>CNP: {lessor.cnp}</p>}
            {lessor.address && <p>Adresa: {lessor.address}</p>}
            {lessor.iban && <p>IBAN: {lessor.iban}</p>}
            {lessor.bank_name && <p>Banca: {lessor.bank_name}</p>}
            {(lessor.phone || lessor.mobile) && <p>Tel.: {lessor.phone ?? lessor.mobile}</p>}
            {lessor.email && <p>Email: {lessor.email}</p>}
          </div>
        </div>

        {/* Products table */}
        <table className="w-full border border-gray-300 text-sm mb-4" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 px-2 py-1.5 text-left">Nr. crt.</th>
              <th className="border border-gray-300 px-2 py-1.5 text-left">Denumirea produselor sau a serviciilor</th>
              <th className="border border-gray-300 px-2 py-1.5 text-center">U.M.</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right">Cant.</th>
              {!isAviz && <>
                <th className="border border-gray-300 px-2 py-1.5 text-right">Pret unitar (fara TVA)</th>
                <th className="border border-gray-300 px-2 py-1.5 text-right">Valoare</th>
                <th className="border border-gray-300 px-2 py-1.5 text-right">Val. TVA</th>
              </>}
            </tr>
          </thead>
          <tbody>
            {transactions.map((t, i) => {
              const contract = t.contracts
              const tvaOnLine = Math.round(t.ron_net * (invoice.tva_rate / 100) * 100) / 100
              const desc = `${t.product_name} ARENDA ${t.campaign_year}${contract ? ` (conform contractului de arendare nr. ${contract.contract_number}${contract.sign_date ? ` din data de ${contract.sign_date}` : ''})` : ''}`
              return (
                <tr key={t.id} className="border-b border-gray-200">
                  <td className="border border-gray-300 px-2 py-1.5">{i + 1}</td>
                  <td className="border border-gray-300 px-2 py-1.5">{desc}</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-center">Kg.</td>
                  <td className="border border-gray-300 px-2 py-1.5 text-right">{Number(t.kg_net).toFixed(0)}</td>
                  {!isAviz && <>
                    <td className="border border-gray-300 px-2 py-1.5 text-right">{Number(t.price_per_unit).toFixed(2)}</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right">{Number(t.ron_net).toFixed(2)}</td>
                    <td className="border border-gray-300 px-2 py-1.5 text-right">{tvaOnLine.toFixed(2)}</td>
                  </>}
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Totals */}
        {!isAviz && (
          <div className="flex justify-end">
            <table className="text-sm">
              <tbody>
                <tr><td className="pr-8 py-0.5 text-gray-500">Total fara TVA</td><td className="font-semibold text-right">{totalFaraTva.toFixed(2)} RON</td></tr>
                <tr><td className="pr-8 py-0.5 text-gray-500">TVA {invoice.tva_rate}%</td><td className="font-semibold text-right">{invoice.tva_amount.toFixed(2)} RON</td></tr>
                <tr className="border-t border-gray-300">
                  <td className="pr-8 py-1 font-bold">Total plata</td>
                  <td className="font-bold text-right text-lg">{total.toFixed(2)} RON</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-6 text-center">TVA la incasare</p>
      </div>
    </>
  )
}
