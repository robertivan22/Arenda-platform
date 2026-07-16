'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Upload, Building2, Layers, FileText, ClipboardCheck,
  ChevronRight, ChevronLeft, ChevronDown, ChevronUp,
  CheckCircle2, SkipForward, Loader2, Search, Check,
  AlertTriangle, X, Plus, Trash2,
} from 'lucide-react'

const ImportWizardModal = dynamic(
  () => import('@/app/(app)/parcele/harta/ImportWizardModal'),
  { ssr: false },
)

// ─── Types ────────────────────────────────────────────────────────────────────

interface FarmForm {
  name: string; cif: string; reg_com: string; address: string
  county: string; locality: string; phone: string; email: string
  iban: string; bank_name: string
}

interface ProductOption { id: string; name: string; unit: string }

interface RentLevelTemplate {
  tid: string
  product_id: string
  product_name: string
  level_per_ha: string
  level_type: 'BRUT' | 'NET'
  tax_rate: string
}

type LessorType = 'NATURAL' | 'LEGAL' | 'PFA'

interface NewLessorData {
  type: LessorType; first_name: string; last_name: string; company_name: string
  cnp: string; county: string; locality: string; phone: string; email: string
}

interface LessorOption { id: string; label: string }

interface ParcelRow {
  id: string; bloc_fizic: string | null; tarla_nr: string | null
  parcel_nr: string | null; county: string | null; locality: string | null
  surface: number; culture: string | null; siruta: string | null
  land_use_category: string | null; cadastral_nr: string | null
  lessor_id: string | null; contract_id: string | null
}

interface ContractFields {
  contract_number: string; contract_type: string; zone: string
  sign_date: string; start_date: string; end_date: string
  primarie_nr: string; primarie_date: string
  tax_method: string; localities: string; status: string
}

interface ContractDraft {
  tid: string
  savedId: string | null
  isExpanded: boolean
  openSection: 'details' | 'lessor' | 'parcels' | null
  fields: ContractFields
  rentLevels: RentLevelTemplate[]
  lessorMode: 'existing' | 'new'
  existingLessorId: string
  existingLessorName: string
  newLessorData: NewLessorData
  selectedParcelIds: string[]
}

// ─── Defaults ────────────────────────────────────────────────────────────────

function emptyContractFields(): ContractFields {
  return {
    contract_number: '', contract_type: 'ARENDA', zone: '',
    sign_date: '', start_date: '', end_date: '',
    primarie_nr: '', primarie_date: '',
    tax_method: 'COTA_FORFETARA', localities: '', status: 'ACTIVE',
  }
}

function emptyNewLessor(): NewLessorData {
  return {
    type: 'NATURAL', first_name: '', last_name: '', company_name: '',
    cnp: '', county: '', locality: '', phone: '', email: '',
  }
}

function tid() { return `${Date.now()}-${Math.random().toString(36).slice(2)}` }

function newContract(templates: RentLevelTemplate[]): ContractDraft {
  return {
    tid: tid(), savedId: null, isExpanded: true, openSection: 'details',
    fields: emptyContractFields(),
    rentLevels: templates.map(t => ({ ...t, tid: tid() })),
    lessorMode: 'existing', existingLessorId: '', existingLessorName: '',
    newLessorData: emptyNewLessor(), selectedParcelIds: [],
  }
}

// ─── Wizard steps ─────────────────────────────────────────────────────────────

const STEPS = [
  { num: 1, label: 'Import APIA',       icon: Upload },
  { num: 2, label: 'Date Fermă',        icon: Building2 },
  { num: 3, label: 'Niveluri Arendă',   icon: Layers },
  { num: 4, label: 'Contracte',         icon: FileText },
  { num: 5, label: 'Rezumat & Salvare', icon: ClipboardCheck },
]

// ─── Small helpers ────────────────────────────────────────────────────────────

const INP = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'
const LBL = 'block text-xs font-medium text-gray-700 mb-1'

function field(label: string, value: string, onChange: (v: string) => void,
  opts?: { req?: boolean; type?: string; ph?: string }) {
  return (
    <div>
      <label className={LBL}>{label}{opts?.req && <span className="text-red-500 ml-0.5">*</span>}</label>
      <input type={opts?.type ?? 'text'} value={value} placeholder={opts?.ph}
        onChange={e => onChange(e.target.value)} className={INP} />
    </div>
  )
}

function sel(label: string, value: string, onChange: (v: string) => void,
  opts: { v: string; l: string }[], req?: boolean) {
  return (
    <div>
      <label className={LBL}>{label}{req && <span className="text-red-500 ml-0.5">*</span>}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className={INP}>
        {opts.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  )
}

function secHdr(label: string, open: boolean, toggle: () => void, sub?: string) {
  return (
    <button type="button" onClick={toggle}
      className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 text-sm font-semibold text-gray-700">
      <span>{label}{sub ? <span className="ml-2 text-xs font-normal text-gray-400">{sub}</span> : null}</span>
      {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
    </button>
  )
}

function parcelLabel(p: ParcelRow) {
  const parts: string[] = []
  if (p.bloc_fizic) parts.push(`Bloc ${p.bloc_fizic}`)
  if (p.tarla_nr) parts.push(`T${p.tarla_nr}`)
  if (p.parcel_nr) parts.push(`P${p.parcel_nr}`)
  parts.push(`${(p.surface ?? 0).toFixed(2)} ha`)
  if (p.culture) parts.push(p.culture)
  const loc = [p.county, p.locality].filter(Boolean).join('/')
  if (loc) parts.push(loc)
  return parts.join(' | ')
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ConfigureazaFermaPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)

  // Step 1
  const [showImport, setShowImport] = useState(false)
  const [importDone, setImportDone] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const [importStartTs, setImportStartTs] = useState<string | null>(null)

  // Step 2
  const [farm, setFarm] = useState<FarmForm>({
    name: '', cif: '', reg_com: '', address: '', county: '',
    locality: '', phone: '', email: '', iban: '', bank_name: '',
  })

  // Step 3
  const [products, setProducts] = useState<ProductOption[]>([])
  const [templates, setTemplates] = useState<RentLevelTemplate[]>([])

  // Step 4
  const [contracts, setContracts] = useState<ContractDraft[]>([])
  const [lessors, setLessors] = useState<LessorOption[]>([])
  const [parcels, setParcels] = useState<ParcelRow[]>([])
  const [pSearch, setPSearch] = useState<Record<string, string>>({})

  // ── Data loaders ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (step === 2) loadFarm()
    if (step === 3) loadProducts()
    if (step === 4) { loadLessors(); loadParcels() }
  }, [step])

  async function loadFarm() {
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return
    const { data } = await db.from('company_settings').select('*').eq('user_id', user.id).maybeSingle()
    if (data) setFarm({
      name: data.name ?? '', cif: data.cif ?? '', reg_com: data.reg_com ?? '',
      address: data.address ?? '', county: data.county ?? '', locality: data.locality ?? '',
      phone: data.phone ?? '', email: data.email ?? '', iban: data.iban ?? '', bank_name: data.bank_name ?? '',
    })
  }

  async function loadProducts() {
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return
    const { data } = await db.from('products').select('id, name, unit').eq('user_id', user.id).eq('is_active', true).order('sort_order')
    setProducts(data ?? [])
  }

  async function loadLessors() {
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return
    const { data } = await db.from('lessors').select('id, first_name, last_name, company_name, type')
      .eq('user_id', user.id).eq('status', 'ACTIVE').order('last_name')
    setLessors((data ?? []).map((l: Record<string, string>) => ({
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
      .select('id,bloc_fizic,tarla_nr,parcel_nr,county,locality,surface,culture,siruta,land_use_category,cadastral_nr,lessor_id,contract_id')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(1000)
    setParcels(data ?? [])
  }, [])

  // ── Import ───────────────────────────────────────────────────────────────────

  async function handleImportComplete() {
    setShowImport(false)
    if (importStartTs) {
      const db = createClient()
      const { data: { user } } = await db.auth.getUser()
      if (user) {
        const { count } = await db.from('parcels').select('id', { count: 'exact', head: true })
          .eq('user_id', user.id).gte('created_at', importStartTs)
        setImportedCount(count ?? 0)
      }
    }
    setImportDone(true)
  }

  // ── Template rent levels CRUD ─────────────────────────────────────────────────

  function addTemplate() {
    const prod = products[0]
    setTemplates(prev => [...prev, {
      tid: tid(), product_id: prod?.id ?? '', product_name: prod?.name ?? '',
      level_per_ha: '', level_type: 'NET', tax_rate: '10',
    }])
  }

  function updTemplate(id: string, f: keyof RentLevelTemplate, v: string) {
    setTemplates(prev => prev.map(t => {
      if (t.tid !== id) return t
      if (f === 'product_id') { const p = products.find(x => x.id === v); return { ...t, product_id: v, product_name: p?.name ?? '' } }
      return { ...t, [f]: v }
    }))
  }

  // ── Contract CRUD ─────────────────────────────────────────────────────────────

  function addContract() {
    setContracts(prev => [
      ...prev.map(c => ({ ...c, isExpanded: false })),
      newContract(templates),
    ])
  }

  function updContract(id: string, fn: (c: ContractDraft) => ContractDraft) {
    setContracts(prev => prev.map(c => c.tid === id ? fn(c) : c))
  }

  function addCRL(cid: string) {
    const prod = products[0]
    updContract(cid, c => ({
      ...c, rentLevels: [...c.rentLevels, {
        tid: tid(), product_id: prod?.id ?? '', product_name: prod?.name ?? '',
        level_per_ha: '', level_type: 'NET', tax_rate: '10',
      }],
    }))
  }

  function updCRL(cid: string, lid: string, f: keyof RentLevelTemplate, v: string) {
    updContract(cid, c => ({
      ...c, rentLevels: c.rentLevels.map(l => {
        if (l.tid !== lid) return l
        if (f === 'product_id') { const p = products.find(x => x.id === v); return { ...l, product_id: v, product_name: p?.name ?? '' } }
        return { ...l, [f]: v }
      }),
    }))
  }

  function toggleParcel(cid: string, pid: string) {
    updContract(cid, c => {
      const has = c.selectedParcelIds.includes(pid)
      return { ...c, selectedParcelIds: has ? c.selectedParcelIds.filter(x => x !== pid) : [...c.selectedParcelIds, pid] }
    })
  }

  function parcelConflict(pid: string, cid: string): string | null {
    for (const c of contracts) {
      if (c.tid === cid) continue
      if (c.selectedParcelIds.includes(pid)) return c.fields.contract_number || 'alt contract'
    }
    return null
  }

  // ── Farm save ────────────────────────────────────────────────────────────────

  async function saveFarm() {
    setSaving(true)
    try {
      const db = createClient()
      const { data: { user } } = await db.auth.getUser()
      if (!user) throw new Error('Neautentificat')
      const { error } = await db.from('company_settings').upsert({ ...farm, user_id: user.id }, { onConflict: 'user_id' })
      if (error) throw new Error(error.message)
      toast.success('Date fermă salvate')
      setStep(3)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Eroare') } finally { setSaving(false) }
  }

  // ── Final save ───────────────────────────────────────────────────────────────

  async function finalSave() {
    setSaving(true)
    const errors: string[] = []
    try {
      const db = createClient()
      const { data: { user } } = await db.auth.getUser()
      if (!user) throw new Error('Neautentificat')

      // 1. Farm
      await db.from('company_settings').upsert({ ...farm, user_id: user.id }, { onConflict: 'user_id' })

      const savedIds: string[] = []

      for (const c of contracts) {
        try {
          // Lessor
          let lessorId: string | null = null
          if (c.lessorMode === 'existing') {
            lessorId = c.existingLessorId || null
          } else {
            const nd = c.newLessorData
            if (!nd.last_name.trim()) throw new Error('Arendatorul nu are nume de familie')
            const { count } = await db.from('lessors').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
            const code = `AR${String(((count ?? 0) as number) + 1).padStart(4, '0')}`
            const { data: lr, error: le } = await db.from('lessors').insert({
              user_id: user.id, code, type: nd.type,
              first_name: nd.first_name.trim(), last_name: nd.last_name.trim(),
              company_name: nd.company_name.trim() || null, cnp: nd.cnp.trim(),
              county: nd.county.trim(), locality: nd.locality.trim(),
              phone: nd.phone.trim() || null, email: nd.email.trim() || null, status: 'ACTIVE',
            }).select('id').single()
            if (le || !lr) throw new Error(le?.message ?? 'Eroare creare arendator')
            lessorId = lr.id
          }

          // Contract
          if (!c.fields.start_date || !c.fields.end_date) throw new Error('Dată început / sfârșit lipsă')
          const surfTotal = parcels.filter(p => c.selectedParcelIds.includes(p.id)).reduce((s, p) => s + (p.surface ?? 0), 0)
          const { data: cr, error: ce } = await db.from('contracts').insert({
            user_id: user.id, lessor_id: lessorId,
            contract_number: c.fields.contract_number, contract_type: c.fields.contract_type,
            zone: c.fields.zone || null, sign_date: c.fields.sign_date || null,
            start_date: c.fields.start_date, end_date: c.fields.end_date,
            primarie_nr: c.fields.primarie_nr || null, primarie_date: c.fields.primarie_date || null,
            tax_method: c.fields.tax_method, localities: c.fields.localities || null,
            status: c.fields.status, annual_rent: surfTotal, total_parcels: c.selectedParcelIds.length,
          }).select('id').single()
          if (ce || !cr) throw new Error(ce?.message ?? 'Eroare creare contract')

          // Rent levels
          const validLvl = c.rentLevels.filter(l => l.level_per_ha && parseFloat(l.level_per_ha) > 0)
          if (validLvl.length > 0) {
            await db.from('contract_rent_levels').insert(
              validLvl.map((l, i) => ({
                user_id: user.id, contract_id: cr.id,
                product_id: l.product_id || null, product_name: l.product_name,
                level_per_ha: parseFloat(l.level_per_ha) || 0, level_type: l.level_type,
                tax_rate: parseFloat(l.tax_rate) || 10, sort_order: i,
              }))
            )
          }

          // Parcels
          if (c.selectedParcelIds.length > 0) {
            await db.from('parcels').update({ contract_id: cr.id, lessor_id: lessorId }).in('id', c.selectedParcelIds)
          }

          savedIds.push(cr.id)
        } catch (e) {
          errors.push(`Contract "${c.fields.contract_number || 'fără nr'}": ${e instanceof Error ? e.message : 'Eroare'}`)
        }
      }

      if (errors.length > 0) {
        errors.forEach(msg => toast.error(msg, { duration: 7000 }))
      } else {
        toast.success(`${savedIds.length} contract(e) salvat(e) cu succes!`)
        router.push(savedIds.length === 1 ? `/contracte/${savedIds[0]}` : '/contracte')
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Eroare la salvare')
    } finally { setSaving(false) }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 pb-20">
      {/* Title */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Configurează Ferma</h1>
        <p className="text-sm text-gray-500 mt-1">Completează pașii de mai jos pentru a configura ferma, arendatorii și contractele.</p>
      </div>

      {/* Stepper */}
      <div className="flex items-start mb-8 overflow-x-auto pb-2 gap-0">
        {STEPS.map((s, i) => {
          const Icon = s.icon
          const done = step > s.num
          const active = step === s.num
          return (
            <div key={s.num} className="flex items-center flex-shrink-0">
              <div className={`flex flex-col items-center gap-1 w-16 ${active ? 'text-brand-600' : done ? 'text-green-600' : 'text-gray-400'}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center border-2 ${active ? 'border-brand-600 bg-brand-50' : done ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-white'}`}>
                  {done ? <Check className="w-4 h-4 text-green-600" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className="text-[10px] font-medium text-center leading-tight">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`w-5 h-0.5 mb-4 flex-shrink-0 ${step > s.num ? 'bg-green-400' : 'bg-gray-200'}`} />}
            </div>
          )
        })}
      </div>

      {/* ── STEP 1 ── */}
      {step === 1 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Import Parcele APIA</h2>
            <p className="text-sm text-gray-500 mt-1">Importă shapefile-ul APIA pentru a popula parcelele. Poți sări peste dacă nu ai fișier acum.</p>
          </div>
          {importDone ? (
            <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-medium text-green-800">Import finalizat</div>
                {importedCount > 0 && <div className="text-sm text-green-700">{importedCount} parcele noi importate în această sesiune.</div>}
              </div>
              <button onClick={() => setImportDone(false)} className="text-xs text-gray-400 hover:text-gray-600">Import nou</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button onClick={() => { setImportStartTs(new Date().toISOString()); setShowImport(true) }}
                className="flex flex-col items-center gap-3 p-6 border-2 border-brand-200 rounded-xl hover:border-brand-400 hover:bg-brand-50 transition-colors">
                <Upload className="w-10 h-10 text-brand-500" />
                <div className="text-center">
                  <div className="font-semibold text-gray-900">Importă parcele APIA</div>
                  <div className="text-xs text-gray-500 mt-1">Fișier .zip, .shp sau .geojson</div>
                </div>
              </button>
              <button onClick={() => setStep(2)}
                className="flex flex-col items-center gap-3 p-6 border-2 border-gray-200 rounded-xl hover:border-gray-300 hover:bg-gray-50 transition-colors">
                <SkipForward className="w-10 h-10 text-gray-400" />
                <div className="text-center">
                  <div className="font-semibold text-gray-700">Sari peste</div>
                  <div className="text-xs text-gray-500 mt-1">Adaug parcele manual mai târziu</div>
                </div>
              </button>
            </div>
          )}
          {importDone && (
            <div className="flex justify-end">
              <button onClick={() => setStep(2)} className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 transition-colors">
                Continuă <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2 ── */}
      {step === 2 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Date despre Fermă</h2>
            <p className="text-sm text-gray-500 mt-1">Datele fermei sunt utilizate pe facturi și documente fiscale.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('Denumire fermă / societate', farm.name, v => setFarm(f => ({ ...f, name: v })), { req: true })}
            {field('CUI / CIF', farm.cif, v => setFarm(f => ({ ...f, cif: v })))}
            {field('Nr. Registru Comerțului', farm.reg_com, v => setFarm(f => ({ ...f, reg_com: v })))}
            {field('Adresă', farm.address, v => setFarm(f => ({ ...f, address: v })))}
            {field('Județ', farm.county, v => setFarm(f => ({ ...f, county: v })))}
            {field('Localitate', farm.locality, v => setFarm(f => ({ ...f, locality: v })))}
            {field('Telefon', farm.phone, v => setFarm(f => ({ ...f, phone: v })))}
            {field('Email', farm.email, v => setFarm(f => ({ ...f, email: v })), { type: 'email' })}
            {field('IBAN', farm.iban, v => setFarm(f => ({ ...f, iban: v })), { ph: 'RO49AAAA...' })}
            {field('Bancă', farm.bank_name, v => setFarm(f => ({ ...f, bank_name: v })))}
          </div>
          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(1)} className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              <ChevronLeft className="w-4 h-4" /> Înapoi
            </button>
            <button onClick={() => void saveFarm()} disabled={saving || !farm.name.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvează și continuă <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 3 ── */}
      {step === 3 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900">Niveluri de arendă</h2>
            <p className="text-sm text-gray-500 mt-1">
              Definește nivelurile de bază (produs, cantitate/ha, tip). Acestea vor fi precompletate în fiecare contract — le poți modifica individual.
            </p>
          </div>

          {products.length === 0 && (
            <div className="mx-6 mb-4 flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Nu există produse configurate. Mergi la <strong className="mx-1">Setări → Produse</strong> pentru a adăuga (Grâu, Porumb, RON etc.).
            </div>
          )}

          <div className="px-6 pb-4 space-y-3">
            {templates.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">Niciun nivel definit. Apasă „Adaugă nivel" pentru a crea primul nivel de arendă.</p>
            )}
            {templates.map((t, i) => (
              <div key={t.tid} className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Nivel {i + 1}</span>
                  <button onClick={() => setTemplates(prev => prev.filter(x => x.tid !== t.tid))} className="p-1 text-red-400 hover:text-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className={LBL}>Produs</label>
                    <select value={t.product_id} onChange={e => updTemplate(t.tid, 'product_id', e.target.value)} className={INP}>
                      <option value="">— Selectează —</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
                    </select>
                  </div>
                  {field('Cant./ha', t.level_per_ha, v => updTemplate(t.tid, 'level_per_ha', v), { type: 'number', ph: '0.00' })}
                  <div>
                    <label className={LBL}>Tip</label>
                    <select value={t.level_type} onChange={e => updTemplate(t.tid, 'level_type', e.target.value)} className={INP}>
                      <option value="NET">NET</option>
                      <option value="BRUT">BRUT</option>
                    </select>
                  </div>
                  {field('Impozit %', t.tax_rate, v => updTemplate(t.tid, 'tax_rate', v), { type: 'number', ph: '10' })}
                </div>
              </div>
            ))}
          </div>

          <div className="px-6 pb-5">
            <button onClick={addTemplate} className="flex items-center gap-2 px-4 py-2 text-sm border border-dashed border-brand-300 text-brand-600 rounded-lg hover:bg-brand-50 transition-colors">
              <Plus className="w-4 h-4" /> Adaugă nivel arendă
            </button>
          </div>

          <div className="border-t border-gray-100 p-4 flex justify-between">
            <button onClick={() => setStep(2)} className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              <ChevronLeft className="w-4 h-4" /> Înapoi
            </button>
            <button onClick={() => { if (contracts.length === 0) addContract(); setStep(4) }}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 transition-colors">
              Continuă la contracte <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4 ── */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Contracte</h2>
              <p className="text-sm text-gray-500 mt-0.5">{contracts.length} contract(e) adăugate</p>
            </div>
            <button onClick={addContract} className="flex items-center gap-2 px-4 py-2 bg-brand-600 text-white text-sm font-medium rounded-xl hover:bg-brand-700 transition-colors">
              <Plus className="w-4 h-4" /> Contract nou
            </button>
          </div>

          {contracts.length === 0 && (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-500">
              <FileText className="w-10 h-10 mx-auto mb-3 text-gray-300" />
              <p className="font-medium">Niciun contract</p>
              <p className="text-sm mt-1">Apasă „Contract nou" pentru a crea primul contract.</p>
            </div>
          )}

          {contracts.map(c => (
            <ContractCard key={c.tid}
              c={c} lessors={lessors} products={products} parcels={parcels}
              search={pSearch[c.tid] ?? ''}
              onSearch={v => setPSearch(s => ({ ...s, [c.tid]: v }))}
              onToggle={() => updContract(c.tid, d => ({ ...d, isExpanded: !d.isExpanded }))}
              onToggleSec={s => updContract(c.tid, d => ({ ...d, openSection: d.openSection === s ? null : s }))}
              onRemove={() => setContracts(prev => prev.filter(x => x.tid !== c.tid))}
              onField={(f, v) => updContract(c.tid, d => ({ ...d, fields: { ...d.fields, [f]: v } }))}
              onLessorMode={mode => updContract(c.tid, d => ({ ...d, lessorMode: mode }))}
              onSelectLessor={(id, name) => updContract(c.tid, d => ({ ...d, existingLessorId: id, existingLessorName: name }))}
              onNewLessor={(f, v) => updContract(c.tid, d => ({ ...d, newLessorData: { ...d.newLessorData, [f]: v } }))}
              onToggleParcel={pid => toggleParcel(c.tid, pid)}
              conflict={pid => parcelConflict(pid, c.tid)}
              onAddCRL={() => addCRL(c.tid)}
              onUpdCRL={(lid, f, v) => updCRL(c.tid, lid, f, v)}
              onRemCRL={lid => updContract(c.tid, d => ({ ...d, rentLevels: d.rentLevels.filter(l => l.tid !== lid) }))}
            />
          ))}

          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(3)} className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              <ChevronLeft className="w-4 h-4" /> Înapoi
            </button>
            <button onClick={() => setStep(5)} disabled={contracts.length === 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 text-white rounded-xl font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors">
              Rezumat & Salvare <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 5 ── */}
      {step === 5 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Rezumat final</h2>
            <p className="text-sm text-gray-500 mt-1">Verifică datele înainte de salvare. Poți reveni și edita orice pas.</p>
          </div>

          {/* Fermă */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2"><Building2 className="w-4 h-4" /> Date fermă</div>
            {farm.name && <p className="text-sm text-gray-700"><strong>Denumire:</strong> {farm.name}</p>}
            {farm.cif && <p className="text-sm text-gray-600"><strong>CUI:</strong> {farm.cif}</p>}
            {farm.locality && <p className="text-sm text-gray-600"><strong>Locație:</strong> {[farm.locality, farm.county].filter(Boolean).join(', ')}</p>}
          </div>

          {/* Import */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2"><Upload className="w-4 h-4" /> Import APIA</div>
            {importDone
              ? <p className="text-sm text-green-700"><CheckCircle2 className="w-4 h-4 inline mr-1 text-green-600" />{importedCount > 0 ? `${importedCount} parcele importate` : 'Import finalizat'}</p>
              : <p className="text-sm text-gray-500">Sărit</p>}
          </div>

          {/* Niveluri */}
          {templates.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2"><Layers className="w-4 h-4" /> Niveluri arendă</div>
              {templates.map(t => (
                <p key={t.tid} className="text-sm text-gray-600">{t.product_name || '—'} — {t.level_per_ha}/ha ({t.level_type}) · {t.tax_rate}% impozit</p>
              ))}
            </div>
          )}

          {/* Contracte */}
          {contracts.map((c, i) => {
            const lessorName = c.lessorMode === 'existing' ? c.existingLessorName :
              c.newLessorData.type === 'LEGAL' ? c.newLessorData.company_name : `${c.newLessorData.last_name} ${c.newLessorData.first_name}`.trim()
            const selParcels = parcels.filter(p => c.selectedParcelIds.includes(p.id))
            const totalHa = selParcels.reduce((s, p) => s + (p.surface ?? 0), 0)
            const incomplete = !c.fields.start_date || !c.fields.end_date
            return (
              <div key={c.tid} className={`bg-white rounded-xl border p-4 space-y-2 ${incomplete ? 'border-amber-300' : 'border-gray-200'}`}>
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <FileText className="w-4 h-4" />
                  Contract {i + 1}{c.fields.contract_number ? ` — ${c.fields.contract_number}` : ''}
                  {lessorName && <span className="font-normal text-gray-500 ml-1">· {lessorName}</span>}
                  <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-semibold ${incomplete ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>
                    {incomplete ? 'Incomplet' : 'Complet'}
                  </span>
                </div>
                {c.fields.start_date && <p className="text-sm text-gray-600"><strong>Perioadă:</strong> {c.fields.start_date} → {c.fields.end_date}</p>}
                <p className="text-sm text-gray-600"><strong>Tip:</strong> {c.fields.contract_type} · Impozit: {c.fields.tax_method.replace('_', ' ')}</p>
                {c.rentLevels.filter(l => l.level_per_ha).map(l => (
                  <p key={l.tid} className="text-sm text-gray-600 ml-2">· {l.product_name} {l.level_per_ha}/ha ({l.level_type})</p>
                ))}
                <p className="text-sm text-gray-600"><strong>Parcele:</strong> {c.selectedParcelIds.length} parcele · {totalHa.toFixed(2)} ha</p>
                {selParcels.slice(0, 3).map(p => <p key={p.id} className="text-xs text-gray-400 ml-4 truncate">{parcelLabel(p)}</p>)}
                {selParcels.length > 3 && <p className="text-xs text-gray-400 ml-4">…și {selParcels.length - 3} altele</p>}
                {incomplete && <p className="text-sm text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Lipsesc dată început / sfârșit!</p>}
              </div>
            )
          })}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button onClick={() => setStep(4)} className="flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              <ChevronLeft className="w-4 h-4" /> Editează contractele
            </button>
            <button onClick={() => void finalSave()} disabled={saving || contracts.length === 0}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors">
              {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              Finalizează configurarea ({contracts.length} contract{contracts.length !== 1 ? 'e' : ''})
            </button>
          </div>
        </div>
      )}

      {/* Import modal */}
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

// ─────────────────────────────────────────────────────────────────────────────
// ContractCard
// ─────────────────────────────────────────────────────────────────────────────

interface CCProps {
  c: ContractDraft; lessors: LessorOption[]; products: ProductOption[]; parcels: ParcelRow[]
  search: string; onSearch: (v: string) => void
  onToggle: () => void; onToggleSec: (s: ContractDraft['openSection']) => void
  onRemove: () => void; onField: (f: keyof ContractFields, v: string) => void
  onLessorMode: (m: 'existing' | 'new') => void
  onSelectLessor: (id: string, name: string) => void
  onNewLessor: (f: keyof NewLessorData, v: string) => void
  onToggleParcel: (pid: string) => void; conflict: (pid: string) => string | null
  onAddCRL: () => void; onUpdCRL: (lid: string, f: keyof RentLevelTemplate, v: string) => void; onRemCRL: (lid: string) => void
}

function ContractCard({ c, lessors, products, parcels, search, onSearch, onToggle, onToggleSec, onRemove, onField, onLessorMode, onSelectLessor, onNewLessor, onToggleParcel, conflict, onAddCRL, onUpdCRL, onRemCRL }: CCProps) {
  const lessorName = c.lessorMode === 'existing' ? c.existingLessorName :
    c.newLessorData.type === 'LEGAL' ? c.newLessorData.company_name : `${c.newLessorData.last_name} ${c.newLessorData.first_name}`.trim()
  const selParcels = parcels.filter(p => c.selectedParcelIds.includes(p.id))
  const totalHa = selParcels.reduce((s, p) => s + (p.surface ?? 0), 0)
  const isValid = !!c.fields.start_date && !!c.fields.end_date
  const fp = search
    ? parcels.filter(p => {
      const q = search.toLowerCase()
      return p.bloc_fizic?.toLowerCase().includes(q) || p.tarla_nr?.toLowerCase().includes(q) ||
        p.parcel_nr?.toLowerCase().includes(q) || p.locality?.toLowerCase().includes(q) || p.culture?.toLowerCase().includes(q)
    })
    : parcels

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50" onClick={onToggle}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-gray-900">{c.fields.contract_number || 'Contract fără număr'}</span>
            {lessorName && <span className="text-xs text-gray-500">{lessorName}</span>}
            <span className={`ml-auto flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ${isValid ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
              {isValid ? 'Complet' : 'Incomplet'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 mt-0.5 text-xs text-gray-400">
            {c.selectedParcelIds.length > 0 && <span>{c.selectedParcelIds.length} parcele · {totalHa.toFixed(2)} ha</span>}
            {c.fields.start_date && <span>{c.fields.start_date} → {c.fields.end_date}</span>}
            {c.rentLevels.length > 0 && <span>{c.rentLevels.length} nivel(e) arendă</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={e => { e.stopPropagation(); onRemove() }} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Șterge contract">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          {c.isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {c.isExpanded && (
        <div className="border-t border-gray-100">

          {/* ── A. Detalii ── */}
          {secHdr('A. Detalii contract', c.openSection === 'details', () => onToggleSec('details'),
            c.fields.contract_number ? `Nr. ${c.fields.contract_number}` : undefined)}
          {c.openSection === 'details' && (
            <div className="p-4 space-y-5">
              {/* Identificare */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Identificare</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div><label className={LBL}>Nr. contract</label><input className={INP} value={c.fields.contract_number} onChange={e => onField('contract_number', e.target.value)} placeholder="001/2026" /></div>
                  <div><label className={LBL}>Nr. primărie</label><input className={INP} value={c.fields.primarie_nr} onChange={e => onField('primarie_nr', e.target.value)} /></div>
                  <div><label className={LBL}>Dată primărie</label><input type="date" className={INP} value={c.fields.primarie_date} onChange={e => onField('primarie_date', e.target.value)} /></div>
                  <div>
                    <label className={LBL}>Tip contract</label>
                    <select className={INP} value={c.fields.contract_type} onChange={e => onField('contract_type', e.target.value)}>
                      {[['ARENDA','Arendă'],['CONCESIUNE','Concesiune'],['COMODAT','Comodat'],['ASOCIERE','Asociere în participațiune']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={LBL}>Status</label>
                    <select className={INP} value={c.fields.status} onChange={e => onField('status', e.target.value)}>
                      {[['ACTIVE','Activ'],['DRAFT','Schiță'],['EXPIRED','Expirat']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </div>
                  <div><label className={LBL}>Zonă</label><input className={INP} value={c.fields.zone} onChange={e => onField('zone', e.target.value)} /></div>
                  <div className="col-span-2 sm:col-span-3"><label className={LBL}>Localități</label><input className={INP} value={c.fields.localities} onChange={e => onField('localities', e.target.value)} placeholder="ex: IS, Municipiul Iași" /></div>
                </div>
              </div>

              {/* Perioadă */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Perioadă</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div><label className={LBL}>Dată semnare</label><input type="date" className={INP} value={c.fields.sign_date} onChange={e => onField('sign_date', e.target.value)} /></div>
                  <div><label className={LBL}>Dată început <span className="text-red-500">*</span></label><input type="date" className={INP} value={c.fields.start_date} onChange={e => onField('start_date', e.target.value)} /></div>
                  <div><label className={LBL}>Dată sfârșit <span className="text-red-500">*</span></label><input type="date" className={INP} value={c.fields.end_date} onChange={e => onField('end_date', e.target.value)} /></div>
                </div>
              </div>

              {/* Plată / impozit */}
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Plată / impozit</p>
                <div className="max-w-xs">
                  <label className={LBL}>Metodă plată impozit</label>
                  <select className={INP} value={c.fields.tax_method} onChange={e => onField('tax_method', e.target.value)}>
                    {[['COTA_FORFETARA','Cotă forfetară'],['SISTEM_REAL','Sistem real'],['SCUTIT','Scutit']].map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              </div>

              {/* Niveluri arendă per contract */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Niveluri arendă</p>
                  {products.length > 0 && (
                    <button onClick={onAddCRL} className="flex items-center gap-1 text-xs px-2.5 py-1 text-brand-600 border border-brand-300 rounded-lg hover:bg-brand-50">
                      <Plus className="w-3 h-3" /> Adaugă
                    </button>
                  )}
                </div>
                {c.rentLevels.length === 0 && <p className="text-xs text-gray-400">Niciun nivel pentru acest contract.</p>}
                {c.rentLevels.map(l => (
                  <div key={l.tid} className="flex items-end gap-2 mb-2">
                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <div>
                        <label className={LBL}>Produs</label>
                        <select value={l.product_id} onChange={e => onUpdCRL(l.tid, 'product_id', e.target.value)} className={INP}>
                          <option value="">—</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </div>
                      <div><label className={LBL}>Cant./ha</label><input type="number" className={INP} value={l.level_per_ha} onChange={e => onUpdCRL(l.tid, 'level_per_ha', e.target.value)} /></div>
                      <div>
                        <label className={LBL}>Tip</label>
                        <select value={l.level_type} onChange={e => onUpdCRL(l.tid, 'level_type', e.target.value)} className={INP}>
                          <option value="NET">NET</option><option value="BRUT">BRUT</option>
                        </select>
                      </div>
                      <div><label className={LBL}>Impozit %</label><input type="number" className={INP} value={l.tax_rate} onChange={e => onUpdCRL(l.tid, 'tax_rate', e.target.value)} /></div>
                    </div>
                    <button onClick={() => onRemCRL(l.tid)} className="p-2 text-red-400 hover:text-red-600 mb-0.5"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── B. Arendator ── */}
          {secHdr('B. Arendator', c.openSection === 'lessor', () => onToggleSec('lessor'), lessorName || undefined)}
          {c.openSection === 'lessor' && (
            <div className="p-4 space-y-4">
              <div className="flex gap-2">
                {(['existing', 'new'] as const).map(mode => (
                  <button key={mode} onClick={() => onLessorMode(mode)}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg border transition-colors ${c.lessorMode === mode ? 'bg-brand-600 text-white border-brand-600' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>
                    {mode === 'existing' ? 'Selectează existent' : 'Arendator nou'}
                  </button>
                ))}
              </div>
              {c.lessorMode === 'existing' && (
                lessors.length === 0
                  ? <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">Nu există arendatori. Selectează „Arendator nou".</p>
                  : <div>
                    <label className={LBL}>Arendator</label>
                    <select className={INP} value={c.existingLessorId}
                      onChange={e => { const f = lessors.find(l => l.id === e.target.value); onSelectLessor(e.target.value, f?.label ?? '') }}>
                      <option value="">— Selectează —</option>
                      {lessors.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                    </select>
                  </div>
              )}
              {c.lessorMode === 'new' && (
                <div className="space-y-3">
                  <div>
                    <label className={LBL}>Tip persoană</label>
                    <select className={INP} value={c.newLessorData.type} onChange={e => onNewLessor('type', e.target.value)}>
                      <option value="NATURAL">Persoană fizică</option>
                      <option value="LEGAL">Persoană juridică</option>
                      <option value="PFA">PFA / II / IF</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {(c.newLessorData.type === 'LEGAL' || c.newLessorData.type === 'PFA') && (
                      <div className="col-span-2"><label className={LBL}>Denumire <span className="text-red-500">*</span></label><input className={INP} value={c.newLessorData.company_name} onChange={e => onNewLessor('company_name', e.target.value)} /></div>
                    )}
                    <div><label className={LBL}>Nume <span className="text-red-500">*</span></label><input className={INP} value={c.newLessorData.last_name} onChange={e => onNewLessor('last_name', e.target.value)} /></div>
                    <div><label className={LBL}>Prenume</label><input className={INP} value={c.newLessorData.first_name} onChange={e => onNewLessor('first_name', e.target.value)} /></div>
                    <div><label className={LBL}>CNP / CUI</label><input className={INP} value={c.newLessorData.cnp} onChange={e => onNewLessor('cnp', e.target.value)} /></div>
                    <div><label className={LBL}>Județ</label><input className={INP} value={c.newLessorData.county} onChange={e => onNewLessor('county', e.target.value)} /></div>
                    <div><label className={LBL}>Localitate</label><input className={INP} value={c.newLessorData.locality} onChange={e => onNewLessor('locality', e.target.value)} /></div>
                    <div><label className={LBL}>Telefon</label><input className={INP} value={c.newLessorData.phone} onChange={e => onNewLessor('phone', e.target.value)} /></div>
                    <div><label className={LBL}>Email</label><input type="email" className={INP} value={c.newLessorData.email} onChange={e => onNewLessor('email', e.target.value)} /></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── C. Parcele ── */}
          {secHdr('C. Parcele asociate', c.openSection === 'parcels', () => onToggleSec('parcels'),
            c.selectedParcelIds.length > 0 ? `${c.selectedParcelIds.length} sel. · ${totalHa.toFixed(2)} ha` : undefined)}
          {c.openSection === 'parcels' && (
            <div className="p-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input value={search} onChange={e => onSearch(e.target.value)}
                  placeholder="Caută bloc, tarla, parcelă, cultură, localitate..."
                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
              {c.selectedParcelIds.length > 0 && (
                <div className="flex items-center gap-3 text-sm text-brand-700 bg-brand-50 border border-brand-200 rounded-lg px-3 py-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span><strong>{c.selectedParcelIds.length}</strong> parcele · <strong>{totalHa.toFixed(2)} ha</strong></span>
                  <button onClick={() => c.selectedParcelIds.forEach(pid => onToggleParcel(pid))} className="ml-auto text-xs text-brand-500 hover:text-brand-700 flex items-center gap-0.5">
                    <X className="w-3.5 h-3.5" /> Deselectează
                  </button>
                </div>
              )}
              {parcels.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Nu există parcele. Importă APIA sau adaugă manual din Lista Parcele.</p>
              ) : (
                <div className="border border-gray-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0 border-b border-gray-200">
                      <tr>
                        <th className="px-2 py-2 w-8">
                          <input type="checkbox"
                            checked={fp.length > 0 && fp.every(p => c.selectedParcelIds.includes(p.id))}
                            onChange={e => fp.forEach(p => { const has = c.selectedParcelIds.includes(p.id); if (e.target.checked !== has) onToggleParcel(p.id) })} />
                        </th>
                        <th className="px-2 py-2 text-left font-semibold text-gray-500 uppercase text-[10px]">Bloc / Tarla / Parcelă</th>
                        <th className="px-2 py-2 text-right font-semibold text-gray-500 uppercase text-[10px]">ha</th>
                        <th className="px-2 py-2 text-left font-semibold text-gray-500 uppercase text-[10px]">Cultură</th>
                        <th className="px-2 py-2 text-left font-semibold text-gray-500 uppercase text-[10px] hidden sm:table-cell">Localitate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fp.map(p => {
                        const sel = c.selectedParcelIds.includes(p.id)
                        const conf = conflict(p.id)
                        return (
                          <tr key={p.id} onClick={() => onToggleParcel(p.id)}
                            className={`border-b border-gray-100 cursor-pointer ${sel ? 'bg-brand-50' : 'hover:bg-gray-50'} ${conf ? 'opacity-60' : ''}`}>
                            <td className="px-2 py-1.5 text-center">
                              <input type="checkbox" checked={sel} onChange={() => onToggleParcel(p.id)} onClick={e => e.stopPropagation()} />
                            </td>
                            <td className="px-2 py-1.5">
                              <span className="font-medium text-gray-800">{p.bloc_fizic ?? '—'}</span>
                              {p.tarla_nr && <span className="text-gray-500 ml-1">/T{p.tarla_nr}</span>}
                              {p.parcel_nr && <span className="text-gray-500 ml-1">/P{p.parcel_nr}</span>}
                              {conf && <span className="ml-1 text-[10px] text-amber-600">(și în {conf})</span>}
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
      )}
    </div>
  )
}
