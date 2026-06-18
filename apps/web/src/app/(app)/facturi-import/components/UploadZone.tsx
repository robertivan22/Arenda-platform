'use client'

import { useRef, useState } from 'react'
import { Upload, FileText, Image, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'

interface Props {
  onFileSelected: (file: File) => void
  uploading: boolean
  accept?: string
}

const ACCEPTED = 'application/pdf,image/jpeg,image/png,image/webp'

export function UploadZone({ onFileSelected, uploading, accept = ACCEPTED }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleFile = (file: File | undefined) => {
    if (!file) return
    onFileSelected(file)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  return (
    <div
      className={clsx(
        'border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-4 transition-colors cursor-pointer select-none',
        dragging ? 'border-green-500 bg-green-50' : 'border-gray-300 hover:border-green-400 bg-gray-50',
        uploading && 'pointer-events-none opacity-60',
      )}
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click() }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => handleFile(e.target.files?.[0])}
      />

      {uploading ? (
        <Loader2 className="w-12 h-12 text-green-600 animate-spin" />
      ) : (
        <div className="flex gap-3 text-gray-400">
          <FileText className="w-8 h-8" />
          <Image className="w-8 h-8" />
        </div>
      )}

      <div className="text-center">
        <p className="font-semibold text-gray-700">
          {uploading ? 'Se procesează OCR...' : 'Trage fișierul aici sau apasă pentru a selecta'}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          PDF, JPG, PNG, WEBP — max. 20 MB
        </p>
      </div>

      {!uploading && (
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors"
          onClick={e => { e.stopPropagation(); inputRef.current?.click() }}
        >
          <Upload className="w-4 h-4" />
          Încarcă factură
        </button>
      )}
    </div>
  )
}
