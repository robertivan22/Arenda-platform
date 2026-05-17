'use client'

export const runtime = 'edge'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from 'sonner'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'

interface LessorOption { id: string; display_name: string }
interface ProductOption { id: string; name: string; unit: string }
interface RentLevel { id?: string; product_id: string; product_name: string; level_per_ha: string; level_type: 'BRUT' | 'NET'; tax_rate: string }

export default function EditContractPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lessorsList, setLessorsList] = useState<LessorOption[]>([])
  const [productsList, setProductsList] = useState<ProductOption[]>([])
  const [rentLevels, setRentLevels] = useState<RentLevel[]>([])
  const [form, setForm] = useState({
    contractNumber: '', primaireNr: '', primaireDate: '',
    contractType: 'ARENDA', lessorId: '', zone: '',
    signDate: '', startDate: '', endDate: '',
    taxMethod: 'COTA_FORFETARA', localities: '', status: 'ACTIVE',
  })

  useEffect(() => {
    const db = createClient()
    Promise.all([
      db.from('lessors').select('id, first_name, last_name, company_name, type').order('last_name'),
      db.from('products').select('id, name, unit').eq('is_active', true).order('sort_order'),
      db.from('contracts').select('*').eq('id', id).single(),
      db.from('contract_rent_levels').select('*').eq('contract_id', id).order('sort_order'),
    ]).then(([{ data: lessors }, { data: products }, { data: contract, error }, { data: levels }]) => {
      if (lessors) setLessorsList((lessors as any[]).map(l => ({
        id: l.id,
        display_name: l.type === 'LEGAL' ? l.company_name : `${l.last_name} ${l.first_name}`.trim(),
      })))
      if (products) setProductsList(products as ProductOption[])
      if (error || !contract) { toast.error('Contractul nu a fost gasit.'); router.push('/contracte'); return }
      setForm({
        contractNumber: contract.contract_number ?? '',
        primaireNr: contract.primarie_nr ?? '',
        primaireDate: contract.primarie_date ?? '',
        contractType: contract.contract_type ?? 'ARENDA',
        lessorId: contract.lessor_id ?? '',
        zone: contract.zone ?? '',
        signDate: contract.sign_date ?? '',
        startDate: contract.start_date ?? '',
        endDate: contract.end_date ?? '',
        taxMethod: contract.tax_method ?? 'COTA_FORFETARA',
        localities: contract.localities ?? '',
        status: contract.status ?? 'ACTIVE',
      })
      if (levels) setRentLevels((levels as any[]).map(l => ({
        id: l.id,
        product_id: l.product_id ?? '',
        product_name: l.product_name ?? '',
        level_per_ha: String(l.level_per_ha ?? ''),
        level_type: l.level_type ?? 'NET',
        tax_rate: String(l.tax_rate ?? '10'),
      })))
      setLoading(false)
    })
  }, [id, router])

  function setField(field: string, value: string) { setForm(prev => ({ ...prev, [field]: value })) }

  function addRentLevel() {
    setRentLevels(prev => [...prev, { product_id: productsList[0]?.id ?? '', product_name: productsList[0]?.name ?? '', level_per_ha: '', level_type: 'NET', tax_rate: '10' }])
  }

  function updateRentLevel(idx: number, field: keyof RentLevel, value: string) {
    setRentLevels(prev => prev.map((r, i) => {
      if (i !== idx) return r
      if (field === 'product_id') {
        const prod = productsList.find(p => p.id === value)
        return { ...r, product_id: value, product_name: prod?.name ?? '' }
      }
      return { ...r, [field]: value }
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) { toast.error('Neautentificat.'); setSaving(false); return }
    const { error } = await db.from('contracts').update({
      contract_number: form.contractNumber,
      contract_type: form.contractType,
      lessor_id: form.lessorId || null,
      zone: form.zone || null,
      sign_date: form.signDate || null,
      start_date: form.startDate,
      end_date: form.endDate,
      primarie_nr: form.primaireNr || null,
      primarie_date: form.primaireDate || null,
      tax_method: form.taxMethod,
      localities: form.localities || null,
      status: form.status,
    }).eq('id', id)
    if (error) { toast.error('Eroare: ' + error.message); setSaving(false); return }
    // Update rent levels: delete all, re-insert
    await db.from('contract_rent_levels').delete().eq('contract_id', id)
    if (rentLevels.length > 0) {
      await db.from('contract_rent_levels').insert(
        rentLevels.filter(r => r.product_id && r.level_per_ha).map((r, i) => ({
          user_id: user.id,
          contract_id: id,
          product_id: r.product_id || null,
          product_name: r.product_name,
          level_per_ha: parseFloat(r.level_per_ha) || 0,
          level_type: r.level_type,
          tax_rate: parseFloat(r.tax_rate) || 10,
          sort_order: i,
        }))
      )
    }
    setSaving(false)
    toast.success('Contractul a fost actualizat.')
    router.push(`/contracte/${id}`)
  }

  const inputCls = 'w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500'
  const labelCls = 'block text-xs font-medium text-gray-700 mb-1'

  if (loading) return <div className="p-8 text-sm text-gray-400">Se incarca...</div>

  return (
    <div className="max-w-4xl">
      <div className="mb-4">
        <button onClick={() => router.push(`/contracte/${id}`)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Inapoi la contract
        </button>
        <PageHeader title={`Editeaza contract ${form.contractNumber}`} subtitle="Modifica datele contractului" />
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-section">
          <div className="form-section-title">Date contract</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><label className={labelCls}>Nr. contract *</label><input className={inputCls} value={form.contractNumber} onChange={e => setField('contractNumber', e.target.value)} required /></div>
            <div><label className={labelCls}>Nr. contract primarie</label><input className={inputCls} value={form.primaireNr} onChange={e => setField('primaireNr', e.target.value)} /></div>
            <div><label className={labelCls}>Data contract primarie</label><input className={inputCls} type="date" value={form.primaireDate} onChange={e => setField('primaireDate', e.target.value)} /></div>
            <div>
              <label className={labelCls}>Tip contract</label>
              <select className={inputCls} value={form.contractType} onChange={e => setField('contractType', e.target.value)}>
                <option value="ARENDA">Arenda</option>
                <option value="CONCESIUNE">Concesiune</option>
                <option value="COMODAT">Comodat</option>
                <option value="ASOCIERE">Asociere in participatiune</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Arendator *</label>
              <select className={inputCls} value={form.lessorId} onChange={e => setField('lessorId', e.target.value)} required>
                <option value="">Selectati</option>
                {lessorsList.map(l => <option key={l.id} value={l.id}>{l.display_name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Metoda plata impozit</label>
              <select className={inputCls} value={form.taxMethod} onChange={e => setField('taxMethod', e.target.value)}>
                <option value="COTA_FORFETARA">Cota Forfetara</option>
                <option value="SISTEM_REAL">Sistem Real</option>
                <option value="SCUTIT">Scutit</option>
              </select>
            </div>
            <div><label className={labelCls}>Zona</label><input className={inputCls} value={form.zone} onChange={e => setField('zone', e.target.value)} /></div>
            <div><label className={labelCls}>Localitate</label><input className={inputCls} value={form.localities} onChange={e => setField('localities', e.target.value)} /></div>
            <div><label className={labelCls}>Data semnare</label><input className={inputCls} type="date" value={form.signDate} onChange={e => setField('signDate', e.target.value)} /></div>
            <div><label className={labelCls}>Data inceput *</label><input className={inputCls} type="date" value={form.startDate} onChange={e => setField('startDate', e.target.value)} required /></div>
            <div><label className={labelCls}>Data sfarsit *</label><input className={inputCls} type="date" value={form.endDate} onChange={e => setField('endDate', e.target.value)} required /></div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={inputCls} value={form.status} onChange={e => setField('status', e.target.value)}>
                <option value="ACTIVE">Activ</option>
                <option value="EXPIRED">Expirat</option>
                <option value="TERMINATED">Reziliat</option>
                <option value="DRAFT">Draft</option>
              </select>
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title flex items-center justify-between">
            <span>Niveluri Arenda</span>
            <button type="button" onClick={addRentLevel} className="flex items-center gap-1 text-xs px-2.5 py-1 bg-brand-500 text-white rounded hover:bg-brand-600">
              <Plus className="w-3 h-3" /> Adauga Nivel
            </button>
          </div>
          {rentLevels.length === 0 && (
            <p className="text-sm text-gray-400 py-2">Niciun nivel definit.</p>
          )}
          {rentLevels.map((r, i) => (
            <div key={i} className="grid grid-cols-4 gap-2 items-center bg-gray-50 border border-gray-200 rounded p-2 mb-2">
              <div>
                <label className={labelCls}>Produs</label>
                <select className={inputCls} value={r.product_id} onChange={e => updateRentLevel(i, 'product_id', e.target.value)}>
                  <option value="">Selectati</option>
                  {productsList.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Nivel / ha</label>
                <input className={inputCls} type="number" min="0" step="0.01" value={r.level_per_ha} onChange={e => updateRentLevel(i, 'level_per_ha', e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Tip nivel</label>
                <select className={inputCls} value={r.level_type} onChange={e => updateRentLevel(i, 'level_type', e.target.value as any)}>
                  <option value="NET">Net</option>
                  <option value="BRUT">Brut</option>
                </select>
              </div>
              <div className="flex items-end gap-1">
                <div className="flex-1">
                  <label className={labelCls}>Cota impozit %</label>
                  <input className={inputCls} type="number" min="0" max="100" step="0.1" value={r.tax_rate} onChange={e => updateRentLevel(i, 'tax_rate', e.target.value)} />
                </div>
                <button type="button" onClick={() => setRentLevels(prev => prev.filter((_, j) => j !== i))} className="p-1.5 text-red-400 hover:text-red-600 mb-0.5">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="px-5 py-2 bg-brand-600 text-white text-sm rounded hover:bg-brand-700 disabled:opacity-50">
            {saving ? 'Se salveaza...' : 'Salveaza modificarile'}
          </button>
          <button type="button" onClick={() => router.push(`/contracte/${id}`)} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">Anuleaza</button>
        </div>
      </form>
    </div>
  )
}
