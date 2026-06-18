'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ChevronDown, ChevronRight, Download, Package, RefreshCw } from 'lucide-react'

interface DAConversion {
  id: string
  distribution_date: string
  from_quantity_kg: number
  to_crop_name: string
  to_quantity_kg: number
}

interface Allocation {
  id: string
  product_type: string
  total_quantity: number
  quantity_unit: string
  campaign_year: number | null
  distributed_total: number
  /** kg consumed via Distribuire Arendă conversions (FROM this crop) */
  da_converted: number
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

export default function DistributionTracker({ contractId }: { contractId: string }) {
  const [allocations, setAllocations] = useState<Allocation[]>([])
  const [distributions, setDistributions] = useState<Record<string, Distribution[]>>({})
  const [daConversions, setDaConversions] = useState<Record<string, DAConversion[]>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [status, setStatus] = useState<'loading' | 'syncing' | 'ready'>('loading')

  /**
   * Idempotent sync: reads real transactions for the contract and ensures
   * corresponding parcel_transactions + transaction_distributions exist.
   * Tracks which transactions are already synced via source_transaction_id.
   */
  const sync = useCallback(async () => {
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return

    const [
      { data: contractData },
      { data: parcelsData },
      { data: realTxns },
      { data: existingPTs },
      { data: allDists },
    ] = await Promise.all([
      db.from('contracts')
        .select('lessor_id, contract_rent_levels(product_name, level_per_ha)')
        .eq('id', contractId)
        .single(),
      db.from('parcels').select('surface').eq('contract_id', contractId),
      db.from('transactions')
        .select('id, product_name, campaign_year, transaction_date, kg_net, lessor_id')
        .eq('contract_id', contractId)
        .eq('is_previzionata', false),
      db.from('parcel_transactions')
        .select('id, product_type, campaign_year, total_quantity')
        .eq('contract_id', contractId),
      db.from('transaction_distributions')
        .select('id, transaction_id, source_transaction_id, quantity_given')
        .eq('user_id', user.id)
        .is('deleted_at', null),
    ])

    if (!realTxns?.length) return

    const lessorId: string = (contractData as any)?.lessor_id ?? ''
    const levels: { product_name: string; level_per_ha: number }[] = (contractData as any)?.contract_rent_levels ?? []
    const ha = (parcelsData ?? []).reduce((s: number, p: any) => s + Number(p.surface ?? 0), 0)

    // Set of real transaction IDs that already have a distribution row
    const syncedTxnIds = new Set<string>(
      (allDists ?? [])
        .filter((d: any) => d.source_transaction_id)
        .map((d: any) => d.source_transaction_id as string)
    )

    // Group transactions by (product_name, campaign_year)
    const groups = new Map<string, { productName: string; year: number; txns: typeof realTxns }>()
    for (const t of (realTxns ?? [])) {
      if (!t.product_name || !t.campaign_year) continue
      const key = `${t.product_name}::${t.campaign_year}`
      if (!groups.has(key)) groups.set(key, { productName: t.product_name, year: t.campaign_year, txns: [] })
      groups.get(key)!.txns.push(t)
    }

    for (const { productName, year, txns } of groups.values()) {
      const level = levels.find(r => r.product_name === productName)
      const levelTotal = level && ha > 0 ? level.level_per_ha * ha : 0
      const txnSum = txns.reduce((s, t) => s + Math.max(0, Number(t.kg_net)), 0)

      // Existing allocation for this (product, year)
      const existingPT = (existingPTs ?? []).find((p: any) =>
        p.product_type === productName && Number(p.campaign_year) === year
      )

      // Account for any manually-added distributions (no source_transaction_id)
      const manualDistSum = existingPT
        ? (allDists ?? [])
            .filter((d: any) => d.transaction_id === existingPT.id && !d.source_transaction_id)
            .reduce((s: number, d: any) => s + Number(d.quantity_given), 0)
        : 0

      // total_quantity = max(contract obligation, sum of distributions that will exist)
      const totalQty = Math.max(levelTotal, txnSum + manualDistSum, 0.0001)

      let ptId: string | null = null

      if (existingPT) {
        ptId = existingPT.id
        if (Math.abs(Number(existingPT.total_quantity) - totalQty) > 0.5) {
          await db.from('parcel_transactions').update({ total_quantity: totalQty }).eq('id', ptId)
        }
      } else {
        const { data: newPT, error } = await db
          .from('parcel_transactions')
          .insert({
            user_id: user.id,
            contract_id: contractId,
            product_type: productName,
            campaign_year: year,
            total_quantity: totalQty,
            quantity_unit: 'kg',
          })
          .select('id')
          .single()
        if (!error && newPT) ptId = newPT.id
      }

      if (!ptId) continue

      // Insert a distribution for each unsynced real transaction
      for (const txn of txns) {
        if (syncedTxnIds.has(txn.id)) continue
        const qty = Number(txn.kg_net)
        if (qty <= 0) continue
        const { error } = await db.from('transaction_distributions').insert({
          user_id: user.id,
          transaction_id: ptId,
          lessor_id: txn.lessor_id ?? lessorId ?? null,
          quantity_given: qty,
          distribution_date: txn.transaction_date,
          source_transaction_id: txn.id,
        })
        if (error) console.warn('Distribution sync error:', error.message)
      }
    }
  }, [contractId])

  const load = useCallback(async () => {
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) return

    const [{ data: pts }, { data: dists }, { data: daConvData }] = await Promise.all([
      db.from('parcel_transactions')
        .select('*')
        .eq('contract_id', contractId)
        .order('campaign_year', { ascending: false })
        .order('product_type', { ascending: true }),
      db.from('transaction_distributions')
        .select('*, lessors(first_name, last_name, company_name, type)')
        .eq('user_id', user.id)
        .is('deleted_at', null),
      db.from('arenda_conversions')
        .select('id, from_crop_name, from_quantity_kg, to_crop_name, to_quantity_kg, distribution_date')
        .eq('contract_id', contractId)
        .eq('status', 'confirmed')
        .order('distribution_date', { ascending: true }),
    ])

    const distMap: Record<string, Distribution[]> = {}
    ;(dists ?? []).forEach((d: any) => {
      const l = Array.isArray(d.lessors) ? d.lessors[0] : d.lessors
      const lessor_name = l
        ? (l.type === 'LEGAL' ? l.company_name : `${l.last_name} ${l.first_name}`.trim())
        : null
      const dist: Distribution = { ...d, lessor_name }
      if (!distMap[d.transaction_id]) distMap[d.transaction_id] = []
      distMap[d.transaction_id].push(dist)
    })

    // DA conversions grouped by FROM crop name
    const daMap: Record<string, DAConversion[]> = {}
    for (const c of (daConvData ?? []) as any[]) {
      if (!c.from_crop_name) continue
      if (!daMap[c.from_crop_name]) daMap[c.from_crop_name] = []
      daMap[c.from_crop_name].push({
        id: c.id,
        distribution_date: c.distribution_date,
        from_quantity_kg: Number(c.from_quantity_kg),
        to_crop_name: c.to_crop_name,
        to_quantity_kg: Number(c.to_quantity_kg),
      })
    }
    const daTotalByCrop: Record<string, number> = {}
    for (const [crop, convs] of Object.entries(daMap)) {
      daTotalByCrop[crop] = convs.reduce((s, c) => s + c.from_quantity_kg, 0)
    }

    const withTotals: Allocation[] = (pts ?? []).map((t: any) => ({
      ...t,
      distributed_total: (distMap[t.id] ?? []).reduce(
        (s: number, d: Distribution) => s + Number(d.quantity_given),
        0
      ),
      da_converted: daTotalByCrop[t.product_type] ?? 0,
    }))

    setAllocations(withTotals)
    setDistributions(distMap)
    setDaConversions(daMap)
  }, [contractId])

  useEffect(() => {
    setStatus('syncing')
    sync()
      .then(() => load())
      .then(() => setStatus('ready'))
      .catch(() => load().then(() => setStatus('ready')))
  }, [sync, load])

  async function handleManualSync() {
    setStatus('syncing')
    try {
      await sync()
      await load()
      toast.success('Date sincronizate.')
    } catch {
      toast.error('Eroare la sincronizare.')
    }
    setStatus('ready')
  }

  function exportCSV(alloc: Allocation) {
    const dists = distributions[alloc.id] ?? []
    const rows = [
      ['Data', 'Produs', 'An', 'Cantitate', 'Unitate', 'Arendator', 'Observatii'],
      ...[...dists]
        .sort((a, b) => a.distribution_date.localeCompare(b.distribution_date))
        .map(d => [
          d.distribution_date,
          alloc.product_type,
          alloc.campaign_year ?? '',
          d.quantity_given,
          alloc.quantity_unit,
          d.lessor_name ?? '',
          d.notes ?? '',
        ]),
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `distributie-${alloc.product_type}-${alloc.campaign_year ?? 'all'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (status === 'loading') return null
  if (allocations.length === 0 && status === 'ready') return null

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <span className="font-semibold text-sm flex items-center gap-2">
          <Package className="w-4 h-4 text-brand-600" />
          Distributie Produs
        </span>
        <button
          onClick={handleManualSync}
          disabled={status === 'syncing'}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-300 rounded text-gray-600 hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${status === 'syncing' ? 'animate-spin' : ''}`} />
          {status === 'syncing' ? 'Sincronizare...' : 'Sincronizeaza'}
        </button>
      </div>

      {allocations.map(alloc => {
        const dists = distributions[alloc.id] ?? []
        const daConvs = daConversions[alloc.product_type] ?? []
        const totalConsumed = alloc.distributed_total + alloc.da_converted
        const remaining = Math.max(0, alloc.total_quantity - totalConsumed)
        const pct = alloc.total_quantity > 0
          ? Math.min(100, (totalConsumed / alloc.total_quantity) * 100)
          : 0
        const isExpanded = expanded.has(alloc.id)
        const done = remaining <= 0.00001

        return (
          <div key={alloc.id} className="border-b border-gray-100 last:border-0">
            <div className="px-4 py-3 flex items-center gap-3">
              <button
                onClick={() => setExpanded(prev => {
                  const s = new Set(prev)
                  s.has(alloc.id) ? s.delete(alloc.id) : s.add(alloc.id)
                  return s
                })}
                className="text-gray-400 hover:text-gray-600 flex-shrink-0"
              >
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{alloc.product_type}</span>
                  {alloc.campaign_year && (
                    <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                      {alloc.campaign_year}
                    </span>
                  )}
                  <span className="text-xs text-gray-500">
                    Total: <strong>{Number(alloc.total_quantity).toFixed(0)} {alloc.quantity_unit}</strong>
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    done ? 'bg-green-100 text-green-700' : 'bg-orange-50 text-orange-600'
                  }`}>
                    {done
                      ? 'Distribuit complet'
                      : `Disponibil: ${remaining.toFixed(0)} ${alloc.quantity_unit}`}
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
                    {totalConsumed.toFixed(0)} / {Number(alloc.total_quantity).toFixed(0)} {alloc.quantity_unit}
                  </span>
                </div>
              </div>

              <button
                onClick={() => exportCSV(alloc)}
                className="p-1.5 text-gray-400 hover:text-brand-600 border border-gray-200 rounded flex-shrink-0"
                title="Export CSV"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>

            {isExpanded && (
              <div className="border-t border-gray-50 bg-gray-50">
                {dists.length === 0 && daConvs.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-center text-gray-400">
                    Nicio distributie inregistrata.
                  </p>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="px-4 py-2 text-left text-gray-500 font-semibold uppercase tracking-wide">Data</th>
                        <th className="px-4 py-2 text-left text-gray-500 font-semibold uppercase tracking-wide">Arendator / Tip</th>
                        <th className="px-4 py-2 text-right text-gray-500 font-semibold uppercase tracking-wide">Cantitate</th>
                        <th className="px-4 py-2 text-left text-gray-500 font-semibold uppercase tracking-wide">Observatii</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...dists]
                        .sort((a, b) => a.distribution_date.localeCompare(b.distribution_date))
                        .map(d => (
                          <tr key={d.id} className="border-b border-gray-50 hover:bg-white">
                            <td className="px-4 py-2 text-gray-600">{d.distribution_date}</td>
                            <td className="px-4 py-2 text-gray-800">
                              {d.lessor_name ?? <span className="text-gray-300">-</span>}
                            </td>
                            <td className="px-4 py-2 text-right font-semibold text-gray-900">
                              {Number(d.quantity_given).toFixed(0)} {alloc.quantity_unit}
                            </td>
                            <td className="px-4 py-2 text-gray-500">{d.notes ?? '-'}</td>
                          </tr>
                        ))}
                      {/* DA conversions that consumed FROM this crop */}
                      {daConvs.map(c => (
                        <tr key={c.id} className="border-b border-amber-50 bg-amber-50/40 hover:bg-amber-50">
                          <td className="px-4 py-2 text-gray-600">{c.distribution_date}</td>
                          <td className="px-4 py-2 text-amber-700 font-medium">
                            → {c.to_crop_name} ({c.to_quantity_kg.toFixed(0)} kg)
                          </td>
                          <td className="px-4 py-2 text-right font-semibold text-amber-800">
                            {c.from_quantity_kg.toFixed(0)} {alloc.quantity_unit}
                          </td>
                          <td className="px-4 py-2 text-amber-600 text-[10px]">Distribuire Arendă</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-100 font-semibold">
                        <td className="px-4 py-2 text-gray-600" colSpan={2}>Total distribuit</td>
                        <td className="px-4 py-2 text-right text-brand-700">
                          {totalConsumed.toFixed(0)} {alloc.quantity_unit}
                        </td>
                        <td className="px-4 py-2 text-gray-500">
                          {!done && (
                            <span className="text-orange-600">
                              Ramas: {remaining.toFixed(0)} {alloc.quantity_unit}
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
