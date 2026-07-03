'use client'

import { useState } from 'react'
import type { OnboardingData } from './types'

interface Props {
  data: OnboardingData
  saving: boolean
  onNext: (data: Partial<OnboardingData>) => void
}

type AccountType = 'PFA' | 'SRL'

export function AccountTypeStep({ data, saving, onNext }: Props) {
  const [selected, setSelected] = useState<AccountType | null>(
    data.accountType ?? null,
  )

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Bun venit în ArendaPro!</h1>
      <p className="text-gray-500 mb-8">
        Să configurăm contul tău. Primul pas: ce tip de entitate reprezinți?
      </p>

      <div className="grid grid-cols-2 gap-4 mb-8">
        {/* PFA Card */}
        <button
          type="button"
          onClick={() => setSelected('PFA')}
          className={`relative rounded-2xl border-2 p-6 text-left transition-all focus:outline-none ${
            selected === 'PFA'
              ? 'border-brand-600 bg-brand-50 shadow-sm'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
          }`}
        >
          {selected === 'PFA' && (
            <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-brand-600 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
          )}
          {/* Icon */}
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${selected === 'PFA' ? 'bg-brand-100' : 'bg-gray-100'}`}>
            <svg className={`w-6 h-6 ${selected === 'PFA' ? 'text-brand-600' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            </svg>
          </div>
          <p className={`font-bold text-lg mb-1 ${selected === 'PFA' ? 'text-brand-700' : 'text-gray-800'}`}>PFA</p>
          <p className="text-sm text-gray-500 leading-snug">
            Persoană Fizică Autorizată — agricultor individual sau exploatație familială
          </p>
        </button>

        {/* SRL Card */}
        <button
          type="button"
          onClick={() => setSelected('SRL')}
          className={`relative rounded-2xl border-2 p-6 text-left transition-all focus:outline-none ${
            selected === 'SRL'
              ? 'border-brand-600 bg-brand-50 shadow-sm'
              : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
          }`}
        >
          {selected === 'SRL' && (
            <span className="absolute top-3 right-3 w-5 h-5 rounded-full bg-brand-600 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </span>
          )}
          {/* Icon */}
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${selected === 'SRL' ? 'bg-brand-100' : 'bg-gray-100'}`}>
            <svg className={`w-6 h-6 ${selected === 'SRL' ? 'text-brand-600' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
            </svg>
          </div>
          <p className={`font-bold text-lg mb-1 ${selected === 'SRL' ? 'text-brand-700' : 'text-gray-800'}`}>SRL / SA</p>
          <p className="text-sm text-gray-500 leading-snug">
            Societate comercială — SRL, SA sau altă formă juridică cu CUI de firmă
          </p>
        </button>
      </div>

      <button
        type="button"
        disabled={!selected || saving}
        onClick={() => selected && onNext({ accountType: selected })}
        className="w-full py-3 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? 'Se salvează...' : 'Continuă →'}
      </button>
    </div>
  )
}
