'use client'

export const runtime = 'edge'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import Link from 'next/link'
import { FileSpreadsheet, Tractor, AlertTriangle, Check, Clock, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface Run {
  id: string
  declarationType: string
  period: string
  status: 'DRAFT' | 'APPROVED' | 'SUBMITTED'
  createdAt: string
  approvedAt?: string
  _count: { items: number }
}

const statusConfig: Record<string, { label: string; cls: string }> = {
  DRAFT: { label: 'Draft', cls: 'bg-gray-100 text-gray-600' },
  APPROVED: { label: 'Aprobat', cls: 'bg-green-100 text-green-700' },
  SUBMITTED: { label: 'Transmis', cls: 'bg-blue-100 text-blue-700' },
}

export default function IstoricPage() {
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

  async function load() {
    setLoading(true)
    try {
      const url = filter ? `/api/declarations/runs?type=${filter}` : '/api/declarations/runs'
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) throw new Error(`Eroare: ${res.status}`)
      setRuns(await res.json())
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filter])

  async function deleteRun(id: string, period: string) {
    if (!confirm(`Sigur ștergeți setul ${period}? Acțiunea este ireversibilă.`)) return
    try {
      const res = await fetch(`/api/declarations/runs/${id}`, { method: 'DELETE', credentials: 'include' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message ?? 'Eroare la ștergere.')
      }
      toast.success('Set șters.')
      load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const inputCls = 'px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Istoric declarații"
        subtitle="Toate seturile de date generate"
      />

      <div className="mb-4 flex gap-2">
        <select value={filter} onChange={e => setFilter(e.target.value)} className={inputCls}>
          <option value="">Toate tipurile</option>
          <option value="D112">D112</option>
          <option value="APIA">APIA</option>
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500 py-8 text-center">Se încarcă...</p>
      ) : runs.length === 0 ? (
        <div className="py-16 text-center text-gray-500">
          <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nu există seturi generate{filter ? ` de tip ${filter}` : ''}.</p>
          <p className="text-xs mt-1">
            <Link href="/declaratii/d112" className="text-brand-600 hover:underline">Generați primul set D112</Link>
            {' sau '}
            <Link href="/declaratii/apia" className="text-brand-600 hover:underline">export APIA</Link>.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {runs.map(run => {
            const cfg = statusConfig[run.status] ?? statusConfig.DRAFT
            const Icon = run.declarationType === 'D112' ? FileSpreadsheet : Tractor
            return (
              <div key={run.id} className="flex items-center gap-3 p-3 bg-white border border-gray-200 rounded-lg">
                <Icon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-sm">{run.declarationType}</span>
                    <span className="text-sm text-gray-600">{run.period}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.cls}`}>{cfg.label}</span>
                    <span className="text-xs text-gray-400">{run._count.items} înregistrări</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Generat: {new Date(run.createdAt).toLocaleString('ro-RO')}
                    {run.approvedAt && ` · Aprobat: ${new Date(run.approvedAt).toLocaleString('ro-RO')}`}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/declaratii/${run.id}`}
                    className="px-2.5 py-1 text-xs border border-gray-300 hover:bg-gray-50 rounded"
                  >
                    Detalii
                  </Link>
                  {run.status === 'DRAFT' && (
                    <button
                      onClick={() => deleteRun(run.id, run.period)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                      title="Șterge"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
