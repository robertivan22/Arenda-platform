'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { AlertTriangle, FileSpreadsheet, Download, Check } from 'lucide-react'
import { toast } from 'sonner'

const MONTHS = [
  'Ianuarie', 'Februarie', 'Martie', 'Aprilie', 'Mai', 'Iunie',
  'Iulie', 'August', 'Septembrie', 'Octombrie', 'Noiembrie', 'Decembrie',
]

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

interface D112Row {
  lessorCnp: string
  lessorLastName: string
  lessorFirstName: string
  contractId: string
  paymentType: string
  grossAmountRon: number
  flatDeductionRon: number
  netTaxableRon: number
  withholdingTaxRon: number
  warnings: string[]
  isComplete: boolean
  legalBasis: string
}

interface D112Dataset {
  periodYear: number
  periodMonth: number
  rows: D112Row[]
  totalGrossRon: number
  totalWithholdingTaxRon: number
  rowsWithWarnings: number
  rowsIncomplete: number
  applicabilityNotes: string[]
  warnings: string[]
  generatedAt: string
  status: 'DRAFT'
  requiresAccountantReview: true
}

export default function D112Page() {
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(currentMonth === 1 ? 12 : currentMonth - 1)  // previous month default
  const [loading, setLoading] = useState(false)
  const [dataset, setDataset] = useState<D112Dataset | null>(null)

  async function generate() {
    setLoading(true)
    setDataset(null)
    try {
      const res = await fetch('/api/d112', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Eroare la generare D112.')
      setDataset(json.dataset)
      toast.success(`D112 generat — ${json.dataset.rows.length} înregistrări.`)
    } catch (e: any) {
      toast.error(e.message ?? 'Eroare la generare D112.')
    } finally {
      setLoading(false)
    }
  }

  function downloadCsv() {
    if (!dataset) return
    const headers = ['CNP', 'Nume', 'Prenume', 'Contract', 'Tip plată', 'Brut (RON)', 'Deducere (RON)', 'Bază impozabilă (RON)', 'Impozit reținut (RON)', 'Complet', 'Avertizări']
    const rows = dataset.rows.map(r => [
      r.lessorCnp, r.lessorLastName, r.lessorFirstName,
      r.contractId, r.paymentType,
      r.grossAmountRon, r.flatDeductionRon, r.netTaxableRon, r.withholdingTaxRon,
      r.isComplete ? 'DA' : 'NU',
      r.warnings.join(' | '),
    ])
    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `D112_${dataset.periodYear}_${String(dataset.periodMonth).padStart(2, '0')}_DRAFT.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const inputCls = 'px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="D112 — Impozit reținut la sursă"
        subtitle="Set de date orientativ pentru pregătirea D112 (DRAFT — necesită validare contabil)"
      />

      <div className="mb-4 flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
        <span>
          <strong>DRAFT</strong> — Sistemul generează un set de date orientativ. Folosiți software-ul oficial
          ANAF D112 pentru transmitere. Nu trimiteți date la ANAF direct din acest sistem.
        </span>
      </div>

      {/* Period selector */}
      <div className="mb-6 flex flex-wrap items-end gap-3 p-4 bg-white border border-gray-200 rounded-lg">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">An</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className={inputCls}>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Lună</label>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} className={inputCls}>
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded font-medium"
        >
          <FileSpreadsheet className="w-4 h-4" />
          {loading ? 'Generez...' : 'Generează set de date'}
        </button>
        {dataset && (
          <button
            onClick={downloadCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 hover:bg-gray-50 rounded font-medium"
          >
            <Download className="w-4 h-4" />
            Export CSV (DRAFT)
          </button>
        )}
      </div>

      {/* Results */}
      {dataset && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Înregistrări', value: dataset.rows.length },
              { label: 'Total brut (RON)', value: dataset.totalGrossRon.toFixed(2) },
              { label: 'Total impozit reținut (RON)', value: dataset.totalWithholdingTaxRon.toFixed(2) },
              { label: 'Cu avertizări', value: dataset.rowsWithWarnings, warn: dataset.rowsWithWarnings > 0 },
            ].map(card => (
              <div key={card.label} className={`p-3 rounded-lg border ${card.warn ? 'border-yellow-200 bg-yellow-50' : 'border-gray-200 bg-white'}`}>
                <div className="text-lg font-semibold">{card.value}</div>
                <div className="text-xs text-gray-500">{card.label}</div>
              </div>
            ))}
          </div>

          {/* Applicability notes */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs font-semibold text-blue-700 mb-1">Note de aplicabilitate</p>
            <ul className="text-xs text-blue-700 space-y-0.5">
              {dataset.applicabilityNotes.map((n, i) => <li key={i}>• {n}</li>)}
            </ul>
          </div>

          {/* Warnings */}
          {dataset.warnings.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              {dataset.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-800">{w}</p>
              ))}
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border-collapse bg-white border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  {['CNP', 'Arendator', 'Tip plată', 'Brut (RON)', 'Deducere (RON)', 'Net impozabil (RON)', 'Impozit reținut (RON)', 'Status'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 border-b border-gray-200">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dataset.rows.map((row, i) => (
                  <tr key={i} className={row.warnings.length > 0 ? 'bg-yellow-50' : ''}>
                    <td className="px-3 py-2 font-mono text-xs text-gray-700">{row.lessorCnp}</td>
                    <td className="px-3 py-2 text-xs">{row.lessorLastName} {row.lessorFirstName}</td>
                    <td className="px-3 py-2 text-xs">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${row.paymentType === 'IN_KIND' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                        {row.paymentType === 'IN_KIND' ? 'Natură' : 'Numerar'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-right">{row.grossAmountRon.toFixed(2)}</td>
                    <td className="px-3 py-2 text-xs text-right text-gray-500">{row.flatDeductionRon.toFixed(2)}</td>
                    <td className="px-3 py-2 text-xs text-right">{row.netTaxableRon.toFixed(2)}</td>
                    <td className="px-3 py-2 text-xs text-right font-semibold">{row.withholdingTaxRon.toFixed(2)}</td>
                    <td className="px-3 py-2 text-xs">
                      {row.isComplete && row.warnings.length === 0 ? (
                        <span className="flex items-center gap-1 text-green-600"><Check className="w-3 h-3" /> OK</span>
                      ) : (
                        <span className="text-yellow-600 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Avertizare
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-semibold">
                <tr>
                  <td colSpan={3} className="px-3 py-2 text-xs text-right">TOTAL</td>
                  <td className="px-3 py-2 text-xs text-right">{dataset.totalGrossRon.toFixed(2)}</td>
                  <td className="px-3 py-2 text-xs text-right text-gray-500">—</td>
                  <td className="px-3 py-2 text-xs text-right">—</td>
                  <td className="px-3 py-2 text-xs text-right">{dataset.totalWithholdingTaxRon.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <div className="mt-6 text-center">
        <span className="text-xs text-gray-400">Setul generat este DRAFT — validați cu contabilul înainte de depunere la ANAF.</span>
      </div>
    </div>
  )
}
