'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { apiGet } from '@/lib/api-client'
import { DataTable } from '@/components/data-display/DataTable'
import type { ColumnDef } from '@tanstack/react-table'

interface ParcelRow {
  id: string; parcelCode: string; tarlaNr: string; parcelNr: string
  county: string; locality: string; landUseCategory: string
  surface: string; surfaceRented: string
}

const columns: ColumnDef<ParcelRow>[] = [
  { accessorKey: 'parcelCode', header: 'Cod parcelă' },
  { accessorKey: 'tarlaNr', header: 'Tarla' },
  { accessorKey: 'parcelNr', header: 'Parcelă' },
  { accessorKey: 'county', header: 'Județ' },
  { accessorKey: 'locality', header: 'Localitate' },
  { accessorKey: 'landUseCategory', header: 'Cat. folosință' },
  { accessorKey: 'surface', header: 'Suprafață (ha)' },
  { accessorKey: 'surfaceRented', header: 'Suprafață arendată (ha)' },
]


export default function LessorParceleTabClient() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { data, isLoading } = useQuery({
    queryKey: ['lessor-parcels', id],
    queryFn: () => apiGet<ParcelRow[]>(`/lessors/${id}/parcels`),
  })

  return (
    <DataTable
      data={data?.data ?? []}
      columns={columns}
      isLoading={isLoading}
      onRowClick={row => router.push(`/parcele/${row.id}`)}
    />
  )
}
