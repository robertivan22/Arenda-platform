'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { apiGet } from '@/lib/api-client'
import { PageHeader } from '@/components/layout/PageHeader'
import { DataTable } from '@/components/data-display/DataTable'
import type { ColumnDef } from '@tanstack/react-table'

interface ParcelRow {
  id: string
  parcelCode: string
  tarlaNr: string
  parcelNr: string
  county: string
  locality: string
  landUseCategory: string
  surface: string
  surfaceRented: string
  lessorName: string
}

const columns: ColumnDef<ParcelRow>[] = [
  { accessorKey: 'parcelCode', header: 'Cod parcelă' },
  {
    accessorKey: 'lessorName',
    header: 'Arendator',
    cell: ({ getValue }) => <span className="font-medium text-gray-900">{getValue<string>()}</span>,
  },
  { accessorKey: 'tarlaNr', header: 'Tarla' },
  { accessorKey: 'parcelNr', header: 'Parcelă' },
  { accessorKey: 'county', header: 'Județ' },
  { accessorKey: 'locality', header: 'Localitate' },
  { accessorKey: 'landUseCategory', header: 'Cat. folosință' },
  { accessorKey: 'surface', header: 'Suprafață (ha)' },
  { accessorKey: 'surfaceRented', header: 'Sup. arendată (ha)' },
]

export default function ParceleListPage() {
  const router = useRouter()
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['parcels', page, search],
    queryFn: () =>
      apiGet<{ items: ParcelRow[]; total: number }>('/parcels', {
        page: page + 1,
        limit: 50,
        search: search || undefined,
      }),
  })

  return (
    <div>
      <PageHeader
        title="Parcele"
        subtitle={data?.data?.total ? `${data.data.total} parcele` : undefined}
        actions={
          <button
            onClick={() => router.push('/parcele/nou')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Parcelă nouă
          </button>
        }
      />

      <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Caută după cod, tarla, arendator..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      <DataTable
        data={data?.data?.items ?? []}
        columns={columns}
        total={data?.data?.total}
        pageIndex={page}
        pageSize={50}
        onPaginationChange={p => setPage(p.pageIndex)}
        isLoading={isLoading}
        onRowClick={row => router.push(`/parcele/${row.id}`)}
      />
    </div>
  )
}
