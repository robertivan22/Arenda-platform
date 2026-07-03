'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { OnboardingData } from './types'

interface Props {
  data: OnboardingData
  saving: boolean
  onNext: (data: Partial<OnboardingData>) => void
  onBack: () => void
}

interface UploadedFile {
  name: string
  path: string
  size: number
  status: 'uploading' | 'done' | 'error'
  error?: string
}

const ACCEPTED = '.pdf,.jpg,.jpeg,.png,.tiff,.tif'
const MAX_SIZE_MB = 20

export function ImportContractsStep({ data, saving, onNext, onBack }: Props) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function uploadFile(file: File) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')
    const path = `onboarding/${user.id}/contracts/${Date.now()}_${safeName}`

    setFiles(prev => [...prev, { name: file.name, path, size: file.size, status: 'uploading' }])

    const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: false })

    setFiles(prev =>
      prev.map(f =>
        f.path === path
          ? error
            ? { ...f, status: 'error', error: error.message }
            : { ...f, status: 'done' }
          : f,
      ),
    )
  }

  function handleFiles(fileList: FileList | null) {
    if (!fileList) return
    Array.from(fileList).forEach(file => {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        alert(`Fișierul „${file.name}" depășește ${MAX_SIZE_MB} MB și a fost ignorat.`)
        return
      }
      void uploadFile(file)
    })
  }

  const hasDoneFiles = files.some(f => f.status === 'done')
  const allDone = files.length > 0 && files.every(f => f.status !== 'uploading')

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Contracte existente</h1>
      <p className="text-gray-500 mb-6">
        Încarcă contractele de arendă existente (PDF sau scan) — le vei putea asocia manual
        cu arendatorii după finalizarea contului.
      </p>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        className={`rounded-2xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors mb-4 ${
          dragging ? 'border-brand-400 bg-brand-50' : 'border-gray-300 bg-white hover:border-brand-300 hover:bg-gray-50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          multiple
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
        <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-3">
          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
        </div>
        <p className="text-sm font-medium text-gray-700 mb-1">
          {dragging ? 'Eliberează pentru a încărca' : 'Trage fișierele aici sau apasă pentru a selecta'}
        </p>
        <p className="text-xs text-gray-400">PDF, JPG, PNG, TIFF — max {MAX_SIZE_MB} MB per fișier</p>
      </div>

      {/* Uploaded files list */}
      {files.length > 0 && (
        <ul className="space-y-2 mb-5">
          {files.map(f => (
            <li key={f.path} className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 px-3 py-2.5">
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
              <span className="flex-1 text-sm text-gray-700 truncate">{f.name}</span>
              <span className="text-xs text-gray-400 flex-shrink-0">{(f.size / 1024).toFixed(0)} KB</span>
              {f.status === 'uploading' && (
                <div className="w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin flex-shrink-0" />
              )}
              {f.status === 'done' && (
                <svg className="w-4 h-4 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
              {f.status === 'error' && (
                <span className="text-xs text-red-500 flex-shrink-0" title={f.error}>Eroare</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="px-6 py-3 rounded-xl border border-gray-300 text-gray-700 font-medium text-sm hover:bg-gray-50 transition-colors"
        >
          ← Înapoi
        </button>

        {/* Skip */}
        <button
          type="button"
          disabled={saving || (files.length > 0 && !allDone)}
          onClick={() => onNext({ contractsImported: false })}
          className="px-5 py-3 rounded-xl border border-gray-300 text-gray-600 font-medium text-sm hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Introduc manual mai târziu
        </button>

        {/* Continue (only shown after at least one successful upload) */}
        {hasDoneFiles && (
          <button
            type="button"
            disabled={saving || !allDone}
            onClick={() => onNext({ contractsImported: true })}
            className="flex-1 py-3 rounded-xl bg-brand-600 text-white font-semibold text-sm hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Se salvează...' : 'Continuă →'}
          </button>
        )}
      </div>
    </div>
  )
}

