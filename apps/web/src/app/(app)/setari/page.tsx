'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from 'sonner'
import { Plus, Trash2, Building2, Package, Upload, X, FileSpreadsheet, Shield, Wheat } from 'lucide-react'
import { VALID_CASA_ANG } from '@/lib/d112Validator'
import type { Campaign } from '@/lib/campaign-types'

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
  const [tab, setTab] = useState<'company' | 'products' | 'd112' | 'asigurator' | 'campanii'>('company')
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
  }, [])

  async function loadProducts(db = createClient()) {
    const { data, error } = await db.from('products').select('*').order('sort_order').order('name')
    if (error) { toast.error('Eroare la încărcarea produselor.'); return }
    if (data) setProducts(data as Product[])
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
    <div className="max-w-3xl">
      <PageHeader title="Setari" subtitle="Configurare firma si produse" />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        {([
          ['company', Building2, 'Date firma'],
          ['products', Package, 'Produse arenda'],
          ['campanii', Wheat, 'Campanii'],
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
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
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
              <div className="col-span-2">
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
              <div className="col-span-2">
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
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Produse definite
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

      {/* D112 Settings Tab */}
      {tab === 'd112' && (rm onSubmit={saveD112}>
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
    </div>
  )
}
