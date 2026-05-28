'use client'

export const runtime = 'edge'

import { PageHeader } from '@/components/layout/PageHeader'
import Link from 'next/link'
import {
  FileSpreadsheet, AlertTriangle, CheckCircle2, ArrowRight, Tractor,
} from 'lucide-react'

export default function DeclaratiiPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="DeclaraÈ›ii fiscale"
        subtitle="Modul orientativ â€” toate rezultatele sunt DRAFT È™i necesitÄƒ validare contabil autorizat"
      />

      {/* Global disclaimer */}
      <div className="mb-6 flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
        <div>
          <p className="font-semibold mb-1">AtenÈ›ie â€” modul orientativ</p>
          <p>
            Toate calculele, seturile de date È™i exporturile generate de acest modul sunt{' '}
            <strong>DRAFT</strong> È™i au caracter orientativ. Sistemul NU transmite date la ANAF sau
            alte autoritÄƒÈ›i. ÃŽnainte de depunerea oricÄƒrei declaraÈ›ii, validaÈ›i obligatoriu cu un{' '}
            <strong>contabil autorizat</strong> sau consultant fiscal.
          </p>
        </div>
      </div>

      {/* Quick actions */}
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link
          href="/declaratii/d112"
          className="flex items-center justify-between p-4 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors"
        >
          <div>
            <div className="font-semibold">GenereazÄƒ D112</div>
            <div className="text-sm text-brand-100 mt-0.5">Impozit reÈ›inut la sursÄƒ â€” lunar</div>
          </div>
          <ArrowRight className="w-5 h-5" />
        </Link>
        <Link
          href="/declaratii/apia"
          className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 border border-gray-200 text-gray-900 rounded-lg transition-colors"
        >
          <div>
            <div className="flex items-center gap-2 font-semibold"><Tractor className="w-4 h-4 text-gray-400" />Export APIA</div>
            <div className="text-sm text-gray-500 mt-0.5">CSV parcele È™i contracte</div>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400" />
        </Link>
      </div>

      {/* D112 detail card */}
      <Link
        href="/declaratii/d112"
        className="block p-4 bg-white border border-green-200 rounded-lg hover:shadow-sm transition-shadow cursor-pointer"
      >
        <div className="flex items-start gap-3">
          <FileSpreadsheet className="w-5 h-5 flex-shrink-0 mt-0.5 text-green-500" />
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className="font-semibold text-gray-900 text-sm">D112 â€” Impozit reÈ›inut la sursÄƒ</span>
              <span className="text-xs px-2 py-0.5 rounded-full border font-medium bg-green-100 text-green-700 border-green-200">
                Obligatorie
              </span>
              <span className="text-xs text-gray-400">Lunar</span>
            </div>
            <p className="text-sm text-gray-600">
              Impozit pe venitul din arendÄƒ reÈ›inut de plÄƒtitor (arendaÈ™).
              Calculul este 10% din venitul brut (impozit aplicat la sursÄƒ pe tranzacÈ›iile marcate).
              Se depune la ANAF lunar, pÃ¢nÄƒ pe 25 ale lunii urmÄƒtoare.
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />
        </div>
      </Link>

      {/* History link */}
      <div className="mt-6 text-center">
        <Link href="/declaratii/istoric" className="text-sm text-brand-600 hover:underline flex items-center justify-center gap-1">
          <CheckCircle2 className="w-4 h-4" /> Istoric declaraÈ›ii
        </Link>
      </div>
    </div>
  )
}
