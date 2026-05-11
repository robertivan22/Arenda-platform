'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { apiGet } from '@/lib/api-client'

interface ContactInfo {
  phone: string | null
  mobile: string | null
  email: string | null
  address: string | null
  postalCode: string | null
  county: string
  locality: string
  countryBirth: string | null
  countyBirth: string | null
  localityBirth: string | null
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-900 mt-0.5">{value || '—'}</dd>
    </div>
  )
}


export default function LessorContactTabClient() {
  const { id } = useParams<{ id: string }>()

  const { data, isLoading } = useQuery({
    queryKey: ['lessor', id],
    queryFn: () => apiGet<ContactInfo>(`/lessors/${id}`),
  })

  if (isLoading) return <div className="text-sm text-gray-400">Se încarcă...</div>

  const l = data?.data

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="form-section">
        <div className="form-section-title">Date de contact</div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label="Telefon fix" value={l?.phone} />
          <Field label="Mobil" value={l?.mobile} />
          <Field label="Email" value={l?.email} />
        </dl>
      </div>

      <div className="form-section">
        <div className="form-section-title">Adresă domiciliu</div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label="Județ" value={l?.county} />
          <Field label="Localitate" value={l?.locality} />
          <Field label="Adresă stradă" value={l?.address} />
          <Field label="Cod poștal" value={l?.postalCode} />
        </dl>
      </div>

      <div className="form-section">
        <div className="form-section-title">Loc naștere</div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label="Țară naștere" value={l?.countryBirth} />
          <Field label="Județ naștere" value={l?.countyBirth} />
          <Field label="Localitate naștere" value={l?.localityBirth} />
        </dl>
      </div>
    </div>
  )
}
