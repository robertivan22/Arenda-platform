'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { AlertTriangle, FileSpreadsheet, Download, Check, FileCode, ShieldCheck, ShieldAlert, XCircle, Loader2, Settings } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { validateD112, buildD112ValidationInput, type VMsg } from '@/lib/d112Validator'


interface PayerInfo {
  cif: string; den: string; caen: string; casaAng: string
  numeDeclar: string; prenumeDeclar: string; functieDeclar: string
}

// CompanySettings shape loaded from DB
interface CS {
  name?: string; cif?: string; reg_com?: string
  address?: string; county?: string; locality?: string
  phone?: string; email?: string
  d112_caen?: string; d112_casa_ang?: string; d112_fax_soc?: string
  d112_adr_fisc?: string; d112_tel_fisc?: string; d112_fax_fisc?: string; d112_mail_fisc?: string
  d112_tip_rec?: number; d112_d_rec?: number
  d112_nume_declar?: string; d112_prenume_declar?: string; d112_functie_declar?: string
}

function buildAdrSoc(cs: CS): string {
  return [cs.address, cs.locality, cs.county].filter(Boolean).join(', ')
}

function buildPayer(cs: CS): PayerInfo {
  return {
    cif: cs.cif ?? '',
    den: cs.name ?? '',
    caen: cs.d112_caen ?? '0111',
    casaAng: cs.d112_casa_ang ?? 'IS',
    numeDeclar: cs.d112_nume_declar ?? '',
    prenumeDeclar: cs.d112_prenume_declar ?? '',
    functieDeclar: cs.d112_functie_declar ?? 'Administrator',
  }
}

const MISSING_REQUIRED: { key: keyof CS; label: string }[] = [
  { key: 'cif',                label: 'CIF firmă (tab Date firmă în Setări)' },
  { key: 'name',               label: 'Denumire firmă (tab Date firmă în Setări)' },
  { key: 'address',            label: 'Adresă sediu (tab Date firmă în Setări)' },
  { key: 'd112_caen',          label: 'Cod CAEN (tab Date Declarație 112)' },
  { key: 'd112_casa_ang',      label: 'Casa asig. sănătate (tab Date Declarație 112)' },
  { key: 'd112_nume_declar',   label: 'Nume declarant (tab Date Declarație 112)' },
  { key: 'd112_prenume_declar',label: 'Prenume declarant (tab Date Declarație 112)' },
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
  const [cs, setCs] = useState<CS | null>(null)
  const [settingsMissing, setSettingsMissing] = useState<string[]>([])
  const [validationMsgs, setValidationMsgs] = useState<VMsg[] | null>(null)
  const [validating, setValidating] = useState(false)

  // Load company settings from DB
  useEffect(() => {
    createClient().from('company_settings').select('*').single()
      .then(({ data }) => {
        if (data) {
          setCs(data as CS)
          const missing = MISSING_REQUIRED
            .filter(({ key }) => !((data as any)[key]?.toString().trim()))
            .map(({ label }) => label)
          setSettingsMissing(missing)
        } else {
          setSettingsMissing(['Completeaza Date firma si Date Declaratie 112 in Setari'])
        }
      })
  }, [])

  async function generate() {
    setLoading(true)
    setDataset(null)
    try {
      const { data: { user } } = await createClient().auth.getUser()
      if (!user) throw new Error('Neautentificat.')
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

  function runValidation() {
    if (!dataset || !cs) return
    setValidating(true)
    try {
      const payer = buildPayer(cs)
      const input = buildD112ValidationInput(dataset, payer)
      const msgs = validateD112(input)
      setValidationMsgs(msgs)
      const errors = msgs.filter(m => m.level === 'ERR').length
      const warns = msgs.filter(m => m.level === 'ATT').length
      if (errors === 0) toast.success(`Validare completa — ${warns} avertizari, nicio eroare fatala.`)
      else toast.error(`Validare: ${errors} erori fatale (ERR). Fisierul XML nu va fi acceptat de ANAF.`)
    } finally {
      setValidating(false)
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
    if (!dataset || !cs) { toast.error('Date firma lipsa. Configureaza in Setari.'); return }
    const NZC = daysInMonth(dataset.periodYear, dataset.periodMonth)
    const firstDay = `${pad2(1)}.${pad2(dataset.periodMonth)}.${dataset.periodYear}`
    const lastDay = `${pad2(NZC)}.${pad2(dataset.periodMonth)}.${dataset.periodYear}`

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
    const adrSoc = buildAdrSoc(cs)
    const adrFisc = cs.d112_adr_fisc?.trim() || adrSoc

    let idCounter = 1
    const asigurati = [...byLessor.entries()].map(([cnp, d]) => {
      const brut = Math.round(d.brut)
      const netTax = Math.round(d.netTax)
      const impozit = Math.round(d.impozit)
      const idAsig = String(idCounter++).padStart(6, '0')
      return `  <asigurat
    idAsig="${idAsig}"
    cnpAsig="${escXml(cnp)}"
    numeAsig="${escXml(d.last.toUpperCase())}"
    prenAsig="${escXml(d.first.toUpperCase())}"
    dataAng="${firstDay}"
    dataSf="${lastDay}"
    casaSn="${escXml(cs.d112_casa_ang ?? 'IS')}"
    asigCI="2"
    asigSO="2"
    Timp_E3="${impozit}">
    <asiguratC
      C_1="26"
      C_2="${NZC}"
      C_19="${brut}"
      C_8="0"
      C_9="0"/>
    <asiguratE3
      E3_1="C"
      E3_2="26"
      E3_3="3"
      E3_4="P"
      E3_8="${brut}"
      E3_9="0"
      E3_14="${brut}"
      E3_15="${impozit}"
      E3_16="${Math.round(d.brut - d.impozit)}"/>
  </asigurat>`
    }).join('\n')

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<declaratieUnica
  xmlns="mfp:anaf:dgti:declaratie_unica:declaratie:v6"
  luna_r="${dataset.periodMonth}"
  an_r="${dataset.periodYear}"
  d_rec="${cs.d112_tip_rec ?? 0}"${(cs.d112_d_rec && cs.d112_d_rec > 0) ? `\n  tip_rec="${cs.d112_d_rec}"` : ''}
  nume_declar="${escXml(cs.d112_nume_declar ?? 'NEDEFINIT')}"
  prenume_declar="${escXml(cs.d112_prenume_declar ?? 'NEDEFINIT')}"
  functie_declar="${escXml(cs.d112_functie_declar ?? 'Administrator')}">
  <angajator
    cif="${escXml(cs.cif ?? '')}"
    rgCom="${escXml(cs.reg_com ?? '')}"
    caen="${escXml(cs.d112_caen ?? '0111')}"
    den="${escXml(cs.name ?? '')}"
    adrSoc="${escXml(adrSoc)}"
    telSoc="${escXml(cs.phone ?? '')}"
    faxSoc="${escXml(cs.d112_fax_soc ?? '')}"
    mailSoc="${escXml(cs.email ?? '')}"
    adrFisc="${escXml(adrFisc)}"
    telFisc="${escXml((cs.d112_tel_fisc?.trim() || cs.phone) ?? '')}"
    faxFisc="${escXml(cs.d112_fax_fisc ?? '')}"
    mailFisc="${escXml((cs.d112_mail_fisc?.trim() || cs.email) ?? '')}"
    casaAng="${escXml(cs.d112_casa_ang ?? 'IS')}"
    datCAM="0"
    bifa_CAM="0"
    totalPlata_A="${totalImpozit}">
    <angajatorA
      A_codBugetar="5503110"
      A_codOblig="619"
      A_datorat="${totalImpozit}"
      A_deductibil="0"
      A_scutit="0"
      A_plata="${totalImpozit}"/>
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
        title="D112 — Impozit retinut la sursa"
        subtitle="Set de date orientativ pentru pregatirea D112 (DRAFT — necesita validare contabil)"
      />

      <div className="mb-4 flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
        <span>
          <strong>DRAFT</strong> — Sistemul genereaza un set de date orientativ. Folositi software-ul oficial
          ANAF D112 pentru transmitere. Nu trimiteti date la ANAF direct din acest sistem.
        </span>
      </div>

      {/* Settings warning / info strip */}
      {settingsMissing.length > 0 ? (
        <div className="mb-4 flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-500" />
          <div>
            <p className="font-semibold mb-1">Date firma incomplete — XML-ul nu va fi generat corect</p>
            <ul className="list-disc list-inside text-xs space-y-0.5">
              {settingsMissing.map(m => <li key={m}>{m}</li>)}
            </ul>
            <Link href="/setari" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-red-700 hover:underline">
              <Settings className="w-3 h-3" /> Configureaza in Setari →
            </Link>
          </div>
        </div>
      ) : cs ? (
        <div className="mb-4 flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-green-800">
          <span>
            <strong>Platitor:</strong> {cs.name} | CIF: {cs.cif} | Declarant: {cs.d112_prenume_declar} {cs.d112_nume_declar} ({cs.d112_functie_declar})
          </span>
          <Link href="/setari" className="flex items-center gap-1 text-green-700 hover:underline font-medium">
            <Settings className="w-3 h-3" /> Editeaza in Setari →
          </Link>
        </div>
      ) : null}

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
              disabled={settingsMissing.length > 0}
              title={settingsMissing.length > 0 ? 'Completează datele firmei în Setări înainte de export' : undefined}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-blue-400 text-blue-700 hover:bg-blue-50 disabled:opacity-40 disabled:cursor-not-allowed rounded font-medium"
            >
              <FileCode className="w-4 h-4" />
              Export XML (ANAF D112)
            </button>

            <button
              onClick={runValidation}
              disabled={validating || settingsMissing.length > 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-green-500 text-green-700 hover:bg-green-50 disabled:opacity-50 rounded font-medium"
            >
              {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Validare ANAF
            </button>
          </>
        )}
      </div>


      {/* Validation results panel */}
      {validationMsgs !== null && (() => {
        const errors = validationMsgs.filter(m => m.level === 'ERR')
        const warns  = validationMsgs.filter(m => m.level === 'ATT')
        const isOk   = errors.length === 0
        return (
          <div className={`mb-4 rounded-lg border overflow-hidden ${
            isOk ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'
          }`}>
            {/* Header */}
            <div className={`flex items-center justify-between px-4 py-2.5 ${
              isOk ? 'bg-green-100' : 'bg-red-100'
            }`}>
              <span className="flex items-center gap-2 text-sm font-semibold">
                {isOk
                  ? <><ShieldCheck className="w-4 h-4 text-green-600" /><span className="text-green-800">Validare ANAF — nicio eroare fatală</span></>
                  : <><ShieldAlert className="w-4 h-4 text-red-600" /><span className="text-red-800">Validare ANAF — {errors.length} erori fatale (ERR)</span></>}
              </span>
              <span className="text-xs text-gray-500">
                {errors.length} ERR &bull; {warns.length} ATT &bull; DUKValidator J26.0.3
              </span>
            </div>
            {/* Messages */}
            {validationMsgs.length > 0 && (
              <div className="divide-y divide-gray-200 max-h-72 overflow-y-auto">
                {validationMsgs.map((m, i) => (
                  <div key={i} className={`flex gap-2 px-4 py-2 text-xs ${
                    m.level === 'ERR' ? 'bg-red-50 text-red-800'
                    : 'bg-amber-50 text-amber-800'
                  }`}>
                    {m.level === 'ERR'
                      ? <XCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-red-500" />
                      : <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-amber-500" />}
                    <div>
                      <span className="font-mono font-bold mr-1.5">[{m.code}]</span>
                      {m.msg}
                      {m.cnp && !m.cnp.startsWith('NECNP') && (
                        <span className="ml-1.5 font-mono text-gray-500">CNP: {m.cnp}</span>
                      )}
                    </div>
                  </div>
                ))}
                {errors.length === 0 && warns.length === 0 && (
                  <div className="px-4 py-2 text-xs text-green-700">
                    Toate verificările au trecut. Fișierul XML poate fi importat în aplicația ANAF D112.
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })()}

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
