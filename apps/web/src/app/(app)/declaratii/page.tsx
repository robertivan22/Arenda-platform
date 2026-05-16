'use client'

export const runtime = 'edge'

import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import Link from 'next/link'
import {
  FileSpreadsheet, AlertTriangle, CheckCircle2, Info,
  ArrowRight, FileText, Tractor,
} from 'lucide-react'

interface ApplicabilityCard {
  code: string
  title: string
  description: string
  status: 'required' | 'conditional' | 'not-applicable' | 'warning-only'
  frequency: string
  href: string
  icon: React.ElementType
}

const DECLARATIONS: ApplicabilityCard[] = [
  {
    code: 'D112',
    title: 'D112 — Impozit reținut la sursă',
    description:
      'Impozit pe venitul din arendă reținut de plătitor (arendaș). ' +
      'Calculul efectiv este 8% din venitul brut (20% deducere forfetară + 10% impozit pe venitul net). ' +
      'Se depune la ANAF lunar, până pe 25 ale lunii următoare.',
    status: 'required',
    frequency: 'Lunar',
    href: '/declaratii/d112',
    icon: FileSpreadsheet,
  },
  {
    code: 'D205',
    title: 'D205 — Declarație anuală beneficiari',
    description:
      'Potențial obligatorie dacă plătitorul este persoană juridică. ' +
      'Există interpretări divergente față de D112. ' +
      'Modulul nu generează D205 — necesită validare contabil autorizat.',
    status: 'conditional',
    frequency: 'Anual',
    href: '#d205-note',
    icon: FileText,
  },
  {
    code: 'APIA',
    title: 'Export APIA',
    description:
      'Date despre contracte și parcele pentru campaniile APIA. ' +
      'Exportul generează un CSV cu informațiile necesare declarațiilor individuale ' +
      'ale arendatorilor la APIA.',
    status: 'required',
    frequency: 'Anual (campanie)',
    href: '/declaratii/apia',
    icon: Tractor,
  },
  {
    code: 'CASS',
    title: 'CASS — Contribuție sănătate',
    description:
      'Sistemul generează NUMAI avertizări orientative despre CASS. ' +
      'Obligația finală depinde de totalul veniturilor arendatorului din toate sursele. ' +
      'Arendatorul depune D212 individual. Sistemul nu poate genera D212.',
    status: 'warning-only',
    frequency: 'Anual',
    href: '#cass-note',
    icon: AlertTriangle,
  },
  {
    code: 'D394',
    title: 'D394 — Declarație TVA',
    description:
      'NU se aplică arendei standard. Arendă este scutită de TVA conform art. 292 Cod Fiscal. ' +
      'D394 este relevantă doar dacă entitatea a optat pentru TVA pe arendă (caz extrem de rar).',
    status: 'not-applicable',
    frequency: 'N/A',
    href: '#d394-note',
    icon: Info,
  },
]

const statusConfig = {
  required: {
    badge: 'bg-green-100 text-green-700 border-green-200',
    label: 'Obligatorie',
    icon: CheckCircle2,
    iconClass: 'text-green-500',
    card: 'border-green-200',
  },
  conditional: {
    badge: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    label: 'Condiționat',
    icon: AlertTriangle,
    iconClass: 'text-yellow-500',
    card: 'border-yellow-200',
  },
  'not-applicable': {
    badge: 'bg-gray-100 text-gray-500 border-gray-200',
    label: 'Neaplicabilă',
    icon: Info,
    iconClass: 'text-gray-400',
    card: 'border-gray-200',
  },
  'warning-only': {
    badge: 'bg-orange-100 text-orange-700 border-orange-200',
    label: 'Avertizare',
    icon: AlertTriangle,
    iconClass: 'text-orange-500',
    card: 'border-orange-200',
  },
}

export default function DeclaratiiPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Declarații fiscale"
        subtitle="Modul orientativ — toate rezultatele sunt DRAFT și necesită validare contabil autorizat"
      />

      {/* Global disclaimer */}
      <div className="mb-6 flex gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-600" />
        <div>
          <p className="font-semibold mb-1">Atenție — modul orientativ</p>
          <p>
            Toate calculele, seturile de date și exporturile generate de acest modul sunt{' '}
            <strong>DRAFT</strong> și au caracter orientativ. Sistemul NU transmite date la ANAF sau
            alte autorități. Înainte de depunerea oricărei declarații, validați obligatoriu cu un{' '}
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
            <div className="font-semibold">Generează D112</div>
            <div className="text-sm text-brand-100 mt-0.5">Set de date pentru luna curentă</div>
          </div>
          <ArrowRight className="w-5 h-5" />
        </Link>
        <Link
          href="/declaratii/apia"
          className="flex items-center justify-between p-4 bg-white hover:bg-gray-50 border border-gray-200 text-gray-900 rounded-lg transition-colors"
        >
          <div>
            <div className="font-semibold">Export APIA</div>
            <div className="text-sm text-gray-500 mt-0.5">CSV parcele și contracte</div>
          </div>
          <ArrowRight className="w-5 h-5 text-gray-400" />
        </Link>
      </div>

      {/* Applicability matrix */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Matrice aplicabilitate
      </h2>
      <div className="space-y-3">
        {DECLARATIONS.map(d => {
          const cfg = statusConfig[d.status]
          const StatusIcon = cfg.icon
          const canNavigate = !d.href.startsWith('#')
          const CardTag = canNavigate ? Link : 'div'
          const cardProps = canNavigate ? { href: d.href } : {}

          return (
            <CardTag
              key={d.code}
              {...(cardProps as any)}
              className={`block p-4 bg-white border rounded-lg ${cfg.card} ${canNavigate ? 'hover:shadow-sm transition-shadow cursor-pointer' : ''}`}
            >
              <div className="flex items-start gap-3">
                <d.icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${cfg.iconClass}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold text-gray-900 text-sm">{d.title}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                    <span className="text-xs text-gray-400">{d.frequency}</span>
                  </div>
                  <p className="text-sm text-gray-600">{d.description}</p>
                </div>
                {canNavigate && <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-1" />}
              </div>
            </CardTag>
          )
        })}
      </div>

      {/* History link */}
      <div className="mt-6 text-center">
        <Link href="/declaratii/istoric" className="text-sm text-brand-600 hover:underline">
          Vizualizați istoricul seturilor generate →
        </Link>
      </div>
    </div>
  )
}
