'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface LessorDetail {
  id: string
  code: string
  type: string
  status: string
  first_name: string
  last_name: string
  company_name: string | null
  cnp: string
  gender: string | null
  county: string
  locality: string
  address: string | null
  iban: string | null
  bank_name: string | null
  notes: string | null
  created_at: string
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
  const [l, setL] = useState<LessorDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    createClient()
      .from('lessors')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setL(data as LessorDetail)
        setLoading(false)
      })
  }, [id])

  if (loading) {
    return <div className="text-sm text-gray-400">Se încarcă...</div>
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Identity section */}
      <div className="form-section">
        <div className="form-section-title">Date identitate</div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          <Field label="Cod intern" value={l?.code} />
          <Field label="Tip persoană" value={l?.type} />
          <Field label="CNP / CUI" value={l?.cnp} />
          <Field label="Gen" value={l?.gender} />
          {l?.type !== 'LEGAL' && (
            <>
              <Field label="Nume" value={l?.last_name} />
              <Field label="Prenume" value={l?.first_name} />
            </>
          )}
          {l?.type === 'LEGAL' && (
            <Field label="Denumire firmă" value={l?.company_name} />
          )}
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
          <Field label="Bancă" value={l?.bank_name} />
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
