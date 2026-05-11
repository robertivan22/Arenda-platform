'use client'

export const runtime = 'edge'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { contracts, lessors, type Lessor } from '@/lib/mockStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'

export default function NewContractPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [lessorsList, setLessorsList] = useState<Lessor[]>([])
  const [form, setForm] = useState({
    contractNumber: '', contractType: 'ARENDA',
    lessorId: '', lessorName: '',
    zone: '', signDate: '', startDate: '', endDate: '',
    totalParcels: '0', annualRent: '', notes: '',
  })

  useEffect(() => { setLessorsList(lessors.list()) }, [])

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleLessorChange(id: string) {
    const l = lessorsList.find(l => l.id === id)
    setForm(prev => ({ ...prev, lessorId: id, lessorName: l?.displayName ?? '' }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    contracts.create({ ...form, totalParcels: parseInt(form.totalParcels) || 0, status: 'ACTIVE' })
    toast.success('Contractul a fost creat cu succes.')
    router.push('/contracte')
  }

  const inputCls = 'w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500'
  const labelCls = 'block text-xs font-medium text-gray-700 mb-1'

  return (
    <div className="max-w-4xl">
      <div className="mb-4">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Înapoi
        </button>
        <PageHeader title="Contract nou" subtitle="Completați datele contractului" />
      </div>
      <form onSubmit={handleSubmit}>
        <div className="form-section">
          <div className="form-section-title">Date contract</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><label className={labelCls}>Nr. contract *</label><input className={inputCls} value={form.contractNumber} onChange={e => set('contractNumber', e.target.value)} required /></div>
            <div>
              <label className={labelCls}>Tip contract</label>
              <select className={inputCls} value={form.contractType} onChange={e => set('contractType', e.target.value)}>
                <option value="ARENDA">Arendă</option>
                <option value="CONCESIUNE">Concesiune</option>
                <option value="COMODAT">Comodat</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Arendator *</label>
              <select className={inputCls} value={form.lessorId} onChange={e => handleLessorChange(e.target.value)} required>
                <option value="">Selectați arendator</option>
                {lessorsList.map(l => <option key={l.id} value={l.id}>{l.displayName}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Zonă</label><input className={inputCls} value={form.zone} onChange={e => set('zone', e.target.value)} /></div>
            <div><label className={labelCls}>Arendă anuală (RON)</label><input className={inputCls} type="number" value={form.annualRent} onChange={e => set('annualRent', e.target.value)} /></div>
            <div><label className={labelCls}>Nr. parcele</label><input className={inputCls} type="number" value={form.totalParcels} onChange={e => set('totalParcels', e.target.value)} /></div>
          </div>
        </div>
        <div className="form-section">
          <div className="form-section-title">Perioade</div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className={labelCls}>Data semnare</label><input className={inputCls} type="date" value={form.signDate} onChange={e => set('signDate', e.target.value)} /></div>
            <div><label className={labelCls}>De la *</label><input className={inputCls} type="date" value={form.startDate} onChange={e => set('startDate', e.target.value)} required /></div>
            <div><label className={labelCls}>Până la *</label><input className={inputCls} type="date" value={form.endDate} onChange={e => set('endDate', e.target.value)} required /></div>
          </div>
        </div>
        <div className="form-section">
          <div className="form-section-title">Observații</div>
          <textarea className={inputCls} rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
        <div className="flex gap-3 mt-6">
          <button type="submit" disabled={saving} className="px-5 py-2 bg-brand-600 text-white text-sm rounded hover:bg-brand-700 disabled:opacity-50">Salvează contract</button>
          <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">Anulează</button>
        </div>
      </form>
    </div>
  )
}
