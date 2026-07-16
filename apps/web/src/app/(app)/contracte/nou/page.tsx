'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from 'sonner'
import {
  ArrowLeft, Plus, Trash2, ChevronDown, ChevronUp,
  Search, Check, CheckCircle2, X, Loader2,
} from 'lucide-react'
import { PREDEFINED_PRODUCTS, PRODUCT_CATEGORIES, productCategory } from '@/lib/predefined-products'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LessorOption { id: string; label: string }
type LessorType = 'NATURAL' | 'LEGAL' | 'PFA'
interface NewLessorData {
  type: LessorType; first_name: string; last_name: string; company_name: string
  cnp: string; county: string; locality: string; phone: string; email: string
}
interface RentLevel { tid: string; product_name: string; level_per_ha: string; level_type: 'BRUT' | 'NET'; tax_rate: string }
interface ParcelRow {
  id: string; bloc_fizic: string | null; tarla_nr: string | null
  parcel_nr: string | null; county: string | null; locality: string | null
  surface: number; culture: string | null
}

const INP = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
const LBL = 'block text-xs font-medium text-gray-700 mb-1'
function tid() { return `${Date.now()}-${Math.random().toString(36).slice(2)}` }

function SectionHeader({ label, open, onToggle, sub }: { label: string; open: boolean; onToggle: () => void; sub?: string }) {
  return (
    <button type="button" onClick={onToggle}
      className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 text-sm font-semibold text-gray-700 transition-colors">
      <span>{label}{sub ? <span className="ml-2 text-xs font-normal text-gray-400">{sub}</span> : null}</span>
      {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
    </button>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewContractPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  // Section open states
  const [openDetails, setOpenDetails] = useState(true)
  const [openLessor, setOpenLessor] = useState(false)
  const [openParcels, setOpenParcels] = useState(false)

  // Contract fields
  const [form, setForm] = useState({
    contract_number: '', contract_type: 'ARENDA', zone: '',
    sign_date: '', start_date: '', end_date: '',
    primarie_nr: '', primarie_date: '',
    tax_method: 'COTA_FORFETARA', localities: '', status: 'ACTIVE',
  })
  const [rentLevels, setRentLevels] = useState<RentLevel[]>([])

  // Lessor
  const [lessors, setLessors] = useState<LessorOption[]>([])
  const [lessorMode, setLessorMode] = useState<'existing' | 'new'>('existing')
  const [selectedLessorId, setSelectedLessorId] = useState('')
  const [newLessor, setNewLessor] = useState<NewLessorData>({
    type: 'NATURAL', first_name: '', last_name: '', company_name: '',
    cnp: '', county: '', locality: '', phone: '', email: '',
  })

  // Parcels
  const [parcels, setParcels] = useState<ParcelRow[]>([])
  const [selectedParcelIds, setSelectedParcelIds] = useState<string[]>([])
  const [parcelSearch, setParcelSearch] = useState('')

  useEffect(() => {
    const db = createClient()
    db.from('lessors').select('id, first_name, last_name, company_name, type').eq('status', 'ACTIVE').order('last_name')
      .then(({ data }) => setLessors((data ?? []).map((l: Record<string, string>) => ({
        id: l.id,
        label: l.type === 'LEGAL' || l.type === 'PFA' ? (l.company_name ?? `${l.last_name} ${l.first_name}`.trim()) : `${l.last_name} ${l.first_name}`.trim(),
      }))))
  }, [])

  const loadParcels = useCallback(async () => {
    const db = createClient()
    const { data } = await db.from('parcels')
      .select('id,bloc_fizic,tarla_nr,parcel_nr,county,locality,surface,culture')
      .order('bloc_fizic').limit(2000)
    setParcels(data ?? [])
  }, [])

  // Load parcels when section opens
  useEffect(() => { if (openParcels) void loadParcels() }, [openParcels, loadParcels])

  const filteredParcels = parcelSearch
    ? parcels.filter(p => {
      const q = parcelSearch.toLowerCase()
      return p.bloc_fizic?.toLowerCase().includes(q) || p.tarla_nr?.toLowerCase().includes(q) ||
        p.parcel_nr?.toLowerCase().includes(q) || p.locality?.toLowerCase().includes(q) || p.culture?.toLowerCase().includes(q)
    })
    : parcels

  const selParcels = parcels.filter(p => selectedParcelIds.includes(p.id))
  const totalHa = selParcels.reduce((s, p) => s + (p.surface ?? 0), 0)

  const lessorLabel = lessorMode === 'existing'
    ? (lessors.find(l => l.id === selectedLessorId)?.label ?? '')
    : newLessor.type === 'LEGAL' ? newLessor.company_name : `${newLessor.last_name} ${newLessor.first_name}`.trim()

  async function handleSave() {
    if (!form.start_date || !form.end_date) { toast.error('Completează dată început și sfârșit'); return }
    setSaving(true)
    try {
      const db = createClient()
      const { data: { user } } = await db.auth.getUser()
      if (!user) throw new Error('Neautentificat')

      // Resolve lessor
      let lessorId: string | null = null
      if (lessorMode === 'existing') {
        lessorId = selectedLessorId || null
      } else {
        if (!newLessor.last_name.trim()) throw new Error('Arendatorul nu are nume')
        const { count } = await db.from('lessors').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
        const code = `AR${String(((count ?? 0) as number) + 1).padStart(4, '0')}`
        const { data: lr, error: le } = await db.from('lessors').insert({
          user_id: user.id, code, type: newLessor.type,
          first_name: newLessor.first_name.trim(), last_name: newLessor.last_name.trim(),
          company_name: newLessor.company_name.trim() || null, cnp: newLessor.cnp.trim(),
          county: newLessor.county.trim(), locality: newLessor.locality.trim(),
          phone: newLessor.phone.trim() || null, email: newLessor.email.trim() || null, status: 'ACTIVE',
        }).select('id').single()
        if (le || !lr) throw new Error(le?.message ?? 'Eroare arendator')
        lessorId = lr.id
      }

      // Contract
      const { data: contract, error: ce } = await db.from('contracts').insert({
        user_id: user.id, lessor_id: lessorId,
        contract_number: form.contract_number, contract_type: form.contract_type,
        zone: form.zone || null, sign_date: form.sign_date || null,
        start_date: form.start_date, end_date: form.end_date,
        primarie_nr: form.primarie_nr || null, primarie_date: form.primarie_date || null,
        tax_method: form.tax_method, localities: form.localities || null,
        status: form.status,
        annual_rent: totalHa, total_parcels: selectedParcelIds.length,
      }).select('id').single()
      if (ce || !contract) throw new Error(ce?.message ?? 'Eroare contract')

      // Rent levels
      const validLvl = rentLevels.filter(l => l.level_per_ha && parseFloat(l.level_per_ha) > 0 && l.product_name)
      if (validLvl.length > 0) {
        await db.from('contract_rent_levels').insert(
          validLvl.map((l, i) => ({
            user_id: user.id, contract_id: contract.id, product_id: null,
            product_name: l.product_name, level_per_ha: parseFloat(l.level_per_ha),
            level_type: l.level_type, tax_rate: parseFloat(l.tax_rate) || 10, sort_order: i,
          }))
        )
      }

      // Parcels
      if (selectedParcelIds.length > 0) {
        await db.from('parcels').update({ contract_id: contract.id, lessor_id: lessorId }).in('id', selectedParcelIds)
      }

      toast.success('Contract creat cu succes!')
      router.push(`/contracte/${contract.id}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Eroare la salvare')
    } finally { setSaving(false) }
  }

  function setF(f: string, v: string) { setForm(prev => ({ ...prev, [f]: v })) }
  function addRL() { setRentLevels(prev => [...prev, { tid: tid(), product_name: '', level_per_ha: '', level_type: 'NET', tax_rate: '10' }]) }
  function updRL(id: string, f: keyof RentLevel, v: string) { setRentLevels(prev => prev.map(l => l.tid === id ? { ...l, [f]: v } : l)) }
  function toggleParcel(pid: string) { setSelectedParcelIds(prev => prev.includes(pid) ? prev.filter(x => x !== pid) : [...prev, pid]) }

  return (
    <div className="max-w-3xl pb-20">
      <div className="mb-5">
        <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2">
          <ArrowLeft className="w-3.5 h-3.5" /> Inapoi
        </button>
        <PageHeader title="Contract nou" subtitle="Completați datele contractului" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">

        {/* ── A. Detalii contract ── */}
        <SectionHeader label="A. Detalii contract" open={openDetails} onToggle={() => setOpenDetails(o => !o)}
          sub={form.contract_number ? `Nr. ${form.contract_number}` : undefined} />
        {openDetails && (
          <div className="p-5 space-y-5">
            {/* Identificare */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Identificare</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div><label className={LBL}>Nr. contract <span className="text-red-500">*</span></label><input className={INP} value={form.contract_number} onChange={e => setF('contract_number', e.target.value)} placeholder="001/2026" /></div>
                <div><label className={LBL}>Nr. primărie</label><input className={INP} value={form.primarie_nr} onChange={e => setF('primarie_nr', e.target.value)} /></div>
                <div><label className={LBL}>Dată primărie</label><input type="date" className={INP} value={form.primarie_date} onChange={e => setF('primarie_date', e.target.value)} /></div>
                <div>
                  <label className={LBL}>Tip contract</label>
                  <select className={INP} value={form.contract_type} onChange={e => setF('contract_type', e.target.value)}>
                    {[['ARENDA','Arendă'],['CONCESIUNE','Concesiune'],['COMODAT','Comodat'],['ASOCIERE','Asociere']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className={LBL}>Status</label>
                  <select className={INP} value={form.status} onChange={e => setF('status', e.target.value)}>
                    {[['ACTIVE','Activ'],['DRAFT','Schiță'],['EXPIRED','Expirat']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div><label className={LBL}>Zonă</label><input className={INP} value={form.zone} onChange={e => setF('zone', e.target.value)} /></div>
                <div className="col-span-2 sm:col-span-3"><label className={LBL}>Localități</label><input className={INP} value={form.localities} onChange={e => setF('localities', e.target.value)} placeholder="ex: IS, Municipiul Iași" /></div>
              </div>
            </div>

            {/* Perioadă */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Perioadă</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div><label className={LBL}>Dată semnare</label><input type="date" className={INP} value={form.sign_date} onChange={e => setF('sign_date', e.target.value)} /></div>
                <div><label className={LBL}>Dată început <span className="text-red-500">*</span></label><input type="date" className={INP} value={form.start_date} onChange={e => setF('start_date', e.target.value)} /></div>
                <div><label className={LBL}>Dată sfârșit <span className="text-red-500">*</span></label><input type="date" className={INP} value={form.end_date} onChange={e => setF('end_date', e.target.value)} /></div>
              </div>
            </div>

            {/* Impozit */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Plată / impozit</p>
              <div className="max-w-xs">
                <label className={LBL}>Metodă plată impozit</label>
                <select className={INP} value={form.tax_method} onChange={e => setF('tax_method', e.target.value)}>
                  {[['COTA_FORFETARA','Cotă forfetară'],['SISTEM_REAL','Sistem real'],['SCUTIT','Scutit']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>

            {/* Niveluri arendă */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Niveluri arendă</p>
                <button type="button" onClick={addRL} className="flex items-center gap-1 text-xs px-2.5 py-1 text-brand-600 border border-brand-300 rounded-lg hover:bg-brand-50">
                  <Plus className="w-3 h-3" /> Adaugă nivel
                </button>
              </div>
              {rentLevels.length === 0 && (
                <p className="text-xs text-gray-400 italic">Niciun nivel definit. Apasă „Adaugă nivel" pentru a specifica arenda (ex: 500 kg Grâu/ha).</p>
              )}
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
          </div>
        )}

        {/* ── B. Arendator ── */}
        <SectionHeader label="B. Arendator" open={openLessor} onToggle={() => setOpenLessor(o => !o)}
          sub={lessorLabel || undefined} />
        {openLessor && (
          <div className="p-5 space-y-4">
            <div className="flex gap-2">
              {(['existing', 'new'] as const).map(mode => (
                <button key={mode} type="button" onClick={() => setLessorMode(mode)}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${lessorMode === mode ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                  {mode === 'existing' ? 'Selectează existent' : 'Arendator nou'}
                </button>
              ))}
            </div>
            {lessorMode === 'existing' && (
              lessors.length === 0
                ? <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">Nu există arendatori activi. Selectează „Arendator nou" sau <a href="/arendatori/nou" className="underline font-medium">creează din lista de arendatori</a>.</div>
                : <div>
                  <label className={LBL}>Arendator</label>
                  <select className={INP} value={selectedLessorId} onChange={e => setSelectedLessorId(e.target.value)}>
                    <option value="">— Selectează —</option>
                    {lessors.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                  </select>
                </div>
            )}
            {lessorMode === 'new' && (
              <div className="space-y-3">
                <div>
                  <label className={LBL}>Tip persoană</label>
                  <select className={INP} value={newLessor.type} onChange={e => setNewLessor(d => ({ ...d, type: e.target.value as LessorType }))}>
                    <option value="NATURAL">Persoană fizică</option>
                    <option value="LEGAL">Persoană juridică</option>
                    <option value="PFA">PFA / II / IF</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {(newLessor.type === 'LEGAL' || newLessor.type === 'PFA') && (
                    <div className="col-span-2"><label className={LBL}>Denumire <span className="text-red-500">*</span></label><input className={INP} value={newLessor.company_name} onChange={e => setNewLessor(d => ({ ...d, company_name: e.target.value }))} /></div>
                  )}
                  <div><label className={LBL}>Nume <span className="text-red-500">*</span></label><input className={INP} value={newLessor.last_name} onChange={e => setNewLessor(d => ({ ...d, last_name: e.target.value }))} /></div>
                  <div><label className={LBL}>Prenume</label><input className={INP} value={newLessor.first_name} onChange={e => setNewLessor(d => ({ ...d, first_name: e.target.value }))} /></div>
                  <div><label className={LBL}>CNP / CUI</label><input className={INP} value={newLessor.cnp} onChange={e => setNewLessor(d => ({ ...d, cnp: e.target.value }))} /></div>
                  <div><label className={LBL}>Județ</label><input className={INP} value={newLessor.county} onChange={e => setNewLessor(d => ({ ...d, county: e.target.value }))} /></div>
                  <div><label className={LBL}>Localitate</label><input className={INP} value={newLessor.locality} onChange={e => setNewLessor(d => ({ ...d, locality: e.target.value }))} /></div>
                  <div><label className={LBL}>Telefon</label><input className={INP} value={newLessor.phone} onChange={e => setNewLessor(d => ({ ...d, phone: e.target.value }))} /></div>
                  <div><label className={LBL}>Email</label><input type="email" className={INP} value={newLessor.email} onChange={e => setNewLessor(d => ({ ...d, email: e.target.value }))} /></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── C. Parcele ── */}
        <SectionHeader label="C. Parcele asociate" open={openParcels} onToggle={() => setOpenParcels(o => !o)}
          sub={selectedParcelIds.length > 0 ? `${selectedParcelIds.length} sel. · ${totalHa.toFixed(2)} ha` : undefined} />
        {openParcels && (
          <div className="p-5 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input value={parcelSearch} onChange={e => setParcelSearch(e.target.value)}
                placeholder="Caută bloc, tarla, parcelă, cultură, localitate..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
            </div>
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
              <p className="text-sm text-gray-500 text-center py-4">Nu există parcele. Importă APIA sau adaugă manual.</p>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0 border-b border-gray-200">
                    <tr>
                      <th className="px-2 py-2 w-8">
                        <input type="checkbox"
                          checked={filteredParcels.length > 0 && filteredParcels.every(p => selectedParcelIds.includes(p.id))}
                          onChange={e => filteredParcels.forEach(p => { const has = selectedParcelIds.includes(p.id); if (e.target.checked !== has) toggleParcel(p.id) })} />
                      </th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-500 uppercase text-[10px]">Bloc / Tarla / Parcelă</th>
                      <th className="px-2 py-2 text-right font-semibold text-gray-500 uppercase text-[10px]">ha</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-500 uppercase text-[10px]">Cultură</th>
                      <th className="px-2 py-2 text-left font-semibold text-gray-500 uppercase text-[10px] hidden sm:table-cell">Localitate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredParcels.map(p => {
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
        <button type="button" onClick={() => void handleSave()} disabled={saving || !form.start_date || !form.end_date}
          className="flex items-center gap-2 px-6 py-2.5 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />}
          Salvează contract
        </button>
        <button type="button" onClick={() => router.back()} className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50">Anulează</button>
      </div>
    </div>
  )
}
