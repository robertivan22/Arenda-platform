'use client'

import { useParams, usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { clsx } from 'clsx'
import { StatusBadge } from '@/components/data-display/StatusBadge'
import { ArrowLeft } from 'lucide-react'
import { useState, useEffect } from 'react'

interface LessorSummary {
  id: string
  code: string
  displayName: string
  status: string
  type: string
}

const TABS = [
  { label: 'Sumar', path: 'sumar' },
  { label: 'Contact', path: 'contact' },
  { label: 'Contracte', path: 'contracte' },
  { label: 'Parcele', path: 'parcele' },
  { label: 'Împuterniciți', path: 'imputerniciti' },
  { label: 'Oferte', path: 'oferte' },
  { label: 'Documente', path: 'documente' },
  { label: 'Mesaje', path: 'mesaje' },
  { label: 'Istoric', path: 'istoric' },
]

export function LessorDetailShell({ children }: { children: React.ReactNode }) {
  const { id } = useParams<{ id: string }>()
  const pathname = usePathname()
  const router = useRouter()
  const [lessor, setLessor] = useState<LessorSummary | null>(null)

  useEffect(() => {
    if (!id) return
    createClient()
      .from('lessors')
      .select('id, code, type, first_name, last_name, company_name, status')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          const d = data as any
          setLessor({
            id: d.id,
            code: d.code ?? '',
            type: d.type,
            status: d.status,
            displayName: d.type === 'LEGAL'
              ? (d.company_name ?? '')
              : `${d.last_name ?? ''} ${d.first_name ?? ''}`.trim(),
          })
        }
      })
  }, [id])

  return (
    <div>
      <div className="mb-4">
        <button
          onClick={() => router.push('/arendatori')}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-2"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Înapoi la lista arendatori
        </button>
        <div className="flex items-center gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold text-gray-900">
                {lessor?.displayName ?? '...'}
              </h1>
              {lessor?.status && <StatusBadge status={lessor.status} size="md" />}
              {lessor?.type && <StatusBadge status={lessor.type} size="md" />}
            </div>
            {lessor?.code && (
              <p className="text-sm text-gray-500">Cod: {lessor.code}</p>
            )}
          </div>
        </div>
      </div>

      <div className="border-b border-gray-200 mb-4">
        <nav className="flex gap-0 overflow-x-auto">
          {TABS.map(tab => {
            const href = `/arendatori/${id}/${tab.path}`
            const active = pathname.endsWith(`/${tab.path}`)
            return (
              <Link
                key={tab.path}
                href={href}
                className={clsx(
                  'px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors',
                  active
                    ? 'border-brand-500 text-brand-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300',
                )}
              >
                {tab.label}
              </Link>
            )
          })}
        </nav>
      </div>

      <div>{children}</div>
    </div>
  )
}
