'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { OnboardingData } from './types'

interface Props {
  data: OnboardingData
  saving: boolean
  onNext: (data: Partial<OnboardingData>) => void
  onBack: () => void
}

type Option = 'draw' | 'import' | 'skip' | null

const MapParcelSelector = dynamic(
  () => import('@/app/(app)/parcele/harta/MapParcelSelector'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[480px] bg-gray-50 rounded-xl border border-gray-200 mt-4">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-500">Se încarcă harta...</p>
        </div>
      </div>
    ),
  },
)

export function ImportParcelsStep({ data, saving, onNext, onBack }: Props) {
  const [selected, setSelected] = useState<Option>(null)
  const [mapOpened, setMapOpened] = useState(false)

  function handleOptionClick(opt: Option) {
    setSelected(opt)
    if (opt === 'draw' || opt === 'import') {
      setMapOpened(true)
    } else {
      setMapOpened(false)
    }
  }

  function handleContinue() {
    if (selected === 'skip') {
      onNext({ parcelsImported: false })
    } else if (selected === 'draw' || selected === 'import') {
      // Parcels are saved directly to the `parcele` table by MapParcelSelector.
      // We only record the flag here.
      onNext({ parcelsImported: true })
    }
  }

  const canContinue = selected !== null

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Parcele agricole</h1>
      <p className="text-gray-500 mb-6">
        Importă parcelele pe care le administrezi sau sari peste — le poți adăuga oricând din meniul{' '}
        <strong>Harta Parcele</strong>.
      </p>

      {/* Option cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {/* Draw */}
        <button
          type="button"
          onClick={() => handleOptionClick('draw')}
          className={`relative rounded-2xl border-2 p-5 text-left transition-all focus:outline-none ${
            selected === 'draw'
              ? 'border-brand-600 bg-brand-50 shadow-sm'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
          }`}
        >
          {selected === 'draw' && <CheckBadge />}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${selected === 'draw' ? 'bg-brand-100' : 'bg-gray-100'}`}>
            <svg className={`w-5 h-5 ${selected === 'draw' ? 'text-brand-600' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
          </div>
          <p className={`font-semibold text-sm mb-1 ${selected === 'draw' ? 'text-brand-700' : 'text-gray-800'}`}>Desenează pe hartă</p>
          <p className="text-xs text-gray-500 leading-snug">Marchează manual conturul parcelelor pe hartă</p>
        </button>

        {/* Shapefile import */}
        <button
          type="button"
          onClick={() => handleOptionClick('import')}
          className={`relative rounded-2xl border-2 p-5 text-left transition-all focus:outline-none ${
            selected === 'import'
              ? 'border-brand-600 bg-brand-50 shadow-sm'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
          }`}
        >
          {selected === 'import' && <CheckBadge />}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${selected === 'import' ? 'bg-brand-100' : 'bg-gray-100'}`}>
            <svg className={`w-5 h-5 ${selected === 'import' ? 'text-brand-600' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <p className={`font-semibold text-sm mb-1 ${selected === 'import' ? 'text-brand-700' : 'text-gray-800'}`}>Import shapefile</p>
          <p className="text-xs text-gray-500 leading-snug">Importă GeoJSON / SHP (Stereo70 sau WGS84)</p>
        </button>

        {/* Skip */}
        <button
          type="button"
          onClick={() => handleOptionClick('skip')}
          className={`relative rounded-2xl border-2 p-5 text-left transition-all focus:outline-none ${
            selected === 'skip'
              ? 'border-gray-400 bg-gray-50 shadow-sm'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
          }`}
        >
          {selected === 'skip' && (
            <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-gray-500 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
          )}
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </div>
          <p className="font-semibold text-sm mb-1 text-gray-700">Sar peste</p>
          <p className="text-xs text-gray-500 leading-snug">Adaug parcelele mai târziu din aplicație</p>
        </button>
      </div>

      {/* Map — shown when draw or import is selected */}
      {mapOpened && (
        <div className="mb-6 rounded-2xl border border-brand-200 overflow-hidden">
          <div className="bg-brand-50 border-b border-brand-200 px-4 py-2.5 flex items-center gap-2">
            <svg className="w-4 h-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs text-brand-700 font-medium">
              {selected === 'import'
                ? 'Folosiți butonul „Import" din hartă pentru a încărca fișierul GeoJSON / SHP.'
                : 'Desenați conturul parcelelor cu instrumentele din bara de sus a hărții.'}
            </span>
          </div>
          <MapParcelSelector
            mode="inline"
            height="460px"
            allowDraw={true}
            showList={false}
          />
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
        >
          ← Înapoi
        </button>
        <button
          type="button"
          disabled={!canContinue || saving}
          onClick={handleContinue}
          className="flex-1 py-3 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Se salvează...' : selected === 'skip' ? 'Sar peste →' : 'Am terminat, continuă →'}
        </button>
      </div>
    </div>
  )
}

function CheckBadge() {
  return (
    <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-brand-600 flex items-center justify-center">
      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    </span>
  )
}

