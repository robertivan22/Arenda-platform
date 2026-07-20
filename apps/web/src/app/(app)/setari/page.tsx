'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from 'sonner'
import { Plus, Trash2, Building2, Package, Upload, X, FileSpreadsheet, Shield, Wheat, Tractor, Users, Mail, UserPlus, Ban, CheckCircle2, Pencil, ChevronDown } from 'lucide-react'
import { VALID_CASA_ANG } from '@/lib/d112Validator'
import type { Campaign } from '@/lib/campaign-types'
import { PREDEFINED_PRODUCTS } from '@/lib/predefined-products'

interface CompanySettings {
  name: string; cif: string; reg_com: string
  address: string; county: string; locality: string
  iban: string; bank_name: string; phone: string; email: string
  invoice_series: string; logo_url?: string
}

interface D112Settings {
  d112_caen: string
  d112_casa_ang: string
  d112_fax_soc: string
  d112_adr_fisc: string
  d112_tel_fisc: string
  d112_fax_fisc: string
  d112_mail_fisc: string
  d112_tip_rec: number
  d112_d_rec: number
  d112_nume_declar: string
  d112_prenume_declar: string
  d112_functie_declar: string
}

interface AsiguratorSettings {
  // Identificare
  asig_cnp: string
  asig_cnp_anterior: string
  asig_nume: string
  asig_prenume: string
  asig_nume_anterior: string
  asig_prenume_anterior: string
  // Date asigurare
  asig_data_ang: string       // dataAng — Dată intrare în categ. asigurat
  asig_data_sf: string        // dataSf — Dată iesire din categ. asigurat
  asig_cis: string            // cisAsig — Cod unic CIS
  asig_casa_sn: string        // casaSn — Casa de asigurări a asiguratului
  // Statut asigurare
  asig_ci: string             // asigCI — 1-asigurat / 2-neasigurat concedii
  asig_so: string             // asigSO — 1-asigurat / 2-neasigurat somaj
  asig_scu: string            // asigScu — PF scutita plata impozit venit
  asig_exc: string            // asigExc — exceptat CAS+CASS salariu minim
  asig_motiv_exc: string      // motivExc — motiv exceptare
}

interface Machine {
  id: string; user_id: string; name: string; type: string
  brand: string | null; model: string | null; year: number | null
  plate: string | null; fuel_type: string; is_active: boolean; notes: string | null
}

interface Product {
  id: string; name: string; unit: string; sort_order: number
}

const EMPTY_COMPANY: CompanySettings = {
  name: '', cif: '', reg_com: '', address: '', county: '', locality: '',
  iban: '', bank_name: '', phone: '', email: '', invoice_series: 'A', logo_url: '',
}

const EMPTY_D112: D112Settings = {
  d112_caen: '0111', d112_casa_ang: 'IS', d112_fax_soc: '',
  d112_adr_fisc: '', d112_tel_fisc: '', d112_fax_fisc: '', d112_mail_fisc: '',
  d112_tip_rec: 0, d112_d_rec: 0,
  d112_nume_declar: '', d112_prenume_declar: '', d112_functie_declar: 'Administrator',
}

export default function SetariPage() {
  const [tab, setTab] = useState<'company' | 'products' | 'd112' | 'asigurator' | 'campanii' | 'utilaje' | 'utilizatori'>('company')
  const [company, setCompany] = useState<CompanySettings>(EMPTY_COMPANY)
  const [savingCompany, setSavingCompany] = useState(false)
  const [d112, setD112] = useState<D112Settings>(EMPTY_D112)
  const [savingD112, setSavingD112] = useState(false)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [savingCampaign, setSavingCampaign] = useState(false)
  const [newCampaign, setNewCampaign] = useState({ name: '', year: new Date().getFullYear(), start_date: '', end_date: '' })
  const [asigurator, setAsigurator] = useState<AsiguratorSettings>({
    asig_cnp: '', asig_cnp_anterior: '',
    asig_nume: '', asig_prenume: '',
    asig_nume_anterior: '', asig_prenume_anterior: '',
    asig_data_ang: '', asig_data_sf: '',
    asig_cis: '', asig_casa_sn: '',
    asig_ci: '1', asig_so: '1',
    asig_scu: '', asig_exc: '0', asig_motiv_exc: '',
  })
  const [savingAsig, setSavingAsig] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [newProduct, setNewProduct] = useState({ name: '', unit: 'kg' })
  const [savingProduct, setSavingProduct] = useState(false)
  const [machines, setMachines] = useState<Machine[]>([])
  const [newMachine, setNewMachine] = useState({ name: '', type: 'TRACTOR', brand: '', model: '', year: '', plate: '', fuel_type: 'motorina', notes: '' })
  const [savingMachine, setSavingMachine] = useState(false)

  // ── Utilizatori state ──────────────────────────────────────────
  type MemberStatus = 'active' | 'suspended' | 'pending'
  type MemberRole = 'administrator' | 'contabil' | 'operator' | 'vizualizare'
  interface FarmMember {
    id: string
    member_id: string | null
    email: string
    display_name: string | null
    role: MemberRole
    status: MemberStatus
    section_permissions: Record<string, boolean>
    created_at: string
  }
  const ROLE_LABELS: Record<MemberRole, string> = {
    administrator: 'Administrator',
    contabil: 'Contabil',
    operator: 'Operator',
    vizualizare: 'Vizualizare',
  }
  const SECTION_KEYS: { key: string; label: string }[] = [
    { key: 'can_dashboard', label: 'Dashboard & Alerte' },
    { key: 'can_arendasi', label: 'Arendatori' },
    { key: 'can_contracte', label: 'Contracte' },
    { key: 'can_parcele', label: 'Parcele' },
    { key: 'can_tranzactii', label: 'Tranzacții' },
    { key: 'can_facturi', label: 'Facturi & e-Transport' },
    { key: 'can_rapoarte', label: 'Rapoarte' },
    { key: 'can_declaratii', label: 'Declarații & APIA' },
    { key: 'can_fitosanitar', label: 'Fitosanitar' },
    { key: 'can_setari', label: 'Setări' },
  ]
  const DEFAULT_PERMS: Record<string, boolean> = {
    can_dashboard: true, can_arendasi: true, can_contracte: true, can_parcele: true,
    can_tranzactii: true, can_facturi: true, can_rapoarte: true, can_declaratii: true,
    can_fitosanitar: true, can_setari: false,
  }
  const [members, setMembers] = useState<FarmMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [addMode, setAddMode] = useState<'invite' | 'create'>('invite')
  const [addEmail, setAddEmail] = useState('')
  const [addRole, setAddRole] = useState<MemberRole>('operator')
  const [addPassword, setAddPassword] = useState('')
  const [addDisplayName, setAddDisplayName] = useState('')
  const [addPerms, setAddPerms] = useState<Record<string, boolean>>({ ...DEFAULT_PERMS })
  const [savingMember, setSavingMember] = useState(false)
  const [editingPermsMemberId, setEditingPermsMemberId] = useState<string | null>(null)
  const [editPerms, setEditPerms] = useState<Record<string, boolean>>({})
  const [savingPerms, setSavingPerms] = useState(false)

  const inputCls = 'w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500'
  const labelCls = 'block text-xs font-medium text-gray-700 mb-1'

  useEffect(() => {
    const db = createClient()
    db.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data, error } = await db.from('company_settings').select('*').eq('user_id', user.id).maybeSingle()
      if (error) { toast.error('Eroare la încărcarea setărilor.'); return }
      if (data) {
        setCompany(data as any)
        setD112({
          d112_caen: (data as any).d112_caen ?? '0111',
          d112_casa_ang: (data as any).d112_casa_ang ?? 'IS',
          d112_fax_soc: (data as any).d112_fax_soc ?? '',
          d112_adr_fisc: (data as any).d112_adr_fisc ?? '',
          d112_tel_fisc: (data as any).d112_tel_fisc ?? '',
          d112_fax_fisc: (data as any).d112_fax_fisc ?? '',
          d112_mail_fisc: (data as any).d112_mail_fisc ?? '',
          d112_tip_rec: (data as any).d112_tip_rec ?? 0,
          d112_d_rec: (data as any).d112_d_rec ?? 0,
          d112_nume_declar: (data as any).d112_nume_declar ?? '',
          d112_prenume_declar: (data as any).d112_prenume_declar ?? '',
          d112_functie_declar: (data as any).d112_functie_declar ?? 'Administrator',
        })
        setAsigurator({
          asig_cnp: (data as any).asig_cnp ?? '',
          asig_cnp_anterior: (data as any).asig_cnp_anterior ?? '',
          asig_nume: (data as any).asig_nume ?? '',
          asig_prenume: (data as any).asig_prenume ?? '',
          asig_nume_anterior: (data as any).asig_nume_anterior ?? '',
          asig_prenume_anterior: (data as any).asig_prenume_anterior ?? '',
          asig_data_ang: (data as any).asig_data_ang ?? '',
          asig_data_sf: (data as any).asig_data_sf ?? '',
          asig_cis: (data as any).asig_cis ?? '',
          asig_casa_sn: (data as any).asig_casa_sn ?? '',
          asig_ci: (data as any).asig_ci ?? '1',
          asig_so: (data as any).asig_so ?? '1',
          asig_scu: (data as any).asig_scu ?? '',
          asig_exc: (data as any).asig_exc ?? '0',
          asig_motiv_exc: (data as any).asig_motiv_exc ?? '',
        })
      }
    })
    loadProducts(db)
    loadCampaigns(db)
    loadMachines(db)
  }, [])

  // ── Utilizatori: load on tab switch ────────────────────────
  useEffect(() => {
    if (tab !== 'utilizatori') return
    loadMembers()
  }, [tab])

  async function loadMembers() {
    setLoadingMembers(true)
    try {
      const res = await fetch('/api/farm-members')
      if (res.ok) {
        const { members: data } = await res.json() as { members: FarmMember[] }
        setMembers(data ?? [])
      }
    } finally {
      setLoadingMembers(false)
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    if (!addEmail) return
    setSavingMember(true)
    try {
      const body: Record<string, unknown> = {
        mode: addMode,
        email: addEmail,
        role: addRole,
        sectionPermissions: addPerms,
      }
      if (addMode === 'create') {
        body.password = addPassword
        body.displayName = addDisplayName
      }
      const res = await fetch('/api/farm-members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Eroare'); return }
      const successMsg = data.message ?? (addMode === 'invite' ? 'Invitație trimisă!' : 'Utilizator creat!')
      toast.success(successMsg)
      setAddEmail(''); setAddPassword(''); setAddDisplayName('')
      setAddPerms({ ...DEFAULT_PERMS })
      await loadMembers()
    } finally {
      setSavingMember(false)
    }
  }

  async function handleSuspend(m: FarmMember) {
    const newStatus = m.status === 'suspended' ? 'active' : 'suspended'
    const res = await fetch(`/api/farm-members/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (res.ok) {
      toast.success(newStatus === 'suspended' ? 'Acces suspendat' : 'Acces reactivat')
      await loadMembers()
    } else {
      const d = await res.json()
      toast.error(d.error ?? 'Eroare')
    }
  }

  async function handleRemove(m: FarmMember) {
    if (!confirm(`Elimini ${m.email} din fermă? Acțiunea este ireversibilă.`)) return
    const res = await fetch(`/api/farm-members/${m.id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Utilizator eliminat'); await loadMembers() }
    else { const d = await res.json(); toast.error(d.error ?? 'Eroare') }
  }

  async function handleSavePerms(m: FarmMember) {
    setSavingPerms(true)
    try {
      const res = await fetch(`/api/farm-members/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionPermissions: editPerms }),
      })
      if (res.ok) { toast.success('Permisiuni salvate'); setEditingPermsMemberId(null); await loadMembers() }
      else { const d = await res.json(); toast.error(d.error ?? 'Eroare') }
    } finally {
      setSavingPerms(false)
    }
  }

  async function loadMachines(db = createClient()) {
    const { data } = await db.from('machines').select('*').order('name')
    if (data) setMachines(data as Machine[])
  }

  async function addMachine(e: React.FormEvent) {
    e.preventDefault()
    if (!newMachine.name.trim()) return
    setSavingMachine(true)
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) { setSavingMachine(false); return }
    const { error } = await db.from('machines').insert({
      user_id: user.id,
      name: newMachine.name.trim(),
      type: newMachine.type,
      brand: newMachine.brand || null,
      model: newMachine.model || null,
      year: newMachine.year ? parseInt(newMachine.year) : null,
      plate: newMachine.plate || null,
      fuel_type: newMachine.fuel_type,
      notes: newMachine.notes || null,
    })
    setSavingMachine(false)
    if (error) { toast.error(error.message); return }
    setNewMachine({ name: '', type: 'TRACTOR', brand: '', model: '', year: '', plate: '', fuel_type: 'motorina', notes: '' })
    toast.success('Utilaj adăugat.')
    loadMachines()
  }

  async function toggleMachineActive(m: Machine) {
    await createClient().from('machines').update({ is_active: !m.is_active }).eq('id', m.id)
    setMachines(prev => prev.map(x => x.id === m.id ? { ...x, is_active: !m.is_active } : x))
  }

  async function deleteMachine(id: string) {
    const { error } = await createClient().from('machines').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    setMachines(m => m.filter(x => x.id !== id))
    toast.success('Utilaj șters.')
  }

  async function loadProducts(db = createClient()) {
    const { data, error } = await db.from('products').select('*').order('sort_order').order('name')
    if (error) { toast.error('Eroare la încărcarea produselor.'); return }
    if (data && data.length === 0) {
      // Auto-seed with predefined list on first use
      await seedDefaultProducts(db)
    } else if (data) {
      setProducts(data as Product[])
    }
  }

  async function seedDefaultProducts(db = createClient()) {
    const { data: { user } } = await db.auth.getUser()
    if (!user) return
    const { error } = await db.from('products').insert(
      PREDEFINED_PRODUCTS.map((p, i) => ({
        user_id: user.id, name: p.name, unit: p.unit, is_active: true, sort_order: i,
      }))
    )
    if (!error) {
      const { data } = await db.from('products').select('*').order('sort_order')
      if (data) setProducts(data as Product[])
      toast.success(`${PREDEFINED_PRODUCTS.length} produse implicite adăugate.`)
    }
  }

  async function loadCampaigns(db = createClient()) {
    const { data } = await db.from('campaigns').select('*').order('year', { ascending: false })
    if (data) setCampaigns(data as Campaign[])
  }

  async function addCampaign(e: React.FormEvent) {
    e.preventDefault()
    if (!newCampaign.year) return
    setSavingCampaign(true)
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) { toast.error('Neautentificat.'); setSavingCampaign(false); return }
    const name = newCampaign.name.trim() || `Campania ${newCampaign.year}`
    const { error } = await db.from('campaigns').insert({
      user_id: user.id,
      name,
      year: newCampaign.year,
      start_date: newCampaign.start_date || `${newCampaign.year}-10-01`,
      end_date: newCampaign.end_date || `${newCampaign.year + 1}-09-30`,
      is_active: campaigns.length === 0,
    })
    setSavingCampaign(false)
    if (error) { toast.error('Eroare: ' + error.message); return }
    setNewCampaign({ name: '', year: new Date().getFullYear(), start_date: '', end_date: '' })
    toast.success(`Campania "${name}" a fost creată.`)
    loadCampaigns()
  }

  async function setActiveCampaign(id: string) {
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return
    // Deactivate all, then activate selected
    await db.from('campaigns').update({ is_active: false }).eq('user_id', user.id)
    await db.from('campaigns').update({ is_active: true }).eq('id', id)
    toast.success('Campania activă a fost schimbată.')
    loadCampaigns()
  }

  async function deleteCampaign(id: string) {
    const { error } = await createClient().from('campaigns').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    setCampaigns(c => c.filter(x => x.id !== id))
    toast.success('Campanie ștearsă.')
  }

  async function saveCompany(e: React.FormEvent) {
    e.preventDefault()
    setSavingCompany(true)
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) { toast.error('Neautentificat.'); setSavingCompany(false); return }
    const { error } = await db.from('company_settings').upsert({ ...company, user_id: user.id }, { onConflict: 'user_id' })
    setSavingCompany(false)
    if (error) { toast.error('Eroare: ' + error.message); return }
    toast.success('Setarile firmei au fost salvate.')
  }

  async function saveD112(e: React.FormEvent) {
    e.preventDefault()
    setSavingD112(true)
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) { toast.error('Neautentificat.'); setSavingD112(false); return }
    const { error } = await db.from('company_settings').upsert(
      { ...d112, user_id: user.id },
      { onConflict: 'user_id' },
    )
    setSavingD112(false)
    if (error) { toast.error('Eroare: ' + error.message); return }
    toast.success('Setarile D112 au fost salvate.')
  }

  async function saveAsigurator(e: React.FormEvent) {
    e.preventDefault()
    setSavingAsig(true)
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) { toast.error('Neautentificat.'); setSavingAsig(false); return }
    const { error } = await db.from('company_settings').upsert(
      { ...asigurator, user_id: user.id },
      { onConflict: 'user_id' },
    )
    setSavingAsig(false)
    if (error) { toast.error('Eroare: ' + error.message); return }
    toast.success('Datele asigurătorului au fost salvate.')
  }

  async function addProduct(e: React.FormEvent) {
    e.preventDefault()
    if (!newProduct.name.trim()) return
    setSavingProduct(true)
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) { toast.error('Neautentificat.'); setSavingProduct(false); return }
    const { error } = await db.from('products').insert({
      user_id: user.id,
      name: newProduct.name.trim(),
      unit: newProduct.unit,
      sort_order: products.length,
    })
    setSavingProduct(false)
    if (error) { toast.error('Eroare: ' + error.message); return }
    setNewProduct({ name: '', unit: 'kg' })
    loadProducts()
  }

  async function deleteProduct(id: string) {
    const { error } = await createClient().from('products').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    setProducts(p => p.filter(x => x.id !== id))
  }

  return (
    <div className="w-full">
      <PageHeader title="Setari" subtitle="Configurare firma si produse" />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        {([
          ['company', Building2, 'Date firma'],
          ['products', Package, 'Produse arenda'],
          ['campanii', Wheat, 'Campanii'],
          ['utilaje', Tractor, 'Utilaje'],
          ['utilizatori', Users, 'Utilizatori & Acces'],
          ['d112', FileSpreadsheet, 'Date Declaratie 112'],
          ['asigurator', Shield, 'Date Asigurator'],
        ] as const).map(([key, Icon, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-md transition-colors ${
              tab === key ? 'bg-white shadow text-brand-700 font-medium' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* Company Settings Tab */}
      {tab === 'company' && (
        <form onSubmit={saveCompany}>
          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-4">
            <p className="text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded p-2">
              Aceste date apar ca <strong>Furnizor</strong> pe facturile fiscale si avizele de insotire a marfii.
            </p>
            <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
              <div className="col-span-2 xl:col-span-4">
                <label className={labelCls}>Denumire firma *</label>
                <input className={inputCls} value={company.name} onChange={e => setCompany(p => ({...p, name: e.target.value}))} required />
              </div>
              <div>
                <label className={labelCls}>CIF / CUI</label>
                <input className={inputCls} value={company.cif} onChange={e => setCompany(p => ({...p, cif: e.target.value}))} />
              </div>
              <div>
                <label className={labelCls}>Nr. Reg. Comert</label>
                <input className={inputCls} value={company.reg_com} onChange={e => setCompany(p => ({...p, reg_com: e.target.value}))} />
              </div>
              <div className="col-span-2 xl:col-span-2">
                <label className={labelCls}>Adresa</label>
                <input className={inputCls} value={company.address} onChange={e => setCompany(p => ({...p, address: e.target.value}))} />
              </div>
              <div>
                <label className={labelCls}>Judet</label>
                <input className={inputCls} value={company.county} onChange={e => setCompany(p => ({...p, county: e.target.value}))} />
              </div>
              <div>
                <label className={labelCls}>Localitate</label>
                <input className={inputCls} value={company.locality} onChange={e => setCompany(p => ({...p, locality: e.target.value}))} />
              </div>
              <div>
                <label className={labelCls}>IBAN</label>
                <input className={inputCls} value={company.iban} onChange={e => setCompany(p => ({...p, iban: e.target.value}))} />
              </div>
              <div>
                <label className={labelCls}>Banca</label>
                <input className={inputCls} value={company.bank_name} onChange={e => setCompany(p => ({...p, bank_name: e.target.value}))} />
              </div>
              <div>
                <label className={labelCls}>Telefon</label>
                <input className={inputCls} value={company.phone} onChange={e => setCompany(p => ({...p, phone: e.target.value}))} />
              </div>
              <div>
                <label className={labelCls}>Email</label>
                <input className={inputCls} type="email" value={company.email} onChange={e => setCompany(p => ({...p, email: e.target.value}))} />
              </div>
              <div>
                <label className={labelCls}>Serie factura</label>
                <input className={inputCls} value={company.invoice_series} onChange={e => setCompany(p => ({...p, invoice_series: e.target.value.toUpperCase()}))} maxLength={5} />
              </div>
              <div className="col-span-2 xl:col-span-4">
                <label className={labelCls}>Logo firmă (apare pe facturi, avize, contracte)</label>
                <div className="flex items-center gap-3 mt-1">
                  {company.logo_url && (
                    <img src={company.logo_url} alt="Logo" className="h-12 border border-gray-200 rounded p-1 bg-white object-contain" />
                  )}
                  <label className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded cursor-pointer hover:bg-gray-50">
                    <Upload className="w-3.5 h-3.5" /> Încarcă logo
                    <input type="file" accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml" className="hidden" onChange={e => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      if (file.size > 150 * 1024) { toast.error('Fișierul este prea mare (max 150KB)'); return }
                      const reader = new FileReader()
                      reader.onload = ev => setCompany(p => ({...p, logo_url: ev.target?.result as string ?? ''}))
                      reader.readAsDataURL(file)
                    }} />
                  </label>
                  {company.logo_url && (
                    <button type="button" onClick={() => setCompany(p => ({...p, logo_url: ''}))} className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700">
                      <X className="w-3 h-3" /> Șterge logo
                    </button>
                  )}
                  <span className="text-xs text-gray-400">PNG, JPG, SVG — max 150KB</span>
                </div>
              </div>
            </div>
            <button type="submit" disabled={savingCompany} className="px-5 py-2 bg-brand-600 text-white text-sm rounded hover:bg-brand-700 disabled:opacity-50">
              {savingCompany ? 'Se salveaza...' : 'Salveaza setarile'}
            </button>
          </div>
        </form>
      )}

      {/* Products Tab */}
      {tab === 'products' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Produse definite</span>
              <button type="button" onClick={() => void seedDefaultProducts()}
                className="text-xs px-3 py-1 border border-brand-300 text-brand-600 rounded-lg hover:bg-brand-50 transition-colors">
                Populează lista implicită
              </button>
            </div>
            {products.length === 0 && (
              <p className="px-4 py-6 text-sm text-gray-400 text-center">Niciun produs definit.</p>
            )}
            {products.map(p => (
              <div key={p.id} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 last:border-0">
                <div>
                  <span className="font-medium text-sm text-gray-900">{p.name}</span>
                  <span className="ml-2 text-xs text-gray-400">{p.unit}</span>
                </div>
                <button onClick={() => deleteProduct(p.id)} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={addProduct} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-3">Adauga produs nou</div>
            <div className="flex gap-2">
              <input
                className="flex-1 min-w-0 px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="Denumire produs (ex: Grau, Porumb, RON)"
                value={newProduct.name}
                onChange={e => setNewProduct(p => ({...p, name: e.target.value}))}
              />
              <select
                className="w-24 shrink-0 px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={newProduct.unit}
                onChange={e => setNewProduct(p => ({...p, unit: e.target.value}))}
              >
                <option value="kg">kg</option>
                <option value="t">tone</option>
                <option value="RON">RON</option>
                <option value="EUR">EUR</option>
              </select>
              <button type="submit" disabled={savingProduct} className="flex items-center gap-1.5 px-4 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-sm rounded font-medium disabled:opacity-50">
                <Plus className="w-3.5 h-3.5" /> Adauga
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Campanii Tab */}
      {tab === 'campanii' && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-5">
          <p className="text-xs text-gray-500">
            O campanie agricolă reprezintă un sezon de producție (ex: <strong>Toamnă 2024 — Vară 2025</strong>). Toate planurile de cultură, activitățile câmpului și distribuțiile sunt legate de o campanie activă.
          </p>

          {/* Existing campaigns */}
          {campaigns.length > 0 && (
            <div className="space-y-2">
              {campaigns.map(c => (
                <div key={c.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-800">{c.name}</span>
                      {c.is_active && (
                        <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded-full font-medium">Activă</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {c.year} · {c.start_date ? new Date(c.start_date).toLocaleDateString('ro-RO') : '—'} — {c.end_date ? new Date(c.end_date).toLocaleDateString('ro-RO') : '—'}
                    </div>
                  </div>
                  {!c.is_active && (
                    <button
                      type="button"
                      onClick={() => void setActiveCampaign(c.id)}
                      className="text-xs px-2.5 py-1 border border-brand-300 text-brand-600 rounded hover:bg-brand-50 transition-colors"
                    >
                      Setează activă
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void deleteCampaign(c.id)}
                    className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                    title="Șterge campanie"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Create new campaign */}
          <form onSubmit={e => void addCampaign(e)} className="border-t border-gray-100 pt-4">
            <p className="text-xs font-medium text-gray-700 mb-3">Campanie nouă</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Denumire campanie</label>
                <input
                  className={inputCls}
                  placeholder={`Campania ${newCampaign.year}`}
                  value={newCampaign.name}
                  onChange={e => setNewCampaign(p => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>An agricol *</label>
                <input
                  className={inputCls}
                  type="number"
                  min={2000}
                  max={2100}
                  required
                  value={newCampaign.year}
                  onChange={e => setNewCampaign(p => ({ ...p, year: Number(e.target.value) }))}
                />
              </div>
              <div>
                <label className={labelCls}>Dată început</label>
                <input
                  className={inputCls}
                  type="date"
                  value={newCampaign.start_date}
                  onChange={e => setNewCampaign(p => ({ ...p, start_date: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>Dată sfârșit</label>
                <input
                  className={inputCls}
                  type="date"
                  value={newCampaign.end_date}
                  onChange={e => setNewCampaign(p => ({ ...p, end_date: e.target.value }))}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={savingCampaign}
              className="mt-3 flex items-center gap-1.5 px-4 py-2 text-sm bg-brand-600 text-white rounded hover:bg-brand-700 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              {savingCampaign ? 'Se salvează...' : 'Adaugă campanie'}
            </button>
          </form>
        </div>
      )}

      {/* Utilaje Tab */}
      {tab === 'utilaje' && (
        <div className="bg-white rounded-lg border border-gray-200 p-8 flex flex-col items-center justify-center gap-4 text-center">
          <Tractor className="w-10 h-10 text-gray-300" />
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-1">Gestionare Parc Utilaje</p>
            <p className="text-xs text-gray-500 max-w-xs">
              Utilajele, implementurile și operatorii se gestionează în secțiunea dedicată,
              cu jurnal de lucru, consum combustibil și calendar de mentenanță.
            </p>
          </div>
          <a href="/utilaje"
            className="flex items-center gap-1.5 px-5 py-2 bg-brand-600 text-white text-sm rounded-lg hover:bg-brand-700">
            Deschide Parc Utilaje →
          </a>
        </div>
      )}

      {/* D112 Settings Tab */}
      {tab === 'd112' && (
        <form onSubmit={saveD112}>
          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-5">
            <p className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded p-2">
              Aceste date sunt utilizate automat la generarea si exportul XML/PDF D112. Completeaza toate campurile marcate cu *.
            </p>

            {/* Section: Declarant */}
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 pb-1 border-b border-gray-100">
                Reprezentant / Declarant
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nume declarant *</label>
                  <input className={inputCls} value={d112.d112_nume_declar} onChange={e => setD112(p => ({...p, d112_nume_declar: e.target.value.toUpperCase()}))} placeholder="ex. POPESCU" required />
                </div>
                <div>
                  <label className={labelCls}>Prenume declarant *</label>
                  <input className={inputCls} value={d112.d112_prenume_declar} onChange={e => setD112(p => ({...p, d112_prenume_declar: e.target.value.toUpperCase()}))} placeholder="ex. ION" required />
                </div>
                <div>
                  <label className={labelCls}>Functie declarant *</label>
                  <input className={inputCls} value={d112.d112_functie_declar} onChange={e => setD112(p => ({...p, d112_functie_declar: e.target.value}))} placeholder="ex. Administrator" required />
                </div>
              </div>
            </div>

            {/* Section: Date fiscale D112 */}
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 pb-1 border-b border-gray-100">
                Date fiscale D112
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Cod CAEN *</label>
                  <input className={inputCls} value={d112.d112_caen} onChange={e => setD112(p => ({...p, d112_caen: e.target.value}))} placeholder="ex. 0111" maxLength={6} required />
                </div>
                <div>
                  <label className={labelCls}>Casa asig. sanatate angajator *</label>
                  <select className={inputCls} value={d112.d112_casa_ang} onChange={e => setD112(p => ({...p, d112_casa_ang: e.target.value}))} required>
                    {[...VALID_CASA_ANG].sort().map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Tip declaratie</label>
                  <select className={inputCls} value={d112.d112_tip_rec} onChange={e => setD112(p => ({...p, d112_tip_rec: Number(e.target.value), d112_d_rec: Number(e.target.value) === 0 ? 0 : p.d112_d_rec}))}>
                    <option value={0}>0 - Declaratie normala</option>
                    <option value={1}>1 - Declaratie rectificativa</option>
                  </select>
                </div>
                {d112.d112_tip_rec === 1 && (
                  <div>
                    <label className={labelCls}>Luna declaratiei rectificate</label>
                    <select className={inputCls} value={d112.d112_d_rec} onChange={e => setD112(p => ({...p, d112_d_rec: Number(e.target.value)}))}>
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className={labelCls}>Fax social</label>
                  <input className={inputCls} value={d112.d112_fax_soc} onChange={e => setD112(p => ({...p, d112_fax_soc: e.target.value}))} placeholder="ex. +40232123456" />
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                CIF, denumire, adresa sociala, telefon si email sunt preluate automat din tab-ul Date firma.
              </p>
            </div>

            {/* Section: Adresa fiscala */}
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 pb-1 border-b border-gray-100">
                Adresa fiscala (optional — completeaza doar daca difera de adresa sociala)
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={labelCls}>Adresa fiscala</label>
                  <input className={inputCls} value={d112.d112_adr_fisc} onChange={e => setD112(p => ({...p, d112_adr_fisc: e.target.value}))} placeholder="Strada, nr., localitate, judet" />
                </div>
                <div>
                  <label className={labelCls}>Telefon fiscal</label>
                  <input className={inputCls} value={d112.d112_tel_fisc} onChange={e => setD112(p => ({...p, d112_tel_fisc: e.target.value}))} />
                </div>
                <div>
                  <label className={labelCls}>Fax fiscal</label>
                  <input className={inputCls} value={d112.d112_fax_fisc} onChange={e => setD112(p => ({...p, d112_fax_fisc: e.target.value}))} />
                </div>
                <div>
                  <label className={labelCls}>Email fiscal</label>
                  <input className={inputCls} type="email" value={d112.d112_mail_fisc} onChange={e => setD112(p => ({...p, d112_mail_fisc: e.target.value}))} />
                </div>
              </div>
            </div>

            <button type="submit" disabled={savingD112} className="px-5 py-2 bg-brand-600 text-white text-sm rounded hover:bg-brand-700 disabled:opacity-50">
              {savingD112 ? 'Se salveaza...' : 'Salveaza setarile D112'}
            </button>
          </div>
        </form>
      )}

      {/* Asigurator Tab */}
      {tab === 'asigurator' && (
        <form onSubmit={saveAsigurator}>
          <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-5">

            {/* Section: DATE DE IDENTIFICARE ASIGURAT */}
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 pb-1 border-b border-gray-100">
                DATE DE IDENTIFICARE ASIGURAT — Anexa 1.2 D112
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>1. CNP / NIF <span className="text-gray-400 font-normal">(cnp)</span></label>
                  <input className={inputCls} maxLength={13}
                    value={asigurator.asig_cnp}
                    onChange={e => setAsigurator(p => ({ ...p, asig_cnp: e.target.value }))}
                    placeholder="ex. 1234567890123" />
                </div>
                <div>
                  <label className={labelCls}>2. CNP / NIF anterior <span className="text-gray-400 font-normal">(cnpAnt)</span></label>
                  <input className={inputCls} maxLength={13}
                    value={asigurator.asig_cnp_anterior}
                    onChange={e => setAsigurator(p => ({ ...p, asig_cnp_anterior: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>3. Nume <span className="text-gray-400 font-normal">(numeSn)</span></label>
                  <input className={inputCls}
                    value={asigurator.asig_nume}
                    onChange={e => setAsigurator(p => ({ ...p, asig_nume: e.target.value.toUpperCase() }))}
                    placeholder="ex. POPESCU" />
                </div>
                <div>
                  <label className={labelCls}>4. Nume anterior <span className="text-gray-400 font-normal">(numeAnt)</span></label>
                  <input className={inputCls}
                    value={asigurator.asig_nume_anterior}
                    onChange={e => setAsigurator(p => ({ ...p, asig_nume_anterior: e.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <label className={labelCls}>Prenume <span className="text-gray-400 font-normal">(prenumeSn)</span></label>
                  <input className={inputCls}
                    value={asigurator.asig_prenume}
                    onChange={e => setAsigurator(p => ({ ...p, asig_prenume: e.target.value.toUpperCase() }))}
                    placeholder="ex. ION" />
                </div>
                <div>
                  <label className={labelCls}>Prenume anterior <span className="text-gray-400 font-normal">(prenumeAnt)</span></label>
                  <input className={inputCls}
                    value={asigurator.asig_prenume_anterior}
                    onChange={e => setAsigurator(p => ({ ...p, asig_prenume_anterior: e.target.value.toUpperCase() }))} />
                </div>
              </div>
            </div>

            {/* Section: Date intrare / iesire + CIS + Casa */}
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 pb-1 border-b border-gray-100">
                Date asigurare
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>5. Dată intrare categ. asigurat <span className="text-gray-400 font-normal">(dataAng)</span></label>
                  <input className={inputCls} type="date"
                    value={asigurator.asig_data_ang}
                    onChange={e => setAsigurator(p => ({ ...p, asig_data_ang: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>6. Dată ieșire categ. asigurat <span className="text-gray-400 font-normal">(dataSf)</span></label>
                  <input className={inputCls} type="date"
                    value={asigurator.asig_data_sf}
                    onChange={e => setAsigurator(p => ({ ...p, asig_data_sf: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Cod unic identificare CIS <span className="text-gray-400 font-normal">(cisAsig — doar pt. NIF asigurat)</span></label>
                  <input className={inputCls}
                    value={asigurator.asig_cis}
                    onChange={e => setAsigurator(p => ({ ...p, asig_cis: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>7. Casa de asigurări de sănătate a asiguratului <span className="text-gray-400 font-normal">(casaSn)</span></label>
                  <select className={inputCls}
                    value={asigurator.asig_casa_sn}
                    onChange={e => setAsigurator(p => ({ ...p, asig_casa_sn: e.target.value }))}>
                    <option value="">— Selectează —</option>
                    {[...VALID_CASA_ANG].sort().map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Section: Status asigurare */}
            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 pb-1 border-b border-gray-100">
                Statut asigurare
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>8. Asigurat concedii/indemnizații <span className="text-gray-400 font-normal">(asigCI)</span></label>
                  <select className={inputCls}
                    value={asigurator.asig_ci}
                    onChange={e => setAsigurator(p => ({ ...p, asig_ci: e.target.value }))}>
                    <option value="1">1 — asigurat</option>
                    <option value="2">2 — neasigurat</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>9. Asigurat șomaj <span className="text-gray-400 font-normal">(asigSO)</span></label>
                  <select className={inputCls}
                    value={asigurator.asig_so}
                    onChange={e => setAsigurator(p => ({ ...p, asig_so: e.target.value }))}>
                    <option value="1">1 — asigurat</option>
                    <option value="2">2 — neasigurat</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>10. PF scutită plată impozit venit <span className="text-gray-400 font-normal">(asigScu)</span></label>
                  <input className={inputCls}
                    value={asigurator.asig_scu}
                    onChange={e => setAsigurator(p => ({ ...p, asig_scu: e.target.value }))}
                    placeholder="cf. art. ... din CF" />
                </div>
                <div>
                  <label className={labelCls}>11. Exceptat plată CAS+CASS salariu minim <span className="text-gray-400 font-normal">(asigExc)</span></label>
                  <select className={inputCls}
                    value={asigurator.asig_exc}
                    onChange={e => setAsigurator(p => ({ ...p, asig_exc: e.target.value }))}>
                    <option value="0">0 — nu e cazul</option>
                    <option value="1">1 — exceptat cf. art.146(5^7) CF</option>
                    <option value="2">2 — exceptat cf. art.168(6^1) CF</option>
                  </select>
                </div>
                {asigurator.asig_exc !== '0' && (
                  <div className="col-span-2">
                    <label className={labelCls}>12. Motiv exceptare CAS+CASS salariu minim <span className="text-gray-400 font-normal">(motivExc)</span></label>
                    <textarea className={inputCls} rows={2}
                      value={asigurator.asig_motiv_exc}
                      onChange={e => setAsigurator(p => ({ ...p, asig_motiv_exc: e.target.value }))}
                      placeholder="cf. art.146(5^7) din CF, daca e cazul" />
                  </div>
                )}
              </div>
            </div>

            <button type="submit" disabled={savingAsig} className="px-5 py-2 bg-brand-600 text-white text-sm rounded hover:bg-brand-700 disabled:opacity-50">
              {savingAsig ? 'Se salveaza...' : 'Salveaza date asigurat D112'}
            </button>
          </div>
        </form>
      )}

      {/* ═══════════════════════════════════════════════════════
          UTILIZATORI & ACCES TAB
          ═══════════════════════════════════════════════════════ */}
      {tab === 'utilizatori' && (
        <div className="space-y-6">

          {/* ── Info banner ─────────────────────────────────── */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
            <Shield className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-900">Acces multi-utilizator</p>
              <p className="text-xs text-amber-700 mt-0.5">
                Adaugă colaboratori care pot accesa ferma ta. Poți controla ce secțiuni vede fiecare utilizator
                și ce rol are: <strong>Administrator</strong> (acces complet), <strong>Contabil</strong> (financiar),{' '}
                <strong>Operator</strong> (operațional) sau <strong>Vizualizare</strong> (citire).
              </p>
            </div>
          </div>

          {/* ── Members list ────────────────────────────────── */}
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">Utilizatori activi</h3>
              <span className="text-xs text-gray-400">{members.length} {members.length === 1 ? 'utilizator' : 'utilizatori'}</span>
            </div>

            {loadingMembers ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">Se încarcă...</div>
            ) : members.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <Users className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Niciun colaborator adăugat încă.</p>
                <p className="text-xs text-gray-400 mt-1">Adaugă primul utilizator folosind formularul de mai jos.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {members.map(m => (
                  <div key={m.id} className="px-5 py-3.5">
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0 uppercase">
                        {(m.display_name ?? m.email).charAt(0)}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {m.display_name && (
                            <span className="text-sm font-medium text-gray-800">{m.display_name}</span>
                          )}
                          <span className="text-xs text-gray-500">{m.email}</span>
                          {/* Role badge */}
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            m.role === 'administrator' ? 'bg-purple-100 text-purple-700' :
                            m.role === 'contabil' ? 'bg-blue-100 text-blue-700' :
                            m.role === 'operator' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {ROLE_LABELS[m.role]}
                          </span>
                          {/* Status badge */}
                          {m.status === 'suspended' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-600">
                              Suspendat
                            </span>
                          )}
                          {m.status === 'pending' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                              Invitație în așteptare
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          Adăugat {new Date(m.created_at).toLocaleDateString('ro-RO')}
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => {
                            if (editingPermsMemberId === m.id) { setEditingPermsMemberId(null) }
                            else { setEditingPermsMemberId(m.id); setEditPerms({ ...m.section_permissions }) }
                          }}
                          title="Permisiuni secțiuni"
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleSuspend(m)}
                          title={m.status === 'suspended' ? 'Reactivează' : 'Suspendă acces'}
                          className={`p-1.5 rounded transition-colors ${
                            m.status === 'suspended'
                              ? 'hover:bg-green-50 text-green-600 hover:text-green-700'
                              : 'hover:bg-amber-50 text-amber-500 hover:text-amber-700'
                          }`}
                        >
                          {m.status === 'suspended' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                        </button>
                        <button
                          onClick={() => handleRemove(m)}
                          title="Elimină utilizator"
                          className="p-1.5 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* ── Permissions editor ─────────────────── */}
                    {editingPermsMemberId === m.id && (
                      <div className="mt-3 ml-11 bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <p className="text-xs font-medium text-gray-700 mb-2">Secțiuni vizibile</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
                          {SECTION_KEYS.map(({ key, label }) => (
                            <label key={key} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                              <input
                                type="checkbox"
                                className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                checked={editPerms[key] !== false}
                                onChange={e => setEditPerms(p => ({ ...p, [key]: e.target.checked }))}
                              />
                              {label}
                            </label>
                          ))}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSavePerms(m)}
                            disabled={savingPerms}
                            className="px-3 py-1.5 bg-brand-600 text-white text-xs rounded hover:bg-brand-700 disabled:opacity-50"
                          >
                            {savingPerms ? 'Se salvează...' : 'Salvează'}
                          </button>
                          <button
                            onClick={() => setEditingPermsMemberId(null)}
                            className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded hover:bg-gray-200"
                          >
                            Anulează
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Add member form ─────────────────────────────── */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Adaugă utilizator nou</h3>

            {/* Mode selector */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-5 w-fit">
              <button
                onClick={() => setAddMode('invite')}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-xs rounded-md transition-colors ${
                  addMode === 'invite' ? 'bg-white shadow text-brand-700 font-medium' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Mail className="w-3.5 h-3.5" /> Invitație email
              </button>
              <button
                onClick={() => setAddMode('create')}
                className={`flex items-center gap-1.5 px-4 py-1.5 text-xs rounded-md transition-colors ${
                  addMode === 'create' ? 'bg-white shadow text-brand-700 font-medium' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" /> Creare directă
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Email *</label>
                  <input
                    type="email"
                    required
                    className={inputCls}
                    value={addEmail}
                    onChange={e => setAddEmail(e.target.value)}
                    placeholder="colaborator@exemplu.ro"
                  />
                </div>
                <div>
                  <label className={labelCls}>Rol *</label>
                  <select className={inputCls} value={addRole} onChange={e => setAddRole(e.target.value as MemberRole)}>
                    <option value="administrator">Administrator — acces complet (fără utilizatori)</option>
                    <option value="contabil">Contabil — financiar + vizualizare</option>
                    <option value="operator">Operator — date operaționale + vizualizare</option>
                    <option value="vizualizare">Vizualizare — doar citire</option>
                  </select>
                </div>

                {addMode === 'create' && (
                  <>
                    <div>
                      <label className={labelCls}>Nume afișat</label>
                      <input
                        className={inputCls}
                        value={addDisplayName}
                        onChange={e => setAddDisplayName(e.target.value)}
                        placeholder="ex: Ion Popescu"
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Parolă temporară *</label>
                      <input
                        type="password"
                        required={addMode === 'create'}
                        minLength={8}
                        className={inputCls}
                        value={addPassword}
                        onChange={e => setAddPassword(e.target.value)}
                        placeholder="Minim 8 caractere"
                      />
                      <p className="text-[10px] text-gray-400 mt-1">
                        Comunică parola utilizatorului pe un canal separat (SMS, telefon).
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Permissions for new member */}
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <p className="text-xs font-medium text-gray-700 mb-3">Secțiuni vizibile pentru utilizatorul nou</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                  {SECTION_KEYS.map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                        checked={addPerms[key] !== false}
                        onChange={e => setAddPerms(p => ({ ...p, [key]: e.target.checked }))}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 mt-3">
                  <button type="button" onClick={() => setAddPerms(Object.fromEntries(SECTION_KEYS.map(s => [s.key, true])))}
                    className="text-[10px] text-brand-600 hover:underline">Selectează tot</button>
                  <span className="text-gray-300">·</span>
                  <button type="button" onClick={() => setAddPerms(Object.fromEntries(SECTION_KEYS.map(s => [s.key, false])))}
                    className="text-[10px] text-gray-500 hover:underline">Deselectează tot</button>
                </div>
              </div>

              {addMode === 'invite' && (
                <p className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded p-2.5">
                  <strong>Invitație email:</strong> Utilizatorul va primi un email Supabase cu un link de activare.
                  După ce accesează linkul, contul îi este activat automat și are acces la ferma ta.
                </p>
              )}
              {addMode === 'create' && (
                <p className="text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded p-2.5">
                  <strong>Creare directă:</strong> Contul este creat imediat și activ. Comunică emailul și parola
                  utilizatorului pe un canal securizat (nu prin email).
                </p>
              )}

              <button
                type="submit"
                disabled={savingMember}
                className="flex items-center gap-2 px-5 py-2 bg-brand-600 text-white text-sm rounded hover:bg-brand-700 disabled:opacity-50 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                {savingMember
                  ? 'Se procesează...'
                  : addMode === 'invite' ? 'Trimite invitație' : 'Creează utilizator'}
              </button>
            </form>
          </div>

          {/* ── Role descriptions ────────────────────────────── */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Descriere roluri</h3>
            <div className="space-y-2.5">
              {[
                { role: 'administrator', color: 'purple', desc: 'Acces complet la toate secțiunile. Poate adăuga/modifica date operaționale, financiare și de raportare. Nu poate gestiona alți administratori sau contul proprietarului.' },
                { role: 'contabil', color: 'blue', desc: 'Vizualizare completă + editare în secțiunile financiare (facturi, tranzacții, declarații). Nu poate modifica contracte, parcele sau utilaje.' },
                { role: 'operator', color: 'green', desc: 'Vizualizare completă + editare date operaționale (arendatori, contracte, parcele, utilaje, fitosanitar). Nu poate accesa secțiunile financiare.' },
                { role: 'vizualizare', color: 'gray', desc: 'Citire în secțiunile permise. Nu poate adăuga sau modifica niciun date.' },
              ].map(({ role, color, desc }) => (
                <div key={role} className="flex gap-3">
                  <span className={`inline-flex items-center self-start mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-${color}-100 text-${color}-700 flex-shrink-0`}>
                    {ROLE_LABELS[role as MemberRole]}
                  </span>
                  <p className="text-xs text-gray-600">{desc}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}
    </div>
  )
}
