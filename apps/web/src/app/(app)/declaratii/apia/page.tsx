'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { AlertTriangle, Tractor, Download, Check } from 'lucide-react'
import { toast } from 'sonner'

interface ApiaRow {
  lessorCnp: string
  lessorLastName: string
  lessorFirstName: string
  contractNumber: string
  contractStartDate: string
  contractEndDate: string
  parcelTarla: string
  parcelParcela: string
  parcelBlocFizic: string
  leasedSurfaceHa: number
  countyName: string
  localityName: string
  landUseCategory: string
  apiaDeclared: boolean
}

interface ApiaDataset {
  campaignYear: number
  rows: ApiaRow[]
  totalSurfaceHa: number
  warnings: string[]
  status: 'DRAFT'
}

const currentYear = new Date().getFullYear()

export default function ApiaPage() {
  const [year, setYear] = useState(currentYear)
  const [loading, setLoading] = useState(false)
  const [dataset, setDataset] = useState<ApiaDataset | null>(null)

  async function generate() {
    setLoading(true)
    setDataset(null)
    try {
      const res = await fetch('/api/apia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignYear: year }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Eroare la generare export APIA.')
      setDataset(json.dataset)
      toast.success(`Export APIA generat — ${json.dataset.rows.length} parcele.`)
    } catch (e: any) {
      toast.error(e.message ?? 'Eroare la generare export APIA.')
    } finally {
      setLoading(false)
    }
  }

  function downloadCsv() {
    if (!dataset) return
    const headers = ['CNP Arendator', 'Nume', 'Prenume', 'Nr. Contract', 'Data Start', 'Data Expirare', 'Tarla', 'Parcela', 'Bloc Fizic', 'Suprafata (ha)', 'Judet', 'Localitate', 'Categorie', 'Declarat APIA']
    const rows = dataset.rows.map(r => [
      r.lessorCnp, r.lessorLastName, r.lessorFirstName,
      r.contractNumber, r.contractStartDate, r.contractEndDate,
      r.parcelTarla, r.parcelParcela, r.parcelBlocFizic,
      r.leasedSurfaceHa, r.countyName, r.localityName,
      r.landUseCategory, r.apiaDeclared ? 'DA' : 'NU',
    ])
    const csv = [headers, ...rows]
      .map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `APIA_Export_${year}_DRAFT.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const inputCls = 'px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        title="Export APIA"
        subtitle="Date de parcele și contracte pentru campania agricolă APIA (DRAFT)"
      />

      <div className="mb-4 flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
        <span>
          <strong>DRAFT</strong> — Exportul este orientativ. Verificați datele față de documentele oficiale APIA
          și cerințele campaniei {year}. Cerințele APIA se modifică anual.
        </span>
      </div>

      {/* Year selector */}
      <div className="mb-6 flex flex-wrap items-end gap-3 p-4 bg-white border border-gray-200 rounded-lg">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">An campanie</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} className={inputCls}>
            {[currentYear - 1, currentYear, currentYear + 1].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white rounded font-medium"
        >
          <Tractor className="w-4 h-4" />
          {loading ? 'Generez...' : 'Generează export'}
        </button>
        {dataset && (
          <button
            onClick={downloadCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 hover:bg-gray-50 rounded font-medium"
          >
            <Download className="w-4 h-4" />
            Descarcă CSV (DRAFT)
          </button>
        )}
      </div>

      {/* Results */}
      {dataset && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Parcele', value: dataset.rows.length },
              { label: 'Suprafață totală (ha)', value: dataset.totalSurfaceHa.toFixed(4) },
              { label: 'Nedeclarate APIA', value: dataset.rows.filter(r => !r.apiaDeclared).length, warn: true },
            ].map(card => (
              <div key={card.label} className={`p-3 rounded-lg border ${card.warn && Number(card.value) > 0 ? 'border-yellow-200 bg-yellow-50' : 'border-gray-200 bg-white'}`}>
                <div className="text-lg font-semibold">{card.value}</div>
                <div className="text-xs text-gray-500">{card.label}</div>
              </div>
            ))}
          </div>

          {/* Warnings */}
          {dataset.warnings.length > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-0.5">
              {dataset.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-800">{w}</p>
              ))}
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs border-collapse bg-white border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-50">
                <tr>
                  {['CNP', 'Arendator', 'Nr. Contract', 'Tarla', 'Parcela', 'Bloc Fizic', 'Suprafață (ha)', 'Județ', 'Localitate', 'APIA'].map(h => (
                    <th key={h} className="px-2.5 py-2 text-left text-xs font-semibold text-gray-600 border-b border-gray-200 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {dataset.rows.map((row, i) => (
                  <tr key={i} className={!row.apiaDeclared ? 'bg-yellow-50' : ''}>
                    <td className="px-2.5 py-1.5 font-mono">{row.lessorCnp}</td>
                    <td className="px-2.5 py-1.5 whitespace-nowrap">{row.lessorLastName} {row.lessorFirstName}</td>
                    <td className="px-2.5 py-1.5">{row.contractNumber}</td>
                    <td className="px-2.5 py-1.5">{row.parcelTarla}</td>
                    <td className="px-2.5 py-1.5">{row.parcelParcela}</td>
                    <td className="px-2.5 py-1.5">{row.parcelBlocFizic}</td>
                    <td className="px-2.5 py-1.5 text-right">{row.leasedSurfaceHa.toFixed(4)}</td>
                    <td className="px-2.5 py-1.5">{row.countyName}</td>
                    <td className="px-2.5 py-1.5">{row.localityName}</td>
                    <td className="px-2.5 py-1.5">
                      {row.apiaDeclared
                        ? <span className="text-green-600 flex items-center gap-1"><Check className="w-3 h-3" />DA</span>
                        : <span className="text-yellow-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />NU</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
