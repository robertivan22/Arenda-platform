'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, Pencil } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatusBadge } from '@/components/data-display/StatusBadge'
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
        if (error) { toast.error('Eroare la încărcarea arendatorilor.'); return }
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
          <button onClick={() => router.push('/arendatori/nou')} className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded font-medium transition-colors">
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
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {['Cod','Nume / Denumire','Tip','CNP / CUI','Judet','Status',''].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={7} className="px-3 py-8 text-center text-gray-400">Niciun arendator inregistrat</td></tr>}
            {filtered.map(r => (
              <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-xs text-gray-500">{r.code}</td>
                <td className="px-3 py-2 font-medium cursor-pointer hover:text-brand-600" onClick={() => router.push(`/arendatori/${r.id}/sumar`)}>{displayName(r)}</td>
                <td className="px-3 py-2 text-gray-500">{r.type === 'NATURAL' ? 'PF' : r.type}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.cnp}</td>
                <td className="px-3 py-2">{r.county}</td>
                <td className="px-3 py-2"><StatusBadge status={r.status} /></td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => router.push(`/arendatori/${r.id}/editeaza`)}
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
