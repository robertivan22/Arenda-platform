'use client'

import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Plus, Search, Download } from 'lucide-react'
import { apiGet } from '@/lib/api-client'
import { PageHeader } from '@/components/layout/PageHeader'
import { DataTable } from '@/components/data-display/DataTable'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import type { ColumnDef } from '@tanstack/react-table'

interface LessorRow {
  id: string
  code: string
  displayName: string
  type: string
  cnpCui: string
  county: string
  locality: string
  phone: string
  status: string
  contractsCount: number
  parcelsCount: number
}

const columns: ColumnDef<LessorRow>[] = [
  { accessorKey: 'code', header: 'Cod', size: 80 },
  {
    accessorKey: 'displayName',
    header: 'Nume arendator',
    cell: ({ getValue }) => (
      <span className="font-medium text-gray-900">{getValue<string>()}</span>
    ),
  },
  {
    accessorKey: 'type',
    header: 'Tip',
    cell: ({ getValue }) => <StatusBadge status={getValue<string>()} />,
  },
  { accessorKey: 'cnpCui', header: 'CNP/CUI' },
  { accessorKey: 'county', header: 'Județ' },
  { accessorKey: 'locality', header: 'Localitate' },
  { accessorKey: 'phone', header: 'Telefon' },
  { accessorKey: 'contractsCount', header: 'Contracte', size: 90 },
  { accessorKey: 'parcelsCount', header: 'Parcele', size: 80 },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ getValue }) => <StatusBadge status={getValue<string>()} />,
  },
]

export default function LessorsListPage() {
  const router = useRouter()
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['lessors', page, search],
    queryFn: () =>
      apiGet<{ items: LessorRow[]; total: number }>('/lessors', {
        page: page + 1,
        limit: 50,
        search: search || undefined,
      }),
  })

  return (
    <div>
      <PageHeader
        title="Arendatori"
        subtitle={data?.data?.total ? `${data.data.total} înregistrări` : undefined}
        actions={
          <>
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 text-gray-700"
              title="Export"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
            <button
              onClick={() => router.push('/arendatori/nou')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Arendator nou
            </button>
          </>
        }
      />

      {/* Filters bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Caută după nume, CNP, cod..."
            value={search}
            onChange={e => {
              setSearch(e.target.value)
              setPage(0)
            }}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
        {/* TODO: county filter, type filter, status filter */}
      </div>

      <DataTable
        data={data?.data?.items ?? []}
        columns={columns}
        total={data?.data?.total}
        pageIndex={page}
        pageSize={50}
        onPaginationChange={p => setPage(p.pageIndex)}
        isLoading={isLoading}
        onRowClick={row => router.push(`/arendatori/${row.id}/sumar`)}
      />
    </div>
  )
}
