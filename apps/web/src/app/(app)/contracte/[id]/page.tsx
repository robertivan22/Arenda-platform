'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'

interface LessorOption { id: string; display_name: string }

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
