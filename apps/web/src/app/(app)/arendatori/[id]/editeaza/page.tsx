'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'

type LessorType = 'NATURAL' | 'LEGAL' | 'PFA'
type Gender = 'MALE' | 'FEMALE' | ''

export default function EditLessorPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [type, setType] = useState<LessorType>('NATURAL')
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    firstName: '', lastName: '', companyName: '',
    cnpCui: '', iban: '', bankName: '',
    gender: '' as Gender,
    county: '', locality: '',
    address: '', phone: '', mobile: '', email: '',
    notes: '',
  })

  useEffect(() => {
    createClient()
      .from('lessors')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) { toast.error('Arendatorul nu a fost gasit.'); router.push('/arendatori'); return }
        setType(data.type as LessorType)
        setForm({
          firstName: data.first_name ?? '',
          lastName: data.last_name ?? '',
          companyName: data.company_name ?? '',
          cnpCui: data.cnp ?? '',
          iban: data.iban ?? '',
          bankName: data.bank_name ?? '',
          gender: (data.gender ?? '') as Gender,
          county: data.county ?? '',
          locality: data.locality ?? '',
          address: data.address ?? '',
          phone: data.phone ?? '',
          mobile: data.mobile ?? '',
          email: data.email ?? '',
          notes: data.notes ?? '',
        })
        setLoading(false)
      })
  }, [id, router])

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await createClient()
      .from('lessors')
      .update({
        type,
        first_name: form.firstName,
        last_name: form.lastName,
        company_name: form.companyName || null,
        cnp: form.cnpCui,
        gender: form.gender || null,
        county: form.county,
        locality: form.locality,
        address: form.address || null,
        phone: form.phone || null,
        mobile: form.mobile || null,
        email: form.email || null,
        iban: form.iban || null,
        bank_name: form.bankName || null,
        notes: form.notes || null,
      })
      .eq('id', id)
    setSaving(false)
    if (error) { toast.error('Eroare: ' + error.message); return }
    toast.success('Datele au fost salvate.')
    router.push(`/arendatori/${id}/sumar`)
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
        <PageHeader title="Editeaza arendator" subtitle="Modifica datele arendatorului" />
      </div>
      <form onSubmit={handleSubmit}>
        <div className="form-section">
          <div className="form-section-title">Tip persoana</div>
          <div className="flex gap-3">
            {(['NATURAL', 'LEGAL', 'PFA'] as LessorType[]).map(t => (
              <label key={t} className="flex items-center gap-2 cursor-pointer text-sm">
                <input type="radio" name="type" value={t} checked={type === t} onChange={() => setType(t)} className="accent-brand-500" />
                {t === 'NATURAL' ? 'Persoana fizica' : t === 'LEGAL' ? 'Persoana juridica' : 'PFA'}
              </label>
            ))}
          </div>
        </div>
        <div className="form-section">
          <div className="form-section-title">Date identitate</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {type !== 'LEGAL' ? (
              <>
                <div><label className={labelCls}>Nume *</label><input className={inputCls} value={form.lastName} onChange={e => set('lastName', e.target.value)} required /></div>
                <div><label className={labelCls}>Prenume *</label><input className={inputCls} value={form.firstName} onChange={e => set('firstName', e.target.value)} required /></div>
              </>
            ) : (
              <div className="col-span-2"><label className={labelCls}>Denumire firma *</label><input className={inputCls} value={form.companyName} onChange={e => set('companyName', e.target.value)} required /></div>
            )}
            <div><label className={labelCls}>{type === 'LEGAL' ? 'CUI' : 'CNP'} *</label><input className={inputCls} value={form.cnpCui} onChange={e => set('cnpCui', e.target.value)} required /></div>
            {type === 'NATURAL' && (
              <div>
                <label className={labelCls}>Gen</label>
                <select className={inputCls} value={form.gender} onChange={e => set('gender', e.target.value)}>
                  <option value="">-</option>
                  <option value="MALE">Masculin</option>
                  <option value="FEMALE">Feminin</option>
                </select>
              </div>
            )}
          </div>
        </div>
        <div className="form-section">
          <div className="form-section-title">Adresa</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><label className={labelCls}>Judet *</label><input className={inputCls} value={form.county} onChange={e => set('county', e.target.value)} required /></div>
            <div><label className={labelCls}>Localitate *</label><input className={inputCls} value={form.locality} onChange={e => set('locality', e.target.value)} required /></div>
            <div><label className={labelCls}>Strada</label><input className={inputCls} value={form.address} onChange={e => set('address', e.target.value)} /></div>
          </div>
        </div>
        <div className="form-section">
          <div className="form-section-title">Date contact</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><label className={labelCls}>Telefon fix</label><input className={inputCls} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
            <div><label className={labelCls}>Mobil</label><input className={inputCls} type="tel" value={form.mobile} onChange={e => set('mobile', e.target.value)} /></div>
            <div><label className={labelCls}>Email</label><input className={inputCls} type="email" value={form.email} onChange={e => set('email', e.target.value)} /></div>
          </div>
        </div>
        <div className="form-section">
          <div className="form-section-title">Date bancare</div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>IBAN</label><input className={inputCls} value={form.iban} onChange={e => set('iban', e.target.value.replace(/\s/g, '').toUpperCase())} placeholder="RO49AAAA1B31007593840000" /></div>
            <div><label className={labelCls}>Banca</label><input className={inputCls} value={form.bankName} onChange={e => set('bankName', e.target.value)} /></div>
          </div>
        </div>
        <div className="form-section">
          <div className="form-section-title">Observatii</div>
          <textarea className={inputCls} rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} />
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
