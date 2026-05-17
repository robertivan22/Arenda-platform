'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from 'sonner'
import { Plus, Trash2, Building2, Package, Upload, X } from 'lucide-react'

interface CompanySettings {
  name: string; cif: string; reg_com: string
  address: string; county: string; locality: string
  iban: string; bank_name: string; phone: string; email: string
  invoice_series: string; logo_url?: string
}

interface Product {
  id: string; name: string; unit: string; sort_order: number
}

const EMPTY_COMPANY: CompanySettings = {
  name: '', cif: '', reg_com: '', address: '', county: '', locality: '',
  iban: '', bank_name: '', phone: '', email: '', invoice_series: 'A', logo_url: '',
}

export default function SetariPage() {
  const [tab, setTab] = useState<'company' | 'products'>('company')
  const [company, setCompany] = useState<CompanySettings>(EMPTY_COMPANY)
  const [savingCompany, setSavingCompany] = useState(false)
  const [products, setProducts] = useState<Product[]>([])
  const [newProduct, setNewProduct] = useState({ name: '', unit: 'kg' })
  const [savingProduct, setSavingProduct] = useState(false)

  const inputCls = 'w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500'
  const labelCls = 'block text-xs font-medium text-gray-700 mb-1'

  useEffect(() => {
    const db = createClient()
    db.from('company_settings').select('*').single()
      .then(({ data }) => { if (data) setCompany(data as any) })
    loadProducts(db)
  }, [])

  async function loadProducts(db = createClient()) {
    const { data } = await db.from('products').select('*').order('sort_order').order('name')
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
        {([['company', Building2, 'Date firma'], ['products', Package, 'Produse arenda']] as const).map(([key, Icon, label]) => (
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
    </div>
  )
}
