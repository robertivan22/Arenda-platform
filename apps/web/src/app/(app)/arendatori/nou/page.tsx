'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from 'sonner'
import {
  ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp,
  Search, CheckCircle2, X, Loader2,
} from 'lucide-react'
import { PREDEFINED_PRODUCTS, PRODUCT_CATEGORIES, productCategory } from '@/lib/predefined-products'

// ─── Types ────────────────────────────────────────────────────────────────────

type LessorType = 'NATURAL' | 'LEGAL' | 'PFA'
type Gender = 'MALE' | 'FEMALE' | ''

interface RentLevel { tid: string; product_name: string; level_per_ha: string; level_type: 'BRUT' | 'NET'; tax_rate: string }

interface ParcelRow {
  id: string; bloc_fizic: string | null; tarla_nr: string | null
  parcel_nr: string | null; county: string | null; locality: string | null
  surface: number; culture: string | null
}

const INP = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
const LBL = 'block text-xs font-medium text-gray-700 mb-1'
function tid() { return `${Date.now()}-${Math.random().toString(36).slice(2)}` }

function SectionHeader({ label, open, onToggle, sub, num }: { label: string; open: boolean; onToggle: () => void; sub?: string; num: number }) {
  return (
    <button type="button" onClick={onToggle}
      className="w-full flex items-center gap-3 px-5 py-3 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 text-sm font-semibold text-gray-700 transition-colors text-left">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center">{num}</span>
      <span className="flex-1">{label}{sub ? <span className="ml-2 text-xs font-normal text-gray-400">{sub}</span> : null}</span>
      {open ? <ChevronUp className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />}
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewLessorPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  // Section states
  const [openLessor, setOpenLessor] = useState(true)
  const [openContract, setOpenContract] = useState(false)
  const [openParcels, setOpenParcels] = useState(false)
  const [addContract, setAddContract] = useState(false)

  // Lessor form
  const [type, setType] = useState<LessorType>('NATURAL')
  const [lessor, setLessor] = useState({
    firstName: '', lastName: '', companyName: '',
    cnpCui: '', gender: '' as Gender,
    county: '', locality: '', address: '',
    phone: '', mobile: '', email: '',
    iban: '', bankName: '', notes: '',
  })

  // Contract form
  const [contract, setContract] = useState({
    contract_number: '', contract_type: 'ARENDA', zone: '',
    sign_date: '', start_date: '', end_date: '',
    primarie_nr: '', primarie_date: '',
    tax_method: 'COTA_FORFETARA', localities: '', status: 'ACTIVE',
  })
  const [rentLevels, setRentLevels] = useState<RentLevel[]>([])

  // Parcels
  const [parcels, setParcels] = useState<ParcelRow[]>([])
  const [selectedParcelIds, setSelectedParcelIds] = useState<string[]>([])
  const [parcelSearch, setParcelSearch] = useState('')
  const [showAddParcel, setShowAddParcel] = useState(false)
  const [addingParcel, setAddingParcel] = useState(false)
  const [newParcel, setNewParcel] = useState({ bloc_fizic: '', tarla_nr: '', parcel_nr: '', county: '', locality: '', surface: '', culture: '', land_use_category: 'Arabil' })

  const loadParcels = useCallback(async () => {
    const db = createClient()
    const { data } = await db.from('parcels')
      .select('id,bloc_fizic,tarla_nr,parcel_nr,county,locality,surface,culture')
      .order('bloc_fizic').limit(2000)
    setParcels(data ?? [])
  }, [])

  useEffect(() => { if (openParcels) void loadParcels() }, [openParcels, loadParcels])

  const fp = parcelSearch
    ? parcels.filter(p => {
      const q = parcelSearch.toLowerCase()
      return p.bloc_fizic?.toLowerCase().includes(q) || p.tarla_nr?.toLowerCase().includes(q) ||
        p.parcel_nr?.toLowerCase().includes(q) || p.locality?.toLowerCase().includes(q) || p.culture?.toLowerCase().includes(q)
    })
    : parcels

  const selParcels = parcels.filter(p => selectedParcelIds.includes(p.id))
  const totalHa = selParcels.reduce((s, p) => s + (p.surface ?? 0), 0)

  async function handleAddNewParcel() {
    if (!newParcel.surface || parseFloat(newParcel.surface) <= 0) { toast.error('Completează suprafața parcelei'); return }
    setAddingParcel(true)
    try {
      const db = createClient()
      const { data: { user } } = await db.auth.getUser()
      if (!user) throw new Error('Neautentificat')
      const { data, error } = await db.from('parcels').insert({
        user_id: user.id,
        bloc_fizic: newParcel.bloc_fizic || null,
        tarla_nr: newParcel.tarla_nr || null,
        parcel_nr: newParcel.parcel_nr || null,
        county: newParcel.county || null,
        locality: newParcel.locality || null,
        surface: parseFloat(newParcel.surface) || 0,
        culture: newParcel.culture || null,
        land_use_category: newParcel.land_use_category || 'Arabil',
        status: 'ACTIVE',
      }).select('id,bloc_fizic,tarla_nr,parcel_nr,county,locality,surface,culture').single()
      if (error || !data) throw new Error(error?.message ?? 'Eroare la adăugare')
      const row = data as ParcelRow
      setParcels(prev => [row, ...prev])
      setSelectedParcelIds(prev => [...prev, row.id])
      setNewParcel({ bloc_fizic: '', tarla_nr: '', parcel_nr: '', county: '', locality: '', surface: '', culture: '', land_use_category: 'Arabil' })
      setShowAddParcel(false)
      toast.success('Parcela a fost adăugată și selectată.')
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Eroare') }
    finally { setAddingParcel(false) }
  }

  function toggleParcel(pid: string) { setSelectedParcelIds(prev => prev.includes(pid) ? prev.filter(x => x !== pid) : [...prev, pid]) }
  function setL(f: string, v: string) { setLessor(d => ({ ...d, [f]: v })) }
  function setC(f: string, v: string) { setContract(d => ({ ...d, [f]: v })) }
  function addRL() { setRentLevels(prev => [...prev, { tid: tid(), product_name: '', level_per_ha: '', level_type: 'NET', tax_rate: '10' }]) }
  function updRL(id: string, f: keyof RentLevel, v: string) { setRentLevels(prev => prev.map(l => l.tid === id ? { ...l, [f]: v } : l)) }

  const lessorLabel = type === 'LEGAL' || type === 'PFA'
    ? lessor.companyName
    : `${lessor.lastName} ${lessor.firstName}`.trim()

  const contractLabel = contract.contract_number ? `Nr. ${contract.contract_number}` : (addContract ? 'fără număr' : undefined)

  async function handleSave() {
    if (!lessor.lastName.trim() && type !== 'LEGAL') { toast.error('Completează numele arendatorului'); return }
    if (type === 'LEGAL' && !lessor.companyName.trim()) { toast.error('Completează denumirea societății'); return }

    setSaving(true)
    try {
      const db = createClient()
      const { data: { user } } = await db.auth.getUser()
      if (!user) throw new Error('Neautentificat')

      // Create lessor
      const { count } = await db.from('lessors').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      const code = `AR${String(((count ?? 0) as number) + 1).padStart(4, '0')}`
      const { data: lessorData, error: le } = await db.from('lessors').insert({
        user_id: user.id, code, type,
        first_name: lessor.firstName.trim(), last_name: lessor.lastName.trim(),
        company_name: lessor.companyName.trim() || null, cnp: lessor.cnpCui.trim(),
        gender: lessor.gender || null, county: lessor.county.trim(), locality: lessor.locality.trim(),
        address: lessor.address.trim() || null, phone: lessor.phone.trim() || null,
        mobile: lessor.mobile.trim() || null, email: lessor.email.trim() || null,
        iban: lessor.iban.trim() || null, bank_name: lessor.bankName.trim() || null,
        notes: lessor.notes.trim() || null, status: 'ACTIVE',
      }).select('id').single()
      if (le || !lessorData) throw new Error(le?.message ?? 'Eroare creare arendator')

      let contractId: string | null = null

      // Optionally create contract
      if (addContract && contract.start_date && contract.end_date) {
        const surfTotal = selParcels.reduce((s, p) => s + (p.surface ?? 0), 0)
        const { data: cr, error: ce } = await db.from('contracts').insert({
          user_id: user.id, lessor_id: lessorData.id,
          contract_number: contract.contract_number, contract_type: contract.contract_type,
          zone: contract.zone || null, sign_date: contract.sign_date || null,
          start_date: contract.start_date, end_date: contract.end_date,
          primarie_nr: contract.primarie_nr || null, primarie_date: contract.primarie_date || null,
          tax_method: contract.tax_method, localities: contract.localities || null,
          status: contract.status, annual_rent: surfTotal, total_parcels: selectedParcelIds.length,
        }).select('id').single()

        if (ce || !cr) {
          toast.error(`Arendatorul a fost creat. Contractul a eșuat: ${ce?.message ?? 'eroare'}`)
          router.push(`/arendatori/${lessorData.id}/sumar`)
          return
        }
        contractId = cr.id

        // Rent levels
        const validLvl = rentLevels.filter(l => l.level_per_ha && parseFloat(l.level_per_ha) > 0 && l.product_name)
        if (validLvl.length > 0) {
          await db.from('contract_rent_levels').insert(
            validLvl.map((l, i) => ({
              user_id: user.id, contract_id: cr.id, product_id: null,
              product_name: l.product_name, level_per_ha: parseFloat(l.level_per_ha),
              level_type: l.level_type, tax_rate: parseFloat(l.tax_rate) || 10, sort_order: i,
            }))
          )
        }
      }

      // Assign parcels
      if (selectedParcelIds.length > 0 && (contractId || lessorData.id)) {
        await db.from('parcels').update({
          contract_id: contractId,
          lessor_id: lessorData.id,
        }).in('id', selectedParcelIds)
      }

      toast.success('Arendatorul a fost creat.')
      router.push(`/arendatori/${lessorData.id}/sumar`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Eroare la salvare')
    } finally { setSaving(false) }
  }

  return (
    <div className="max-w-3xl pb-20">
      <div className="mb-5">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Inapoi
        </button>
        <PageHeader title="Arendator nou" subtitle="Completați datele, adăugați opțional un contract și parcele asociate" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">

        {/* ── 1. Arendator ── */}
        <SectionHeader num={1} label="Date arendator" open={openLessor} onToggle={() => setOpenLessor(o => !o)}
          sub={lessorLabel || undefined} />
        {openLessor && (
          <div className="p-5 space-y-4">
            <div>
              <label className={LBL}>Tip persoană</label>
              <div className="flex gap-3 mt-1">
                {(['NATURAL', 'LEGAL', 'PFA'] as LessorType[]).map(t => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="radio" name="lessor-type" value={t} checked={type === t} onChange={() => setType(t)} className="accent-brand-500" />
                    {t === 'NATURAL' ? 'Persoană fizică' : t === 'LEGAL' ? 'Persoană juridică' : 'PFA / II / IF'}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {(type === 'LEGAL' || type === 'PFA') && (
                <div className="col-span-2"><label className={LBL}>Denumire societate <span className="text-red-500">*</span></label><input className={INP} value={lessor.companyName} onChange={e => setL('companyName', e.target.value)} /></div>
              )}
              <div><label className={LBL}>Nume {type !== 'LEGAL' && <span className="text-red-500">*</span>}</label><input className={INP} value={lessor.lastName} onChange={e => setL('lastName', e.target.value)} /></div>
              <div><label className={LBL}>Prenume</label><input className={INP} value={lessor.firstName} onChange={e => setL('firstName', e.target.value)} /></div>
              {type === 'NATURAL' && (
                <div>
                  <label className={LBL}>Gen</label>
                  <select className={INP} value={lessor.gender} onChange={e => setL('gender', e.target.value)}>
                    <option value="">—</option>
                    <option value="MALE">Masculin</option>
                    <option value="FEMALE">Feminin</option>
                  </select>
                </div>
              )}
              <div><label className={LBL}>CNP / CUI</label><input className={INP} value={lessor.cnpCui} onChange={e => setL('cnpCui', e.target.value)} /></div>
              <div><label className={LBL}>Județ</label><input className={INP} value={lessor.county} onChange={e => setL('county', e.target.value)} /></div>
              <div><label className={LBL}>Localitate</label><input className={INP} value={lessor.locality} onChange={e => setL('locality', e.target.value)} /></div>
              <div className="col-span-2"><label className={LBL}>Adresă</label><input className={INP} value={lessor.address} onChange={e => setL('address', e.target.value)} /></div>
              <div><label className={LBL}>Telefon fix</label><input className={INP} value={lessor.phone} onChange={e => setL('phone', e.target.value)} /></div>
              <div><label className={LBL}>Mobil</label><input className={INP} value={lessor.mobile} onChange={e => setL('mobile', e.target.value)} /></div>
              <div><label className={LBL}>Email</label><input type="email" className={INP} value={lessor.email} onChange={e => setL('email', e.target.value)} /></div>
              <div><label className={LBL}>IBAN</label><input className={INP} value={lessor.iban} onChange={e => setL('iban', e.target.value)} placeholder="RO49AAAA..." /></div>
              <div><label className={LBL}>Bancă</label><input className={INP} value={lessor.bankName} onChange={e => setL('bankName', e.target.value)} /></div>
              <div className="col-span-2"><label className={LBL}>Note</label><textarea className={INP + ' resize-none'} rows={2} value={lessor.notes} onChange={e => setL('notes', e.target.value)} /></div>
            </div>
          </div>
        )}

        {/* ── 2. Contract (opțional) ── */}
        <SectionHeader num={2} label="Contract (opțional)" open={openContract} onToggle={() => setOpenContract(o => !o)}
          sub={contractLabel} />
        {openContract && (
          <div className="p-5">
            {!addContract ? (
              <div className="text-center py-4">
                <p className="text-sm text-gray-500 mb-3">Poți adăuga un contract acum sau mai târziu din profilul arendatorului.</p>
                <button type="button" onClick={() => setAddContract(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700 transition-colors mx-auto">
                  <Plus className="w-4 h-4" /> Adaugă contract
                </button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div><label className={LBL}>Nr. contract</label><input className={INP} value={contract.contract_number} onChange={e => setC('contract_number', e.target.value)} placeholder="001/2026" /></div>
                  <div><label className={LBL}>Nr. primărie</label><input className={INP} value={contract.primarie_nr} onChange={e => setC('primarie_nr', e.target.value)} /></div>
                  <div><label className={LBL}>Dată primărie</label><input type="date" className={INP} value={contract.primarie_date} onChange={e => setC('primarie_date', e.target.value)} /></div>
                  <div>
                    <label className={LBL}>Tip contract</label>
                    <select className={INP} value={contract.contract_type} onChange={e => setC('contract_type', e.target.value)}>
                      {[['ARENDA','Arendă'],['CONCESIUNE','Concesiune'],['COMODAT','Comodat'],['ASOCIERE','Asociere']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={LBL}>Status</label>
                    <select className={INP} value={contract.status} onChange={e => setC('status', e.target.value)}>
                      {[['ACTIVE','Activ'],['DRAFT','Schiță'],['EXPIRED','Expirat']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={LBL}>Metodă impozit</label>
                    <select className={INP} value={contract.tax_method} onChange={e => setC('tax_method', e.target.value)}>
                      {[['COTA_FORFETARA','Cotă forfetară'],['SISTEM_REAL','Sistem real'],['SCUTIT','Scutit']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div><label className={LBL}>Zonă</label><input className={INP} value={contract.zone} onChange={e => setC('zone', e.target.value)} /></div>
                  <div><label className={LBL}>Localități</label><input className={INP} value={contract.localities} onChange={e => setC('localities', e.target.value)} /></div>
                  <div><label className={LBL}>Dată semnare</label><input type="date" className={INP} value={contract.sign_date} onChange={e => setC('sign_date', e.target.value)} /></div>
                  <div><label className={LBL}>Dată început <span className="text-red-500">*</span></label><input type="date" className={INP} value={contract.start_date} onChange={e => setC('start_date', e.target.value)} /></div>
                  <div><label className={LBL}>Dată sfârșit <span className="text-red-500">*</span></label><input type="date" className={INP} value={contract.end_date} onChange={e => setC('end_date', e.target.value)} /></div>
                </div>

                {/* Rent levels */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Niveluri arendă</p>
                    <button type="button" onClick={addRL} className="flex items-center gap-1 text-xs px-2.5 py-1 text-brand-600 border border-brand-300 rounded-lg hover:bg-brand-50">
                      <Plus className="w-3 h-3" /> Adaugă
                    </button>
                  </div>
                  {rentLevels.length === 0 && <p className="text-xs text-gray-400 italic">Niciun nivel definit.</p>}
                  {rentLevels.map(l => (
                    <div key={l.tid} className="flex items-end gap-2 mb-3 bg-gray-50 border border-gray-200 rounded-xl p-3">
                      <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div className="col-span-2 sm:col-span-1">
                          <label className={LBL}>Cultură / produs</label>
                          <select value={l.product_name} onChange={e => updRL(l.tid, 'product_name', e.target.value)} className={INP}>
                            <option value="">— Selectează —</option>
                            {PRODUCT_CATEGORIES.map(cat => {
                              const items = PREDEFINED_PRODUCTS.filter(p => p.cat === cat)
                              if (items.length === 0) return null
                              return (
                                <optgroup key={cat} label={cat}>
                                  {items.map(p => <option key={p.name} value={p.name}>{p.name}</option>)}
                                </optgroup>
                              )
                            })}
                          </select>
                        </div>
                        <div><label className={LBL}>Cant./ha</label><input type="number" className={INP} value={l.level_per_ha} onChange={e => updRL(l.tid, 'level_per_ha', e.target.value)} placeholder="0.00" /></div>
                        <div>
                          <label className={LBL}>Tip</label>
                          <select value={l.level_type} onChange={e => updRL(l.tid, 'level_type', e.target.value)} className={INP}>
                            <option value="NET">NET</option><option value="BRUT">BRUT</option>
                          </select>
                        </div>
                        <div><label className={LBL}>Impozit %</label><input type="number" className={INP} value={l.tax_rate} onChange={e => updRL(l.tid, 'tax_rate', e.target.value)} placeholder="10" /></div>
                      </div>
                      <button type="button" onClick={() => setRentLevels(prev => prev.filter(x => x.tid !== l.tid))} className="p-2 text-red-400 hover:text-red-600 mb-0.5"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>

                <button type="button" onClick={() => setAddContract(false)} className="text-xs text-red-400 hover:text-red-600">
                  Renunță la contract
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── 3. Parcele ── */}
        <SectionHeader num={3} label="Parcele asociate (opțional)" open={openParcels} onToggle={() => setOpenParcels(o => !o)}
          sub={selectedParcelIds.length > 0 ? `${selectedParcelIds.length} sel. · ${totalHa.toFixed(2)} ha` : undefined} />
        {openParcels && (
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={parcelSearch} onChange={e => setParcelSearch(e.target.value)}
                  placeholder="Caută bloc, tarla, parcelă, cultură, localitate..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              <button type="button" onClick={() => setShowAddParcel(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors flex-shrink-0 ${showAddParcel ? 'bg-brand-50 border-brand-300 text-brand-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                <Plus className="w-3.5 h-3.5" /> Parcelă nouă
              </button>
            </div>

            {/* ── Inline add-parcel form ── */}
            {showAddParcel && (
              <div className="border border-brand-200 bg-brand-50/40 rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide">Parcelă nouă</p>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className={LBL}>Bloc fizic</label><input className={INP} value={newParcel.bloc_fizic} onChange={e => setNewParcel(p => ({ ...p, bloc_fizic: e.target.value }))} placeholder="ex: 502" /></div>
                  <div><label className={LBL}>Tarla</label><input className={INP} value={newParcel.tarla_nr} onChange={e => setNewParcel(p => ({ ...p, tarla_nr: e.target.value }))} /></div>
                  <div><label className={LBL}>Nr. parcelă</label><input className={INP} value={newParcel.parcel_nr} onChange={e => setNewParcel(p => ({ ...p, parcel_nr: e.target.value }))} /></div>
                  <div><label className={LBL}>Județ</label><input className={INP} value={newParcel.county} onChange={e => setNewParcel(p => ({ ...p, county: e.target.value }))} /></div>
                  <div><label className={LBL}>Localitate</label><input className={INP} value={newParcel.locality} onChange={e => setNewParcel(p => ({ ...p, locality: e.target.value }))} /></div>
                  <div><label className={LBL}>Suprafață (ha) <span className="text-red-500">*</span></label><input type="number" step="0.01" className={INP} value={newParcel.surface} onChange={e => setNewParcel(p => ({ ...p, surface: e.target.value }))} placeholder="0.00" /></div>
                  <div><label className={LBL}>Cultură</label><input className={INP} value={newParcel.culture} onChange={e => setNewParcel(p => ({ ...p, culture: e.target.value }))} placeholder="ex: PORUMB" /></div>
                  <div><label className={LBL}>Categorie folosință</label>
                    <select className={INP} value={newParcel.land_use_category} onChange={e => setNewParcel(p => ({ ...p, land_use_category: e.target.value }))}>
                      {['Arabil','Pasune','Fanete','Vie','Livada','Padure','Curti-constructii','Ape','Drumuri','Neproductiv'].map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => void handleAddNewParcel()} disabled={addingParcel}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-600 text-white text-sm font-medium rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors">
                    {addingParcel ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                    Adaugă și selectează
                  </button>
                  <button type="button" onClick={() => setShowAddParcel(false)} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-lg">Anulează</button>
                </div>
              </div>
            )}
            {selectedParcelIds.length > 0 && (
              <div className="flex items-center gap-3 text-sm text-brand-700 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2">
                <CheckCircle2 className="w-4 h-4" />
                <span><strong>{selectedParcelIds.length}</strong> parcele · <strong>{totalHa.toFixed(2)} ha</strong></span>
                <button type="button" onClick={() => setSelectedParcelIds([])} className="ml-auto text-xs text-brand-500 hover:text-brand-700 flex items-center gap-0.5">
                  <X className="w-3.5 h-3.5" /> Deselectează
                </button>
              </div>
            )}
            {parcels.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">Nu există parcele disponibile.</p>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0 border-b border-gray-200">
                    <tr>
                      <th className="px-2 py-2 w-8">
                        <input type="checkbox"
                          checked={fp.length > 0 && fp.every(p => selectedParcelIds.includes(p.id))}
                          onChange={e => fp.forEach(p => { const has = selectedParcelIds.includes(p.id); if (e.target.checked !== has) toggleParcel(p.id) })} />
                      </th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-500 uppercase text-[10px]">Bloc / Tarla / Parcelă</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-500 uppercase text-[10px]">ha</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-500 uppercase text-[10px]">Cultură</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-500 uppercase text-[10px] hidden sm:table-cell">Localitate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fp.map(p => {
                      const sel = selectedParcelIds.includes(p.id)
                      return (
                        <tr key={p.id} onClick={() => toggleParcel(p.id)}
                          className={`border-b border-gray-100 cursor-pointer ${sel ? 'bg-brand-50' : 'hover:bg-gray-50'}`}>
                          <td className="px-2 py-1.5 text-center">
                            <input type="checkbox" checked={sel} onChange={() => toggleParcel(p.id)} onClick={e => e.stopPropagation()} />
                          </td>
                          <td className="px-2 py-1.5">
                            <span className="font-medium text-gray-800">{p.bloc_fizic ?? '—'}</span>
                            {p.tarla_nr && <span className="text-gray-500 ml-1">/T{p.tarla_nr}</span>}
                            {p.parcel_nr && <span className="text-gray-500 ml-1">/P{p.parcel_nr}</span>}
                          </td>
                          <td className="px-2 py-1.5 text-right text-gray-700">{(p.surface ?? 0).toFixed(2)}</td>
                          <td className="px-2 py-1.5 text-gray-600">{p.culture ?? '—'}</td>
                          <td className="px-2 py-1.5 text-gray-400 hidden sm:table-cell">{[p.county, p.locality].filter(Boolean).join('/') || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Save */}
      <div className="mt-5 flex gap-3">
        <button type="button" onClick={() => void handleSave()} disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Salvează arendator
        </button>
        <button type="button" onClick={() => router.back()} className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50">Anulează</button>
      </div>
    </div>
  )
}
