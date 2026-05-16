'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface ContactInfo {
  phone: string | null
  mobile: string | null
  email: string | null
  address: string | null
  county: string
  locality: string
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
  const [l, setL] = useState<ContactInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    createClient()
      .from('lessors')
      .select('phone, mobile, email, address, county, locality')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) setL(data as ContactInfo)
        setLoading(false)
      })
  }, [id])

  if (loading) return <div className="text-sm text-gray-400">Se încarcă...</div>

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
        </dl>
      </div>
    </div>
  )
}
