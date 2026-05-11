'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search } from 'lucide-react'
import { parcels, type Parcel } from '@/lib/mockStore'
import { PageHeader } from '@/components/layout/PageHeader'

export default function ParceleListPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<Parcel[]>([])

  useEffect(() => { setRows(parcels.list()) }, [])

  const filtered = rows.filter(r =>
    !search || r.parcelCode.toLowerCase().includes(search.toLowerCase()) ||
    r.lessorName.toLowerCase().includes(search.toLowerCase()) ||
    r.locality.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <PageHeader
        title="Parcele"
        subtitle={`${filtered.length} parcele`}
        actions={
          <button onClick={() => router.push('/parcele/nou')} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded font-medium">
            <Plus className="w-3.5 h-3.5" /> Parcelă nouă
          </button>
        }
      />
      <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Caută după cod, tarla, arendator..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['Cod parcelă','Arendator','Tarla','Parcelă','Județ','Localitate','Cat. folosință','Suprafață (ha)','Sup. arendată (ha)'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-400">Nicio parcelă înregistrată</td></tr>}
            {filtered.map(row => (
              <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs">{row.parcelCode}</td>
                <td className="px-3 py-2 font-medium text-gray-900">{row.lessorName}</td>
                <td className="px-3 py-2">{row.tarlaNr}</td>
                <td className="px-3 py-2">{row.parcelNr}</td>
                <td className="px-3 py-2">{row.county}</td>
                <td className="px-3 py-2">{row.locality}</td>
                <td className="px-3 py-2">{row.landUseCategory}</td>
                <td className="px-3 py-2">{row.surface}</td>
                <td className="px-3 py-2">{row.surfaceRented}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
