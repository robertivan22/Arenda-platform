'use client'

export const runtime = 'edge'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PageHeader } from '@/components/layout/PageHeader'
import { AlertTriangle, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'

interface RunItem {
  id: string
  entityType: string
  entityId: string
  computedValue: number
  status: string
  metadataJson: {
    lessorCnp?: string
    lessorName?: string
    contractId?: string
    paymentType?: string
    grossAmountRon?: number
    flatDeductionRon?: number
    netTaxableRon?: number
    withholdingTaxRon?: number
    warnings?: string[]
    legalBasis?: string
    isComplete?: boolean
  }
}

interface Run {
  id: string
  declarationType: string
  period: string
  status: string
  createdAt: string
  approvedAt?: string
  reviewNotes?: string
  metadataJson: {
    totalGrossRon?: number
    totalWithholdingTaxRon?: number
    warnings?: string[]
    generatedAt?: string
  }
  items: RunItem[]
}

export default function RunDetailPage() {
  const params = useParams()
  const router = useRouter()
  const runId = params?.runId as string
  const [run, setRun] = useState<Run | null>(null)
  const [loading, setLoading] = useState(true)
  const [approveNotes, setApproveNotes] = useState('')
  const [approving, setApproving] = useState(false)

  useEffect(() => {
    if (!runId) return
    fetch(`/api/declarations/runs/${runId}`, { credentials: 'include' })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setRun)
      .catch(() => toast.error('Nu s-a putut încărca setul.'))
      .finally(() => setLoading(false))
  }, [runId])

  async function approve() {
    setApproving(true)
    try {
      const res = await fetch(`/api/declarations/runs/${runId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: approveNotes }),
        credentials: 'include',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message ?? 'Eroare la aprobare.')
      }
      const updated = await res.json()
      setRun(prev => prev ? { ...prev, status: updated.status, approvedAt: updated.approvedAt, reviewNotes: updated.reviewNotes } : prev)
      toast.success('Set aprobat.')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setApproving(false)
    }
  }

  if (loading) return <div className="p-8 text-center text-sm text-gray-500">Se încarcă...</div>
  if (!run) return <div className="p-8 text-center text-sm text-red-500">Setul nu a fost găsit. <Link href="/declaratii/istoric" className="underline">Înapoi</Link></div>

  const isDraft = run.status === 'DRAFT'
  const needsReviewItems = run.items.filter(i => i.status === 'NEEDS_REVIEW')

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title={`${run.declarationType} — ${run.period}`}
        subtitle={`Status: ${run.status} · ${run.items.length} înregistrări`}
      />

      <div className="mb-4 flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
        <span>
          <strong>DRAFT</strong> — Setul este orientativ. Nu transmiteți date la ANAF din acest sistem.
          Aprobarea înregistrează validarea internă; nu înlocuiește depunerea oficială.
        </span>
      </div>

      {/* Summary */}
      <div className="mb-4 p-4 bg-white border border-gray-200 rounded-lg">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div><span className="text-gray-500">Tip:</span> <strong>{run.declarationType}</strong></div>
          <div><span className="text-gray-500">Perioadă:</span> <strong>{run.period}</strong></div>
          <div><span className="text-gray-500">Total brut:</span> <strong>{run.metadataJson?.totalGrossRon?.toFixed(2) ?? '—'} RON</strong></div>
          <div><span className="text-gray-500">Total impozit:</span> <strong>{run.metadataJson?.totalWithholdingTaxRon?.toFixed(2) ?? '—'} RON</strong></div>
        </div>
        {run.approvedAt && (
          <p className="text-xs text-green-700 mt-2">
            ✓ Aprobat la {new Date(run.approvedAt).toLocaleString('ro-RO')}
            {run.reviewNotes && ` · Note: ${run.reviewNotes}`}
          </p>
        )}
      </div>

      {/* Warnings */}
      {(run.metadataJson?.warnings ?? []).length > 0 && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          {(run.metadataJson.warnings ?? []).map((w, i) => <p key={i} className="text-xs text-amber-800">{w}</p>)}
        </div>
      )}

      {/* Items needing review */}
      {needsReviewItems.length > 0 && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-800">
          <strong>{needsReviewItems.length} înregistrări necesită verificare</strong> (de ex. plăți în natură fără preț județean sau date lipsă).
        </div>
      )}

      {/* Approve section */}
      {isDraft && (
        <div className="mb-4 p-4 bg-white border border-gray-200 rounded-lg">
          <p className="text-sm font-semibold mb-2">Validare internă</p>
          <p className="text-xs text-gray-500 mb-3">
            Aprobarea marchează setul ca verificat intern. Nu înlocuiește depunerea la ANAF.
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Note de validare (opțional)"
              value={approveNotes}
              onChange={e => setApproveNotes(e.target.value)}
              className="flex-1 px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button
              onClick={approve}
              disabled={approving}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded font-medium"
            >
              <Check className="w-4 h-4" />
              {approving ? 'Se aprobă...' : 'Aprobă intern'}
            </button>
          </div>
        </div>
      )}

      {/* Items table */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs border-collapse bg-white border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-gray-50">
            <tr>
              {['CNP', 'Arendator', 'Tip plată', 'Brut (RON)', 'Net impozabil (RON)', 'Impozit (RON)', 'Status'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-b border-gray-200">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {run.items.map((item, i) => {
              const m = item.metadataJson
              const hasWarnings = (m.warnings ?? []).length > 0
              return (
                <tr key={item.id} className={hasWarnings ? 'bg-yellow-50' : ''}>
                  <td className="px-3 py-1.5 font-mono">{m.lessorCnp}</td>
                  <td className="px-3 py-1.5 whitespace-nowrap">{m.lessorName}</td>
                  <td className="px-3 py-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${m.paymentType === 'IN_KIND' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                      {m.paymentType === 'IN_KIND' ? 'Natură' : 'Numerar'}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right">{m.grossAmountRon?.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right">{m.netTaxableRon?.toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right font-semibold">{m.withholdingTaxRon?.toFixed(2)}</td>
                  <td className="px-3 py-1.5">
                    {item.status === 'COMPUTED' ? (
                      <span className="flex items-center gap-1 text-green-600"><Check className="w-3 h-3" /> OK</span>
                    ) : (
                      <span title={(m.warnings ?? []).join('\n')} className="flex items-center gap-1 text-yellow-600 cursor-help">
                        <AlertTriangle className="w-3 h-3" /> Verificare
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-center">
        <Link href="/declaratii/istoric" className="text-sm text-brand-600 hover:underline">← Înapoi la istoric</Link>
      </div>
    </div>
  )
}
