'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, TrendingUp, User, Building2, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { createClient } from '@/lib/supabase/client'
import type { LandlordSearchResult, LandlordDistributionStatus, CropPrice } from '@/types/distribuire'
import { toast } from 'sonner'

const CROP_ICONS: Record<string, string> = {
  'Porumb': '🌽',
  'Grâu': '🌾',
  'Floarea-soarelui': '🌻',
  'Rapiță': '🌿',
  'Soia': '🫘',
  'Orz': '🌾',
  'Ovăz': '🌾',
  'Secară': '🌾',
  'Triticale': '🌾',
  'Mazăre': '🟢',
  'Sfeclă de zahăr': '🌱',
  'Lucernă': '🌿',
}

interface Props {
  landlord: LandlordSearchResult | null
  refreshKey?: number  // increment to force refresh
  currentDistributionKg?: number  // quantity being entered in form
}

export function SumarArendator({ landlord, refreshKey, currentDistributionKg = 0 }: Props) {
  const [status, setStatus] = useState<LandlordDistributionStatus | null>(null)
  const [prices, setPrices] = useState<CropPrice[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshingPrices, setRefreshingPrices] = useState(false)
  const [manualEdit, setManualEdit] = useState<Record<string, string>>({})
  const [savingCrop, setSavingCrop] = useState<string | null>(null)
  const [cropBreakdown, setCropBreakdown] = useState<{
    contractedByCrop: Record<string, number>
    distributedByCrop: Record<string, number>
  } | null>(null)

  const displayName = landlord
    ? landlord.type === 'LEGAL'
      ? landlord.company_name ?? ''
      : `${landlord.last_name} ${landlord.first_name}`.trim()
    : null

  const initials = landlord
    ? landlord.type === 'LEGAL'
      ? (landlord.company_name ?? 'SC').slice(0, 2).toUpperCase()
      : `${(landlord.last_name ?? '').charAt(0)}${(landlord.first_name ?? '').charAt(0)}`.toUpperCase()
    : null

  const load = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const currentYear = new Date().getFullYear()

      const [{ data: convData }, { data: contractsData }, { data: pricesData }, { data: txnsData }] = await Promise.all([
        supabase
          .from('arenda_conversions')
          .select('id, from_crop_name, from_quantity_kg, from_price_per_kg, to_crop_name, to_quantity_kg, to_price_per_kg, conversion_rate, value_ron, delivery_method, distribution_date, notes, status, transaction_id, created_at, contract_id, contracts(contract_number)')
          .eq('lessor_id', id)
          .eq('status', 'confirmed')
          .order('distribution_date', { ascending: false })
          .limit(50),
        supabase.from('contracts').select('id').eq('lessor_id', id).eq('status', 'ACTIVE'),
        supabase
          .from('crop_prices')
          .select('id, crop_name, price_per_kg, source, effective_date, notes')
          .or(`user_id.is.null,user_id.eq.${user.id}`)
          .order('effective_date', { ascending: false }),
        // Real distributions from the transactions table (matches contract page data)
        supabase
          .from('transactions')
          .select('product_name, kg_net')
          .eq('lessor_id', id)
          .eq('campaign_year', currentYear)
          .eq('is_previzionata', false),
      ])

      const priceSeen = new Map<string, CropPrice>()
      for (const row of (pricesData ?? []) as CropPrice[]) {
        if (!priceSeen.has(row.crop_name)) priceSeen.set(row.crop_name, row)
      }
      setPrices(Array.from(priceSeen.values()).sort((a, b) => a.crop_name.localeCompare(b.crop_name, 'ro')))

      const contractIds = (contractsData ?? []).map((c: any) => c.id)
      let ptPerCrop: any[] = []
      if (contractIds.length > 0) {
        // Filter to current campaign year to match contract page totals
        const { data: ptData } = await supabase
          .from('parcel_transactions')
          .select('product_type, total_quantity, campaign_year')
          .in('contract_id', contractIds)
          .eq('campaign_year', currentYear)
        ptPerCrop = ptData ?? []
      }

      // Per-crop contracted (from parcel_transactions for current year)
      const contractedByCrop: Record<string, number> = {}
      for (const pt of ptPerCrop) {
        if (pt.product_type) {
          contractedByCrop[pt.product_type] = (contractedByCrop[pt.product_type] ?? 0) + Number(pt.total_quantity)
        }
      }
      const totalKg = Object.values(contractedByCrop).reduce((s, v) => s + v, 0)

      // Per-crop distributed — from transactions table (same source as contract page)
      const txnRows = (txnsData ?? []) as any[]
      const distributedByCrop: Record<string, number> = {}
      for (const t of txnRows) {
        if (t.product_name) {
          distributedByCrop[t.product_name] = (distributedByCrop[t.product_name] ?? 0) + Number(t.kg_net)
        }
      }
      // Include any crops in parcel_transactions that have no transactions yet
      for (const crop of Object.keys(contractedByCrop)) {
        if (!(crop in distributedByCrop)) distributedByCrop[crop] = 0
      }
      setCropBreakdown({ contractedByCrop, distributedByCrop })

      const convRows = (convData ?? []) as any[]
      const distributedKg = Object.values(distributedByCrop).reduce((s, v) => s + v, 0)
      const valueRon = convRows.reduce((s: number, c: any) => s + Number(c.value_ron ?? 0), 0)

      setStatus({
        total_kg: totalKg,
        distributed_kg: distributedKg,
        remaining_kg: Math.max(0, totalKg - distributedKg),
        percent_distributed: totalKg > 0 ? Math.round((distributedKg / totalKg) * 100) : 0,
        value_ron: valueRon,
        conversions: convRows.map((c: any) => ({
          ...c,
          contract_number: c.contracts?.contract_number ?? null,
          lessor_id: id,
          user_id: user.id,
          campaign_id: c.campaign_id ?? null,
        })),
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (landlord?.id) void load(landlord.id)
  }, [landlord?.id, refreshKey, load])

  async function handleRefreshPrices() {
    setRefreshingPrices(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase
        .from('crop_prices')
        .select('id, crop_name, price_per_kg, source, effective_date, notes')
        .or(user ? `user_id.is.null,user_id.eq.${user.id}` : 'user_id.is.null')
        .order('effective_date', { ascending: false })
      const seen = new Map<string, CropPrice>()
      for (const row of (data ?? []) as CropPrice[]) {
        if (!seen.has(row.crop_name)) seen.set(row.crop_name, row)
      }
      setPrices(Array.from(seen.values()).sort((a, b) => a.crop_name.localeCompare(b.crop_name, 'ro')))
      toast.success('Prețuri actualizate')
    } finally {
      setRefreshingPrices(false)
    }
  }

  async function handleSaveManualPrice(cropName: string) {
    const val = parseFloat(manualEdit[cropName] ?? '')
    if (isNaN(val) || val <= 0) { toast.error('Preț invalid'); return }
    setSavingCrop(cropName)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('Neautentificat'); return }
      const { error } = await supabase.from('crop_prices').insert({
        user_id: user.id,
        crop_name: cropName,
        price_per_kg: val,
        source: 'MANUAL',
        effective_date: new Date().toISOString().split('T')[0],
        notes: 'Preț manual',
      })
      if (error) { toast.error(error.message); return }
      toast.success(`Preț ${cropName} salvat`)
      await handleRefreshPrices()
      setManualEdit((prev) => { const n = { ...prev }; delete n[cropName]; return n })
    } finally {
      setSavingCrop(null)
    }
  }

  // Effective total when previewing current form input
  const effectiveDistributed = (status?.distributed_kg ?? 0) + currentDistributionKg
  const effectiveRemaining = Math.max(0, (status?.total_kg ?? 0) - effectiveDistributed)
  const effectivePercent =
    (status?.total_kg ?? 0) > 0
      ? Math.min(100, Math.round((effectiveDistributed / status!.total_kg) * 100))
      : status?.percent_distributed ?? 0

  if (!landlord) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 flex flex-col items-center justify-center gap-3 min-h-[200px]">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
          <User className="w-6 h-6 text-gray-400" />
        </div>
        <p className="text-sm text-gray-500 text-center">
          Selectează un arendator din stânga pentru a vedea situația distribuirii
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Landlord header card */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Situație {displayName?.split(' ')[0]}
        </p>
        <div className="flex items-start gap-3">
          <div
            className={clsx(
              'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
              landlord.type === 'LEGAL'
                ? 'bg-purple-100 text-purple-700'
                : 'bg-brand-100 text-brand-700',
            )}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-gray-900 text-sm">{displayName}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {landlord.cnp} · {landlord.locality}
            </div>
          </div>
          {landlord.type === 'LEGAL' ? (
            <Building2 className="w-4 h-4 text-purple-400 flex-shrink-0 mt-1" />
          ) : (
            <User className="w-4 h-4 text-brand-400 flex-shrink-0 mt-1" />
          )}
        </div>

        {/* Progress bar */}
        {loading ? (
          <div className="mt-4 flex items-center gap-2 text-gray-400 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Se încarcă...
          </div>
        ) : status ? (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Progress distribuire</span>
              <span className="font-semibold text-gray-700">
                {status.distributed_kg.toLocaleString('ro-RO', { maximumFractionDigits: 0 })} /{' '}
                {status.total_kg.toLocaleString('ro-RO', { maximumFractionDigits: 0 })} kg
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className={clsx(
                  'h-2.5 rounded-full transition-all duration-500',
                  effectivePercent >= 100 ? 'bg-green-500' : 'bg-brand-500',
                )}
                style={{ width: `${Math.min(100, effectivePercent)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-xs text-brand-600 font-medium">{effectivePercent}% distribuit</span>
              <span className="text-xs text-gray-500">
                {effectiveRemaining.toLocaleString('ro-RO', { maximumFractionDigits: 0 })} kg rămas
              </span>
            </div>
          </div>
        ) : null}
      </div>

      {/* Summary table */}
      {status && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Situație distribuire</p>
          <div className="space-y-2">
            {[
              { label: 'Total contractat', value: `${status.total_kg.toLocaleString('ro-RO', { maximumFractionDigits: 0 })} kg` },
              { label: 'Distribuit anterior', value: `${status.distributed_kg.toLocaleString('ro-RO', { maximumFractionDigits: 0 })} kg` },
              {
                label: 'Această distribuire',
                value: currentDistributionKg > 0
                  ? `${currentDistributionKg.toLocaleString('ro-RO', { maximumFractionDigits: 1 })} kg`
                  : '—',
                highlight: currentDistributionKg > 0,
              },
              {
                label: 'Rămas după confirmare',
                value: `${effectiveRemaining.toLocaleString('ro-RO', { maximumFractionDigits: 0 })} kg`,
                warning: effectiveRemaining < 0,
              },
              {
                label: 'Valoare RON',
                value: `${status.value_ron.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON`,
              },
            ].map((row) => (
              <div key={row.label} className="flex justify-between text-sm py-1.5 border-b border-gray-100 last:border-0">
                <span className="text-gray-500">{row.label}</span>
                <span
                  className={clsx(
                    'font-medium',
                    row.highlight ? 'text-blue-700' : row.warning ? 'text-red-600' : 'text-gray-900',
                  )}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MADR prices */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Prețuri referință MADR
          </p>
          <button
            onClick={handleRefreshPrices}
            disabled={refreshingPrices}
            className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={clsx('w-3 h-3', refreshingPrices && 'animate-spin')} />
            Actualizează prețuri
          </button>
        </div>

        {prices.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-2">Nu există prețuri</p>
        ) : (
          <div className="space-y-1.5">
            {prices.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-600">
                  {CROP_ICONS[p.crop_name] ?? '🌿'} {p.crop_name}
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">
                    {p.price_per_kg.toFixed(2)} RON/kg
                  </span>
                  {p.source === 'MANUAL' && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">manual</span>
                  )}
                </div>
              </div>
            ))}
            <p className="text-xs text-gray-400 mt-2">
              Sursa: MADR · actualizat periodic
            </p>
          </div>
        )}

        {/* Manual price update section */}
        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Actualizare preț manual
          </p>
          <div className="space-y-2">
            {prices.map((p) => (
              <div key={`manual-${p.crop_name}`} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-24 truncate flex-shrink-0">
                  {CROP_ICONS[p.crop_name]} {p.crop_name}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={p.price_per_kg.toFixed(2)}
                  value={manualEdit[p.crop_name] ?? ''}
                  onChange={(e) =>
                    setManualEdit((prev) => ({ ...prev, [p.crop_name]: e.target.value }))
                  }
                  className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <span className="text-xs text-gray-400 flex-shrink-0">RON/kg</span>
                <button
                  onClick={() => handleSaveManualPrice(p.crop_name)}
                  disabled={savingCrop === p.crop_name || !manualEdit[p.crop_name]}
                  className="px-2.5 py-1.5 text-xs bg-brand-500 text-white rounded hover:bg-brand-600 disabled:opacity-50 transition-colors flex-shrink-0"
                >
                  {savingCrop === p.crop_name ? '...' : 'Salvează'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Per-crop breakdown */}
      {cropBreakdown && Object.keys(cropBreakdown.contractedByCrop).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Situație pe culturi</p>
          <table className="w-full">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-100">
                <th className="text-left pb-2 font-semibold">Cultură</th>
                <th className="text-right pb-2 font-semibold">Contractat</th>
                <th className="text-right pb-2 font-semibold">Distribuit</th>
                <th className="text-right pb-2 font-semibold">Rămas</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(cropBreakdown.contractedByCrop).map(([crop, total]) => {
                const distributed = cropBreakdown.distributedByCrop[crop] ?? 0
                const remaining = Math.max(0, total - distributed)
                return (
                  <tr key={crop} className="border-b border-gray-50 last:border-0">
                    <td className="py-1.5 text-xs text-gray-700">{CROP_ICONS[crop] ?? '🌿'} {crop}</td>
                    <td className="py-1.5 text-xs text-right text-gray-600">{total.toLocaleString('ro-RO', { maximumFractionDigits: 0 })} kg</td>
                    <td className="py-1.5 text-xs text-right text-green-700 font-medium">{distributed.toLocaleString('ro-RO', { maximumFractionDigits: 0 })} kg</td>
                    <td className={clsx('py-1.5 text-xs text-right font-semibold', remaining === 0 ? 'text-gray-400' : 'text-amber-700')}>
                      {remaining.toLocaleString('ro-RO', { maximumFractionDigits: 0 })} kg
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* All distributions for this landlord */}
      {status && status.conversions.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Distribuiri anterioare ({status.conversions.length})
          </p>
          <div className="space-y-2">
            {status.conversions.map((conv) => (
              <div
                key={conv.id}
                className="flex items-start justify-between py-2 border-b border-gray-100 last:border-0 text-sm"
              >
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <div className="text-gray-700 font-medium">
                      {conv.from_quantity_kg} kg {conv.from_crop_name} → {conv.to_quantity_kg.toLocaleString('ro-RO', { maximumFractionDigits: 1 })} kg {conv.to_crop_name}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {conv.contract_number ?? '—'} · {conv.distribution_date}
                    </div>
                  </div>
                </div>
                <span className="text-sm font-semibold text-gray-700 flex-shrink-0 ml-2">
                  {conv.value_ron.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
