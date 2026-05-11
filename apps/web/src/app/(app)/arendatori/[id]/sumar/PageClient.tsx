'use client'

import { useQuery } from '@tanstack/react-query'
import { useParams } from 'next/navigation'
import { apiGet } from '@/lib/api-client'

interface LessorDetail {
  id: string
  code: string
  displayName: string
  type: string
  status: string
  cnpCui: string
  birthDate: string | null
  gender: string | null
  maritalStatus: string | null
  nationality: string | null
  iban: string | null
  bankName: string | null
  notes: string | null
  county: string
  locality: string
  address: string | null
  registeredAt: string
  createdAt: string
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-900 mt-0.5">{value || '—'}</dd>
    </div>
  )
}


export default function LessorSumarTabClient() {
  const { id } = useParams<{ id: string }>()

  const { data, isLoading } = useQuery({
    queryKey: ['lessor', id],
    queryFn: () => apiGet<LessorDetail>(`/lessors/${id}`),
  })

  if (isLoading) {
    return <div className="text-sm text-gray-400">Se încarcă...</div>
  }

  const l = data?.data

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Identity section */}
      <div className="form-section">
        <div className="form-section-title">Date identitate</div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label="Cod intern" value={l?.code} />
          <Field label="Tip persoană" value={l?.type} />
          <Field label="CNP / CUI" value={l?.cnpCui} />
          <Field label="Data nașterii" value={l?.birthDate?.split('T')[0]} />
          <Field label="Gen" value={l?.gender} />
          <Field label="Stare civilă" value={l?.maritalStatus} />
          <Field label="Cetățenie" value={l?.nationality} />
        </dl>
      </div>

      {/* Address section */}
      <div className="form-section">
        <div className="form-section-title">Adresă</div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label="Județ" value={l?.county} />
          <Field label="Localitate" value={l?.locality} />
          <Field label="Adresă" value={l?.address} />
        </dl>
      </div>

      {/* Bank section */}
      <div className="form-section">
        <div className="form-section-title">Date bancare</div>
        <dl className="grid grid-cols-1 gap-y-3">
          <Field label="IBAN" value={l?.iban} />
          <Field label="Bancă" value={l?.bankName} />
        </dl>
      </div>

      {/* Notes */}
      {l?.notes && (
        <div className="form-section">
          <div className="form-section-title">Observații</div>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{l.notes}</p>
        </div>
      )}
    </div>
  )
}
