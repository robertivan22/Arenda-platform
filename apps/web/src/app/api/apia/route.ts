import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  }
  const token = authHeader.slice(7)

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )

  const { data: { user }, error: authErr } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  }

  const body = await req.json() as { campaignYear: number }
  const { campaignYear } = body
  if (!campaignYear) {
    return NextResponse.json({ error: 'Parametru lipsă: campaignYear' }, { status: 400 })
  }

  // Fetch parcels with lessor and contract for this user
  const { data: parcels, error } = await supabase
    .from('parcels')
    .select(`
      id,
      bloc_fizic,
      tarla_nr,
      parcel_nr,
      surface,
      surface_rented,
      county,
      locality,
      land_use_category,
      lessor_id,
      contract_id,
      lessors(cnp, first_name, last_name),
      contracts(contract_number, start_date, end_date)
    `)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Eroare interogare parcele: ' + error.message }, { status: 500 })
  }

  const rows = (parcels ?? []).map((p: any) => {
    const lessor   = Array.isArray(p.lessors)   ? p.lessors[0]   : p.lessors
    const contract = Array.isArray(p.contracts) ? p.contracts[0] : p.contracts
    return {
      lessorCnp:        lessor?.cnp        ?? '',
      lessorLastName:   lessor?.last_name  ?? '—',
      lessorFirstName:  lessor?.first_name ?? '—',
      contractNumber:   contract?.contract_number ?? '—',
      contractStartDate: contract?.start_date ?? '',
      contractEndDate:   contract?.end_date   ?? '',
      parcelTarla:      p.tarla_nr ?? '',
      parcelParcela:    p.parcel_nr ?? '',
      parcelBlocFizic:  p.bloc_fizic ?? '',
      leasedSurfaceHa:  Number(p.surface_rented ?? p.surface ?? 0),
      countyName:       p.county   ?? '—',
      localityName:     p.locality ?? '—',
      landUseCategory:  p.land_use_category ?? '—',
      apiaDeclared:     false,
    }
  })

  const totalSurfaceHa = rows.reduce((s: number, r: any) => s + r.leasedSurfaceHa, 0)

  return NextResponse.json({
    dataset: {
      campaignYear, rows,
      totalSurfaceHa: Math.round(totalSurfaceHa * 10000) / 10000,
      warnings: [], status: 'DRAFT',
    },
  })
}


