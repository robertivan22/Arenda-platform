'use client'

export const runtime = 'edge'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { parcels, lessors, contracts, type Lessor, type Contract } from '@/lib/mockStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'

const LAND_CATEGORIES = ['Arabil','Pășune','Fânețe','Vie','Livadă','Pădure','Curți-construcții','Ape','Drumuri','Neproductiv']

export default function NewParcelPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [lessorsList, setLessorsList] = useState<Lessor[]>([])
  const [contractsList, setContractsList] = useState<Contract[]>([])
  const [form, setForm] = useState({
    parcelCode: '', tarlaNr: '', parcelNr: '',
    county: '', locality: '', landUseCategory: 'Arabil',
    surface: '', surfaceRented: '',
    lessorId: '', lessorName: '', contractId: '',
  })

  useEffect(() => {
    setLessorsList(lessors.list())
    setContractsList(contracts.list())
  }, [])

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function handleLessorChange(id: string) {
    const l = lessorsList.find(l => l.id === id)
    setForm(prev => ({ ...prev, lessorId: id, lessorName: l?.displayName ?? '', county: l?.county ?? prev.county, locality: l?.locality ?? prev.locality }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    parcels.create({ ...form, status: 'ACTIVE' })
    toast.success('Parcela a fost adăugată.')
    router.push('/parcele')
  }

  const inputCls = 'w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500'
  const labelCls = 'block text-xs font-medium text-gray-700 mb-1'

  return (
    <div className="max-w-4xl">
      <div className="mb-4">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Înapoi
        </button>
        <PageHeader title="Parcelă nouă" subtitle="Adaugă o parcelă nouă" />
      </div>
      <form onSubmit={handleSubmit}>
        <div className="form-section">
          <div className="form-section-title">Identificare parcelă</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><label className={labelCls}>Cod parcelă *</label><input className={inputCls} value={form.parcelCode} onChange={e => set('parcelCode', e.target.value)} required /></div>
            <div><label className={labelCls}>Nr. tarla</label><input className={inputCls} value={form.tarlaNr} onChange={e => set('tarlaNr', e.target.value)} /></div>
            <div><label className={labelCls}>Nr. parcelă</label><input className={inputCls} value={form.parcelNr} onChange={e => set('parcelNr', e.target.value)} /></div>
            <div><label className={labelCls}>Județ *</label><input className={inputCls} value={form.county} onChange={e => set('county', e.target.value)} required /></div>
            <div><label className={labelCls}>Localitate *</label><input className={inputCls} value={form.locality} onChange={e => set('locality', e.target.value)} required /></div>
            <div>
              <label className={labelCls}>Categorie folosință</label>
              <select className={inputCls} value={form.landUseCategory} onChange={e => set('landUseCategory', e.target.value)}>
                {LAND_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div><label className={labelCls}>Suprafață totală (ha) *</label><input className={inputCls} type="number" step="0.0001" value={form.surface} onChange={e => set('surface', e.target.value)} required /></div>
            <div><label className={labelCls}>Suprafață arendată (ha)</label><input className={inputCls} type="number" step="0.0001" value={form.surfaceRented} onChange={e => set('surfaceRented', e.target.value)} /></div>
          </div>
        </div>
        <div className="form-section">
          <div className="form-section-title">Asociere</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Arendator</label>
              <select className={inputCls} value={form.lessorId} onChange={e => handleLessorChange(e.target.value)}>
                <option value="">Selectați arendator</option>
                {lessorsList.map(l => <option key={l.id} value={l.id}>{l.displayName}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Contract</label>
              <select className={inputCls} value={form.contractId} onChange={e => set('contractId', e.target.value)}>
                <option value="">Selectați contract</option>
                {contractsList.filter(c => !form.lessorId || c.lessorId === form.lessorId).map(c => (
                  <option key={c.id} value={c.id}>{c.contractNumber} - {c.lessorName}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button type="submit" disabled={saving} className="px-5 py-2 bg-brand-600 text-white text-sm rounded hover:bg-brand-700 disabled:opacity-50">Salvează parcela</button>
          <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">Anulează</button>
        </div>
      </form>
    </div>
  )
}
