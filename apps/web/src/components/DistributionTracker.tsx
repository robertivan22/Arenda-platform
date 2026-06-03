'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Plus, ChevronDown, ChevronRight, Trash2, Download, Package } from 'lucide-react'

interface ParcelTransaction {
  id: string
  product_type: string
  total_quantity: number
  quantity_unit: string
  campaign_year: number | null
  notes: string | null
  distributed_total: number
}

interface Distribution {
  id: string
  transaction_id: string
  lessor_id: string | null
  lessor_name?: string | null
  quantity_given: number
  distribution_date: string
  notes: string | null
}

interface LessorOption { id: string; display_name: string }
interface RentLevelInfo { product_name: string; level_per_ha: number }

const UNITS = ['kg', 'tone', 'saci', 'buc']

export default function DistributionTracker({ contractId }: { contractId: string }) {
  const [transactions, setTransactions] = useState<ParcelTransaction[]>([])
  const [distributions, setDistributions] = useState<Record<string, Distribution[]>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [contractLessor, setContractLessor] = useState<LessorOption | null>(null)
  const [rentLevels, setRentLevels] = useState<RentLevelInfo[]>([])
  const [totalHa, setTotalHa] = useState(0)
  const [loading, setLoading] = useState(true)

  const [showAddTxn, setShowAddTxn] = useState(false)
  const [txnForm, setTxnForm] = useState({
    productType: '', totalQuantity: '', quantityUnit: 'kg',
    campaignYear: String(new Date().getFullYear()), notes: '',
  })

  const [showAddDist, setShowAddDist] = useState<string | null>(null)
  const [distForm, setDistForm] = useState({
    lessorId: '', quantityGiven: '',
    distributionDate: new Date().toISOString().split('T')[0], notes: '',
  })

  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return

    const [{ data: txns }, { data: dists }, { data: contractData }, { data: parcelsData }] = await Promise.all([
      db.from('parcel_transactions')
        .select('*')
        .eq('contract_id', contractId)
        .order('campaign_year', { ascending: false })
        .order('created_at', { ascending: false }),
      db.from('transaction_distributions')
        .select('*, lessors(first_name, last_name, company_name, type)')
        .eq('user_id', user.id)
        .is('deleted_at', null),
      db.from('contracts')
        .select('lessor_id, lessors(first_name, last_name, company_name, type), contract_rent_levels(product_name, level_per_ha)')
        .eq('id', contractId)
        .single(),
      db.from('parcels').select('surface').eq('contract_id', contractId),
    ])

    const distMap: Record<string, Distribution[]> = {}
    ;(dists ?? []).forEach((d: any) => {
      const l = Array.isArray(d.lessors) ? d.lessors[0] : d.lessors
      const lessor_name = l ? (l.type === 'LEGAL' ? l.company_name : `${l.last_name} ${l.first_name}`.trim()) : null
      const dist: Distribution = { ...d, lessor_name }
      if (!distMap[d.transaction_id]) distMap[d.transaction_id] = []
      distMap[d.transaction_id].push(dist)
    })

    const withTotals: ParcelTransaction[] = (txns ?? []).map((t: any) => ({
      ...t,
      distributed_total: (distMap[t.id] ?? []).reduce((s: number, d: Distribution) => s + Number(d.quantity_given), 0),
    }))

    setTransactions(withTotals)
    setDistributions(distMap)
    if (contractData) {
      const l = Array.isArray((contractData as any).lessors) ? (contractData as any).lessors[0] : (contractData as any).lessors
      const lessor: LessorOption = {
        id: (contractData as any).lessor_id,
        display_name: l ? (l.type === 'LEGAL' ? l.company_name : `${l.last_name} ${l.first_name}`.trim()) : '—',
      }
      setContractLessor(lessor)
      setRentLevels((contractData as any).contract_rent_levels ?? [])
      // pre-fill distForm with this lessor
      setDistForm(p => ({ ...p, lessorId: lessor.id }))
    }
    setTotalHa((parcelsData ?? []).reduce((s: number, p: any) => s + Number(p.surface ?? 0), 0))
    setLoading(false)
  }, [contractId])

  useEffect(() => { void load() }, [load])

  function handleProductSelect(productName: string) {
    const level = rentLevels.find(r => r.product_name === productName)
    const suggested = level && totalHa > 0 ? String(Math.round(level.level_per_ha * totalHa)) : ''
    setTxnForm(p => ({ ...p, productType: productName, totalQuantity: suggested }))
  }

  async function saveAllocation(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) { setSaving(false); return }
    const { error } = await db.from('parcel_transactions').insert({
      user_id: user.id,
      contract_id: contractId,
      product_type: txnForm.productType,
      total_quantity: parseFloat(txnForm.totalQuantity),
      quantity_unit: txnForm.quantityUnit,
      campaign_year: txnForm.campaignYear ? parseInt(txnForm.campaignYear) : null,
      notes: txnForm.notes || null,
    })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Alocare adăugată.')
    setShowAddTxn(false)
    setTxnForm({ productType: '', totalQuantity: '', quantityUnit: 'kg', campaignYear: String(new Date().getFullYear()), notes: '' })
    void load()
  }

  async function saveDistribution(e: React.FormEvent, txn: ParcelTransaction) {
    e.preventDefault()
    const qty = parseFloat(distForm.quantityGiven)
    const remaining = txn.total_quantity - txn.distributed_total
    if (qty > remaining + 0.00001) {
      toast.error(`Cantitate prea mare. Disponibil: ${remaining.toFixed(2)} ${txn.quantity_unit}`)
      return
    }
    setSaving(true)
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) { setSaving(false); return }
    const { error } = await db.from('transaction_distributions').insert({
      user_id: user.id,
      transaction_id: txn.id,
      lessor_id: distForm.lessorId || null,
      quantity_given: qty,
      distribution_date: distForm.distributionDate,
      notes: distForm.notes || null,
    })
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Distribuție înregistrată.')
    setShowAddDist(null)
    setDistForm({ lessorId: contractLessor?.id ?? '', quantityGiven: '', distributionDate: new Date().toISOString().split('T')[0], notes: '' })
    void load()
  }

  async function softDeleteDist(distId: string) {
    if (!confirm('Ștergi această distribuție?')) return
    const { error } = await createClient()
      .from('transaction_distributions')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', distId)
    if (error) { toast.error(error.message); return }
    toast.success('Distribuție ștearsă.')
    void load()
  }

  async function deleteAllocation(txnId: string) {
    if (!confirm('Ștergi această alocare și toate distribuțiile ei?')) return
    const { error } = await createClient().from('parcel_transactions').delete().eq('id', txnId)
    if (error) { toast.error(error.message); return }
    toast.success('Alocare ștearsă.')
    void load()
  }

  function exportCSV(txn: ParcelTransaction) {
    const dists = distributions[txn.id] ?? []
    const rows = [
      ['Data', 'Produs', 'An', 'Cantitate', 'Unitate', 'Arendator', 'Observatii'],
      ...dists.map(d => [
        d.distribution_date,
        txn.product_type,
        txn.campaign_year ?? '',
        d.quantity_given,
        txn.quantity_unit,
        d.lessor_name ?? '',
        d.notes ?? '',
      ]),
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `distributie-${txn.product_type}-${txn.campaign_year ?? 'all'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const inputCls = 'w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500'
  const labelCls = 'block text-xs font-medium text-gray-700 mb-1'

  if (loading) return null

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <span className="font-semibold text-sm flex items-center gap-2">
          <Package className="w-4 h-4 text-brand-600" />
          Distribuție Produs
        </span>
        <button
          onClick={() => setShowAddTxn(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded font-medium"
        >
          <Plus className="w-3.5 h-3.5" /> Alocare nouă
        </button>
      </div>

      {/* Add allocation form */}
      {showAddTxn && (
        <form onSubmit={saveAllocation} className="px-4 py-3 border-b border-gray-100 bg-green-50">
          <p className="text-xs font-semibold text-gray-600 mb-2">Înregistrează cantitatea totală de produs pentru distribuție</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div>
              <label className={labelCls}>Produs *</label>
              {rentLevels.length > 0 ? (
                <select className={inputCls} value={txnForm.productType}
                  onChange={e => handleProductSelect(e.target.value)} required>
                  <option value="">Selectați</option>
                  {rentLevels.map(r => (
                    <option key={r.product_name} value={r.product_name}>{r.product_name}</option>
                  ))}
                </select>
              ) : (
                <input className={inputCls} placeholder="ex: OVAZ, Porumb" value={txnForm.productType}
                  onChange={e => setTxnForm(p => ({ ...p, productType: e.target.value }))} required />
              )}
            </div>
            <div>
              <label className={labelCls}>Cantitate totală *</label>
              <input className={inputCls} type="number" min="0.0001" step="0.0001" placeholder="ex: 1000"
                value={txnForm.totalQuantity} onChange={e => setTxnForm(p => ({ ...p, totalQuantity: e.target.value }))} required />
              {txnForm.totalQuantity && rentLevels.find(r => r.product_name === txnForm.productType) && totalHa > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {rentLevels.find(r => r.product_name === txnForm.productType)!.level_per_ha} kg/ha × {totalHa.toFixed(2)} ha
                </p>
              )}
            </div>
            <div>
              <label className={labelCls}>Unitate</label>
              <select className={inputCls} value={txnForm.quantityUnit} onChange={e => setTxnForm(p => ({ ...p, quantityUnit: e.target.value }))}>
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>An campanie</label>
              <input className={inputCls} type="number" min="2000" max="2100" value={txnForm.campaignYear}
                onChange={e => setTxnForm(p => ({ ...p, campaignYear: e.target.value }))} />
            </div>
            <div className="col-span-2 md:col-span-4">
              <label className={labelCls}>Observații</label>
              <input className={inputCls} value={txnForm.notes} onChange={e => setTxnForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <button type="submit" disabled={saving}
              className="px-3 py-1.5 bg-brand-600 text-white text-sm rounded disabled:opacity-50">
              {saving ? 'Se salvează...' : 'Salvează alocarea'}
            </button>
            <button type="button" onClick={() => setShowAddTxn(false)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white">
              Anulează
            </button>
          </div>
        </form>
      )}

      {/* Empty state */}
      {transactions.length === 0 && !showAddTxn && (
        <div className="px-4 py-8 text-center text-sm text-gray-400">
          Nicio alocare de produs înregistrată.
        </div>
      )}

      {/* Allocation rows */}
      {transactions.map(txn => {
        const dists = distributions[txn.id] ?? []
        const remaining = Math.max(0, txn.total_quantity - txn.distributed_total)
        const pct = txn.total_quantity > 0 ? Math.min(100, (txn.distributed_total / txn.total_quantity) * 100) : 0
        const isExpanded = expanded.has(txn.id)
        const done = remaining <= 0.00001

        return (
          <div key={txn.id} className="border-b border-gray-100 last:border-0">
            {/* Summary row */}
            <div className="px-4 py-3 flex items-center gap-3">
              <button
                onClick={() => setExpanded(prev => { const s = new Set(prev); s.has(txn.id) ? s.delete(txn.id) : s.add(txn.id); return s })}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{txn.product_type}</span>
                  {txn.campaign_year && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{txn.campaign_year}</span>
                  )}
                  <span className="text-xs text-gray-500">
                    Total: <strong>{Number(txn.total_quantity).toFixed(0)} {txn.quantity_unit}</strong>
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    done ? 'bg-green-100 text-green-700' : 'bg-orange-50 text-orange-600'
                  }`}>
                    {done
                      ? '✓ Distribuit complet'
                      : `Disponibil: ${remaining.toFixed(0)} ${txn.quantity_unit}`}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="w-32 bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${done ? 'bg-green-500' : 'bg-brand-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">
                    {txn.distributed_total.toFixed(0)} / {Number(txn.total_quantity).toFixed(0)} {txn.quantity_unit}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 flex-shrink-0">
                <button
                  onClick={() => {
                    setShowAddDist(txn.id)
                    setDistForm(p => ({ ...p, lessorId: contractLessor?.id ?? '' }))
                    setExpanded(prev => new Set(prev).add(txn.id))
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded font-medium"
                >
                  <Plus className="w-3 h-3" /> Distribuie
                </button>
                <button onClick={() => exportCSV(txn)}
                  className="p-1.5 text-gray-400 hover:text-brand-600 border border-gray-200 rounded" title="Export CSV">
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => deleteAllocation(txn.id)}
                  className="p-1.5 text-gray-300 hover:text-red-500 border border-gray-200 rounded" title="Șterge">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Expanded panel */}
            {isExpanded && (
              <div className="border-t border-gray-50 bg-gray-50">
                {/* Add distribution form */}
                {showAddDist === txn.id && (
                  <form onSubmit={e => saveDistribution(e, txn)}
                    className="px-4 py-3 border-b border-blue-100 bg-blue-50">
                    <p className="text-xs font-semibold text-gray-600 mb-2">
                      Adaugă distribuție — Disponibil:{' '}
                      <strong className="text-orange-600">{remaining.toFixed(2)} {txn.quantity_unit}</strong>
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div>
                        <label className={labelCls}>Arendator</label>
                        <div className={`${inputCls} bg-gray-50 text-gray-700 cursor-default`}>
                          {contractLessor?.display_name ?? '—'}
                        </div>
                        <input type="hidden" value={distForm.lessorId} readOnly />
                      </div>
                      <div>
                        <label className={labelCls}>Cantitate ({txn.quantity_unit}) *</label>
                        <input className={inputCls} type="number" min="0.0001" step="0.0001"
                          max={remaining}
                          value={distForm.quantityGiven}
                          onChange={e => setDistForm(p => ({ ...p, quantityGiven: e.target.value }))}
                          required />
                      </div>
                      <div>
                        <label className={labelCls}>Data *</label>
                        <input className={inputCls} type="date" value={distForm.distributionDate}
                          onChange={e => setDistForm(p => ({ ...p, distributionDate: e.target.value }))} required />
                      </div>
                      <div>
                        <label className={labelCls}>Observații</label>
                        <input className={inputCls} value={distForm.notes}
                          onChange={e => setDistForm(p => ({ ...p, notes: e.target.value }))} />
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <button type="submit" disabled={saving}
                        className="px-3 py-1.5 bg-green-600 text-white text-sm rounded disabled:opacity-50">
                        {saving ? 'Se salvează...' : 'Salvează'}
                      </button>
                      <button type="button" onClick={() => setShowAddDist(null)}
                        className="px-3 py-1.5 text-sm border border-gray-300 rounded bg-white">
                        Anulează
                      </button>
                    </div>
                  </form>
                )}

                {/* Distributions table */}
                {dists.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-center text-gray-400">
                    Nicio distribuție înregistrată pentru această alocare.
                  </p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-4 py-2 text-left text-gray-500 font-semibold uppercase tracking-wide">Data</th>
                        <th className="px-4 py-2 text-left text-gray-500 font-semibold uppercase tracking-wide">Arendator</th>
                        <th className="px-4 py-2 text-right text-gray-500 font-semibold uppercase tracking-wide">Cantitate</th>
                        <th className="px-4 py-2 text-left text-gray-500 font-semibold uppercase tracking-wide">Observații</th>
                        <th className="px-4 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {dists.map(d => (
                        <tr key={d.id} className="border-b border-gray-50 hover:bg-white">
                          <td className="px-4 py-2 text-gray-600">{d.distribution_date}</td>
                          <td className="px-4 py-2 text-gray-800">{d.lessor_name ?? <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-2 text-right font-semibold text-gray-900">
                            {Number(d.quantity_given).toFixed(0)} {txn.quantity_unit}
                          </td>
                          <td className="px-4 py-2 text-gray-500">{d.notes ?? '—'}</td>
                          <td className="px-4 py-2 text-right">
                            <button onClick={() => softDeleteDist(d.id)}
                              className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-100 font-semibold">
                        <td className="px-4 py-2 text-gray-600" colSpan={2}>Total distribuit</td>
                        <td className="px-4 py-2 text-right text-brand-700">
                          {txn.distributed_total.toFixed(0)} {txn.quantity_unit}
                        </td>
                        <td className="px-4 py-2 text-gray-500" colSpan={2}>
                          {!done && (
                            <span className="text-orange-600">
                              Rămas: {remaining.toFixed(0)} {txn.quantity_unit}
                            </span>
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
