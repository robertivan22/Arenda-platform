'use server'

import { createClient } from '@/lib/supabase/server'
import type {
  LandlordSearchResult,
  Contract,
  CropPrice,
  DistributionFormData,
  DistributionResult,
  LandlordDistributionStatus,
  DistribuirePageStats,
  ArendaConversion,
} from '@/types/distribuire'

// ─── Search landlords ─────────────────────────────────────────────────────────

export async function searchLandlords(
  query: string,
  typeFilter?: 'ALL' | 'PF' | 'PJ',
): Promise<LandlordSearchResult[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const q = query.trim()
  if (q.length < 1) return []

  let dbQuery = supabase
    .from('lessors')
    .select('id, code, type, first_name, last_name, company_name, cnp, county, locality, status')
    .eq('status', 'ACTIVE')
    .limit(20)

  // Apply type filter
  if (typeFilter === 'PF') {
    dbQuery = dbQuery.in('type', ['NATURAL', 'PFA'])
  } else if (typeFilter === 'PJ') {
    dbQuery = dbQuery.eq('type', 'LEGAL')
  }

  // Search: CNP exact match gets priority via OR filter
  const isNumeric = /^\d+$/.test(q)
  if (isNumeric) {
    dbQuery = dbQuery.ilike('cnp', `${q}%`)
  } else {
    // Search by combined name or county/locality
    dbQuery = dbQuery.or(
      `last_name.ilike.%${q}%,first_name.ilike.%${q}%,company_name.ilike.%${q}%,locality.ilike.%${q}%`,
    )
  }

  const { data, error } = await dbQuery
  if (error) return []
  return (data ?? []) as LandlordSearchResult[]
}

// ─── Get landlord contracts ───────────────────────────────────────────────────

export async function getLandlordContracts(landlordId: string): Promise<Contract[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('contracts')
    .select('id, contract_number, contract_type, start_date, end_date, status, zone, annual_rent, lessor_id')
    .eq('lessor_id', landlordId)
    .eq('status', 'ACTIVE')
    .order('contract_number')

  if (error) return []
  return (data ?? []) as Contract[]
}

// ─── Get current crop prices ──────────────────────────────────────────────────
// Returns the most recent price per crop: user-specific MANUAL prices override
// system MADR prices.

export async function getCurrentCropPrices(): Promise<CropPrice[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch all prices (system + user's own)
  const { data, error } = await supabase
    .from('crop_prices')
    .select('id, crop_name, price_per_kg, source, effective_date, notes')
    .or(user ? `user_id.is.null,user_id.eq.${user.id}` : 'user_id.is.null')
    .order('effective_date', { ascending: false })

  if (error) return []

  // Deduplicate: prefer user MANUAL > user MADR > system MADR, latest date first
  const seen = new Map<string, CropPrice>()
  for (const row of (data ?? []) as CropPrice[]) {
    const key = row.crop_name
    if (!seen.has(key)) {
      seen.set(key, row)
    } else {
      const existing = seen.get(key)!
      // Prefer user-specific over system; prefer MANUAL over MADR
      const existingScore = (existing as any).user_id ? 2 : 0
      const newScore = (row as any).user_id ? 2 : 0
      if (newScore > existingScore) seen.set(key, row)
    }
  }

  return Array.from(seen.values()).sort((a, b) => a.crop_name.localeCompare(b.crop_name, 'ro'))
}

// ─── Update / upsert a crop price (manual) ───────────────────────────────────

export async function upsertManualCropPrice(
  cropName: string,
  pricePerKg: number,
  notes?: string,
): Promise<{ ok: boolean; error?: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Neautentificat' }

  if (pricePerKg <= 0) return { ok: false, error: 'Prețul trebuie să fie pozitiv' }

  const { error } = await supabase.from('crop_prices').insert({
    user_id: user.id,
    crop_name: cropName,
    price_per_kg: pricePerKg,
    source: 'MANUAL',
    effective_date: new Date().toISOString().split('T')[0],
    notes: notes ?? 'Preț manual actualizat',
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

// ─── Execute distribution (atomic via RPC) ────────────────────────────────────

export async function executeDistribution(
  data: DistributionFormData,
): Promise<DistributionResult | { error: string }> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Neautentificat' }

  // Server-side validation
  if (data.from_quantity_kg <= 0) return { error: 'Cantitatea trebuie să fie pozitivă' }
  if (data.from_price_per_kg <= 0) return { error: 'Prețul culturii sursă invalid' }
  if (data.to_price_per_kg <= 0) return { error: 'Prețul culturii destinație invalid' }

  // Fetch active campaign
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id')
    .eq('is_active', true)
    .maybeSingle()

  const { data: result, error } = await supabase.rpc('execute_arenda_distribution', {
    p_user_id: user.id,
    p_lessor_id: data.lessor_id,
    p_contract_id: data.contract_id,
    p_campaign_id: campaign?.id ?? null,
    p_from_crop_name: data.from_crop_name,
    p_from_quantity_kg: data.from_quantity_kg,
    p_from_price_per_kg: data.from_price_per_kg,
    p_to_crop_name: data.to_crop_name,
    p_to_quantity_kg: data.to_quantity_kg,
    p_to_price_per_kg: data.to_price_per_kg,
    p_conversion_rate: data.conversion_rate,
    p_value_ron: data.from_quantity_kg * data.from_price_per_kg,
    p_delivery_method: data.delivery_method,
    p_distribution_date: data.distribution_date,
    p_notes: data.notes ?? null,
  })

  if (error) return { error: error.message }

  const res = result as { conversion_id: string; transaction_id: string }
  return {
    conversionId: res.conversion_id,
    transactionId: res.transaction_id,
  }
}

// ─── Get landlord distribution status ────────────────────────────────────────

export async function getLandlordDistributionStatus(
  landlordId: string,
): Promise<LandlordDistributionStatus> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const empty: LandlordDistributionStatus = {
    total_kg: 0,
    distributed_kg: 0,
    remaining_kg: 0,
    percent_distributed: 0,
    value_ron: 0,
    conversions: [],
  }
  if (!user) return empty

  // Confirmed conversions for this landlord
  const { data: conversions } = await supabase
    .from('arenda_conversions')
    .select(`
      id, from_crop_name, from_quantity_kg, from_price_per_kg,
      to_crop_name, to_quantity_kg, to_price_per_kg,
      conversion_rate, value_ron, delivery_method, distribution_date,
      notes, status, transaction_id, created_at, contract_id,
      contracts(contract_number)
    `)
    .eq('lessor_id', landlordId)
    .eq('status', 'confirmed')
    .order('distribution_date', { ascending: false })
    .limit(50)

  // Parcel transactions (total allocated from contracts) for this landlord's contracts
  const { data: contracts } = await supabase
    .from('contracts')
    .select('id')
    .eq('lessor_id', landlordId)
    .eq('status', 'ACTIVE')

  const contractIds = (contracts ?? []).map((c: any) => c.id)

  let totalKg = 0
  if (contractIds.length > 0) {
    const { data: ptData } = await supabase
      .from('parcel_transactions')
      .select('total_quantity')
      .in('contract_id', contractIds)

    totalKg = ((ptData ?? []) as any[]).reduce(
      (sum, pt) => sum + Number(pt.total_quantity ?? 0),
      0,
    )
  }

  const conversionRows = (conversions ?? []) as any[]
  const distributedKg = conversionRows.reduce(
    (sum: number, c: any) => sum + Number(c.from_quantity_kg ?? 0),
    0,
  )
  const valueRon = conversionRows.reduce(
    (sum: number, c: any) => sum + Number(c.value_ron ?? 0),
    0,
  )

  const mapped: ArendaConversion[] = conversionRows.map((c: any) => ({
    ...c,
    contract_number: c.contracts?.contract_number ?? null,
    lessor_id: landlordId,
    user_id: user.id,
    campaign_id: c.campaign_id ?? null,
  }))

  return {
    total_kg: totalKg,
    distributed_kg: distributedKg,
    remaining_kg: Math.max(0, totalKg - distributedKg),
    percent_distributed: totalKg > 0 ? Math.round((distributedKg / totalKg) * 100) : 0,
    value_ron: valueRon,
    conversions: mapped,
  }
}

// ─── Page-level stats ─────────────────────────────────────────────────────────

export async function getDistribuirePageStats(): Promise<DistribuirePageStats> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const empty: DistribuirePageStats = {
    totalToDistributeKg: 0,
    distributedKg: 0,
    remainingKg: 0,
    activeLandlordsCount: 0,
    pendingPaymentsCount: 0,
    activeCampaignName: '',
    activeCampaignId: null,
  }
  if (!user) return empty

  const [
    { data: campaign },
    { data: ptData },
    { data: convData },
    { count: activeLandlords },
    { count: pendingCount },
  ] = await Promise.all([
    supabase.from('campaigns').select('id, name').eq('is_active', true).maybeSingle(),
    supabase.from('parcel_transactions').select('total_quantity').limit(5000),
    supabase
      .from('arenda_conversions')
      .select('from_quantity_kg')
      .eq('status', 'confirmed')
      .limit(5000),
    supabase
      .from('lessors')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ACTIVE'),
    supabase
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('is_paid', false)
      .eq('is_previzionata', false),
  ])

  const totalKg = ((ptData ?? []) as any[]).reduce(
    (s, r) => s + Number(r.total_quantity ?? 0),
    0,
  )
  const distributedKg = ((convData ?? []) as any[]).reduce(
    (s, r) => s + Number(r.from_quantity_kg ?? 0),
    0,
  )

  return {
    totalToDistributeKg: totalKg,
    distributedKg,
    remainingKg: Math.max(0, totalKg - distributedKg),
    activeLandlordsCount: activeLandlords ?? 0,
    pendingPaymentsCount: pendingCount ?? 0,
    activeCampaignName: campaign?.name ?? '',
    activeCampaignId: campaign?.id ?? null,
  }
}

// ─── Get recent distributions (all landlords) ─────────────────────────────────

export async function getRecentDistributions(limit = 10): Promise<ArendaConversion[]> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return []

  const { data, error } = await supabase
    .from('arenda_conversions')
    .select(`
      id, lessor_id, contract_id, campaign_id,
      from_crop_name, from_quantity_kg, from_price_per_kg,
      to_crop_name, to_quantity_kg, to_price_per_kg,
      conversion_rate, value_ron, delivery_method, distribution_date,
      notes, status, transaction_id, created_at,
      lessors(first_name, last_name, company_name, type),
      contracts(contract_number)
    `)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return []

  return ((data ?? []) as any[]).map((c) => ({
    ...c,
    user_id: user.id,
    lessor_name:
      c.lessors?.type === 'LEGAL'
        ? c.lessors.company_name
        : `${c.lessors?.last_name ?? ''} ${c.lessors?.first_name ?? ''}`.trim(),
    contract_number: c.contracts?.contract_number ?? null,
  })) as ArendaConversion[]
}
