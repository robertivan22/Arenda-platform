'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Pencil } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { ResponsiveTable } from '@/components/ui/responsive-table'
import { toast } from 'sonner'

interface Lessor {
  id: string; code: string; type: 'NATURAL' | 'LEGAL' | 'PFA'
  first_name: string; last_name: string; company_name: string | null
  cnp: string; county: string; locality: string; status: 'ACTIVE' | 'INACTIVE'
}

function displayName(l: Lessor) {
  return l.type === 'LEGAL' ? (l.company_name ?? '') : `${l.last_name} ${l.first_name}`.trim()
}

export default function LessorsListPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<Lessor[]>([])

  useEffect(() => {
    createClient()
      .from('lessors')
      .select('id, code, type, first_name, last_name, company_name, cnp, county, locality, status')
      .order('last_name')
      .limit(500)
      .then(({ data, error }) => {
        if (error) { toast.error('Eroare la incarcarea arendatorilor.'); return }
        if (data) setRows(data as Lessor[])
      })
  }, [])

  const filtered = rows.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return displayName(r).toLowerCase().includes(q) || (r.cnp ?? '').includes(q) || (r.code ?? '').includes(q)
  })

  return (
    <div>
      <PageHeader
        title="Arendatori"
        subtitle={`${filtered.length} inregistrari`}
        actions={
          <button onClick={() => router.push('/arendatori/nou')} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded font-medium transition-colors min-h-[44px] md:min-h-0">
            <Plus className="w-3.5 h-3.5" /> Arendator nou
          </button>
        }
      />
      <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text" placeholder="Cauta dupa nume, CNP, cod..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      <ResponsiveTable
        rows={filtered}
        keyExtractor={r => r.id}
        emptyMessage="Niciun arendator inregistrat"
        onRowClick={r => router.push(`/arendatori/${r.id}/sumar`)}
        columns={[
          {
            key: 'name', header: 'Nume / Denumire', mobileTitle: true,
            cell: (r: Lessor) => <span className="font-medium text-gray-900">{displayName(r)}</span>,
          },
          {
            key: 'code', header: 'Cod',
            cell: (r: Lessor) => <span className="font-mono text-xs text-gray-500">{r.code}</span>,
          },
          {
            key: 'type', header: 'Tip', hideOnMobile: true,
            cell: (r: Lessor) => <span className="text-gray-500">{r.type === 'NATURAL' ? 'PF' : r.type}</span>,
          },
          {
            key: 'cnp', header: 'CNP / CUI', hideOnMobile: true,
            cell: (r: Lessor) => <span className="font-mono text-xs">{r.cnp}</span>,
          },
          {
            key: 'county', header: 'Judet',
            cell: (r: Lessor) => r.county,
          },
          {
            key: 'status', header: 'Status',
            cell: (r: Lessor) => <StatusBadge status={r.status} />,
          },
          {
            key: 'actions', header: '', mobileLabel: false, hideOnMobile: true,
            cell: (r: Lessor) => (
              <button
                onClick={e => { e.stopPropagation(); router.push(`/arendatori/${r.id}/editeaza`) }}
                className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                title="Editeaza"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            ),
          },
        ]}
        mobileActions={(r: Lessor) => (
          <button
            onClick={e => { e.stopPropagation(); router.push(`/arendatori/${r.id}/editeaza`) }}
            className="w-full flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium bg-gray-50 text-gray-600 rounded-lg"
          >
            <Pencil className="w-4 h-4" /> Editeaza
          </button>
        )}
      />
    </div>
  )
}
