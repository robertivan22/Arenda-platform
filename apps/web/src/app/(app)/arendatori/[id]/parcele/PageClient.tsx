'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface ParcelRow {
  id: string; parcel_code: string | null; tarla_nr: string | null; parcel_nr: string | null
  county: string; locality: string; land_use_category: string | null
  surface: number; surface_rented: number | null
}

export default function LessorParceleTabClient() {
  const { id } = useParams<{ id: string }>()
  const [rows, setRows] = useState<ParcelRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    createClient()
      .from('parcels')
      .select('id, parcel_code, tarla_nr, parcel_nr, county, locality, land_use_category, surface, surface_rented')
      .eq('lessor_id', id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setRows(data as ParcelRow[])
        setLoading(false)
      })
  }, [id])

  if (loading) return <div className="text-sm text-gray-400">Se încarcă...</div>
  if (rows.length === 0) return <div className="text-sm text-gray-400 py-4">Nicio parcelă asociată.</div>

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            {['Cod parcelă', 'Tarla', 'Parcelă', 'Județ', 'Localitate', 'Cat. folosință', 'Suprafață (ha)', 'Suprafață arendată (ha)'].map(h => (
              <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
              <td className="px-3 py-2 font-mono text-xs">{row.parcel_code ?? '—'}</td>
              <td className="px-3 py-2">{row.tarla_nr ?? '—'}</td>
              <td className="px-3 py-2">{row.parcel_nr ?? '—'}</td>
              <td className="px-3 py-2">{row.county}</td>
              <td className="px-3 py-2">{row.locality}</td>
              <td className="px-3 py-2">{row.land_use_category ?? '—'}</td>
              <td className="px-3 py-2">{Number(row.surface).toFixed(4)}</td>
              <td className="px-3 py-2">{row.surface_rented != null ? Number(row.surface_rented).toFixed(4) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
