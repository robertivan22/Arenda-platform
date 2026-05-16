'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { AlertTriangle, FileSpreadsheet, Download, Check, FileCode, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

interface PayerInfo {
  cif: string
  den: string
  caen: string
  casaAng: string
  numeDeclar: string
  prenumeDeclar: string
  functieDeclar: string
}

const DEFAULT_PAYER: PayerInfo = {
  cif: '', den: '', caen: '0111', casaAng: 'IS',
  numeDeclar: '', prenumeDeclar: '', functieDeclar: 'Administrator',
}

const CASA_ANG_OPTIONS = [
  '_B','_A','_T','AB','AR','AG','BC','BH','BN','BT','BV','BR','BZ','CS','CJ','CT','CV',
  'CL','DB','DJ','GL','GR','GJ','HR','HD','IL','IS','IF','MM','MH','MS','NT','OT','PH',
  'SM','SJ','SB','SV','TR','TM','TL','VS','VL','VN',
]

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

function daysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate() }

function pad2(n: number) { return String(n).padStart(2, '0') }

function escXml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export default function D112Page() {
  const [year, setYear] = useState(currentYear)
  const [month, setMonth] = useState(currentMonth === 1 ? 12 : currentMonth - 1)
  const [loading, setLoading] = useState(false)
  const [dataset, setDataset] = useState<D112Dataset | null>(null)
  const [payer, setPayer] = useState<PayerInfo>(() => {
    if (typeof window !== 'undefined') {
      try { return { ...DEFAULT_PAYER, ...JSON.parse(localStorage.getItem('d112_payer') ?? '{}') } } catch { /**/ }
    }
    return DEFAULT_PAYER
  })
  const [showPayerForm, setShowPayerForm] = useState(false)

  function savePayer(updated: PayerInfo) {
    setPayer(updated)
    localStorage.setItem('d112_payer', JSON.stringify(updated))
  }

  async function generate() {
    setLoading(true)
    setDataset(null)
    try {
      const { data: { session } } = await createClient().auth.getSession()
      const token = session?.access_token ?? ''
      const res = await fetch('/api/d112', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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

  function downloadXml() {
    if (!dataset) return
    const NZC = daysInMonth(dataset.periodYear, dataset.periodMonth)
    const firstDay = `1.${pad2(dataset.periodMonth)}.${dataset.periodYear}`
    const lastDay = `${NZC}.${pad2(dataset.periodMonth)}.${dataset.periodYear}`

    // Aggregate per CNP (multiple payments → sum)
    const byLessor = new Map<string, { last: string; first: string; brut: number; netTax: number; impozit: number }>()
    for (const r of dataset.rows) {
      const key = r.lessorCnp || `NECNP_${r.lessorLastName}`
      const ex = byLessor.get(key)
      if (ex) {
        ex.brut += r.grossAmountRon
        ex.netTax += r.netTaxableRon
        ex.impozit += r.withholdingTaxRon
      } else {
        byLessor.set(key, { last: r.lessorLastName, first: r.lessorFirstName, brut: r.grossAmountRon, netTax: r.netTaxableRon, impozit: r.withholdingTaxRon })
      }
    }

    const totalImpozit = Math.round(dataset.totalWithholdingTaxRon)
    const totalBrut = Math.round(dataset.totalGrossRon)
    const totalCASS = Math.round(totalBrut * 0.10) // 10% CASS arendă (C_1=26)
    const totalPlata = totalImpozit + totalCASS

    const [numeDeclar, ...restNume] = (payer.numeDeclar || 'NEDEFINIT').split(' ')
    const prenumeDeclar = payer.prenumeDeclar || restNume.join(' ') || 'NEDEFINIT'

    let idCounter = 1
    const asigurati = [...byLessor.entries()].map(([cnp, d]) => {
      const brut = Math.round(d.brut)
      const netTax = Math.round(d.netTax)
      const impozit = Math.round(d.impozit)
      const cass = Math.round(brut * 0.10)
      const idAsig = String(idCounter++).padStart(6, '0')
      return `  <asigurat
    idAsig="${idAsig}"
    cnpAsig="${escXml(cnp)}"
    numeAsig="${escXml(d.last.toUpperCase())}"
    prenAsig="${escXml(d.first.toUpperCase())}"
    dataAng="${firstDay}"
    dataSf="${lastDay}"
    casaSn="${escXml(payer.casaAng)}"
    asigCI="2"
    asigSO="2"
    Timp_E3="${impozit}">
    <asiguratC
      C_1="26"
      C_2="${NZC}"
      C_19="${brut}"
      C_8="${brut}"
      C_9="${cass}"/>
    <asiguratE3
      E3_1="C"
      E3_2="26"
      E3_3="3"
      E3_4="P"
      E3_8="${brut}"
      E3_9="0"
      E3_14="${netTax}"
      E3_15="${impozit}"
      E3_16="${brut}"/>
  </asigurat>`
    }).join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<declaratieUnica
  xmlns="mfp:anaf:dgti:declaratie_unica:declaratie:v6"
  luna_r="${dataset.periodMonth}"
  an_r="${dataset.periodYear}"
  d_rec="0"
  nume_declar="${escXml(payer.numeDeclar || 'NEDEFINIT')}"
  prenume_declar="${escXml(prenumeDeclar)}"
  functie_declar="${escXml(payer.functieDeclar || 'Administrator')}">
  <angajator
    cif="${escXml(payer.cif)}"
    caen="${escXml(payer.caen)}"
    den="${escXml(payer.den)}"
    casaAng="${escXml(payer.casaAng)}"
    datCAM="0"
    bifa_CAM="0"
    totalPlata_A="${totalPlata}">
    <angajatorA
      A_codBugetar="5503XXXXXX"
      A_codOblig="619"
      A_datorat="${totalImpozit}"
      A_scutit="0"
      A_plata="${totalImpozit}"/>
    <angajatorA
      A_codBugetar="5503XXXXXX"
      A_codOblig="469"
      A_datorat="${totalCASS}"
      A_scutit="0"
      A_plata="${totalCASS}"/>
    <angajatorB
      B_cnp="0"
      B_sanatate="0"
      B_pensie="0"
      B_brutSalarii="0"
      B_sal="0"/>
  </angajator>
${asigurati}
</declaratieUnica>`

    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `D112_${dataset.periodYear}_${String(dataset.periodMonth).padStart(2, '0')}_DRAFT.xml`
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

      {/* Payer info form */}
      <div className="mb-4 border border-gray-200 rounded-lg bg-white overflow-hidden">
        <button
          onClick={() => setShowPayerForm(v => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <span className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-gray-400" />
            Date plătitor pentru export XML
            {(!payer.cif || !payer.den) && <span className="text-xs text-amber-600 font-normal">(completați pentru XML valid)</span>}
          </span>
          {showPayerForm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        {showPayerForm && (
          <div className="px-4 pb-4 pt-2 grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-gray-100">
            {([
              { key: 'cif', label: 'CIF Plătitor', placeholder: 'ex. 12345678' },
              { key: 'den', label: 'Denumire plătitor', placeholder: 'ex. SC AGRO SRL' },
              { key: 'numeDeclar', label: 'Nume declarant', placeholder: 'ex. POPESCU' },
              { key: 'prenumeDeclar', label: 'Prenume declarant', placeholder: 'ex. ION' },
              { key: 'functieDeclar', label: 'Funcție declarant', placeholder: 'ex. Administrator' },
            ] as const).map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                <input
                  value={payer[f.key]}
                  onChange={e => savePayer({ ...payer, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  className={inputCls + ' w-full'}
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Cod CAEN</label>
              <input value={payer.caen} onChange={e => savePayer({ ...payer, caen: e.target.value })} className={inputCls + ' w-full'} placeholder="0111" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Casă asig. sănătate</label>
              <select value={payer.casaAng} onChange={e => savePayer({ ...payer, casaAng: e.target.value })} className={inputCls + ' w-full'}>
                {CASA_ANG_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        )}
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
          <>
            <button
              onClick={downloadCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 hover:bg-gray-50 rounded font-medium"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={downloadXml}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-blue-400 text-blue-700 hover:bg-blue-50 rounded font-medium"
            >
              <FileCode className="w-4 h-4" />
              Export XML (ANAF D112)
            </button>
          </>
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
