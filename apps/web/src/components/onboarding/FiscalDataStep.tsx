'use client'

import { useState } from 'react'
import type { OnboardingData, FiscalData } from './types'

interface Props {
  data: OnboardingData
  saving: boolean
  onNext: (data: Partial<OnboardingData>) => void
  onBack: () => void
}

/** Strips 'RO' prefix and whitespace, returns digits only. */
function normalizeCui(raw: string): string {
  return raw.trim().replace(/^RO\s*/i, '').replace(/\s/g, '')
}

/** Romanian CUI: 2–10 digits. */
function isValidCui(cui: string): boolean {
  return /^\d{2,10}$/.test(normalizeCui(cui))
}

export function FiscalDataStep({ data, saving, onNext, onBack }: Props) {
  const existing = data.fiscal
  const [cui, setCui] = useState(existing?.cui ?? '')
  const [denumire, setDenumire] = useState(existing?.denumire ?? '')
  const [adresa, setAdresa] = useState(existing?.adresaSediu ?? '')
  const [caen, setCaen] = useState(existing?.codCaen ?? '')
  const [cuiError, setCuiError] = useState<string | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)

  async function handleCuiBlur() {
    const normalized = normalizeCui(cui)
    if (!normalized) return

    if (!isValidCui(cui)) {
      setCuiError('CUI invalid — introduceți 2–10 cifre (cu sau fără prefix „RO").')
      return
    }
    setCuiError(null)

    // TODO: integrate ANAF open-data CUI lookup when endpoint is available.
    // Example: GET /api/anaf/cui?cui={normalized} → { denumire, adresa }
    // For now, show a loading shimmer to indicate the hook is wired.
    setLookupLoading(true)
    await new Promise(r => setTimeout(r, 300)) // placeholder latency
    setLookupLoading(false)
  }

  function handleSubmit() {
    const normalized = normalizeCui(cui)

    if (!isValidCui(cui)) {
      setCuiError('CUI invalid — introduceți 2–10 cifre (cu sau fără prefix „RO").')
      return
    }
    if (!denumire.trim()) return
    if (!adresa.trim()) return

    const fiscal: FiscalData = {
      cui: normalized,
      denumire: denumire.trim(),
      adresaSediu: adresa.trim(),
      codCaen: caen.trim(),
    }
    onNext({ fiscal })
  }

  const canSubmit = isValidCui(cui) && denumire.trim() && adresa.trim()

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Date fiscale</h1>
      <p className="text-gray-500 mb-8">
        Aceste date vor fi folosite la generarea facturilor și declarațiilor ANAF.
      </p>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5">
        {/* CUI */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            CUI / CIF <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="text"
              value={cui}
              onChange={e => { setCui(e.target.value); setCuiError(null) }}
              onBlur={handleCuiBlur}
              placeholder="ex: 12345678 sau RO12345678"
              className={`w-full px-4 py-2.5 rounded-lg border text-sm outline-none transition-colors ${
                cuiError
                  ? 'border-red-400 focus:border-red-500 bg-red-50'
                  : 'border-gray-300 focus:border-brand-500'
              }`}
            />
            {lookupLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
            )}
          </div>
          {cuiError && <p className="mt-1 text-xs text-red-600">{cuiError}</p>}
          <p className="mt-1 text-xs text-gray-400">
            {/* TODO: ANAF autocompletare activă după integrare endpoint lookup */}
            Completează CUI-ul — datele firmei vor fi preluate automat din ANAF (în curând).
          </p>
        </div>

        {/* Denumire */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Denumire <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={denumire}
            onChange={e => setDenumire(e.target.value)}
            placeholder={`ex: ${data.accountType === 'PFA' ? 'PFA Ion Popescu' : 'Agro SRL'}`}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-brand-500 text-sm outline-none transition-colors"
          />
        </div>

        {/* Adresă sediu */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Adresă sediu <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={adresa}
            onChange={e => setAdresa(e.target.value)}
            placeholder="ex: Str. Câmpului nr. 1, sat Aroneanu, jud. Iași"
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-brand-500 text-sm outline-none transition-colors"
          />
        </div>

        {/* Cod CAEN */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Cod CAEN
            <span className="ml-1 text-gray-400 font-normal text-xs">(opțional)</span>
          </label>
          <input
            type="text"
            value={caen}
            onChange={e => setCaen(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="ex: 0111"
            maxLength={4}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:border-brand-500 text-sm outline-none transition-colors"
          />
          <p className="mt-1 text-xs text-gray-400">4 cifre — activitatea principală conform clasificării CAEN Rev. 2</p>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
        >
          ← Înapoi
        </button>
        <button
          type="button"
          disabled={!canSubmit || saving}
          onClick={handleSubmit}
          className="flex-1 py-3 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Se salvează...' : 'Continuă →'}
        </button>
      </div>
    </div>
  )
}
