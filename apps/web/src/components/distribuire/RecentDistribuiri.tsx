'use client'

import { useState, useCallback } from 'react'
import { Eye, X, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import type { ArendaConversion } from '@/types/distribuire'
import { createClient } from '@/lib/supabase/client'

const DELIVERY_LABELS: Record<string, string> = {
  siloz: 'Siloz',
  livrare_ferma: 'La fermă',
  transfer_bancar: 'Transfer bancar',
}
const STATUS_DOT: Record<string, string> = {
  confirmed: 'bg-green-500',
  draft: 'bg-amber-400',
  cancelled: 'bg-gray-400',
}
const CROP_ICONS: Record<string, string> = {
  'Porumb': '🌽',
  'Grâu': '🌾',
  'Floarea-soarelui': '🌻',
  'Rapiță': '🌿',
  'Soia': '🫘',
  'Orz': '🌾',
}

interface Props {
  initialData?: ArendaConversion[]
  refreshKey?: number
}

export function RecentDistribuiri({ initialData = [], refreshKey }: Props) {
  const [items, setItems] = useState<ArendaConversion[]>(initialData)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<ArendaConversion | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('arenda_conversions')
        .select('id, lessor_id, contract_id, campaign_id, from_crop_name, from_quantity_kg, from_price_per_kg, to_crop_name, to_quantity_kg, to_price_per_kg, conversion_rate, value_ron, delivery_method, distribution_date, notes, status, transaction_id, created_at, lessors(first_name, last_name, company_name, type), contracts(contract_number)')
        .order('created_at', { ascending: false })
        .limit(10)
      setItems(
        ((data ?? []) as any[]).map((c) => ({
          ...c,
          user_id: '',
          lessor_name:
            c.lessors?.type === 'LEGAL'
              ? c.lessors.company_name
              : `${c.lessors?.last_name ?? ''} ${c.lessors?.first_name ?? ''}`.trim(),
          contract_number: c.contracts?.contract_number ?? null,
        })) as ArendaConversion[],
      )
    } finally {
      setLoading(false)
    }
  }, [])

  // Load on mount if no initialData
  useState(() => {
    if (initialData.length === 0) void load()
  })

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
          Distribuiri recente
        </p>
        <button
          onClick={load}
          disabled={loading}
          className="text-xs text-brand-600 hover:text-brand-800 transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            'Reîncarcă'
          )}
        </button>
      </div>

      {loading && items.length === 0 ? (
        <div className="flex items-center justify-center py-6 text-gray-400 gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Se încarcă...</span>
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">
          Nicio distribuire înregistrată
        </p>
      ) : (
        <div className="space-y-1">
          {items.map((item) => (
            <div
              key={item.id}
              className="group flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              onClick={() => setSelected(item)}
            >
              {/* Status dot */}
              <div className="flex-shrink-0 mt-1.5">
                <div className={clsx('w-2.5 h-2.5 rounded-full', STATUS_DOT[item.status] ?? 'bg-gray-300')} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 text-sm font-medium text-gray-800 truncate">
                  <span>{item.lessor_name ?? '—'}</span>
                  {item.contract_number && (
                    <>
                      <span className="text-gray-400">·</span>
                      <span className="text-xs text-gray-500">{item.contract_number}</span>
                    </>
                  )}
                </div>
                <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
                  <span>{CROP_ICONS[item.from_crop_name] ?? '🌿'} {item.from_quantity_kg} kg {item.from_crop_name}</span>
                  <span className="text-gray-300">→</span>
                  <span>{CROP_ICONS[item.to_crop_name] ?? '🌿'} {item.to_crop_name}</span>
                  <span className="text-gray-300">·</span>
                  <span>{item.distribution_date}</span>
                </div>
              </div>

              {/* Amount */}
              <div className="flex-shrink-0 text-right">
                <div className="text-sm font-semibold text-gray-900">
                  {item.to_quantity_kg.toLocaleString('ro-RO', { maximumFractionDigits: 1 })} kg
                </div>
                <div className="text-xs text-gray-500">
                  {item.value_ron.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON
                </div>
              </div>

              {/* Eye icon on hover */}
              <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
                <Eye className="w-4 h-4 text-gray-400" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-gray-900">Detalii distribuire</h3>
              <button
                onClick={() => setSelected(null)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Status */}
              <div className="flex items-center gap-2">
                <div className={clsx('w-2.5 h-2.5 rounded-full', STATUS_DOT[selected.status])} />
                <span className="text-sm font-medium capitalize text-gray-700">{selected.status}</span>
              </div>

              {/* Conversion visual */}
              <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between gap-3">
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900">
                    {selected.from_quantity_kg.toLocaleString('ro-RO', { maximumFractionDigits: 1 })} kg
                  </div>
                  <div className="text-sm text-gray-600 mt-0.5">
                    {CROP_ICONS[selected.from_crop_name]} {selected.from_crop_name}
                  </div>
                  <div className="text-xs text-gray-400">
                    {selected.from_price_per_kg.toFixed(2)} RON/kg
                  </div>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-lg">→</span>
                  <span className="text-xs font-semibold text-gray-600 mt-0.5">
                    {selected.value_ron.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON
                  </span>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-900">
                    {selected.to_quantity_kg.toLocaleString('ro-RO', { maximumFractionDigits: 1 })} kg
                  </div>
                  <div className="text-sm text-gray-600 mt-0.5">
                    {CROP_ICONS[selected.to_crop_name]} {selected.to_crop_name}
                  </div>
                  <div className="text-xs text-gray-400">
                    {selected.to_price_per_kg.toFixed(2)} RON/kg
                  </div>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                {[
                  { label: 'Arendator', value: selected.lessor_name ?? '—' },
                  { label: 'Contract', value: selected.contract_number ?? '—' },
                  { label: 'Rată conversie', value: `1 kg = ${selected.conversion_rate.toFixed(4)} kg` },
                  { label: 'Metodă livrare', value: DELIVERY_LABELS[selected.delivery_method] ?? selected.delivery_method },
                  { label: 'Data distribuirii', value: selected.distribution_date },
                  { label: 'Înregistrat la', value: new Date(selected.created_at).toLocaleDateString('ro-RO') },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between py-1.5 border-b border-gray-100 last:border-0">
                    <span className="text-gray-500">{row.label}</span>
                    <span className="font-medium text-gray-900">{row.value}</span>
                  </div>
                ))}
                {selected.notes && (
                  <div className="pt-2">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Note</span>
                    <p className="mt-1 text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{selected.notes}</p>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setSelected(null)}
              className="mt-5 w-full py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Închide
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
