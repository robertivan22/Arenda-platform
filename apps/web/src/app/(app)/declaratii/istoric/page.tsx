'use client'

import { PageHeader } from '@/components/layout/PageHeader'
import Link from 'next/link'
import { FileSpreadsheet } from 'lucide-react'

export default function IstoricPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Istoric declarații"
        subtitle="Toate seturile de date generate"
      />
      <div className="py-16 text-center text-gray-500">
        <FileSpreadsheet className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Istoricul declarațiilor nu este disponibil încă.</p>
        <p className="text-xs mt-1 text-gray-400">
          Generați un set de date din{' '}
          <Link href="/declaratii/d112" className="text-brand-600 hover:underline">D112</Link>
          {' sau '}
          <Link href="/declaratii/apia" className="text-brand-600 hover:underline">APIA</Link>
          {' și descărcați CSV/XML/PDF direct.'}
        </p>
      </div>
    </div>
  )
}
