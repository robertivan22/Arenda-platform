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

  // Fetch active contracts with parcel and lessor data
  const { data: contracts, error } = await supabase
    .from('Contract')
    .select(`
      id,
      contractNumber,
      startDate,
      endDate,
      lessor:Lessor(cnp, lastName, firstName),
      parcelLinks:ParcelContractLink(
        parcel:Parcel(
          tarla,
          parcela,
          blocFizic,
          surfaceHa,
          landUseCategory:LandUseCategory(name),
          locality:Locality(
            name,
            county:County(name)
          )
        )
      )
    `)
    .eq('status', 'ACTIVE')

  if (error) {
    return NextResponse.json({ error: 'Eroare interogare contracte: ' + error.message }, { status: 500 })
  }

  const rows = []
  const warnings: string[] = []

  for (const contract of (contracts ?? [])) {
    const lessor = Array.isArray(contract.lessor) ? contract.lessor[0] : contract.lessor
    for (const link of (contract.parcelLinks ?? [])) {
      const parcel = Array.isArray(link.parcel) ? link.parcel[0] : link.parcel
      if (!parcel) continue

      const locality = Array.isArray(parcel.locality) ? parcel.locality[0] : parcel.locality
      const county = Array.isArray(locality?.county) ? locality?.county?.[0] : locality?.county
      const landUseCat = Array.isArray(parcel.landUseCategory) ? parcel.landUseCategory[0] : parcel.landUseCategory

      rows.push({
        lessorCnp: lessor?.cnp ?? '',
        lessorLastName: lessor?.lastName ?? '—',
        lessorFirstName: lessor?.firstName ?? '—',
        contractNumber: contract.contractNumber ?? contract.id,
        contractStartDate: contract.startDate ?? '',
        contractEndDate: contract.endDate ?? '',
        parcelTarla: parcel.tarla ?? '',
        parcelParcela: parcel.parcela ?? '',
        parcelBlocFizic: parcel.blocFizic ?? '',
        leasedSurfaceHa: Number(parcel.surfaceHa ?? 0),
        countyName: county?.name ?? '—',
        localityName: locality?.name ?? '—',
        landUseCategory: landUseCat?.name ?? '—',
        apiaDeclared: false,
      })
    }
  }

  const totalSurfaceHa = rows.reduce((s, r) => s + r.leasedSurfaceHa, 0)

  return NextResponse.json({
    dataset: {
      campaignYear,
      rows,
      totalSurfaceHa: Math.round(totalSurfaceHa * 10000) / 10000,
      warnings,
      status: 'DRAFT',
    },
  })
}
