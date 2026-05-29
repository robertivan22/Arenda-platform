'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from 'sonner'
import { Plus, Trash2, Building2, Package, Upload, X, FileSpreadsheet, Shield } from 'lucide-react'
import { VALID_CASA_ANG } from '@/lib/d112Validator'

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
  asig_denumire_cas: string       // Denumire completă CAS (ex: Casa Județeană de Asigurări PH)
  asig_nr_contract_cas: string    // Nr. contract cu CAS
  asig_data_contract_cas: string  // Data contract CAS
  asig_cont_plata: string         // Cont IBAN plată contribuții CASS
  asig_banca_plata: string        // Banca cont plată contribuții
  asig_cod_unic: string           // Cod unic înregistrare la CAS
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
  const [tab, setTab] = useState<'company' | 'products' | 'd112' | 'asigurator'>('company')
  const [company, setCompany] = useState<CompanySettings>(EMPTY_COMPANY)
  const [savingCompany, setSavingCompany] = useState(false)
  const [d112, setD112] = useState<D112Settings>(EMPTY_D112)
  const [savingD112, setSavingD112] = useState(false)
  const [asigurator, setAsigurator] = useState<AsiguratorSettings>({
    asig_denumire_cas: '', asig_nr_contract_cas: '', asig_data_contract_cas: '',
    asig_cont_plata: '', asig_banca_plata: '', asig_cod_unic: '',
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
          asig_denumire_cas: (data as any).asig_denumire_cas ?? '',
          asig_nr_contract_cas: (data as any).asig_nr_contract_cas ?? '',
          asig_data_contract_cas: (data as any).asig_data_contract_cas ?? '',
          asig_cont_plata: (data as any).asig_cont_plata ?? '',
          asig_banca_plata: (data as any).asig_banca_plata ?? '',
          asig_cod_unic: (data as any).asig_cod_unic ?? '',
        })
      }
    })
    loadProducts(db)
  }, [])

  async function loadProducts(db = createClient()) {
    const { data, error } = await db.from('products').select('*').order('sort_order').order('name')
    if (error) { toast.error('Eroare la încărcarea produselor.'); return }
    if (data) setProducts(data as Product[])
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
            <p className="text-xs text-gray-500 bg-blue-50 border border-blue-200 rounded p-3 space-y-1">
              <strong className="block">Date asigurător — mapate în XML D112</strong>
              Aceste date descriu <strong>Casa de Asigurări de Sănătate (CAS)</strong> la care este înregistrat angajatorul.
              În XML D112, câmpurile se regăsesc în secțiunea <code>Angajator › CasaAngajatorCod</code> și
              în blocul de contribuții. Codul CAS (<em>d112_casa_ang</em>) este deja configurat în tab-ul
              <em> Date Declarație 112</em> — acest tab completează datele suplimentare necesare pentru contractul de asigurare.
            </p>

            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 pb-1 border-b border-gray-100">
                Identificare CAS / Asigurător
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={labelCls}>Denumire CAS angajator <span className="text-gray-400">(XML: <code>NumeCAS</code>)</span></label>
                  <input className={inputCls}
                    value={asigurator.asig_denumire_cas}
                    onChange={e => setAsigurator(p => ({ ...p, asig_denumire_cas: e.target.value }))}
                    placeholder="ex. Casa Județeană de Asigurări de Sănătate Prahova" />
                </div>
                <div>
                  <label className={labelCls}>Cod unic CAS <span className="text-gray-400">(XML: <code>CodUnicAsig</code>)</span></label>
                  <input className={inputCls}
                    value={asigurator.asig_cod_unic}
                    onChange={e => setAsigurator(p => ({ ...p, asig_cod_unic: e.target.value }))}
                    placeholder="ex. RO12345678" />
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 pb-1 border-b border-gray-100">
                Contract asigurare
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nr. contract CAS <span className="text-gray-400">(XML: <code>NrContractAsig</code>)</span></label>
                  <input className={inputCls}
                    value={asigurator.asig_nr_contract_cas}
                    onChange={e => setAsigurator(p => ({ ...p, asig_nr_contract_cas: e.target.value }))}
                    placeholder="ex. 1234/2026" />
                </div>
                <div>
                  <label className={labelCls}>Data contract CAS</label>
                  <input className={inputCls} type="date"
                    value={asigurator.asig_data_contract_cas}
                    onChange={e => setAsigurator(p => ({ ...p, asig_data_contract_cas: e.target.value }))} />
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 pb-1 border-b border-gray-100">
                Date bancare plată contribuții CASS
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Bancă plată contribuții <span className="text-gray-400">(XML: <code>BancaPlata</code>)</span></label>
                  <input className={inputCls}
                    value={asigurator.asig_banca_plata}
                    onChange={e => setAsigurator(p => ({ ...p, asig_banca_plata: e.target.value }))}
                    placeholder="ex. BCR, ING, BRD" />
                </div>
                <div>
                  <label className={labelCls}>Cont IBAN plată CASS <span className="text-gray-400">(XML: <code>ContPlata</code>)</span></label>
                  <input className={inputCls}
                    value={asigurator.asig_cont_plata}
                    onChange={e => setAsigurator(p => ({ ...p, asig_cont_plata: e.target.value.toUpperCase() }))}
                    placeholder="ex. RO49AAAA1B31007593840000" maxLength={34} />
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Contul IBAN al CAS-ului pentru viramentul contribuțiilor CASS reținute (cod 469).
                Verificați pe site-ul CNAS sau al casei județene respective.
              </p>
            </div>

            <button type="submit" disabled={savingAsig} className="px-5 py-2 bg-brand-600 text-white text-sm rounded hover:bg-brand-700 disabled:opacity-50">
              {savingAsig ? 'Se salveaza...' : 'Salveaza datele asigurătorului'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
