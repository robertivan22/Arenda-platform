'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Pencil, Eye } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { ResponsiveTable } from '@/components/ui/responsive-table'
import { toast } from 'sonner'

interface Contract {
  id: string; contract_number: string; contract_type: string
  lessor_id: string | null; zone: string | null; sign_date: string | null
  start_date: string; end_date: string; annual_rent: number; status: string
  lessor_name: string
}

function effectiveStatus(status: string, endDate: string): string {
  if (status === 'TERMINATED' || status === 'ARCHIVED') return status
  if (new Date(endDate) < new Date()) return 'EXPIRED'
  return status
}

export default function ContractesListPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<Contract[]>([])

  useEffect(() => {
    createClient()
      .from('contracts')
      .select('id, contract_number, contract_type, lessor_id, zone, sign_date, start_date, end_date, annual_rent, status, lessors(first_name, last_name, company_name, type)')
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data, error }) => {
        if (error) { toast.error('Eroare la încărcarea contractelor.'); return }
        if (data) setRows((data as any[]).map(c => ({
          ...c,
          lessor_name: c.lessors
            ? (c.lessors.type === 'LEGAL' ? c.lessors.company_name : `${c.lessors.last_name} ${c.lessors.first_name}`.trim())
            : 'fara arendator',
        })))
      })
  }, [])

  const filtered = rows.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return r.contract_number.toLowerCase().includes(q) || r.lessor_name.toLowerCase().includes(q)
  })

  return (
    <div>
      <PageHeader
        title="Contracte"
        subtitle={`${filtered.length} contracte`}
        actions={
          <button onClick={() => router.push('/contracte/nou')} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded font-medium min-h-[44px] md:min-h-0">
            <Plus className="w-3.5 h-3.5" /> Contract nou
          </button>
        }
      />
      <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Cauta dupa nr. contract, arendator..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
      </div>

      <ResponsiveTable
        rows={filtered}
        keyExtractor={r => r.id}
        emptyMessage="Nicio înregistrare"
        onRowClick={r => router.push(`/contracte/${r.id}`)}
        columns={[
          {
            key: 'contract_number', header: 'Nr. contract', mobileTitle: true,
            cell: r => <span className="font-semibold text-brand-700">{r.contract_number}</span>,
          },
          {
            key: 'lessor_name', header: 'Arendator',
            cell: r => <span className="font-medium text-gray-900">{r.lessor_name}</span>,
          },
          { key: 'contract_type', header: 'Tip', cell: r => r.contract_type, hideOnMobile: true },
          { key: 'zone', header: 'Zonă', cell: r => r.zone ?? '-', hideOnMobile: true },
          {
            key: 'start_date', header: 'Perioadă',
            cell: r => <span className="text-xs">{r.start_date} → {r.end_date}</span>,
          },
          {
            key: 'annual_rent', header: 'Arendă/an',
            cell: r => <span className="font-medium">{Number(r.annual_rent).toFixed(2)} RON</span>,
          },
          {
            key: 'status', header: 'Status',
            cell: r => <StatusBadge status={effectiveStatus(r.status, r.end_date)} />,
          },
          {
            key: 'actions', header: '', mobileLabel: false, hideOnMobile: true,
            cell: r => (
              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                <button onClick={() => router.push(`/contracte/${r.id}`)} className="p-1.5 rounded hover:bg-brand-50 text-brand-500 hover:text-brand-700 transition-colors" title="Dashboard">
                  <Eye className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => router.push(`/contracte/${r.id}/editeaza`)} className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors" title="Editeaza">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              </div>
            ),
          },
        ]}
        mobileActions={r => (
          <div className="flex gap-2">
            <button onClick={e => { e.stopPropagation(); router.push(`/contracte/${r.id}`) }} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium bg-brand-50 text-brand-700 rounded-lg">
              <Eye className="w-4 h-4" /> Deschide
            </button>
            <button onClick={e => { e.stopPropagation(); router.push(`/contracte/${r.id}/editeaza`) }} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium bg-gray-50 text-gray-600 rounded-lg">
              <Pencil className="w-4 h-4" /> Editează
            </button>
          </div>
        )}
      />
    </div>
  )
}
