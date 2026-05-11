'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { apiGet } from '@/lib/api-client'
import { DataTable } from '@/components/data-display/DataTable'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import type { ColumnDef } from '@tanstack/react-table'

interface ContractRow {
  id: string; contractNumber: string; contractType: string
  signDate: string; startDate: string; endDate: string
  status: string; totalParcels: number; annualRent: string
}

const columns: ColumnDef<ContractRow>[] = [
  { accessorKey: 'contractNumber', header: 'Nr. contract' },
  { accessorKey: 'contractType', header: 'Tip' },
  { accessorKey: 'signDate', header: 'Data semnării', cell: ({ getValue }) => getValue<string>()?.split('T')[0] },
  { accessorKey: 'startDate', header: 'De la', cell: ({ getValue }) => getValue<string>()?.split('T')[0] },
  { accessorKey: 'endDate', header: 'Până la', cell: ({ getValue }) => getValue<string>()?.split('T')[0] },
  { accessorKey: 'totalParcels', header: 'Parcele' },
  { accessorKey: 'annualRent', header: 'Arendă anuală' },
  { accessorKey: 'status', header: 'Status', cell: ({ getValue }) => <StatusBadge status={getValue<string>()} /> },
]


export default function LessorContracteTabClient() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { data, isLoading } = useQuery({
    queryKey: ['lessor-contracts', id],
    queryFn: () => apiGet<ContractRow[]>(`/lessors/${id}/contracts`),
  })

  return (
    <DataTable
      data={data?.data ?? []}
      columns={columns}
      isLoading={isLoading}
      onRowClick={row => router.push(`/contracte/${row.id}/sumar`)}
    />
  )
}
