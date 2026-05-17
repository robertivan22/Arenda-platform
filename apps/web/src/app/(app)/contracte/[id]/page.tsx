'use client'

export const runtime = 'edge'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Pencil, Plus, Trash2, Printer, X } from 'lucide-react'

interface Contract {
  id: string; contract_number: string; contract_type: string
  lessor_id: string; lessor_name: string; zone: string | null
  start_date: string; end_date: string; sign_date: string | null
  primarie_nr: string | null; tax_method: string; localities: string | null; status: string
}
interface RentLevel { id: string; product_name: string; level_per_ha: number; level_type: string; tax_rate: number }
interface Parcel { id: string; tarla_nr: string | null; parcel_nr: string | null; surface: number }
interface Transaction {
  id: string; campaign_year: number; transaction_date: string
  product_name: string; kg_brut: number; kg_net: number
  price_per_unit: number; ron_brut: number; ron_net: number; tax_amount: number
  payment_type: string; pv_number: string | null; is_previzionata: boolean
}
interface Amendment { id: string; number: string; sign_date: string | null; description: string | null }
interface Deed { id: string; deed_nr: string | null; deed_date: string | null; deed_type: string; file_url: string | null }

const TAX_LABELS: Record<string, string> = {
  COTA_FORFETARA: 'Cota Forfetara', SISTEM_REAL: 'Sistem Real', SCUTIT: 'Scutit',
}

export default function ContractDashboardPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [contract, setContract] = useState<Contract | null>(null)
  const [rentLevels, setRentLevels] = useState<RentLevel[]>([])
  const [parcels, setParcels] = useState<Parcel[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [amendments, setAmendments] = useState<Amendment[]>([])
  const [deeds, setDeeds] = useState<Deed[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTxns, setSelectedTxns] = useState<Set<string>>(new Set())
  const [showNewAmendment, setShowNewAmendment] = useState(false)
  const [amendForm, setAmendForm] = useState({ number: '', sign_date: '', description: '' })
  const [showNewDeed, setShowNewDeed] = useState(false)
  const [deedForm, setDeedForm] = useState({ deed_nr: '', deed_date: '', deed_type: 'Titlu proprietate' })

  const load = useCallback(async () => {
    const db = createClient()
    const [{ data: c }, { data: levels }, { data: ps }, { data: txns }, { data: amends }, { data: ds }] = await Promise.all([
      db.from('contracts').select('*, lessors(first_name, last_name, company_name, type)').eq('id', id).single(),
      db.from('contract_rent_levels').select('*').eq('contract_id', id).order('sort_order'),
      db.from('parcels').select('id, tarla_nr, parcel_nr, surface').eq('contract_id', id),
      db.from('transactions').select('*').eq('contract_id', id).order('campaign_year').order('transaction_date'),
      db.from('contract_amendments').select('*').eq('contract_id', id).order('sign_date'),
      db.from('property_deeds').select('*').eq('contract_id', id).order('deed_date'),
    ])
    if (c) {
      const lessor = Array.isArray((c as any).lessors) ? (c as any).lessors[0] : (c as any).lessors
      setContract({ ...c as any, lessor_name: lessor ? (lessor.type === 'LEGAL' ? lessor.company_name : `${lessor.last_name} ${lessor.first_name}`.trim()) : '—' })
    }
    setRentLevels((levels ?? []) as RentLevel[])
    setParcels((ps ?? []) as Parcel[])
    setTransactions((txns ?? []) as Transaction[])
    setAmendments((amends ?? []) as Amendment[])
    setDeeds((ds ?? []) as Deed[])
    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  const totalHa = parcels.reduce((s, p) => s + Number(p.surface ?? 0), 0)
  const years: number[] = []
  if (contract) {
    const sy = new Date(contract.start_date).getFullYear()
    const ey = new Date(contract.end_date).getFullYear()
    for (let y = sy; y <= ey; y++) years.push(y)
  }
  const matrix: Record<string, Record<number, number>> = {}
  transactions.filter(t => !t.is_previzionata).forEach(t => {
    if (!matrix[t.product_name]) matrix[t.product_name] = {}
    matrix[t.product_name][t.campaign_year] = (matrix[t.product_name][t.campaign_year] ?? 0) + t.kg_net
  })
  const productNames = [...new Set(transactions.map(t => t.product_name))].filter(Boolean)

  async function deleteTxn(txnId: string) {
    if (!confirm('Stergi aceasta tranzactie?')) return
    const { error } = await createClient().from('transactions').delete().eq('id', txnId)
    if (error) { toast.error(error.message); return }
    setTransactions(prev => prev.filter(t => t.id !== txnId))
  }

  async function saveAmendment(e: React.FormEvent) {
    e.preventDefault()
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return
    const { error } = await db.from('contract_amendments').insert({ user_id: user.id, contract_id: id, number: amendForm.number, sign_date: amendForm.sign_date || null, description: amendForm.description || null })
    if (error) { toast.error(error.message); return }
    toast.success('Act aditional adaugat.')
    setShowNewAmendment(false); setAmendForm({ number: '', sign_date: '', description: '' }); load()
  }

  async function saveDeed(e: React.FormEvent) {
    e.preventDefault()
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return
    const { error } = await db.from('property_deeds').insert({ user_id: user.id, contract_id: id, deed_nr: deedForm.deed_nr || null, deed_date: deedForm.deed_date || null, deed_type: deedForm.deed_type })
    if (error) { toast.error(error.message); return }
    toast.success('Act adaugat.')
    setShowNewDeed(false); setDeedForm({ deed_nr: '', deed_date: '', deed_type: 'Titlu proprietate' }); load()
  }

  async function generateInvoice() {
    if (selectedTxns.size === 0) { toast.error('Selectati cel putin o tranzactie.'); return }
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return
    const { data: cs } = await db.from('company_settings').select('invoice_series, invoice_counter').eq('user_id', user.id).single()
    const series = cs?.invoice_series ?? 'A'
    const counter = (cs?.invoice_counter ?? 0) + 1
    const invoiceNumber = `${series}-${counter}`
    const txnsSelected = transactions.filter(t => selectedTxns.has(t.id))
    const totalRon = txnsSelected.reduce((s, t) => s + t.ron_net, 0)
    const tvaAmount = Math.round(totalRon * 0.09 * 100) / 100
    const { data: inv, error } = await db.from('invoices').insert({
      user_id: user.id, lessor_id: contract?.lessor_id,
      invoice_number: invoiceNumber, invoice_series: series,
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      total_ron: totalRon, tva_amount: tvaAmount, tva_rate: 9, doc_type: 'FACTURA', status: 'DRAFT',
    }).select('id').single()
    if (error || !inv) { toast.error('Eroare la generare factura.'); return }
    await db.from('company_settings').update({ invoice_counter: counter }).eq('user_id', user.id)
    await db.from('transactions').update({ invoice_id: inv.id }).in('id', [...selectedTxns])
    toast.success(`Factura ${invoiceNumber} generata.`)
    router.push(`/print/factura/${inv.id}`)
  }

  const inputCls = 'w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500'
  const labelCls = 'block text-xs font-medium text-gray-700 mb-1'
  const thCls = 'px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide bg-gray-50'
  const tdCls = 'px-3 py-2 text-sm'

  if (loading) return <div className="p-8 text-sm text-gray-400">Se incarca...</div>
  if (!contract) return <div className="p-8 text-sm text-red-400">Contract negasit.</div>

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-lg font-bold text-gray-900">Contract {contract.contract_number}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${contract.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{contract.status}</span>
            </div>
            <div className="text-sm text-gray-500 space-y-0.5">
              <div><span className="font-medium text-gray-700">{contract.lessor_name}</span> · {contract.localities ?? contract.zone ?? '—'}</div>
              <div>Plata impozit: <span className="font-medium">{TAX_LABELS[contract.tax_method] ?? contract.tax_method}</span></div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right mr-2">
              <div className="text-xs text-gray-400">Suprafata totala</div>
              <div className="text-xl font-bold text-brand-700">{totalHa.toFixed(4)} ha</div>
            </div>
            <button onClick={() => router.push(`/contracte/${id}/editeaza`)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">
              <Pencil className="w-3.5 h-3.5" /> Editeaza
            </button>
          </div>
        </div>
        {/* Timeline */}
        <div className="mt-4 bg-[#1e3a22] rounded-lg p-3 text-white">
          <div className="text-sm font-bold mb-1">{new Date(contract.start_date).getFullYear()} — {new Date(contract.end_date).getFullYear()}</div>
          <div className="text-sm font-semibold">{contract.lessor_name}</div>
          {rentLevels.map((r, i) => (
            <div key={i} className="text-xs text-green-300">{r.level_per_ha} {r.product_name}/ha {r.level_type}</div>
          ))}
          {totalHa > 0 && <div className="text-sm font-bold mt-1">{totalHa.toFixed(4)} ha</div>}
        </div>
      </div>

      {/* Contract initial + Acte aditionale */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 font-semibold text-sm">Contract initial si acte aditionale</div>
        <table className="w-full text-sm">
          <thead><tr>{['Nr.','Data','Arendator','Perioada','Nivel arenda','Tarla','Parcela','Ha',''].map(h => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
          <tbody>
            <tr className="border-b border-gray-100">
              <td className={tdCls + ' font-mono font-bold'}>{contract.contract_number}</td>
              <td className={tdCls}>{contract.sign_date ?? '—'}</td>
              <td className={tdCls}><span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">{contract.lessor_name}</span></td>
              <td className={tdCls}>{new Date(contract.start_date).getFullYear()} – {new Date(contract.end_date).getFullYear()}</td>
              <td className={tdCls}>{rentLevels.map((r, i) => <div key={i} className="text-xs">{r.level_per_ha} {r.product_name}/ha {r.level_type}</div>)}</td>
              <td className={tdCls}>{parcels.map(p => p.tarla_nr).filter(Boolean).join(', ') || '—'}</td>
              <td className={tdCls}>{parcels.map(p => p.parcel_nr).filter(Boolean).join(', ') || '—'}</td>
              <td className={tdCls + ' font-semibold'}>{totalHa.toFixed(4)}</td>
              <td className={tdCls}></td>
            </tr>
            {amendments.map(a => (
              <tr key={a.id} className="border-b border-gray-100 bg-blue-50">
                <td className={tdCls + ' font-mono text-blue-700'}>Act {a.number}</td>
                <td className={tdCls}>{a.sign_date ?? '—'}</td>
                <td className={tdCls + ' text-blue-700 font-medium'}>{contract.lessor_name}</td>
                <td className={tdCls} colSpan={5}>{a.description ?? '—'}</td>
                <td className={tdCls}><button onClick={async () => { await createClient().from('contract_amendments').delete().eq('id', a.id); setAmendments(p => p.filter(x => x.id !== a.id)) }} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
          <button onClick={() => setShowNewAmendment(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded font-medium"><Plus className="w-3.5 h-3.5" /> Adauga act aditional</button>
          <button onClick={async () => { if (!confirm('Inchizi contractul?')) return; await createClient().from('contracts').update({ status: 'TERMINATED' }).eq('id', id); load() }} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-500 hover:bg-red-600 text-white rounded font-medium"><X className="w-3.5 h-3.5" /> Inchide Contract</button>
        </div>
        {showNewAmendment && (
          <form onSubmit={saveAmendment} className="px-4 pb-4 border-t border-gray-100 pt-3">
            <div className="grid grid-cols-3 gap-3">
              <div><label className={labelCls}>Nr. act</label><input className={inputCls} value={amendForm.number} onChange={e => setAmendForm(p => ({...p, number: e.target.value}))} required /></div>
              <div><label className={labelCls}>Data semnare</label><input className={inputCls} type="date" value={amendForm.sign_date} onChange={e => setAmendForm(p => ({...p, sign_date: e.target.value}))} /></div>
              <div><label className={labelCls}>Descriere</label><input className={inputCls} value={amendForm.description} onChange={e => setAmendForm(p => ({...p, description: e.target.value}))} /></div>
            </div>
            <div className="flex gap-2 mt-2">
              <button type="submit" className="px-3 py-1.5 bg-brand-600 text-white text-sm rounded">Salveaza</button>
              <button type="button" onClick={() => setShowNewAmendment(false)} className="px-3 py-1.5 text-sm border border-gray-300 rounded">Anuleaza</button>
            </div>
          </form>
        )}
      </div>

      {/* Tranzactii */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
          <span className="font-semibold text-sm">Tranzactii</span>
          <div className="flex gap-2">
            {selectedTxns.size > 0 && (
              <button onClick={generateInvoice} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"><Printer className="w-3.5 h-3.5" /> Genereaza factura ({selectedTxns.size})</button>
            )}
            <button onClick={() => router.push(`/contracte/${id}/tranzactie`)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded font-medium"><Plus className="w-3.5 h-3.5" /> Adauga tranzactie</button>
          </div>
        </div>
        {productNames.length > 0 && (
          <div className="overflow-x-auto border-b border-gray-100">
            <table className="text-xs min-w-full">
              <thead><tr className="bg-[#1e3a22] text-white"><th className="px-3 py-2 text-left font-semibold">Produs</th>{years.map(y => <th key={y} className="px-3 py-2 text-right font-semibold">{y}</th>)}</tr></thead>
              <tbody>
                {productNames.map(prod => {
                  const level = rentLevels.find(r => r.product_name === prod)
                  const duePerYear = level ? level.level_per_ha * totalHa : null
                  return (
                    <tr key={prod} className="border-b border-gray-100">
                      <td className="px-3 py-2 font-semibold bg-gray-50">{prod}</td>
                      {years.map(y => {
                        const paid = matrix[prod]?.[y] ?? 0
                        const rem = duePerYear !== null ? duePerYear - paid : null
                        return <td key={y} className={`px-3 py-2 text-right ${paid > 0 ? 'text-green-700 font-semibold' : ''} ${rem !== null && rem > 0 ? 'text-orange-500' : ''}`}>{rem !== null && rem > 0 ? rem.toFixed(0) : paid > 0 ? paid.toFixed(0) : '—'}</td>
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead><tr>
              <th className={thCls + ' w-8'}><input type="checkbox" onChange={e => setSelectedTxns(e.target.checked ? new Set(transactions.map(t => t.id)) : new Set())} /></th>
              {['An','Arendator','Data','Produs','Kg Brut','Kg Net','Tip Plata','Pret(lei)','RON Brut','RON Net','Impozit',''].map(h => <th key={h} className={thCls}>{h}</th>)}
            </tr></thead>
            <tbody>
              {transactions.length === 0 && <tr><td colSpan={13} className="px-3 py-8 text-center text-gray-400">Nicio tranzactie inregistrata</td></tr>}
              {transactions.map(t => (
                <tr key={t.id} className={`border-b border-gray-100 hover:bg-gray-50 ${t.is_previzionata ? 'opacity-60 italic' : ''}`}>
                  <td className={tdCls}><input type="checkbox" checked={selectedTxns.has(t.id)} onChange={e => setSelectedTxns(prev => { const s = new Set(prev); e.target.checked ? s.add(t.id) : s.delete(t.id); return s })} /></td>
                  <td className={tdCls}>{t.campaign_year}</td>
                  <td className={tdCls}>{contract.lessor_name}</td>
                  <td className={tdCls}>{t.transaction_date}</td>
                  <td className={tdCls}><span className="px-1.5 py-0.5 bg-brand-100 text-brand-700 rounded text-xs">{t.product_name}</span></td>
                  <td className={tdCls + ' text-right'}>{Number(t.kg_brut).toFixed(0)}</td>
                  <td className={tdCls + ' text-right font-semibold'}>{Number(t.kg_net).toFixed(0)}</td>
                  <td className={tdCls}>{t.payment_type}{t.pv_number ? ` #${t.pv_number}` : ''}</td>
                  <td className={tdCls + ' text-right'}>{Number(t.price_per_unit).toFixed(2)}</td>
                  <td className={tdCls + ' text-right'}>{Number(t.ron_brut).toFixed(2)}</td>
                  <td className={tdCls + ' text-right font-semibold text-green-700'}>{Number(t.ron_net).toFixed(2)}</td>
                  <td className={tdCls + ' text-right text-orange-600'}>{Number(t.tax_amount).toFixed(2)}</td>
                  <td className={tdCls}><button onClick={() => deleteTxn(t.id)} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Acte de proprietate */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 font-semibold text-sm">Acte de proprietate</div>
        <table className="w-full text-sm">
          <thead><tr>{['Nr.','Nr. act','Data','Tip','Fisier',''].map(h => <th key={h} className={thCls}>{h}</th>)}</tr></thead>
          <tbody>
            {deeds.length === 0 && <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-400">Niciun act de proprietate</td></tr>}
            {deeds.map((d, i) => (
              <tr key={d.id} className="border-b border-gray-100">
                <td className={tdCls}>{i + 1}</td>
                <td className={tdCls}>{d.deed_nr ?? '—'}</td>
                <td className={tdCls}>{d.deed_date ?? '—'}</td>
                <td className={tdCls}>{d.deed_type}</td>
                <td className={tdCls}>{d.file_url ? <a href={d.file_url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline text-xs">Deschide</a> : '—'}</td>
                <td className={tdCls}><button onClick={async () => { await createClient().from('property_deeds').delete().eq('id', d.id); setDeeds(p => p.filter(x => x.id !== d.id)) }} className="p-1 text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-gray-100">
          <button onClick={() => setShowNewDeed(v => !v)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded font-medium"><Plus className="w-3.5 h-3.5" /> Adauga act de proprietate</button>
        </div>
        {showNewDeed && (
          <form onSubmit={saveDeed} className="px-4 pb-4 border-t border-gray-100 pt-3">
            <div className="grid grid-cols-3 gap-3">
              <div><label className={labelCls}>Nr. act</label><input className={inputCls} value={deedForm.deed_nr} onChange={e => setDeedForm(p => ({...p, deed_nr: e.target.value}))} /></div>
              <div><label className={labelCls}>Data</label><input className={inputCls} type="date" value={deedForm.deed_date} onChange={e => setDeedForm(p => ({...p, deed_date: e.target.value}))} /></div>
              <div><label className={labelCls}>Tip</label><select className={inputCls} value={deedForm.deed_type} onChange={e => setDeedForm(p => ({...p, deed_type: e.target.value}))}>{['Titlu proprietate','Extras CF','Contract vanzare-cumparare','Certificat mostenitor','Donatie','Alta'].map(t => <option key={t} value={t}>{t}</option>)}</select></div>
            </div>
            <div className="flex gap-2 mt-2">
              <button type="submit" className="px-3 py-1.5 bg-brand-600 text-white text-sm rounded">Salveaza</button>
              <button type="button" onClick={() => setShowNewDeed(false)} className="px-3 py-1.5 text-sm border border-gray-300 rounded">Anuleaza</button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}


export default function EditContractPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lessorsList, setLessorsList] = useState<LessorOption[]>([])
  const [form, setForm] = useState({
    contractNumber: '', contractType: 'ARENDA',
    lessorId: '', zone: '', signDate: '', startDate: '', endDate: '',
    totalParcels: '0', annualRent: '', status: 'ACTIVE',
  })

  useEffect(() => {
    const db = createClient()
    db.from('lessors').select('id, first_name, last_name, company_name, type').order('last_name')
      .then(({ data }) => {
        if (data) setLessorsList((data as any[]).map(l => ({
          id: l.id,
          display_name: l.type === 'LEGAL' ? l.company_name : `${l.last_name} ${l.first_name}`.trim(),
        })))
      })
    db.from('contracts').select('*').eq('id', id).single()
      .then(({ data, error }) => {
        if (error || !data) { toast.error('Contractul nu a fost gasit.'); router.push('/contracte'); return }
        setForm({
          contractNumber: data.contract_number ?? '',
          contractType: data.contract_type ?? 'ARENDA',
          lessorId: data.lessor_id ?? '',
          zone: data.zone ?? '',
          signDate: data.sign_date ?? '',
          startDate: data.start_date ?? '',
          endDate: data.end_date ?? '',
          totalParcels: String(data.total_parcels ?? 0),
          annualRent: String(data.annual_rent ?? ''),
          status: data.status ?? 'ACTIVE',
        })
        setLoading(false)
      })
  }, [id, router])

  function set(field: string, value: string) { setForm(prev => ({ ...prev, [field]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await createClient()
      .from('contracts')
      .update({
        contract_number: form.contractNumber,
        contract_type: form.contractType,
        lessor_id: form.lessorId || null,
        zone: form.zone || null,
        sign_date: form.signDate || null,
        start_date: form.startDate,
        end_date: form.endDate,
        total_parcels: parseInt(form.totalParcels) || 0,
        annual_rent: parseFloat(form.annualRent) || 0,
        status: form.status,
      })
      .eq('id', id)
    setSaving(false)
    if (error) { toast.error('Eroare: ' + error.message); return }
    toast.success('Contractul a fost actualizat.')
    router.push('/contracte')
  }

  const inputCls = 'w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500'
  const labelCls = 'block text-xs font-medium text-gray-700 mb-1'

  if (loading) return <div className="p-8 text-sm text-gray-400">Se incarca...</div>

  return (
    <div className="max-w-4xl">
      <div className="mb-4">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Inapoi
        </button>
        <PageHeader title={`Contract ${form.contractNumber}`} subtitle="Modifica datele contractului" />
      </div>
      <form onSubmit={handleSubmit}>
        <div className="form-section">
          <div className="form-section-title">Date contract</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><label className={labelCls}>Nr. contract *</label><input className={inputCls} value={form.contractNumber} onChange={e => set('contractNumber', e.target.value)} required /></div>
            <div>
              <label className={labelCls}>Tip contract</label>
              <select className={inputCls} value={form.contractType} onChange={e => set('contractType', e.target.value)}>
                <option value="ARENDA">Arenda</option>
                <option value="CONCESIUNE">Concesiune</option>
                <option value="COMODAT">Comodat</option>
                <option value="ASOCIERE">Asociere in participatiune</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Arendator *</label>
              <select className={inputCls} value={form.lessorId} onChange={e => set('lessorId', e.target.value)} required>
                <option value="">Selectati</option>
                {lessorsList.map(l => <option key={l.id} value={l.id}>{l.display_name}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Zona</label><input className={inputCls} value={form.zone} onChange={e => set('zone', e.target.value)} /></div>
            <div><label className={labelCls}>Data semnare</label><input className={inputCls} type="date" value={form.signDate} onChange={e => set('signDate', e.target.value)} /></div>
            <div><label className={labelCls}>De la *</label><input className={inputCls} type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} required /></div>
            <div><label className={labelCls}>Pana la *</label><input className={inputCls} type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} required /></div>
            <div><label className={labelCls}>Arenda anuala (RON)</label><input className={inputCls} type="number" min="0" step="0.01" value={form.annualRent} onChange={e => set('annualRent', e.target.value)} /></div>
            <div><label className={labelCls}>Nr. parcele</label><input className={inputCls} type="number" min="0" value={form.totalParcels} onChange={e => set('totalParcels', e.target.value)} /></div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={inputCls} value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="ACTIVE">Activ</option>
                <option value="EXPIRED">Expirat</option>
                <option value="TERMINATED">Reziliat</option>
                <option value="DRAFT">Draft</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button type="submit" disabled={saving} className="px-5 py-2 bg-brand-600 text-white text-sm rounded hover:bg-brand-700 disabled:opacity-50">
            {saving ? 'Se salveaza...' : 'Salveaza modificarile'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">Anuleaza</button>
        </div>
      </form>
    </div>
  )
}
