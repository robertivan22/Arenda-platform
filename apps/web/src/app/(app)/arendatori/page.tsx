'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Search, FileText } from 'lucide-react'
import { lessors, type Lessor } from '@/lib/mockStore'
import { generateLessorPDF } from '@/lib/pdfGenerator'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatusBadge } from '@/components/data-display/StatusBadge'

export default function LessorsListPage() {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<Lessor[]>([])

  useEffect(() => { setRows(lessors.list()) }, [])

  const filtered = rows.filter(r =>
    !search || r.displayName.toLowerCase().includes(search.toLowerCase()) ||
    r.cnpCui?.includes(search) || r.code?.includes(search)
  )

  return (
    <div>
      <PageHeader
        title="Arendatori"
        subtitle={`${filtered.length} înregistrări`}
        actions={
          <button
            onClick={() => router.push('/arendatori/nou')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-brand-500 hover:bg-brand-600 text-white rounded font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Arendator nou
          </button>
        }
      />

      <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Caută după nume, CNP, cod..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Cod</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Nume</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Tip</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">CNP/CUI</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Județ</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Localitate</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Telefon</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Contracte</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={10} className="px-3 py-8 text-center text-gray-400">Nicio înregistrare</td></tr>
            )}
            {filtered.map(row => (
              <tr key={row.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-500 font-mono text-xs">{row.code}</td>
                <td className="px-3 py-2">
                  <button onClick={() => router.push(`/arendatori/${row.id}/sumar`)} className="font-medium text-gray-900 hover:text-brand-600 text-left">
                    {row.displayName}
                  </button>
                </td>
                <td className="px-3 py-2"><StatusBadge status={row.type} /></td>
                <td className="px-3 py-2 font-mono text-xs">{row.cnpCui}</td>
                <td className="px-3 py-2">{row.county}</td>
                <td className="px-3 py-2">{row.locality}</td>
                <td className="px-3 py-2">{row.mobile || row.phone}</td>
                <td className="px-3 py-2 text-center">{row.contractsCount}</td>
                <td className="px-3 py-2"><StatusBadge status={row.status} /></td>
                <td className="px-3 py-2">
                  <button
                    onClick={() => generateLessorPDF(row)}
                    className="flex items-center gap-1 px-2 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50 text-gray-600"
                    title="Generează contract PDF"
                  >
                    <FileText className="w-3 h-3" />
                    PDF Contract
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
