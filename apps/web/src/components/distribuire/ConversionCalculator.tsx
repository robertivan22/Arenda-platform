'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, ArrowRight, Info } from 'lucide-react'
import { clsx } from 'clsx'
import type { CropPrice, ConversionResult } from '@/types/distribuire'
import { createClient } from '@/lib/supabase/client'
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
const CROP_COLORS: Record<string, string> = {
  'Porumb': 'text-orange-600',
  'Grâu': 'text-amber-600',
  'Floarea-soarelui': 'text-yellow-600',
  'Rapiță': 'text-green-600',
  'Soia': 'text-lime-600',
  'Orz': 'text-teal-600',
  'Ovăz': 'text-blue-600',
  'Secară': 'text-slate-600',
  'Triticale': 'text-stone-600',
  'Mazăre': 'text-emerald-600',
  'Sfeclă de zahăr': 'text-pink-600',
  'Lucernă': 'text-green-700',
}

interface Props {
  fromCropName: string
  toCropName: string
  fromQuantityKg: number
  prices: CropPrice[]
  loading: boolean
  onResult: (result: ConversionResult | null) => void
  onRefreshPrices: () => Promise<void>
  onFromCropChange: (cropName: string) => void
  onToCropChange: (cropName: string) => void
  onFromQuantityChange: (qty: number) => void
}

type PriceMode = 'MADR' | 'MANUAL'

export function ConversionCalculator({
  fromCropName,
  toCropName,
  fromQuantityKg,
  prices,
  loading,
  onResult,
  onRefreshPrices,
  onFromCropChange,
  onToCropChange,
  onFromQuantityChange,
}: Props) {
  const [priceMode, setPriceMode] = useState<PriceMode>('MADR')
  const [manualPrices, setManualPrices] = useState<Record<string, string>>({})
  const [savingPrice, setSavingPrice] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const cropNames = prices.map((p) => p.crop_name)

  const getPrice = useCallback(
    (cropName: string): number | null => {
      if (priceMode === 'MANUAL' && manualPrices[cropName]) {
        const v = parseFloat(manualPrices[cropName])
        return isNaN(v) || v <= 0 ? null : v
      }
      return prices.find((p) => p.crop_name === cropName)?.price_per_kg ?? null
    },
    [prices, priceMode, manualPrices],
  )

  // Recalculate whenever inputs change
  useEffect(() => {
    if (!fromCropName || !toCropName || !fromQuantityKg || fromQuantityKg <= 0) {
      onResult(null)
      return
    }
    const fromPrice = getPrice(fromCropName)
    const toPrice = getPrice(toCropName)
    if (!fromPrice || !toPrice) {
      onResult(null)
      return
    }

    if (fromCropName === toCropName) {
      onResult({ toQuantityKg: fromQuantityKg, valueRon: fromQuantityKg * fromPrice, rate: 1 })
      return
    }

    const valueRon = fromQuantityKg * fromPrice
    const toQty = valueRon / toPrice
    const rate = fromPrice / toPrice
    onResult({
      toQuantityKg: Math.round(toQty * 10) / 10,
      valueRon: Math.round(valueRon * 100) / 100,
      rate: Math.round(rate * 10000) / 10000,
    })
  }, [fromCropName, toCropName, fromQuantityKg, getPrice, onResult])

  const fromPrice = getPrice(fromCropName)
  const toPrice = getPrice(toCropName)
  const valueRon = fromPrice && fromQuantityKg > 0 ? fromQuantityKg * fromPrice : null
  const toQty = valueRon && toPrice ? Math.round((valueRon / toPrice) * 10) / 10 : null
  const rate = fromPrice && toPrice && fromCropName !== toCropName
    ? Math.round((fromPrice / toPrice) * 10000) / 10000
    : fromCropName === toCropName ? 1 : null

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await onRefreshPrices()
      toast.success('Prețuri actualizate')
    } finally {
      setRefreshing(false)
    }
  }

  async function handleSaveManualPrice(cropName: string) {
    const val = parseFloat(manualPrices[cropName] ?? '')
    if (isNaN(val) || val <= 0) {
      toast.error('Preț invalid')
      return
    }
    setSavingPrice(cropName)
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
      await onRefreshPrices()
    } finally {
      setSavingPrice(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Price mode selector */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Prețuri:</span>
        <div className="flex rounded-lg overflow-hidden border border-gray-200">
          {(['MADR', 'MANUAL'] as PriceMode[]).map((m) => (
            <button
              key={m}
              onClick={() => setPriceMode(m)}
              className={clsx(
                'px-3 py-1.5 text-xs font-semibold transition-colors',
                priceMode === m ? 'bg-brand-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50',
              )}
            >
              {m === 'MADR' ? 'Folosesc MADR' : 'Preț manual'}
            </button>
          ))}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-800 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={clsx('w-3.5 h-3.5', refreshing && 'animate-spin')} />
          Actualizează prețuri
        </button>
      </div>

      {/* Crop & quantity selectors */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
        {/* From crop */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
            Cultură contractată (de dat)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base">
              {CROP_ICONS[fromCropName] ?? '🌿'}
            </span>
            <select
              value={fromCropName}
              onChange={(e) => onFromCropChange(e.target.value)}
              className="w-full pl-8 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 appearance-none bg-white"
            >
              <option value="">Selectează cultura...</option>
              {cropNames.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {fromCropName && fromPrice && (
            <p className="mt-1 text-xs text-gray-500">
              {fromPrice.toFixed(2)} RON/kg
            </p>
          )}
        </div>

        {/* Arrow */}
        <div className="flex items-center justify-center pb-2">
          <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <ArrowRight className="w-4 h-4 text-gray-500" />
          </div>
        </div>

        {/* To crop */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
            Cultură de primit
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base">
              {CROP_ICONS[toCropName] ?? '🌿'}
            </span>
            <select
              value={toCropName}
              onChange={(e) => onToCropChange(e.target.value)}
              className="w-full pl-8 pr-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 appearance-none bg-white"
            >
              <option value="">Selectează cultura...</option>
              {cropNames.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {toCropName && toPrice && (
            <p className="mt-1 text-xs text-gray-500">
              {toPrice.toFixed(2)} RON/kg
            </p>
          )}
        </div>
      </div>

      {/* Quantity row */}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
            Cantitate de distribuit (kg)
          </label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={fromQuantityKg || ''}
            onChange={(e) => onFromQuantityChange(parseFloat(e.target.value) || 0)}
            placeholder="0"
            className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        <div className="flex justify-center pt-5">
          <div className="w-7 h-7 rounded flex items-center justify-center bg-gray-100 text-gray-400">
            ⇄
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
            Cantitate echivalentă (kg)
          </label>
          <input
            type="text"
            readOnly
            value={toQty != null ? toQty.toLocaleString('ro-RO', { maximumFractionDigits: 1 }) : ''}
            placeholder="Calculat automat"
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-700 cursor-not-allowed"
          />
        </div>
      </div>

      {/* Conversion summary box */}
      {fromCropName && toCropName && fromQuantityKg > 0 && toQty != null && valueRon != null && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="grid grid-cols-[1fr_auto_1fr] gap-4 items-center">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {fromQuantityKg.toLocaleString('ro-RO', { maximumFractionDigits: 1 })} kg
              </div>
              <div className={clsx('text-sm font-medium mt-0.5', CROP_COLORS[fromCropName] ?? 'text-gray-600')}>
                {CROP_ICONS[fromCropName]} {fromCropName}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {fromPrice?.toFixed(2)} RON/kg
              </div>
            </div>

            <div className="flex flex-col items-center gap-1">
              <ArrowRight className="w-5 h-5 text-amber-500" />
              <span className="text-xs font-semibold text-amber-600">
                {valueRon.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON
              </span>
            </div>

            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {toQty.toLocaleString('ro-RO', { maximumFractionDigits: 1 })} kg
              </div>
              <div className={clsx('text-sm font-medium mt-0.5', CROP_COLORS[toCropName] ?? 'text-gray-600')}>
                {CROP_ICONS[toCropName]} {toCropName}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {toPrice?.toFixed(2)} RON/kg
              </div>
            </div>
          </div>

          {rate != null && fromCropName !== toCropName && (
            <div className="mt-3 text-center text-xs text-amber-700 font-medium">
              Rată de conversie: 1 kg {fromCropName} = {rate.toLocaleString('ro-RO', { maximumFractionDigits: 4 })} kg {toCropName}
              &nbsp;·&nbsp;
              Valoare totală:{' '}
              <strong>
                {valueRon.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON
              </strong>
            </div>
          )}
        </div>
      )}

      {/* Manual price inputs (shown only in MANUAL mode) */}
      {priceMode === 'MANUAL' && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-semibold text-blue-700">Prețuri personalizate</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {prices.map((p) => (
              <div key={p.crop_name} className="flex items-center gap-2">
                <span className="text-xs text-gray-600 w-28 truncate">
                  {CROP_ICONS[p.crop_name]} {p.crop_name}
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={p.price_per_kg.toFixed(2)}
                  value={manualPrices[p.crop_name] ?? ''}
                  onChange={(e) =>
                    setManualPrices((prev) => ({ ...prev, [p.crop_name]: e.target.value }))
                  }
                  className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 w-16"
                />
                <button
                  disabled={savingPrice === p.crop_name}
                  onClick={() => handleSaveManualPrice(p.crop_name)}
                  className="px-2 py-1 text-xs bg-brand-500 text-white rounded hover:bg-brand-600 disabled:opacity-50 transition-colors"
                >
                  {savingPrice === p.crop_name ? '...' : 'Salv'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
