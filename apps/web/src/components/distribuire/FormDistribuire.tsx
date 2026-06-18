'use client'

import { useState, useEffect, useCallback } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { clsx } from 'clsx'
import { Warehouse, Truck, CreditCard, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { createClient } from '@/lib/supabase/client'
import { ConversionCalculator } from './ConversionCalculator'
import type { Contract, CropPrice, LandlordSearchResult, ConversionResult } from '@/types/distribuire'

// ─── Zod schema ───────────────────────────────────────────────────────────────

const schema = z.object({
  lessor_id: z.string().uuid(),
  contract_id: z.string().min(1, 'Selectează contractul'),
  from_crop_name: z.string().min(1, 'Selectează cultura sursă'),
  from_quantity_kg: z.number({ invalid_type_error: 'Introdu o cantitate' }).positive('Cantitatea trebuie să fie pozitivă'),
  to_crop_name: z.string().min(1, 'Selectează cultura destinație'),
  to_quantity_kg: z.number().min(0),
  conversion_rate: z.number().min(0),
  from_price_per_kg: z.number().positive(),
  to_price_per_kg: z.number().positive(),
  distribution_date: z.string().min(1, 'Selectează data'),
  delivery_method: z.enum(['siloz', 'livrare_ferma', 'transfer_bancar']),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

// ─── Delivery methods ─────────────────────────────────────────────────────────

interface DeliveryOption {
  value: 'siloz' | 'livrare_ferma' | 'transfer_bancar'
  label: string
  icon: React.ElementType
}

const DELIVERY_OPTIONS: DeliveryOption[] = [
  { value: 'siloz', label: 'Siloz', icon: Warehouse },
  { value: 'livrare_ferma', label: 'La fermă', icon: Truck },
  { value: 'transfer_bancar', label: 'Transfer bancar', icon: CreditCard },
]

// ─── Props ────────────────────────────────────────────────────────────────────

interface CropBreakdown {
  contractedByCrop: Record<string, number>
  distributedByCrop: Record<string, number>
}

interface Props {
  landlord: LandlordSearchResult
  cropBreakdown: CropBreakdown | null
  onSuccess: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FormDistribuire({ landlord, cropBreakdown, onSuccess }: Props) {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [prices, setPrices] = useState<CropPrice[]>([])
  const [loadingInit, setLoadingInit] = useState(true)
  const [conversionResult, setConversionResult] = useState<ConversionResult | null>(null)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const displayName =
    landlord.type === 'LEGAL'
      ? landlord.company_name ?? ''
      : `${landlord.last_name} ${landlord.first_name}`.trim()

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      lessor_id: landlord.id,
      contract_id: '',
      from_crop_name: '',
      to_crop_name: '',
      from_quantity_kg: 0,
      to_quantity_kg: 0,
      conversion_rate: 1,
      from_price_per_kg: 0,
      to_price_per_kg: 0,
      distribution_date: new Date().toISOString().split('T')[0],
      delivery_method: 'siloz',
      notes: '',
    },
  })

  const fromCropName = watch('from_crop_name')
  const toCropName = watch('to_crop_name')
  const fromQuantityKg = watch('from_quantity_kg')
  const contractId = watch('contract_id')
  const distributionDate = watch('distribution_date')

  // Per-crop remaining validation
  const remainingForCrop = fromCropName && cropBreakdown
    ? Math.max(0, (cropBreakdown.contractedByCrop[fromCropName] ?? 0) - (cropBreakdown.distributedByCrop[fromCropName] ?? 0))
    : null
  const cropFullyDistributed = remainingForCrop === 0 && !!fromCropName && cropBreakdown !== null
  const quantityExceedsRemaining = remainingForCrop !== null && remainingForCrop > 0 && fromQuantityKg > remainingForCrop
  const deliveryMethod = watch('delivery_method')
  const toQuantityKg = watch('to_quantity_kg')

  // Load contracts and prices on mount
  useEffect(() => {
    async function init() {
      setLoadingInit(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const [{ data: contractsData }, { data: rawPrices }] = await Promise.all([
        supabase
          .from('contracts')
          .select('id, contract_number, contract_type, start_date, end_date, status, zone, annual_rent, lessor_id')
          .eq('lessor_id', landlord.id)
          .eq('status', 'ACTIVE')
          .order('contract_number'),
        supabase
          .from('crop_prices')
          .select('id, crop_name, price_per_kg, source, effective_date, notes')
          .or(user ? `user_id.is.null,user_id.eq.${user.id}` : 'user_id.is.null')
          .order('effective_date', { ascending: false }),
      ])
      const contracts = (contractsData ?? []) as Contract[]
      setContracts(contracts)
      if (contracts.length === 1) setValue('contract_id', contracts[0].id)
      const seen = new Map<string, CropPrice>()
      for (const row of (rawPrices ?? []) as CropPrice[]) {
        if (!seen.has(row.crop_name)) seen.set(row.crop_name, row)
      }
      setPrices(Array.from(seen.values()).sort((a, b) => a.crop_name.localeCompare(b.crop_name, 'ro')))
      setLoadingInit(false)
    }
    void init()
  }, [landlord.id, setValue])

  // Sync conversion result into form values
  const handleConversionResult = useCallback(
    (result: ConversionResult | null) => {
      setConversionResult(result)
      if (result) {
        setValue('to_quantity_kg', result.toQuantityKg)
        setValue('conversion_rate', result.rate)
      } else {
        setValue('to_quantity_kg', 0)
        setValue('conversion_rate', 1)
      }
    },
    [setValue],
  )

  // Sync price fields when crops change
  useEffect(() => {
    const fromPrice = prices.find((p) => p.crop_name === fromCropName)?.price_per_kg
    const toPrice = prices.find((p) => p.crop_name === toCropName)?.price_per_kg
    if (fromPrice) setValue('from_price_per_kg', fromPrice)
    if (toPrice) setValue('to_price_per_kg', toPrice)
  }, [fromCropName, toCropName, prices, setValue])

  async function onSubmit(values: FormValues) {
    if (cropFullyDistributed) {
      toast.error(`Cultura ${fromCropName} a fost distribuită complet — cantitate rămasă 0 kg`)
      return
    }
    if (quantityExceedsRemaining && remainingForCrop !== null) {
      toast.error(`Cantitate depășește disponibilul de ${remainingForCrop.toLocaleString('ro-RO', { maximumFractionDigits: 0 })} kg pentru ${fromCropName}`)
      return
    }
    setShowConfirmModal(true)
  }

  async function handleConfirm() {
    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { toast.error('Neautentificat'); return }

      const { data: campaign } = await supabase
        .from('campaigns').select('id').eq('is_active', true).maybeSingle()

      const fromPrice = prices.find((p) => p.crop_name === fromCropName)?.price_per_kg ?? 0
      const toPrice = prices.find((p) => p.crop_name === toCropName)?.price_per_kg ?? 0

      const { error } = await supabase.rpc('execute_arenda_distribution', {
        p_user_id: user.id,
        p_lessor_id: landlord.id,
        p_contract_id: contractId,
        p_campaign_id: campaign?.id ?? null,
        p_from_crop_name: fromCropName,
        p_from_quantity_kg: fromQuantityKg,
        p_from_price_per_kg: fromPrice,
        p_to_crop_name: toCropName,
        p_to_quantity_kg: conversionResult?.toQuantityKg ?? 0,
        p_to_price_per_kg: toPrice,
        p_conversion_rate: conversionResult?.rate ?? 1,
        p_value_ron: fromQuantityKg * fromPrice,
        p_delivery_method: deliveryMethod,
        p_distribution_date: distributionDate,
        p_notes: watch('notes') ?? null,
      })
      if (error) { toast.error(error.message); return }
      toast.success('Distribuire confirmată cu succes!')
      setShowConfirmModal(false)
      onSuccess()
    } finally {
      setSubmitting(false)
    }
  }

  const selectedContract = contracts.find((c) => c.id === contractId)
  const valueRon = conversionResult?.valueRon ?? null

  if (loadingInit) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-center gap-2 text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Se încarcă datele...</span>
      </div>
    )
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Step header */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center">
              <span className="text-white text-xs">✓</span>
            </div>
            <span className="text-sm font-semibold text-gray-700">
              Configurare distribuire — <span className="text-brand-600">{displayName}</span>
            </span>
          </div>

          {/* Contract selector */}
          <div className="mb-4">
            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
              Contract
            </label>
            {contracts.length === 0 ? (
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                Niciun contract activ găsit pentru acest arendator
              </div>
            ) : (
              <select
                {...register('contract_id')}
                className={clsx(
                  'w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 appearance-none bg-white',
                  errors.contract_id ? 'border-red-400' : 'border-gray-300',
                )}
              >
                <option value="">Selectează contractul...</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.contract_number} · {c.zone ?? c.contract_type} · {c.start_date} – {c.end_date}
                  </option>
                ))}
              </select>
            )}
            {errors.contract_id && (
              <p className="mt-1 text-xs text-red-500">{errors.contract_id.message}</p>
            )}
          </div>

          {/* Conversion calculator */}
          <ConversionCalculator
            fromCropName={fromCropName}
            toCropName={toCropName}
            fromQuantityKg={fromQuantityKg}
            prices={prices}
            loading={false}
            onResult={handleConversionResult}
            onRefreshPrices={async () => {
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
            }}
            onFromCropChange={(v) => setValue('from_crop_name', v, { shouldValidate: true })}
            onToCropChange={(v) => setValue('to_crop_name', v, { shouldValidate: true })}
            onFromQuantityChange={(v) => setValue('from_quantity_kg', v, { shouldValidate: true })}
          />

          {/* Per-crop availability warnings */}
          {fromCropName && cropBreakdown && (
            cropFullyDistributed ? (
              <div className="mt-3 flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-red-700">
                  <strong>Distribuit complet!</strong> Cantitate disponibilă pentru <strong>{fromCropName}</strong>: <strong>0 kg</strong>.
                  Arendatorul a primit toată cantitatea contractată pentru această cultură.
                </div>
              </div>
            ) : quantityExceedsRemaining ? (
              <div className="mt-3 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                Cantitate depășește disponibilul de{' '}
                <strong>{remainingForCrop!.toLocaleString('ro-RO', { maximumFractionDigits: 0 })} kg</strong>{' '}
                pentru {fromCropName}
              </div>
            ) : remainingForCrop !== null ? (
              <p className="mt-1.5 text-xs text-amber-700 font-medium">
                Disponibil {fromCropName}: {remainingForCrop.toLocaleString('ro-RO', { maximumFractionDigits: 0 })} kg
                {fromQuantityKg > 0 && ` · Rămas după confirmare: ${Math.max(0, remainingForCrop - fromQuantityKg).toLocaleString('ro-RO', { maximumFractionDigits: 0 })} kg`}
              </p>
            ) : null
          )}

          {errors.from_crop_name && (
            <p className="mt-1 text-xs text-red-500">{errors.from_crop_name.message}</p>
          )}
          {errors.to_crop_name && (
            <p className="mt-1 text-xs text-red-500">{errors.to_crop_name.message}</p>
          )}
          {errors.from_quantity_kg && (
            <p className="mt-1 text-xs text-red-500">{errors.from_quantity_kg.message}</p>
          )}
        </div>

        {/* Delivery method */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <label className="block text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">
            Metodă de livrare
          </label>
          <Controller
            control={control}
            name="delivery_method"
            render={({ field }) => (
              <div className="grid grid-cols-3 gap-2">
                {DELIVERY_OPTIONS.map((opt) => {
                  const Icon = opt.icon
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => field.onChange(opt.value)}
                      className={clsx(
                        'flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium border transition-all',
                        field.value === opt.value
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50',
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            )}
          />
        </div>

        {/* Distribution date */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
            Data distribuirii
          </label>
          <input
            type="date"
            {...register('distribution_date')}
            className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>

        {/* Notes */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
            Note (opțional)
          </label>
          <textarea
            {...register('notes')}
            rows={2}
            placeholder="Observații despre această distribuire..."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
          />
        </div>

        {/* Transaction preview */}
        {conversionResult && contractId && fromCropName && toCropName && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-sm font-semibold text-gray-700">Previzualizare tranzacție</span>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Arendator</span>
                <span className="font-medium text-gray-900">{displayName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Cultură dată</span>
                <span className="font-medium text-gray-900">{fromQuantityKg} kg {fromCropName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Cultură primită</span>
                <span className="font-medium text-gray-900">
                  {conversionResult.toQuantityKg.toLocaleString('ro-RO', { maximumFractionDigits: 1 })} kg {toCropName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Valoare RON</span>
                <span className="font-medium text-gray-900">
                  {conversionResult.valueRon.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Metodă</span>
                <span className="font-medium text-gray-900">
                  {DELIVERY_OPTIONS.find((d) => d.value === deliveryMethod)?.label}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Data</span>
                <span className="font-medium text-gray-900">{distributionDate}</span>
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-400">
              Va apărea în: Tranzacții · Contract {selectedContract?.contract_number ?? '—'} · Dashboard arendator
            </p>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={!contractId || !fromCropName || !toCropName || !conversionResult || submitting}
          className="w-full flex items-center justify-center gap-2 py-3 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          Confirmă distribuirea
        </button>
      </form>

      {/* Confirmation modal */}
      {showConfirmModal && conversionResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !submitting && setShowConfirmModal(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Confirmi distribuirea?</h3>
            <p className="text-sm text-gray-500 mb-4">
              Această acțiune este ireversibilă după confirmare.
            </p>

            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm mb-5">
              <div className="flex justify-between">
                <span className="text-gray-500">Arendator</span>
                <span className="font-semibold">{displayName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Contract</span>
                <span className="font-semibold">{selectedContract?.contract_number ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">De distribuit</span>
                <span className="font-semibold">
                  {fromQuantityKg} kg {fromCropName}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Primește</span>
                <span className="font-semibold">
                  {conversionResult.toQuantityKg.toLocaleString('ro-RO', { maximumFractionDigits: 1 })} kg {toCropName}
                </span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2 mt-2">
                <span className="text-gray-500 font-medium">Valoare totală</span>
                <span className="font-bold text-brand-700 text-base">
                  {conversionResult.valueRon.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Livrare</span>
                <span className="font-semibold">
                  {DELIVERY_OPTIONS.find((d) => d.value === deliveryMethod)?.label}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Data</span>
                <span className="font-semibold">{distributionDate}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Anulează
              </button>
              <button
                onClick={handleConfirm}
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmă
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
