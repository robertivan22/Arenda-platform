'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { apiGet } from '@/lib/api-client'
import { PageHeader } from '@/components/layout/PageHeader'
import { DataTable } from '@/components/data-display/DataTable'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import type { ColumnDef } from '@tanstack/react-table'

interface ContractRow {
  id: string
  contractNumber: string
  contractType: string
  lessorName: string
  zone: string
  signDate: string
  startDate: string
  endDate: string
  totalParcels: number
  annualRent: string
  status: string
}

const columns: ColumnDef<ContractRow>[] = [
  { accessorKey: 'contractNumber', header: 'Nr. contract', size: 130 },
  {
    accessorKey: 'lessorName',
    header: 'Arendator',
    cell: ({ getValue }) => <span className="font-medium text-gray-900">{getValue<string>()}</span>,
  },
  { accessorKey: 'contractType', header: 'Tip', size: 80 },
  { accessorKey: 'zone', header: 'Zonă' },
  { accessorKey: 'signDate', header: 'Data semn.', cell: ({ getValue }) => getValue<string>()?.split('T')[0], size: 100 },
  { accessorKey: 'startDate', header: 'De la', cell: ({ getValue }) => getValue<string>()?.split('T')[0], size: 95 },
  { accessorKey: 'endDate', header: 'Până la', cell: ({ getValue }) => getValue<string>()?.split('T')[0], size: 95 },
  { accessorKey: 'totalParcels', header: 'Parc.', size: 60 },
  { accessorKey: 'annualRent', header: 'Arendă/an' },
  { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
]

export default function ContractesListPage() {
  const router = useRouter()
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['contracts', page, search],
    queryFn: () =>
      apiGet<{ items: ContractRow[]; total: number }>('/contracts', {
        page: page + 1,
        limit: 50,
        search: search || undefined,
      }),
  })

  return (
    <div>
      <PageHeader
        title="Contracte"
        subtitle={data?.data?.total ? `${data.data.total} contracte` : undefined}
        actions={
          <button
            onClick={() => router.push('/contracte/nou')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Contract nou
          </button>
        }
      />

      <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Caută după număr, arendator..."
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
        onRowClick={row => router.push(`/contracte/${row.id}/sumar`)}
      />
    </div>
  )
}
