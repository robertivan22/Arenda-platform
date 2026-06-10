'use client'
export const runtime = 'edge'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from 'sonner'
import { Plus, Loader2, Package, AlertTriangle, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import type { InputLot, Supplier, InputCategory } from '@/lib/inventory-types'
import { INPUT_CATEGORY_LABELS, INPUT_CATEGORY_COLORS } from '@/lib/inventory-types'

const UNITS = ['kg', 'L', 't', 'buc', 'saci', 'litri']
const CATEGORIES: InputCategory[] = ['SEED', 'FERTILIZER', 'PPP', 'FUEL', 'OTHER']

const EMPTY_LOT = () => ({
  supplier_id: '', category: 'SEED' as InputCategory, product_name: '',
  unit: 'kg', quantity: '', unit_price: '', batch_number: '',
  expiry_date: '', received_date: new Date().toISOString().split('T')[0], invoice_ref: '', notes: '',
})

const EMPTY_MVT = () => ({
  lot_id: '', mvt_type: 'OUT' as 'OUT' | 'IN' | 'ADJUSTMENT', quantity: '', mvt_date: new Date().toISOString().split('T')[0], notes: '',
})

export default function LoturiPage() {
  const [lots, setLots] = useState<(InputLot & { supplier_name?: string | null })[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [catFilter, setCatFilter] = useState<InputCategory | 'ALL'>('ALL')
  const [showAddLot, setShowAddLot] = useState(false)
  const [showMvt, setShowMvt] = useState<InputLot | null>(null)
  const [lotForm, setLotForm] = useState(EMPTY_LOT())
  const [mvtForm, setMvtForm] = useState(EMPTY_MVT())
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const db = createClient()
    const [{ data: lotData }, { data: supData }] = await Promise.all([
      db.from('input_lots').select('*, suppliers(name)').order('received_date', { ascending: false }),
      db.from('suppliers').select('id, name').eq('is_active', true).order('name'),
    ])
    setLots((lotData ?? []).map((l: any) => ({ ...l, supplier_name: l.suppliers?.name ?? null })))
    setSuppliers((supData ?? []) as Supplier[])
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  async function saveLot(e: React.FormEvent) {
    e.preventDefault()
    const qty = parseFloat(lotForm.quantity)
    if (!lotForm.product_name.trim() || isNaN(qty) || qty <= 0) {
      toast.error('Produs si cantitate sunt obligatorii.')
      return
    }
    setSaving(true)
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) { toast.error('Sesiune expirata.'); setSaving(false); return }
    const { error } = await db.from('input_lots').insert({
      user_id: user.id,
      supplier_id: lotForm.supplier_id || null,
      category: lotForm.category,
      product_name: lotForm.product_name.trim(),
      unit: lotForm.unit,
      quantity: qty,
      quantity_available: qty,   // initial stock = received qty
      unit_price: lotForm.unit_price ? parseFloat(lotForm.unit_price) : null,
      batch_number: lotForm.batch_number.trim() || null,
      expiry_date: lotForm.expiry_date || null,
      received_date: lotForm.received_date,
      invoice_ref: lotForm.invoice_ref.trim() || null,
      notes: lotForm.notes.trim() || null,
    })
    if (error) { toast.error('Eroare la adaugare lot.'); setSaving(false); return }
    toast.success('Lot inregistrat in stoc.')
    setSaving(false)
    setShowAddLot(false)
    void load()
  }

  async function saveMvt(e: React.FormEvent) {
    e.preventDefault()
    if (!showMvt) return
    const qty = parseFloat(mvtForm.quantity)
    if (isNaN(qty) || qty <= 0) { toast.error('Cantitate invalida.'); return }
    if (mvtForm.mvt_type === 'OUT' && qty > showMvt.quantity_available) {
      toast.error(`Stoc insuficient. Disponibil: ${showMvt.quantity_available} ${showMvt.unit}`)
      return
    }
    setSaving(true)
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) { toast.error('Sesiune expirata.'); setSaving(false); return }
    const { error } = await db.from('input_stock_mvt').insert({
      user_id: user.id,
      lot_id: showMvt.id,
      mvt_type: mvtForm.mvt_type,
      quantity: qty,
      mvt_date: mvtForm.mvt_date,
      notes: mvtForm.notes.trim() || null,
    })
    if (error) { toast.error('Eroare la inregistrare miscare.'); setSaving(false); return }
    toast.success(mvtForm.mvt_type === 'OUT' ? 'Iesire inregistrata.' : 'Intrare suplimentara inregistrata.')
    setSaving(false)
    setShowMvt(null)
    setMvtForm(EMPTY_MVT())
    void load()
  }

  const displayed = lots.filter(l => catFilter === 'ALL' || l.category === catFilter)
  const totalValue = lots.reduce((s, l) => s + (l.quantity_available * (l.unit_price ?? 0)), 0)
  const lowStock = lots.filter(l => l.quantity_available < l.quantity * 0.1 && l.quantity_available > 0).length

  const inp = 'w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500'
  const th = 'px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide'
  const td = 'px-4 py-3 text-sm'

  return (
    <div>
      <PageHeader
        title="Loturi Inputuri"
        subtitle={`${lots.length} loturi · valoare estimata ${totalValue.toFixed(0)} RON`}
        actions={
          <button onClick={() => { setLotForm(EMPTY_LOT()); setShowAddLot(true) }}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
            Lot nou
          </button>
        }
      />

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Total loturi', value: lots.length, color: 'text-gray-700' },
          { label: 'Stoc redus (<10%)', value: lowStock, color: lowStock > 0 ? 'text-amber-600' : 'text-gray-700' },
          { label: 'Valoare stoc', value: `${totalValue.toFixed(0)} RON`, color: 'text-brand-700' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-400 mb-0.5">{s.label}</p>
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button onClick={() => setCatFilter('ALL')}
          className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${catFilter === 'ALL' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          Toate
        </button>
        {CATEGORIES.map(cat => (
          <button key={cat} onClick={() => setCatFilter(cat)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${catFilter === cat ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {INPUT_CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-brand-600" /></div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Niciun lot inregistrat</p>
          <p className="text-sm mt-1">Inregistreaza primul lot de inputuri agricole.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className={th}>Produs</th>
                <th className={th}>Categorie</th>
                <th className={th}>Furnizor</th>
                <th className={th}>Receptie</th>
                <th className={th}>Disponibil / Total</th>
                <th className={th}>Pret unit.</th>
                <th className={th}>Lot / Exp.</th>
                <th className={th + ' text-right'}>Actiuni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayed.map(l => {
                const pct = l.quantity > 0 ? (l.quantity_available / l.quantity) * 100 : 0
                const isLow = pct < 10 && l.quantity_available > 0
                const isExpired = l.expiry_date ? new Date(l.expiry_date) < new Date() : false
                return (
                  <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                    <td className={td}>
                      <div className="font-medium text-gray-900 flex items-center gap-1.5">
                        {isLow && <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />}
                        {l.product_name}
                      </div>
                    </td>
                    <td className={td}>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${INPUT_CATEGORY_COLORS[l.category]}`}>
                        {INPUT_CATEGORY_LABELS[l.category]}
                      </span>
                    </td>
                    <td className={td}>
                      <span className="text-gray-600 text-xs">{l.supplier_name ?? '—'}</span>
                    </td>
                    <td className={td}>
                      <span className="text-gray-600 text-xs">{l.received_date}</span>
                    </td>
                    <td className={td}>
                      <div>
                        <span className={`font-semibold ${isLow ? 'text-amber-600' : l.quantity_available === 0 ? 'text-red-500' : 'text-gray-900'}`}>
                          {Number(l.quantity_available).toFixed(2)}
                        </span>
                        <span className="text-gray-400"> / {Number(l.quantity).toFixed(2)} {l.unit}</span>
                      </div>
                      <div className="mt-1 h-1 rounded-full bg-gray-200 w-24">
                        <div className={`h-1 rounded-full ${isLow ? 'bg-amber-400' : 'bg-brand-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                    </td>
                    <td className={td}>
                      {l.unit_price ? <span className="text-gray-700">{Number(l.unit_price).toFixed(2)} RON/{l.unit}</span> : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={td}>
                      {l.batch_number && <div className="text-xs text-gray-600">Lot: {l.batch_number}</div>}
                      {l.expiry_date && (
                        <div className={`text-xs ${isExpired ? 'text-red-500 font-medium' : 'text-gray-500'}`}>
                          Exp: {l.expiry_date}{isExpired ? ' (expirat)' : ''}
                        </div>
                      )}
                      {!l.batch_number && !l.expiry_date && <span className="text-gray-300">—</span>}
                    </td>
                    <td className={td + ' text-right'}>
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => { setShowMvt(l); setMvtForm({ ...EMPTY_MVT(), lot_id: l.id, mvt_type: 'OUT' }) }}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Inregistreaza iesire">
                          <ArrowUpCircle className="w-3.5 h-3.5" />
                          Iesire
                        </button>
                        <button
                          onClick={() => { setShowMvt(l); setMvtForm({ ...EMPTY_MVT(), lot_id: l.id, mvt_type: 'IN' }) }}
                          className="flex items-center gap-1 px-2.5 py-1 text-xs text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Intrare suplimentara">
                          <ArrowDownCircle className="w-3.5 h-3.5" />
                          Intrare
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add lot modal */}
      {showAddLot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-4">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Inregistrare lot nou</h2>
              <button onClick={() => setShowAddLot(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={saveLot} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Categorie *</label>
                  <select className={inp} value={lotForm.category} onChange={e => setLotForm(f => ({ ...f, category: e.target.value as InputCategory }))}>
                    {CATEGORIES.map(c => <option key={c} value={c}>{INPUT_CATEGORY_LABELS[c]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Furnizor</label>
                  <select className={inp} value={lotForm.supplier_id} onChange={e => setLotForm(f => ({ ...f, supplier_id: e.target.value }))}>
                    <option value="">Fara furnizor</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Produs / Denumire *</label>
                <input className={inp} value={lotForm.product_name} onChange={e => setLotForm(f => ({ ...f, product_name: e.target.value }))} placeholder="Ex: Seminte porumb Pioneer P9903" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cantitate receptionata *</label>
                  <input type="number" min="0" step="0.001" className={inp} value={lotForm.quantity} onChange={e => setLotForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0.000" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">U.M.</label>
                  <select className={inp} value={lotForm.unit} onChange={e => setLotForm(f => ({ ...f, unit: e.target.value }))}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Pret unitar (RON)</label>
                  <input type="number" min="0" step="0.0001" className={inp} value={lotForm.unit_price} onChange={e => setLotForm(f => ({ ...f, unit_price: e.target.value }))} placeholder="0.0000" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Data receptie</label>
                  <input type="date" className={inp} value={lotForm.received_date} onChange={e => setLotForm(f => ({ ...f, received_date: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Numar lot / Lot</label>
                  <input className={inp} value={lotForm.batch_number} onChange={e => setLotForm(f => ({ ...f, batch_number: e.target.value }))} placeholder="Ex: L2026-001" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Data expirare</label>
                  <input type="date" className={inp} value={lotForm.expiry_date} onChange={e => setLotForm(f => ({ ...f, expiry_date: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nr. factura receptie</label>
                <input className={inp} value={lotForm.invoice_ref} onChange={e => setLotForm(f => ({ ...f, invoice_ref: e.target.value }))} placeholder="Ex: F123456" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Note</label>
                <textarea className={inp + ' resize-none'} rows={2} value={lotForm.notes} onChange={e => setLotForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddLot(false)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Anuleaza</button>
                <button type="submit" disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-lg disabled:opacity-60 transition-colors">
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Inregistreaza lot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Movement modal */}
      {showMvt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">
                {mvtForm.mvt_type === 'OUT' ? 'Inregistrare iesire stoc' : 'Intrare suplimentara'}
              </h2>
              <button onClick={() => setShowMvt(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={saveMvt} className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">
                <span className="font-medium text-gray-700">{showMvt.product_name}</span>
                <span className="text-gray-400 ml-2">· Stoc: {Number(showMvt.quantity_available).toFixed(3)} {showMvt.unit}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Tip miscare</label>
                  <select className={inp} value={mvtForm.mvt_type} onChange={e => setMvtForm(f => ({ ...f, mvt_type: e.target.value as 'IN' | 'OUT' | 'ADJUSTMENT' }))}>
                    <option value="OUT">Iesire (consum)</option>
                    <option value="IN">Intrare (supliment)</option>
                    <option value="ADJUSTMENT">Ajustare inventar</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cantitate ({showMvt.unit}) *</label>
                  <input type="number" min="0.001" step="0.001" className={inp} value={mvtForm.quantity} onChange={e => setMvtForm(f => ({ ...f, quantity: e.target.value }))} placeholder="0.000" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Data</label>
                <input type="date" className={inp} value={mvtForm.mvt_date} onChange={e => setMvtForm(f => ({ ...f, mvt_date: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Note</label>
                <input className={inp} value={mvtForm.notes} onChange={e => setMvtForm(f => ({ ...f, notes: e.target.value }))} placeholder="Ex: Parcela 12, semanat 25 ha" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowMvt(null)} className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">Anuleaza</button>
                <button type="submit" disabled={saving} className={`flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-60 transition-colors ${mvtForm.mvt_type === 'OUT' ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
                  {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {mvtForm.mvt_type === 'OUT' ? 'Confirm iesire' : 'Confirm intrare'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
