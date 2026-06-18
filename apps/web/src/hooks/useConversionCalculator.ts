'use client'

import { useState, useCallback, useRef } from 'react'
import type { CropPrice, ConversionResult } from '@/types/distribuire'
import { createClient } from '@/lib/supabase/client'

export function useConversionCalculator() {
  const [prices, setPrices] = useState<CropPrice[]>([])
  const [loading, setLoading] = useState(false)
  const fetchedRef = useRef(false)

  async function fetchPricesFromDB(): Promise<CropPrice[]> {
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
    return Array.from(seen.values()).sort((a, b) => a.crop_name.localeCompare(b.crop_name, 'ro'))
  }

  const loadPrices = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchPricesFromDB()
      setPrices(data)
      fetchedRef.current = true
    } finally {
      setLoading(false)
    }
  }, [])

  // Lazy-load on first call
  const ensurePrices = useCallback(async (): Promise<CropPrice[]> => {
    if (fetchedRef.current) return prices
    setLoading(true)
    try {
      const data = await fetchPricesFromDB()
      setPrices(data)
      fetchedRef.current = true
      return data
    } finally {
      setLoading(false)
    }
  }, [prices])

  const refreshPrices = useCallback(async () => {
    fetchedRef.current = false
    await loadPrices()
  }, [loadPrices])

  const calculate = useCallback(
    (fromCropName: string, toCropName: string, quantityKg: number): ConversionResult | null => {
      if (!quantityKg || quantityKg <= 0) return null

      const fromPrice = prices.find((p) => p.crop_name === fromCropName)?.price_per_kg
      const toPrice = prices.find((p) => p.crop_name === toCropName)?.price_per_kg

      if (!fromPrice || !toPrice) return null

      // Same crop: 1:1
      if (fromCropName === toCropName) {
        return { toQuantityKg: quantityKg, valueRon: quantityKg * fromPrice, rate: 1 }
      }

      const valueRon = quantityKg * fromPrice
      const toQuantityKg = valueRon / toPrice
      const rate = fromPrice / toPrice

      return {
        toQuantityKg: Math.round(toQuantityKg * 10) / 10,
        valueRon: Math.round(valueRon * 100) / 100,
        rate: Math.round(rate * 10000) / 10000,
      }
    },
    [prices],
  )

  const getPriceForCrop = useCallback(
    (cropName: string): number | null => {
      return prices.find((p) => p.crop_name === cropName)?.price_per_kg ?? null
    },
    [prices],
  )

  return {
    prices,
    loading,
    calculate,
    getPriceForCrop,
    refreshPrices,
    ensurePrices,
  }
}
