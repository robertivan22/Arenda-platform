'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search } from 'lucide-react'
import { contracts, type Contract } from '@/lib/mockStore'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatusBadge } from '@/components/data-display/StatusBadge'

export default function ContractesListPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<Contract[]>([])

  useEffect(() => { setRows(contracts.list()) }, [])

  const filtered = rows.filter(r =>
    !search || r.contractNumber.toLowerCase().includes(search.toLowerCase()) ||
    r.lessorName.toLowerCase().includes(search.toLowerCase())
  )

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
          <input type="text" placeholder="Caută după nr. contract, arendator..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['Nr. contract','Arendator','Tip','Zonă','Data semn.','De la','Până la','Arendă/an','Status'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-400">Nicio înregistrare</td></tr>}
            {filtered.map(row => (
              <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/contracte/${row.id}`)}>
                <td className="px-3 py-2 font-medium">{row.contractNumber}</td>
                <td className="px-3 py-2 font-medium text-gray-900">{row.lessorName}</td>
                <td className="px-3 py-2">{row.contractType}</td>
                <td className="px-3 py-2">{row.zone}</td>
                <td className="px-3 py-2">{row.signDate}</td>
                <td className="px-3 py-2">{row.startDate}</td>
                <td className="px-3 py-2">{row.endDate}</td>
                <td className="px-3 py-2">{row.annualRent} RON</td>
                <td className="px-3 py-2"><StatusBadge status={row.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
