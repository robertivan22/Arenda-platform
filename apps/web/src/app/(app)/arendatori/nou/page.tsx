'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { apiGet, apiPost } from '@/lib/api-client'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from 'sonner'
import { ArrowLeft, Loader2 } from 'lucide-react'

interface County { id: string; name: string }
interface Locality { id: string; name: string }

type LessorType = 'NATURAL' | 'LEGAL' | 'PFA'
type Gender = 'MALE' | 'FEMALE'

export default function NewLessorPage() {
  const router = useRouter()

  const [type, setType] = useState<LessorType>('NATURAL')
  const [form, setForm] = useState({
    firstName: '', lastName: '', companyName: '',
    cnpCui: '', iban: '', bankName: '',
    gender: '' as Gender | '',
    countyId: '', localityId: '',
    address: '', phone: '', mobile: '', email: '',
    notes: '',
  })

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  // Nomenclature data
  const { data: counties } = useQuery({
    queryKey: ['counties'],
    queryFn: () => apiGet<County[]>('/nomenclature/counties'),
    staleTime: Infinity,
  })

  const { data: localities } = useQuery({
    queryKey: ['localities', form.countyId],
    queryFn: () => apiGet<Locality[]>(`/nomenclature/localities?countyId=${form.countyId}`),
    enabled: !!form.countyId,
  })

  const mutation = useMutation({
    mutationFn: (payload: unknown) => apiPost<{ id: string }>('/lessors', payload),
    onSuccess: res => {
      toast.success('Arendatorul a fost creat cu succes.')
      router.push(`/arendatori/${res.data.id}/sumar`)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? 'Eroare la salvare.'
      toast.error(msg)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    mutation.mutate({ type, ...form })
  }

  const inputCls = 'w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500'
  const labelCls = 'block text-xs font-medium text-gray-700 mb-1'

  return (
    <div className="max-w-4xl">
      <div className="mb-4">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Înapoi
        </button>
        <PageHeader title="Arendator nou" subtitle="Completați datele arendatorului" />
      </div>

      <form onSubmit={handleSubmit}>
        {/* Tip persoană */}
        <div className="form-section">
          <div className="form-section-title">Tip persoană</div>
          <div className="flex gap-3">
            {(['NATURAL', 'LEGAL', 'PFA'] as LessorType[]).map(t => (
              <label key={t} className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="type"
                  value={t}
                  checked={type === t}
                  onChange={() => setType(t)}
                  className="accent-brand-500"
                />
                {t === 'NATURAL' ? 'Persoană fizică' : t === 'LEGAL' ? 'Persoană juridică' : 'PFA'}
              </label>
            ))}
          </div>
        </div>

        {/* Date identitate */}
        <div className="form-section">
          <div className="form-section-title">Date identitate</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {type === 'NATURAL' || type === 'PFA' ? (
              <>
                <div>
                  <label className={labelCls}>Nume *</label>
                  <input className={inputCls} value={form.lastName} onChange={e => set('lastName', e.target.value)} required />
                </div>
                <div>
                  <label className={labelCls}>Prenume *</label>
                  <input className={inputCls} value={form.firstName} onChange={e => set('firstName', e.target.value)} required />
                </div>
              </>
            ) : (
              <div className="col-span-2">
                <label className={labelCls}>Denumire firmă *</label>
                <input className={inputCls} value={form.companyName} onChange={e => set('companyName', e.target.value)} required />
              </div>
            )}

            <div>
              <label className={labelCls}>{type === 'LEGAL' ? 'CUI' : 'CNP'} *</label>
              <input className={inputCls} value={form.cnpCui} onChange={e => set('cnpCui', e.target.value)} required />
            </div>

            {type === 'NATURAL' && (
              <div>
                <label className={labelCls}>Gen</label>
                <select className={inputCls} value={form.gender} onChange={e => set('gender', e.target.value as Gender)}>
                  <option value="">—</option>
                  <option value="MALE">Masculin</option>
                  <option value="FEMALE">Feminin</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Adresă */}
        <div className="form-section">
          <div className="form-section-title">Adresă</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Județ *</label>
              <select className={inputCls} value={form.countyId} onChange={e => set('countyId', e.target.value)} required>
                <option value="">Selectați județ</option>
                {counties?.data?.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Localitate *</label>
              <select className={inputCls} value={form.localityId} onChange={e => set('localityId', e.target.value)} required disabled={!form.countyId}>
                <option value="">Selectați localitate</option>
                {localities?.data?.map(l => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Adresă stradă</label>
              <input className={inputCls} value={form.address} onChange={e => set('address', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="form-section">
          <div className="form-section-title">Date contact</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Telefon fix</label>
              <input className={inputCls} type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Mobil</label>
              <input className={inputCls} type="tel" value={form.mobile} onChange={e => set('mobile', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input className={inputCls} type="email" value={form.email} onChange={e => set('email', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Date bancare */}
        <div className="form-section">
          <div className="form-section-title">Date bancare</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>IBAN</label>
              <input className={inputCls} value={form.iban} onChange={e => set('iban', e.target.value.replace(/\s/g, '').toUpperCase())} placeholder="RO49AAAA1B31007593840000" />
            </div>
            <div>
              <label className={labelCls}>Bancă</label>
              <input className={inputCls} value={form.bankName} onChange={e => set('bankName', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Observații */}
        <div className="form-section">
          <div className="form-section-title">Observații</div>
          <textarea
            className={`${inputCls} min-h-20`}
            value={form.notes}
            onChange={e => set('notes', e.target.value)}
            rows={3}
          />
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex items-center gap-2 px-5 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded transition-colors disabled:opacity-60"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Salvează arendator
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-sm border border-gray-300 rounded text-gray-700 hover:bg-gray-50"
          >
            Anulează
          </button>
        </div>
      </form>
    </div>
  )
}
