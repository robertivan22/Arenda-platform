'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Pencil, Eye } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { toast } from 'sonner'

interface Contract {
  id: string; contract_number: string; contract_type: string
  lessor_id: string | null; zone: string | null; sign_date: string | null
  start_date: string; end_date: string; annual_rent: number; status: string
  lessor_name: string
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
          <button onClick={() => router.push('/contracte/nou')} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded font-medium">
            <Plus className="w-3.5 h-3.5" /> Contract nou
          </button>
        }
      />
      <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Cauta dupa nr. contract, arendator..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['Nr. contract','Arendator','Tip','Zona','Data semn.','De la','Pana la','Arenda/an','Status',''].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-400">Nicio inregistrare</td></tr>}
            {filtered.map(row => (
              <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 font-medium">{row.contract_number}</td>
                <td className="px-3 py-2 font-medium text-gray-900">{row.lessor_name}</td>
                <td className="px-3 py-2">{row.contract_type}</td>
                <td className="px-3 py-2">{row.zone ?? '-'}</td>
                <td className="px-3 py-2">{row.sign_date ?? '-'}</td>
                <td className="px-3 py-2">{row.start_date}</td>
                <td className="px-3 py-2">{row.end_date}</td>
                <td className="px-3 py-2">{Number(row.annual_rent).toFixed(2)} RON</td>
                <td className="px-3 py-2"><StatusBadge status={row.status} /></td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <button
                      onClick={() => router.push(`/contracte/${row.id}`)}
                      className="p-1.5 rounded hover:bg-brand-50 text-brand-500 hover:text-brand-700 transition-colors"
                      title="Deschide dashboard"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => router.push(`/contracte/${row.id}/editeaza`)}
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                      title="Editeaza"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
