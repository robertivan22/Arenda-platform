'use client'

export const runtime = 'edge'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from 'sonner'
import { ArrowLeft } from 'lucide-react'
import SirutaLookup from '@/components/SirutaLookup'

interface LessorOption { id: string; display_name: string }
interface ContractOption { id: string; lessor_id: string; contract_number: string }

const LAND_CATEGORIES = ['Arabil','Pasune','Fanete','Vie','Livada','Padure','Curti-constructii','Ape','Drumuri','Neproductiv']

export default function EditParcelPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lessorsList, setLessorsList] = useState<LessorOption[]>([])
  const [contractsList, setContractsList] = useState<ContractOption[]>([])
  const [form, setForm] = useState({
    blocFizic: '', tarlaNr: '', parcelNr: '',
    nrCadastral: '',
    county: '', locality: '', landUseCategory: 'Arabil',
    culture: '', apiaEligibil: 'true',
    surface: '', surfaceRented: '',
    lat: '', lng: '',
    lessorId: '', contractId: '', status: 'ACTIVE',
    sirutaCode: '', sirutaName: '',
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
    db.from('contracts').select('id, lessor_id, contract_number').order('contract_number')
      .then(({ data }) => { if (data) setContractsList(data as ContractOption[]) })
    db.from('parcels').select('*').eq('id', id).single()
      .then(({ data, error }) => {
        if (error || !data) { toast.error('Parcela nu a fost gasita.'); router.push('/parcele'); return }
        setForm({
          blocFizic: data.bloc_fizic ?? '',
          tarlaNr: data.tarla_nr ?? '',
          parcelNr: data.parcel_nr ?? '',
          nrCadastral: data.nr_cadastral ?? '',
          county: data.county ?? '',
          locality: data.locality ?? '',
          landUseCategory: data.land_use_category ?? 'Arabil',
          culture: data.culture ?? '',
          apiaEligibil: data.apia_eligible === false ? 'false' : 'true',
          surface: String(data.surface ?? ''),
          surfaceRented: String(data.surface_rented ?? ''),
          lat: String(data.lat ?? ''),
          lng: String(data.lng ?? ''),
          lessorId: data.lessor_id ?? '',
          contractId: data.contract_id ?? '',
          status: data.status ?? 'ACTIVE',
          sirutaCode: data.siruta_code ?? '',
          sirutaName: '',
        })
        setLoading(false)
      })
  }, [id, router])

  function set(field: string, value: string) { setForm(prev => ({ ...prev, [field]: value })) }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await createClient()
      .from('parcels')
      .update({
        bloc_fizic: form.blocFizic || null,
        tarla_nr: form.tarlaNr || null,
        parcel_nr: form.parcelNr || null,
        nr_cadastral: form.nrCadastral || null,
        county: form.county,
        locality: form.locality,
        land_use_category: form.landUseCategory,
        culture: form.culture || null,
        apia_eligible: form.apiaEligibil !== '' ? form.apiaEligibil === 'true' : null,
        surface: parseFloat(form.surface) || 0,
        surface_rented: form.surfaceRented ? parseFloat(form.surfaceRented) : null,
        lat: form.lat ? parseFloat(form.lat) : null,
        lng: form.lng ? parseFloat(form.lng) : null,
        lessor_id: form.lessorId || null,
        contract_id: form.contractId || null,
        siruta_code: form.sirutaCode || null,
        status: form.status,
      })
      .eq('id', id)
    setSaving(false)
    if (error) { toast.error('Eroare: ' + error.message); return }
    toast.success('Parcela a fost actualizata.')
    router.push('/parcele')
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
        <PageHeader title="Editeaza parcela" subtitle="Modifica datele parcelei" />
      </div>
      <form onSubmit={handleSubmit}>
        <div className="form-section">
          <div className="form-section-title">Identificare cadastrala</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><label className={labelCls}>Bloc Fizic (APIA/LPIS)</label><input className={inputCls} placeholder="ex: AB001-0001" value={form.blocFizic} onChange={e => set('blocFizic', e.target.value)} /></div>
            <div><label className={labelCls}>Tarla nr.</label><input className={inputCls} value={form.tarlaNr} onChange={e => set('tarlaNr', e.target.value)} /></div>
            <div><label className={labelCls}>Parcela nr.</label><input className={inputCls} value={form.parcelNr} onChange={e => set('parcelNr', e.target.value)} /></div>
            <div><label className={labelCls}>Nr. Cadastral</label><input className={inputCls} placeholder="ex: CAD-001234" value={form.nrCadastral} onChange={e => set('nrCadastral', e.target.value)} /></div>
          </div>
        </div>
        <div className="form-section">
          <div className="form-section-title">Localizare</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div><label className={labelCls}>Judet *</label><input className={inputCls} value={form.county} onChange={e => set('county', e.target.value)} required /></div>
            <div><label className={labelCls}>Localitate *</label><input className={inputCls} value={form.locality} onChange={e => set('locality', e.target.value)} required /></div>
            <div className="md:col-span-3">
              <label className={labelCls}>Cod SIRUTA</label>
              <SirutaLookup
                county={form.county}
                locality={form.locality}
                value={form.sirutaCode}
                onChange={(code, name) => setForm(prev => ({ ...prev, sirutaCode: code, sirutaName: name }))}
                inputClassName={inputCls}
              />
            </div>
            <div><label className={labelCls}>Latitudine (GPS)</label><input className={inputCls} type="number" step="0.0000001" placeholder="ex: 45.9432" value={form.lat} onChange={e => set('lat', e.target.value)} /></div>
            <div><label className={labelCls}>Longitudine (GPS)</label><input className={inputCls} type="number" step="0.0000001" placeholder="ex: 24.9668" value={form.lng} onChange={e => set('lng', e.target.value)} /></div>
            <div>
              <label className={labelCls}>Categorie folosinta</label>
              <select className={inputCls} value={form.landUseCategory} onChange={e => set('landUseCategory', e.target.value)}>
                {LAND_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="form-section">
          <div className="form-section-title">Suprafata</div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Suprafata totala (ha) *</label><input className={inputCls} type="number" min="0" step="0.0001" value={form.surface} onChange={e => set('surface', e.target.value)} required /></div>
            <div><label className={labelCls}>Suprafata arendata (ha)</label><input className={inputCls} type="number" min="0" step="0.0001" value={form.surfaceRented} onChange={e => set('surfaceRented', e.target.value)} /></div>
            <div><label className={labelCls}>Cultura agricola</label><input className={inputCls} placeholder="ex: Grau, Porumb" value={form.culture} onChange={e => set('culture', e.target.value)} /></div>
            <div>
              <label className={labelCls}>APIA Eligibil</label>
              <select className={inputCls} value={form.apiaEligibil} onChange={e => set('apiaEligibil', e.target.value)}>
                <option value="true">Da</option>
                <option value="false">Nu</option>
              </select>
            </div>
          </div>
        </div>
        <div className="form-section">
          <div className="form-section-title">Asociere si status</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Arendator</label>
              <select className={inputCls} value={form.lessorId} onChange={e => set('lessorId', e.target.value)}>
                <option value="">Selectati</option>
                {lessorsList.map(l => <option key={l.id} value={l.id}>{l.display_name}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Contract</label>
              <select className={inputCls} value={form.contractId} onChange={e => set('contractId', e.target.value)}>
                <option value="">Selectati</option>
                {contractsList
                  .filter(c => !form.lessorId || c.lessor_id === form.lessorId)
                  .map(c => <option key={c.id} value={c.id}>{c.contract_number}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={inputCls} value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="ACTIVE">Activa</option>
                <option value="INACTIVE">Inactiva</option>
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
