'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Upload, Building2, Users, FileText, MapPin, ClipboardCheck,
  ChevronRight, ChevronLeft, CheckCircle2, SkipForward, Loader2,
  Search, Check, AlertTriangle, X,
} from 'lucide-react'

// Browser-only — uses shpjs, turf, stereo70 transforms
const ImportWizardModal = dynamic(
  () => import('@/app/(app)/parcele/harta/ImportWizardModal'),
  { ssr: false },
)

// ─── Types ────────────────────────────────────────────────────────────────────

interface FarmForm {
  name: string; cif: string; reg_com: string
  address: string; county: string; locality: string
  phone: string; email: string; iban: string; bank_name: string
}

interface LessorForm {
  type: 'NATURAL' | 'LEGAL' | 'PFA'
  first_name: string; last_name: string; company_name: string
  cnp: string; county: string; locality: string; phone: string; email: string
}

interface ContractForm {
  contract_number: string; sign_date: string
  start_date: string; end_date: string
}

interface ParcelRow {
  id: string
  bloc_fizic: string | null
  tarla_nr: string | null
  parcel_nr: string | null
  county: string | null
  locality: string | null
  surface: number
  culture: string | null
  lessor_id: string | null
  contract_id: string | null
}

interface LessorOption {
  id: string
  label: string
}

// ─── Step config ──────────────────────────────────────────────────────────────

const STEPS = [
  { num: 1, label: 'Import APIA',  icon: Upload },
  { num: 2, label: 'Date Fermă',   icon: Building2 },
  { num: 3, label: 'Arendator',    icon: Users },
  { num: 4, label: 'Contract',     icon: FileText },
  { num: 5, label: 'Parcele',      icon: MapPin },
  { num: 6, label: 'Rezumat',      icon: ClipboardCheck },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inp(
  label: string,
  value: string,
  onChange: (v: string) => void,
  opts?: { required?: boolean; type?: string; placeholder?: string },
) {
  return (
    <div key={label}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}{opts?.required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type={opts?.type ?? 'text'}
        value={value}
        placeholder={opts?.placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ConfigureazaFermaPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  // ── Step 1 ──────────────────────────────────────────────────────────────────
  const [showImport, setShowImport] = useState(false)
  const [importDone, setImportDone] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const [importStartTs, setImportStartTs] = useState<string | null>(null)

  // ── Step 2 ──────────────────────────────────────────────────────────────────
  const [farm, setFarm] = useState<FarmForm>({
    name: '', cif: '', reg_com: '', address: '', county: '',
    locality: '', phone: '', email: '', iban: '', bank_name: '',
  })

  // ── Step 3 ──────────────────────────────────────────────────────────────────
  const [lessorMode, setLessorMode] = useState<'existing' | 'new'>('existing')
  const [lessors, setLessors] = useState<LessorOption[]>([])
  const [selectedLessorId, setSelectedLessorId] = useState('')
  const [newLessor, setNewLessor] = useState<LessorForm>({
    type: 'NATURAL', first_name: '', last_name: '', company_name: '',
    cnp: '', county: '', locality: '', phone: '', email: '',
  })
  const [savedLessorId, setSavedLessorId] = useState<string | null>(null)
  const [savedLessorName, setSavedLessorName] = useState('')

  // ── Step 4 ──────────────────────────────────────────────────────────────────
  const [contract, setContract] = useState<ContractForm>({
    contract_number: '', sign_date: '', start_date: '', end_date: '',
  })
  const [savedContractId, setSavedContractId] = useState<string | null>(null)

  // ── Step 5 ──────────────────────────────────────────────────────────────────
  const [parcels, setParcels] = useState<ParcelRow[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [parcelSearch, setParcelSearch] = useState('')
  const [onlyFree, setOnlyFree] = useState(true)

  // ── Load data on step enter ──────────────────────────────────────────────────

  useEffect(() => {
    if (step === 2) loadFarm()
    if (step === 3) loadLessors()
    if (step === 5) loadParcels()
  }, [step])

  async function loadFarm() {
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return
    const { data } = await db.from('company_settings').select('*').eq('user_id', user.id).maybeSingle()
    if (data) {
      setFarm({
        name: data.name ?? '',
        cif: data.cif ?? '',
        reg_com: data.reg_com ?? '',
        address: data.address ?? '',
        county: data.county ?? '',
        locality: data.locality ?? '',
        phone: data.phone ?? '',
        email: data.email ?? '',
        iban: data.iban ?? '',
        bank_name: data.bank_name ?? '',
      })
    }
  }

  async function loadLessors() {
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return
    const { data } = await db.from('lessors')
      .select('id, first_name, last_name, company_name, type')
      .eq('user_id', user.id)
      .eq('status', 'ACTIVE')
      .order('last_name')
    setLessors((data ?? []).map(l => ({
      id: l.id,
      label: l.type === 'LEGAL' || l.type === 'PFA'
        ? (l.company_name ?? `${l.last_name} ${l.first_name}`.trim())
        : `${l.last_name} ${l.first_name}`.trim(),
    })))
  }

  const loadParcels = useCallback(async () => {
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return
    const { data } = await db.from('parcels')
      .select('id, bloc_fizic, tarla_nr, parcel_nr, county, locality, surface, culture, lessor_id, contract_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500)
    setParcels(data ?? [])
  }, [])

  // ── Import callback ───────────────────────────────────────────────────────────

  async function handleImportComplete() {
    setShowImport(false)
    if (importStartTs) {
      const db = createClient()
      const { data: { user } } = await db.auth.getUser()
      if (user) {
        const { count } = await db.from('parcels')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .gte('created_at', importStartTs)
        setImportedCount(count ?? 0)
      }
    }
    setImportDone(true)
  }

  // ── Step save functions ───────────────────────────────────────────────────────

  async function saveFarm() {
    setSaving(true)
    try {
      const db = createClient()
      const { data: { user } } = await db.auth.getUser()
      if (!user) throw new Error('Neautentificat')
      const { error } = await db.from('company_settings').upsert(
        { ...farm, user_id: user.id },
        { onConflict: 'user_id' },
      )
      if (error) throw new Error(error.message)
      toast.success('Date fermă salvate')
      setStep(3)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Eroare la salvare')
    } finally {
      setSaving(false)
    }
  }

  async function saveLessor() {
    setSaving(true)
    try {
      const db = createClient()
      const { data: { user } } = await db.auth.getUser()
      if (!user) throw new Error('Neautentificat')

      if (lessorMode === 'existing') {
        if (!selectedLessorId) throw new Error('Selectează un arendator')
        const found = lessors.find(l => l.id === selectedLessorId)
        setSavedLessorId(selectedLessorId)
        setSavedLessorName(found?.label ?? '')
        setStep(4)
        return
      }

      // New lessor
      const { first_name, last_name } = newLessor
      if (!last_name.trim()) throw new Error('Numele de familie este obligatoriu')
      const count = await db.from('lessors').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
      const code = `AR${String(((count.count ?? 0) as number) + 1).padStart(4, '0')}`
      const { data, error } = await db.from('lessors').insert({
        user_id: user.id,
        code,
        type: newLessor.type,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        company_name: newLessor.company_name.trim() || null,
        cnp: newLessor.cnp.trim(),
        county: newLessor.county.trim(),
        locality: newLessor.locality.trim(),
        phone: newLessor.phone.trim() || null,
        email: newLessor.email.trim() || null,
        status: 'ACTIVE',
      }).select('id').single()
      if (error) throw new Error(error.message)
      const name = newLessor.type === 'LEGAL'
        ? newLessor.company_name
        : `${last_name} ${first_name}`.trim()
      setSavedLessorId(data.id)
      setSavedLessorName(name)
      toast.success('Arendator adăugat')
      setStep(4)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Eroare la salvare')
    } finally {
      setSaving(false)
    }
  }

  async function saveContract() {
    setSaving(true)
    try {
      const db = createClient()
      const { data: { user } } = await db.auth.getUser()
      if (!user) throw new Error('Neautentificat')
      if (!contract.start_date || !contract.end_date) throw new Error('Data început și sfârșit sunt obligatorii')
      const { data, error } = await db.from('contracts').insert({
        user_id: user.id,
        lessor_id: savedLessorId,
        contract_number: contract.contract_number.trim(),
        contract_type: 'ARENDA',
        sign_date: contract.sign_date || null,
        start_date: contract.start_date,
        end_date: contract.end_date,
        status: 'ACTIVE',
        annual_rent: 0,
        total_parcels: 0,
      }).select('id').single()
      if (error) throw new Error(error.message)
      setSavedContractId(data.id)
      toast.success('Contract creat')
      setStep(5)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Eroare la salvare')
    } finally {
      setSaving(false)
    }
  }

  async function associateParcels() {
    if (selected.size === 0) { setStep(6); return }
    setSaving(true)
    try {
      const db = createClient()
      const ids = [...selected]
      const { error } = await db.from('parcels')
        .update({ lessor_id: savedLessorId, contract_id: savedContractId })
        .in('id', ids)
      if (error) throw new Error(error.message)
      // Update contract total_parcels
      if (savedContractId) {
        const totalSurface = parcels
          .filter(p => ids.includes(p.id))
          .reduce((s, p) => s + (p.surface ?? 0), 0)
        await db.from('contracts').update({
          total_parcels: ids.length,
          annual_rent: totalSurface,
        }).eq('id', savedContractId)
      }
      toast.success(`${ids.length} parcele asociate contractului`)
      setStep(6)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Eroare la asociere')
    } finally {
      setSaving(false)
    }
  }

  // ── Parcels filter ────────────────────────────────────────────────────────────

  const filteredParcels = parcels.filter(p => {
    if (onlyFree && (p.lessor_id || p.contract_id)) return false
    if (parcelSearch) {
      const q = parcelSearch.toLowerCase()
      return (
        p.bloc_fizic?.toLowerCase().includes(q) ||
        p.tarla_nr?.toLowerCase().includes(q) ||
        p.parcel_nr?.toLowerCase().includes(q) ||
        p.locality?.toLowerCase().includes(q) ||
        p.culture?.toLowerCase().includes(q)
      )
    }
    return true
  })

  const toggleParcel = (id: string) => {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(id) ? n.delete(id) : n.add(id)
      return n
    })
  }

  const totalSelected = parcels
    .filter(p => selected.has(p.id))
    .reduce((s, p) => s + (p.surface ?? 0), 0)

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Page title */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Configurează Ferma</h1>
        <p className="text-sm text-gray-500 mt-1">
          Completează pașii de mai jos pentru a configura ferma, arendatorii și contractele.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center mb-8 overflow-x-auto pb-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          const done = step > s.num
          const active = step === s.num
          return (
            <div key={s.num} className="flex items-center flex-shrink-0">
              <div className={`flex flex-col items-center gap-1 ${active ? 'text-brand-600' : done ? 'text-green-600' : 'text-gray-400'}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors ${
                  active ? 'border-brand-600 bg-brand-50' : done ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-white'
                }`}>
                  {done ? <Check className="w-4 h-4 text-green-600" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className="text-[10px] font-medium whitespace-nowrap">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-0.5 mb-4 mx-1 flex-shrink-0 ${step > s.num ? 'bg-green-400' : 'bg-gray-200'}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* ── STEP 1: Import APIA ─────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Pasul 1 — Import Parcele APIA</h2>
            <p className="text-sm text-gray-500 mt-1">
              Importă shapefile-ul APIA pentru a popula automat parcelele cu bloc fizic, suprafețe, culturi și geometrie.
            </p>
          </div>

          {importDone ? (
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div>
                <div className="font-medium text-green-800">Import finalizat</div>
                {importedCount > 0 && (
                  <div className="text-sm text-green-700">{importedCount} parcele noi importate în această sesiune.</div>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                onClick={() => {
                  setImportStartTs(new Date().toISOString())
                  setShowImport(true)
                }}
                className="flex flex-col items-center gap-3 p-6 border-2 border-brand-200 rounded-xl hover:border-brand-400 hover:bg-brand-50 transition-colors group"
              >
                <Upload className="w-10 h-10 text-brand-500 group-hover:text-brand-600" />
                <div className="text-center">
                  <div className="font-semibold text-gray-900">Importă parcele APIA</div>
                  <div className="text-xs text-gray-500 mt-1">Fișier .zip, .shp sau .geojson</div>
                </div>
              </button>
              <button
                onClick={() => setStep(2)}
                className="flex flex-col items-center gap-3 p-6 border-2 border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors group"
              >
                <SkipForward className="w-10 h-10 text-gray-400 group-hover:text-gray-500" />
                <div className="text-center">
                  <div className="font-semibold text-gray-700">Sari peste import APIA</div>
                  <div className="text-xs text-gray-500 mt-1">Voi adăuga parcele manual mai târziu</div>
                </div>
              </button>
            </div>
          )}

          {importDone && (
            <div className="flex justify-end">
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 transition-colors"
              >
                Continuă <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: Date Fermă ──────────────────────────────────────────────── */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Pasul 2 — Date despre Fermă</h2>
            <p className="text-sm text-gray-500 mt-1">Aceste date sunt folosite pe facturi și documente fiscale.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {inp('Denumire fermă / societate', farm.name, v => setFarm(f => ({ ...f, name: v })), { required: true })}
            {inp('CUI / CIF', farm.cif, v => setFarm(f => ({ ...f, cif: v })))}
            {inp('Nr. Registru Comerțului', farm.reg_com, v => setFarm(f => ({ ...f, reg_com: v })))}
            {inp('Adresă', farm.address, v => setFarm(f => ({ ...f, address: v })))}
            {inp('Județ', farm.county, v => setFarm(f => ({ ...f, county: v })))}
            {inp('Localitate', farm.locality, v => setFarm(f => ({ ...f, locality: v })))}
            {inp('Telefon', farm.phone, v => setFarm(f => ({ ...f, phone: v })))}
            {inp('Email', farm.email, v => setFarm(f => ({ ...f, email: v })), { type: 'email' })}
            {inp('IBAN', farm.iban, v => setFarm(f => ({ ...f, iban: v })), { placeholder: 'RO49AAAA1B31007593840000' })}
            {inp('Bancă', farm.bank_name, v => setFarm(f => ({ ...f, bank_name: v })))}
          </div>
          <div className="flex items-center justify-between pt-2">
            <button onClick={() => setStep(1)} className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              <ChevronLeft className="w-4 h-4" /> Înapoi
            </button>
            <button
              onClick={() => void saveFarm()}
              disabled={saving || !farm.name.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Salvează și continuă <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Arendator ───────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Pasul 3 — Arendator</h2>
            <p className="text-sm text-gray-500 mt-1">Selectează un arendator existent sau adaugă unul nou.</p>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setLessorMode('existing')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${lessorMode === 'existing' ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              Selectează existent
            </button>
            <button
              onClick={() => setLessorMode('new')}
              className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${lessorMode === 'new' ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              Adaugă arendator nou
            </button>
          </div>

          {lessorMode === 'existing' && (
            <div>
              {lessors.length === 0 ? (
                <div className="flex items-center gap-2 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  Nu există arendatori. Selectează „Adaugă arendator nou".
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Arendator</label>
                  <select
                    value={selectedLessorId}
                    onChange={e => setSelectedLessorId(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  >
                    <option value="">— Selectează —</option>
                    {lessors.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          {lessorMode === 'new' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tip persoană</label>
                <select
                  value={newLessor.type}
                  onChange={e => setNewLessor(l => ({ ...l, type: e.target.value as 'NATURAL' | 'LEGAL' | 'PFA' }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="NATURAL">Persoană fizică</option>
                  <option value="LEGAL">Persoană juridică</option>
                  <option value="PFA">PFA / II / IF</option>
                </select>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {newLessor.type === 'LEGAL' || newLessor.type === 'PFA'
                  ? inp('Denumire societate', newLessor.company_name, v => setNewLessor(l => ({ ...l, company_name: v })), { required: true })
                  : null}
                {inp('Nume', newLessor.last_name, v => setNewLessor(l => ({ ...l, last_name: v })), { required: true })}
                {inp('Prenume', newLessor.first_name, v => setNewLessor(l => ({ ...l, first_name: v })))}
                {inp('CNP / CUI', newLessor.cnp, v => setNewLessor(l => ({ ...l, cnp: v })))}
                {inp('Județ', newLessor.county, v => setNewLessor(l => ({ ...l, county: v })))}
                {inp('Localitate', newLessor.locality, v => setNewLessor(l => ({ ...l, locality: v })))}
                {inp('Telefon', newLessor.phone, v => setNewLessor(l => ({ ...l, phone: v })))}
                {inp('Email', newLessor.email, v => setNewLessor(l => ({ ...l, email: v })), { type: 'email' })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button onClick={() => setStep(2)} className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              <ChevronLeft className="w-4 h-4" /> Înapoi
            </button>
            <button
              onClick={() => void saveLessor()}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Continuă <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Contract ────────────────────────────────────────────────── */}
      {step === 4 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Pasul 4 — Contract</h2>
            <p className="text-sm text-gray-500 mt-1">
              Contract pentru arendatorul <strong>{savedLessorName}</strong>.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {inp('Număr contract', contract.contract_number, v => setContract(c => ({ ...c, contract_number: v })), { placeholder: 'ex: 001/2026' })}
            {inp('Data semnării', contract.sign_date, v => setContract(c => ({ ...c, sign_date: v })), { type: 'date' })}
            {inp('Data intrare în vigoare', contract.start_date, v => setContract(c => ({ ...c, start_date: v })), { type: 'date', required: true })}
            {inp('Data expirare', contract.end_date, v => setContract(c => ({ ...c, end_date: v })), { type: 'date', required: true })}
          </div>
          <div className="flex items-center justify-between pt-2">
            <button onClick={() => setStep(3)} className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              <ChevronLeft className="w-4 h-4" /> Înapoi
            </button>
            <button
              onClick={() => void saveContract()}
              disabled={saving || !contract.start_date || !contract.end_date}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Salvează și continuă <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 5: Parcele ─────────────────────────────────────────────────── */}
      {step === 5 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Pasul 5 — Asociere Parcele</h2>
            <p className="text-sm text-gray-500 mt-1">
              Selectează parcelele care aparțin contractului <strong>{contract.contract_number || '(fără nr)'}</strong> — <strong>{savedLessorName}</strong>.
            </p>
          </div>

          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={parcelSearch}
                onChange={e => setParcelSearch(e.target.value)}
                placeholder="Caută bloc, tarla, parcelă, localitate, cultură..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={onlyFree}
                onChange={e => setOnlyFree(e.target.checked)}
                className="rounded"
              />
              Doar parcele neasociate
            </label>
          </div>

          {/* Selection stats */}
          {selected.size > 0 && (
            <div className="flex items-center gap-4 p-3 bg-brand-50 border border-brand-200 rounded-lg text-sm">
              <CheckCircle2 className="w-4 h-4 text-brand-600 flex-shrink-0" />
              <span className="text-brand-800">
                <strong>{selected.size}</strong> parcele selectate —{' '}
                <strong>{totalSelected.toFixed(2)} ha</strong> total suprafață
              </span>
              <button onClick={() => setSelected(new Set())} className="ml-auto text-brand-600 hover:text-brand-800 flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> Deselectează
              </button>
            </div>
          )}

          {/* Parcels list */}
          {parcels.length === 0 ? (
            <div className="flex items-center gap-2 p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600">
              <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-500" />
              Nu există parcele importate. Poți sări peste acest pas și le adaugi mai târziu din Lista Parcele.
            </div>
          ) : filteredParcels.length === 0 ? (
            <div className="text-sm text-gray-500 text-center py-6">Nicio parcelă găsită cu filtrele aplicate.</div>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr className="text-gray-500 uppercase text-[10px] font-semibold tracking-wide border-b border-gray-200">
                    <th className="px-3 py-2 text-center w-8">
                      <input
                        type="checkbox"
                        checked={filteredParcels.length > 0 && filteredParcels.every(p => selected.has(p.id))}
                        onChange={e => {
                          if (e.target.checked) setSelected(prev => new Set([...prev, ...filteredParcels.map(p => p.id)]))
                          else setSelected(prev => { const n = new Set(prev); filteredParcels.forEach(p => n.delete(p.id)); return n })
                        }}
                      />
                    </th>
                    <th className="px-3 py-2 text-left">Bloc Fizic</th>
                    <th className="px-3 py-2 text-left">Tarla</th>
                    <th className="px-3 py-2 text-left">Parcelă</th>
                    <th className="px-3 py-2 text-right">Sup. (ha)</th>
                    <th className="px-3 py-2 text-left">Cultură</th>
                    <th className="px-3 py-2 text-left">Localitate</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredParcels.map(p => (
                    <tr
                      key={p.id}
                      onClick={() => toggleParcel(p.id)}
                      className={`border-b border-gray-100 cursor-pointer transition-colors ${selected.has(p.id) ? 'bg-brand-50' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selected.has(p.id)}
                          onChange={() => toggleParcel(p.id)}
                          onClick={e => e.stopPropagation()}
                        />
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-800">{p.bloc_fizic ?? '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{p.tarla_nr ?? '—'}</td>
                      <td className="px-3 py-2 text-gray-600">{p.parcel_nr ?? '—'}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{(p.surface ?? 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-gray-600">{p.culture ?? '—'}</td>
                      <td className="px-3 py-2 text-gray-500">{[p.locality, p.county].filter(Boolean).join(', ') || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button onClick={() => setStep(4)} className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              <ChevronLeft className="w-4 h-4" /> Înapoi
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setStep(6)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Sari peste
              </button>
              <button
                onClick={() => void associateParcels()}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {selected.size > 0 ? `Asociază ${selected.size} parcele` : 'Continuă fără parcele'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 6: Rezumat ─────────────────────────────────────────────────── */}
      {step === 6 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-50 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Configurare finalizată!</h2>
              <p className="text-sm text-gray-500">Iată rezumatul celor configurate.</p>
            </div>
          </div>

          <div className="space-y-3">
            {/* Import */}
            <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50">
              <Upload className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <div className="flex-1 text-sm">
                <span className="font-medium text-gray-700">Import APIA: </span>
                {importDone
                  ? <span className="text-green-700">{importedCount > 0 ? `${importedCount} parcele importate` : 'Importat cu succes'}</span>
                  : <span className="text-gray-500">Sărit</span>}
              </div>
            </div>

            {/* Fermă */}
            <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50">
              <Building2 className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <div className="flex-1 text-sm">
                <span className="font-medium text-gray-700">Fermă: </span>
                <span className="text-gray-600">{farm.name || '—'}</span>
                {farm.cif && <span className="text-gray-400 ml-2">CUI: {farm.cif}</span>}
              </div>
            </div>

            {/* Arendator */}
            <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50">
              <Users className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <div className="flex-1 text-sm">
                <span className="font-medium text-gray-700">Arendator: </span>
                <span className="text-gray-600">{savedLessorName || '—'}</span>
              </div>
            </div>

            {/* Contract */}
            <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50">
              <FileText className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <div className="flex-1 text-sm">
                <span className="font-medium text-gray-700">Contract: </span>
                <span className="text-gray-600">{contract.contract_number || '(fără număr)'}</span>
                {contract.start_date && contract.end_date && (
                  <span className="text-gray-400 ml-2">{contract.start_date} → {contract.end_date}</span>
                )}
              </div>
            </div>

            {/* Parcele */}
            <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50">
              <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0" />
              <div className="flex-1 text-sm">
                <span className="font-medium text-gray-700">Parcele asociate: </span>
                {selected.size > 0
                  ? <span className="text-green-700">{selected.size} parcele · {totalSelected.toFixed(2)} ha</span>
                  : <span className="text-gray-500">Nicio parcelă asociată</span>}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {savedContractId && (
              <button
                onClick={() => router.push(`/contracte/${savedContractId}`)}
                className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 transition-colors"
              >
                <FileText className="w-4 h-4" />
                Deschide contractul
              </button>
            )}
            <button
              onClick={() => router.push('/parcele')}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
            >
              <MapPin className="w-4 h-4" />
              Vezi parcele
            </button>
          </div>
        </div>
      )}

      {/* ── ImportWizardModal overlay ─────────────────────────────────────── */}
      {showImport && (
        <ImportWizardModal
          open={showImport}
          onClose={() => setShowImport(false)}
          onPreview={() => {}}
          onSaveComplete={() => void handleImportComplete()}
        />
      )}
    </div>
  )
}
