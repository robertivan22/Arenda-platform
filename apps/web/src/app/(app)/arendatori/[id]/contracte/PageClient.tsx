'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { StatusBadge } from '@/components/data-display/StatusBadge'

interface ContractRow {
  id: string; contract_number: string; contract_type: string
  sign_date: string | null; start_date: string; end_date: string
  status: string; total_parcels: number; annual_rent: number
}

export default function LessorContracteTabClient() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [rows, setRows] = useState<ContractRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    createClient()
      .from('contracts')
      .select('id, contract_number, contract_type, sign_date, start_date, end_date, status, total_parcels, annual_rent')
      .eq('lessor_id', id)
      .order('start_date', { ascending: false })
      .then(({ data }) => {
        if (data) setRows(data as ContractRow[])
        setLoading(false)
      })
  }, [id])

  if (loading) return <div className="text-sm text-gray-400">Se încarcă...</div>
  if (rows.length === 0) return <div className="text-sm text-gray-400 py-4">Niciun contract asociat.</div>

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {['Nr. contract', 'Tip', 'Data semnării', 'De la', 'Până la', 'Parcele', 'Arendă anuală', 'Status'].map(h => (
              <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => router.push(`/contracte/${row.id}`)}>
              <td className="px-3 py-2 font-medium">{row.contract_number}</td>
              <td className="px-3 py-2">{row.contract_type}</td>
              <td className="px-3 py-2">{row.sign_date ?? '—'}</td>
              <td className="px-3 py-2">{row.start_date}</td>
              <td className="px-3 py-2">{row.end_date}</td>
              <td className="px-3 py-2">{row.total_parcels}</td>
              <td className="px-3 py-2">{Number(row.annual_rent).toFixed(2)} RON</td>
              <td className="px-3 py-2"><StatusBadge status={row.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
