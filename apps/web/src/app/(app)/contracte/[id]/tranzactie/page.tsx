'use client'

export const runtime = 'edge'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'

interface Product { id: string; name: string; unit: string }
interface RentLevel { product_id: string; product_name: string; level_per_ha: number; level_type: string; tax_rate: number }
interface ContractInfo { contract_number: string; lessor_id: string; lessor_name: string; start_date: string; end_date: string }
interface Parcel { surface: number }

const PAYMENT_TYPES = ['Proces Verbal', 'Chitanta', 'Ordin de plata', 'Numerar', 'Virament bancar']

export default function NewTransactionPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [saving, setSaving] = useState(false)
  const [contract, setContract] = useState<ContractInfo | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [rentLevels, setRentLevels] = useState<RentLevel[]>([])
  const [totalHa, setTotalHa] = useState(0)
  const [paidThisYear, setPaidThisYear] = useState<Record<string, number>>({})
  const currentYear = new Date().getFullYear()

  const [form, setForm] = useState({
    productId: '', productName: '',
    campaignYear: String(currentYear),
    transactionDate: new Date().toISOString().split('T')[0],
    kgBrut: '',
    pricePerUnit: '',
    paymentType: 'Proces Verbal',
    pvNumber: '',
    autoNr: true,
    isPrevizionata: false,
    impozitAplicat: false,
    notes: '',
  })

  useEffect(() => {
    const db = createClient()
    Promise.all([
      db.from('contracts').select('contract_number, lessor_id, start_date, end_date, lessors(first_name, last_name, company_name, type)').eq('id', id).single(),
      db.from('products').select('id, name, unit').eq('is_active', true).order('sort_order'),
      db.from('contract_rent_levels').select('*').eq('contract_id', id).order('sort_order'),
      db.from('parcels').select('surface').eq('contract_id', id),
    ]).then(([{ data: c }, { data: prods }, { data: levels }, { data: ps }]) => {
      if (c) {
        const lessor = Array.isArray((c as any).lessors) ? (c as any).lessors[0] : (c as any).lessors
        setContract({ ...c as any, lessor_name: lessor ? (lessor.type === 'LEGAL' ? lessor.company_name : `${lessor.last_name} ${lessor.first_name}`.trim()) : '—' })
      }
      if (prods) setProducts(prods as Product[])
      if (levels) {
        setRentLevels(levels as RentLevel[])
        if (levels.length > 0) {
          const first = levels[0] as any
          setForm(prev => ({ ...prev, productId: first.product_id ?? '', productName: first.product_name ?? '' }))
        }
      }
      if (ps) setTotalHa((ps as Parcel[]).reduce((s, p) => s + Number(p.surface ?? 0), 0))
    })
  }, [id])

  useEffect(() => {
    if (!form.productName || !form.campaignYear) return
    createClient().from('transactions')
      .select('kg_net, product_name')
      .eq('contract_id', id)
      .eq('campaign_year', parseInt(form.campaignYear))
      .eq('is_previzionata', false)
      .then(({ data }) => {
        const map: Record<string, number> = {}
        ;(data ?? []).forEach((t: any) => { map[t.product_name] = (map[t.product_name] ?? 0) + Number(t.kg_net) })
        setPaidThisYear(map)
      })
  }, [id, form.productName, form.campaignYear])

  function setField(field: string, value: string | boolean) { setForm(prev => ({ ...prev, [field]: value })) }

  // Calculations
  const level = rentLevels.find(r => r.product_name === form.productName)
  const dueTotalKg = level ? level.level_per_ha * totalHa : 0
  const paidKg = paidThisYear[form.productName] ?? 0
  const remainingKg = Math.max(0, dueTotalKg - paidKg)
  const kgBrut = parseFloat(form.kgBrut) || 0
  // Physical kg net (display only — does not affect RON calculation)
  const kgNet = level?.level_type === 'BRUT'
    ? kgBrut - (kgBrut * 0.8) * ((level?.tax_rate ?? 10) / 100)
    : kgBrut
  const price = parseFloat(form.pricePerUnit) || 0
  const ronBrut = kgBrut * price
  const taxAmount = form.impozitAplicat ? Math.round(ronBrut * 0.10 * 100) / 100 : 0
  const ronNet = Math.round((ronBrut - taxAmount) * 100) / 100

  function fillPercent(pct: number) {
    setField('kgBrut', (remainingKg * pct / 100).toFixed(0))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.productId) { toast.error('Selectati un produs.'); return }
    setSaving(true)
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) { toast.error('Neautentificat.'); setSaving(false); return }
    let pvNumber = form.pvNumber
    if (form.autoNr && !pvNumber) {
      const { count } = await db.from('transactions').select('id', { count: 'exact', head: true }).eq('contract_id', id)
      pvNumber = String((count ?? 0) + 1)
    }
    const { error } = await db.from('transactions').insert({
      user_id: user.id,
      contract_id: id,
      lessor_id: contract?.lessor_id ?? null,
      product_id: form.productId,
      product_name: form.productName,
      campaign_year: parseInt(form.campaignYear),
      transaction_date: form.transactionDate,
      kg_brut: kgBrut,
      kg_net: Math.round(kgNet * 10000) / 10000,
      price_per_unit: price,
      ron_brut: Math.round(ronBrut * 100) / 100,
      ron_net: Math.round(ronNet * 100) / 100,
      tax_amount: Math.round(taxAmount * 100) / 100,
      payment_type: form.paymentType,
      pv_number: pvNumber || null,
      is_previzionata: form.isPrevizionata,
      impozit_aplicat: form.impozitAplicat,
      notes: form.notes || null,
    })
    setSaving(false)
    if (error) { toast.error('Eroare: ' + error.message); return }
    toast.success('Tranzactia a fost inregistrata.')
    router.push(`/contracte/${id}`)
  }

  const inputCls = 'w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500'
  const labelCls = 'block text-xs font-medium text-gray-700 mb-1'

  return (
    <div className="max-w-2xl">
      <div className="mb-4">
        <button onClick={() => router.push(`/contracte/${id}`)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Inapoi la contract
        </button>
        <PageHeader title="Adauga tranzactie" subtitle={contract ? `Contract ${contract.contract_number} — ${contract.lessor_name}` : ''} />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          {/* Flags */}
          <div className="flex flex-wrap gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.isPrevizionata} onChange={e => setField('isPrevizionata', e.target.checked)} className="rounded" />
              <span className="text-gray-700">Tranzacție Previzionată</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.impozitAplicat} onChange={e => setField('impozitAplicat', e.target.checked)} className="rounded" />
              <span className="text-gray-700">Aplică impozit 10% la sursă</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Produs *</label>
              <select className={inputCls} value={form.productId} onChange={e => {
                const prod = products.find(p => p.id === e.target.value)
                setForm(prev => ({ ...prev, productId: e.target.value, productName: prod?.name ?? '' }))
              }} required>
                <option value="">Selectati</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>An campanie *</label>
              <input className={inputCls} type="number" min="2000" max="2100" value={form.campaignYear} onChange={e => setField('campaignYear', e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Data tranzactie *</label>
              <input className={inputCls} type="date" value={form.transactionDate} onChange={e => setField('transactionDate', e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Pret / unitate (RON)</label>
              <input className={inputCls} type="number" min="0" step="0.0001" value={form.pricePerUnit} onChange={e => setField('pricePerUnit', e.target.value)} />
            </div>
          </div>

          {/* Quick fill buttons */}
          {dueTotalKg > 0 && (
            <div>
              <div className="text-xs text-gray-500 mb-1.5">
                Cantitate ramasa: <strong className="text-orange-600">{remainingKg.toFixed(0)} {level?.product_name}</strong> (din {dueTotalKg.toFixed(0)} total an)
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-gray-500">Seteaza:</span>
                {[25, 50, 75, 100].map(pct => (
                  <button key={pct} type="button" onClick={() => fillPercent(pct)}
                    className="px-3 py-1 text-xs rounded-full border border-brand-300 text-brand-700 hover:bg-brand-50 font-medium">
                    {pct}%
                  </button>
                ))}
                <span className="text-xs text-gray-400">din {remainingKg.toFixed(0)} {level?.product_name}</span>
              </div>
            </div>
          )}

          <div>
            <label className={labelCls}>Cantitate Bruta *</label>
            <input className={inputCls} type="number" min="0" step="0.01" value={form.kgBrut} onChange={e => setField('kgBrut', e.target.value)} required />
          </div>

          {/* Calculated summary */}
          {kgBrut > 0 && (
            <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">Kg Net (fizic):</span><span className="font-semibold">{kgNet.toFixed(4)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">RON Brut:</span><span>{ronBrut.toFixed(2)}</span></div>
              {form.impozitAplicat && (
                <div className="flex justify-between"><span className="text-gray-500">Impozit (10%):</span><span className="text-orange-600">{taxAmount.toFixed(2)}</span></div>
              )}
              <div className="flex justify-between"><span className="text-gray-500">RON Net:</span><span className="font-semibold text-green-700">{ronNet.toFixed(2)}</span></div>
              <div className="border-t border-gray-200 pt-1 text-xs text-gray-400">
                {form.impozitAplicat ? 'Net = Brut × 90% (impozit 10% reținut la sursă)' : 'Fără impozit reținut — bifă „Aplică impozit” de mai sus'}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tip plata</label>
              <select className={inputCls} value={form.paymentType} onChange={e => setField('paymentType', e.target.value)}>
                {PAYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Nr. Proces Verbal</label>
              <div className="flex gap-2 items-center">
                <input className={inputCls} value={form.pvNumber} onChange={e => setField('pvNumber', e.target.value)} disabled={form.autoNr} placeholder={form.autoNr ? 'Auto' : ''} />
                <label className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap cursor-pointer">
                  <input type="checkbox" checked={form.autoNr} onChange={e => setField('autoNr', e.target.checked)} /> Auto
                </label>
              </div>
            </div>
          </div>

          <div>
            <label className={labelCls}>Observatii</label>
            <input className={inputCls} value={form.notes} onChange={e => setField('notes', e.target.value)} />
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="px-5 py-2 bg-brand-600 text-white text-sm rounded hover:bg-brand-700 disabled:opacity-50">
            {saving ? 'Se salveaza...' : 'Salveaza tranzactia'}
          </button>
          <button type="button" onClick={() => router.push(`/contracte/${id}`)} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">Anuleaza</button>
        </div>
      </form>
    </div>
  )
}
