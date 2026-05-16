'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'

interface LessorOption { id: string; display_name: string }

export default function NewContractPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [lessorsList, setLessorsList] = useState<LessorOption[]>([])
  const [form, setForm] = useState({
    contractNumber: '', contractType: 'ARENDA',
    lessorId: '', zone: '', signDate: '', startDate: '', endDate: '',
    totalParcels: '0', annualRent: '',
  })

  useEffect(() => {
    createClient().from('lessors').select('id, first_name, last_name, company_name, type').order('last_name')
      .then(({ data }) => {
        if (data) setLessorsList((data as any[]).map(l => ({
          id: l.id,
          display_name: l.type === 'LEGAL' ? l.company_name : `${l.last_name} ${l.first_name}`.trim(),
        })))
      })
  }, [])

  function set(field: string, value: string) { setForm(prev => ({ ...prev, [field]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) { toast.error('Neautentificat.'); setSaving(false); return }
    const { error } = await db.from('contracts').insert({
      user_id: user.id,
      contract_number: form.contractNumber,
      contract_type: form.contractType,
      lessor_id: form.lessorId || null,
      zone: form.zone || null,
      sign_date: form.signDate || null,
      start_date: form.startDate,
      end_date: form.endDate,
      total_parcels: parseInt(form.totalParcels) || 0,
      annual_rent: parseFloat(form.annualRent) || 0,
      status: 'ACTIVE',
    })
    setSaving(false)
    if (error) { toast.error('Eroare: ' + error.message); return }
    toast.success('Contractul a fost creat.')
    router.push('/contracte')
  }

  const inputCls = 'w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500'
  const labelCls = 'block text-xs font-medium text-gray-700 mb-1'

  return (
    <div className="max-w-4xl">
      <div className="mb-4">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Inapoi
        </button>
        <PageHeader title="Contract nou" subtitle="Completati datele contractului" />
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
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button type="submit" disabled={saving} className="px-5 py-2 bg-brand-600 text-white text-sm rounded hover:bg-brand-700 disabled:opacity-50">
            {saving ? 'Se salveaza...' : 'Salveaza contract'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">Anuleaza</button>
        </div>
      </form>
    </div>
  )
}
