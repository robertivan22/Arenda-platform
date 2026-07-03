'use client'

import { useState } from 'react'
import type { OnboardingData } from './types'

interface Props {
  data: OnboardingData
  saving: boolean
  onNext: (data: Partial<OnboardingData>) => void
  onBack: () => void
}

interface AlertType {
  key: string
  label: string
  description: string
  icon: React.ReactNode
  defaultOn: boolean
}

const ALERT_TYPES: AlertType[] = [
  {
    key: 'contracte',
    label: 'Expirare contracte',
    description: 'Notificare la 45, 7 și 1 zile înainte de expirarea contractelor de arendă',
    defaultOn: true,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
      </svg>
    ),
  },
  {
    key: 'ferma',
    label: 'Operațiuni fermă restante',
    description: 'Alerte pentru operațiuni agricole planificate (arătură, semănat, recoltat) depășite',
    defaultOn: true,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  {
    key: 'stocuri',
    label: 'Stocuri critice',
    description: 'Avertizare când stocurile de inputuri (semințe, fertilizanți, pesticide) sunt epuizate sau critice',
    defaultOn: true,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
      </svg>
    ),
  },
  {
    key: 'utilaje',
    label: 'Documente utilaje',
    description: 'Alerte pentru RCA, ITP și service-uri la utilaje și vehicule agricole',
    defaultOn: true,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    key: 'etransport',
    label: 'e-Transport UIT',
    description: 'Avertizare pentru coduri UIT care expiră în mai puțin de 2 zile',
    defaultOn: false,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
      </svg>
    ),
  },
  {
    key: 'plati',
    label: 'Plăți restante',
    description: 'Notificare pentru tranzacții de arendă neîncasate sau depășite ca termen',
    defaultOn: true,
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
  },
]

export function AlertPreferencesStep({ data, saving, onNext, onBack }: Props) {
  const existing = data.alertPreferences ?? {}
  const [prefs, setPrefs] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {}
    ALERT_TYPES.forEach(t => {
      init[t.key] = t.key in existing ? (existing[t.key] as boolean) : t.defaultOn
    })
    return init
  })

  function toggle(key: string) {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function handleSubmit() {
    onNext({ alertPreferences: prefs })
  }

  const enabledCount = Object.values(prefs).filter(Boolean).length

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Preferințe alerte</h1>
      <p className="text-gray-500 mb-6">
        Alege ce tipuri de alerte dorești să primești. Le poți modifica oricând din{' '}
        <strong>Setări → Alerte</strong>.
      </p>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-6">
        {ALERT_TYPES.map((alert, i) => (
          <div
            key={alert.key}
            className={`flex items-center gap-4 px-5 py-4 ${i < ALERT_TYPES.length - 1 ? 'border-b border-gray-100' : ''}`}
          >
            {/* Icon */}
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${prefs[alert.key] ? 'bg-brand-50 text-brand-600' : 'bg-gray-100 text-gray-400'}`}>
              {alert.icon}
            </div>

            {/* Label + description */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${prefs[alert.key] ? 'text-gray-900' : 'text-gray-500'}`}>
                {alert.label}
              </p>
              <p className="text-xs text-gray-400 leading-snug mt-0.5">{alert.description}</p>
            </div>

            {/* Toggle switch */}
            <button
              type="button"
              role="switch"
              aria-checked={prefs[alert.key]}
              onClick={() => toggle(alert.key)}
              className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                prefs[alert.key] ? 'bg-brand-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${
                  prefs[alert.key] ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-400 text-center mb-6">
        {enabledCount === 0
          ? 'Nicio alertă activată — vei putea activa oricând din Setări.'
          : `${enabledCount} din ${ALERT_TYPES.length} tipuri de alerte activate`}
      </p>

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
          disabled={saving}
          onClick={handleSubmit}
          className="flex-1 py-3 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Se finalizează...' : '✓ Finalizează configurarea'}
        </button>
      </div>
    </div>
  )
}

