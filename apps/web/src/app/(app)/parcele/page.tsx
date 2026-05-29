'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Pencil } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { toast } from 'sonner'

interface Parcel {
  id: string; bloc_fizic: string | null; tarla_nr: string | null; parcel_nr: string | null
  county: string; locality: string; surface: number; status: string
  lessor_name: string
}

export default function ParceleListPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<Parcel[]>([])

  useEffect(() => {
    createClient()
      .from('parcels')
      .select('*, lessors(first_name, last_name, company_name, type)')
      .order('created_at', { ascending: false })
      .limit(1000)
      .then(({ data, error }) => {
        if (error) { toast.error('Eroare la încărcarea parcelelor.'); return }
        if (data) setRows((data as any[]).map(p => ({
          ...p,
          lessor_name: p.lessors
            ? (p.lessors.type === 'LEGAL' ? p.lessors.company_name : `${p.lessors.last_name} ${p.lessors.first_name}`.trim())
            : '-',
        })))
      })
  }, [])

  const filtered = rows.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return (r.bloc_fizic ?? '').toLowerCase().includes(q) ||
      r.lessor_name.toLowerCase().includes(q) ||
      r.locality.toLowerCase().includes(q)
  })

  return (
    <div>
      <PageHeader
        title="Parcele"
        subtitle={`${filtered.length} inregistrari`}
        actions={
          <button onClick={() => router.push('/parcele/nou')} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded font-medium">
            <Plus className="w-3.5 h-3.5" /> Parcela noua
          </button>
        }
      />
      <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input type="text" placeholder="Cauta dupa cod, arendator, localitate..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500" />
        </div>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['Bloc Fizic','Tarla','Nr. parcela','Judet','Localitate','Suprafata (ha)','Arendator','Status',''].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={9} className="px-3 py-8 text-center text-gray-400">Nicio parcela inregistrata</td></tr>}
            {filtered.map(row => (
              <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs">{row.bloc_fizic ?? '-'}</td>
                <td className="px-3 py-2">{row.tarla_nr ?? '-'}</td>
                <td className="px-3 py-2">{row.parcel_nr ?? '-'}</td>
                <td className="px-3 py-2">{row.county}</td>
                <td className="px-3 py-2">{row.locality}</td>
                <td className="px-3 py-2 font-medium">{Number(Number(row.surface).toFixed(4))}</td>
                <td className="px-3 py-2">{row.lessor_name}</td>
                <td className="px-3 py-2"><span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">{row.status}</span></td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => router.push(`/parcele/${row.id}`)}
                    className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                    title="Editeaza"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
