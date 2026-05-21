'use client'

import { useState, useMemo, useEffect } from 'react'
import {
  BBCHStage, STAGE_COLORS, STAGE_LABELS, STAGE_MONTHS,
  getBBCHForCultura, CULTURA_OPTIONS, CULTURA_TO_BBCH,
} from '@/lib/bbch-data'
import { ChevronDown, ChevronRight, X, Info } from 'lucide-react'

interface BBCHChartProps {
  initialCultura?: string
  highlightCode?: string
  onSelectCode?: (code: string, descriere: string) => void
  onClose?: () => void
}

// Treatment windows by principal stage (informational overlay)
const TREATMENT_WINDOWS: Record<number, string[]> = {
  1: ['Erbicide post-emergent timpuriu'],
  2: ['Erbicide post-emergent', 'Fungicide (septorioza timpurie)'],
  3: ['Regulatori de creștere', 'Fungicide (Puccinia, septorioza)', 'Insecticide (afide)'],
  4: ['Fungicide (Fusarium, Helminthosporium)', 'Insecticide'],
  5: ['Fungicide (fuzarioza spicului)'],
  6: ['Fungicide (fuzarioza) — fereastră critică', 'Insecticide (afide spic)'],
  7: [],
  8: [],
  9: [],
  0: ['Fungicide sămânță (tratament înainte de semănat)'],
}

export function BBCHChart({ initialCultura = 'Grâu', highlightCode, onSelectCode, onClose }: BBCHChartProps) {
  const [cultura, setCultura] = useState(initialCultura)
  const [expandedPrincipal, setExpandedPrincipal] = useState<number | null>(null)

  const stages = useMemo(() => getBBCHForCultura(cultura), [cultura])
  const culturaType = CULTURA_TO_BBCH[cultura] ?? 'cereale'

  const byPrincipal = useMemo(() => {
    const map: Record<number, BBCHStage[]> = {}
    for (let i = 0; i <= 9; i++) map[i] = []
    stages.forEach(s => map[s.stagiu].push(s))
    return map
  }, [stages])

  const highlightStagiu = useMemo(() =>
    highlightCode ? stages.find(s => s.code === highlightCode)?.stagiu ?? null : null,
    [highlightCode, stages])

  useEffect(() => {
    if (highlightStagiu !== null) setExpandedPrincipal(highlightStagiu)
  }, [highlightStagiu])

  const inputCls = 'px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-brand-500'

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
        <div>
          <h2 className="text-base font-semibold text-gray-900">Scara BBCH — Referință</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Biologische Bundesanstalt, Bundessortenamt und CHemische Industrie
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={cultura}
            onChange={e => setCultura(e.target.value)}
            className={inputCls}
          >
            {CULTURA_OPTIONS.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          {onClose && (
            <button onClick={onClose} className="p-1.5 rounded hover:bg-gray-100 text-gray-400">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Visual timeline strip */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex rounded-lg overflow-hidden border border-gray-200 h-14">
          {Array.from({ length: 10 }, (_, i) => {
            const count   = byPrincipal[i].length
            const color   = STAGE_COLORS[i]
            const isActive= highlightStagiu === i
            return (
              <button
                key={i}
                onClick={() => setExpandedPrincipal(expandedPrincipal === i ? null : i)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-opacity border-r border-white/20 last:border-0 hover:brightness-95"
                style={{ background: color.hex, opacity: isActive ? 1 : 0.85 }}
                title={STAGE_LABELS[i]}
              >
                <span className="text-[11px] font-bold leading-none" style={{ color: color.text }}>
                  {i * 10}
                </span>
                <span className="text-[9px] hidden sm:block leading-none" style={{ color: color.text }}>
                  {STAGE_LABELS[i]}
                </span>
                {count > 0 && (
                  <span className="text-[8px] leading-none opacity-80" style={{ color: color.text }}>
                    {count} cod{count !== 1 ? 'uri' : ''}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Month labels under strip */}
        <div className="flex mt-0.5">
          {Array.from({ length: 10 }, (_, i) => (
            <div key={i} className="flex-1 text-center text-[8px] text-gray-400 truncate px-0.5 leading-tight">
              {STAGE_MONTHS[culturaType][i]}
            </div>
          ))}
        </div>

        <div className="flex justify-between mt-0.5 px-0.5">
          <span className="text-[10px] text-gray-400">BBCH 00</span>
          <span className="text-[10px] text-gray-400">→ creștere / timp →</span>
          <span className="text-[10px] text-gray-400">BBCH 99</span>
        </div>
      </div>

      {/* Stage detail panels */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {Array.from({ length: 10 }, (_, principal) => {
          const codesInStage = byPrincipal[principal]
          if (codesInStage.length === 0) return null
          const color = STAGE_COLORS[principal]
          const isExpanded = expandedPrincipal === principal
          const treatments = TREATMENT_WINDOWS[principal] ?? []

          return (
            <div key={principal} className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedPrincipal(isExpanded ? null : principal)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 transition-colors"
              >
                <div
                  className="w-7 h-7 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: color.hex }}
                >
                  <span style={{ color: color.text }}>{principal}</span>
                </div>
                <div className="flex-1 text-left">
                  <span className="text-sm font-medium text-gray-800">
                    Stadiu {principal}: {STAGE_LABELS[principal]}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    (BBCH {principal * 10}–{principal * 10 + 9})
                  </span>
                  {treatments.length > 0 && (
                    <span className="ml-2 inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                      <Info className="w-3 h-3" />
                      Tratamente recomandate
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-400 mr-1">{STAGE_MONTHS[culturaType][principal]}</span>
                <span className="text-xs text-gray-400">{codesInStage.length} etape</span>
                {isExpanded
                  ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                }
              </button>

              {isExpanded && (
                <div className="border-t border-gray-100 bg-gray-50">
                  {/* Treatment window info */}
                  {treatments.length > 0 && (
                    <div className="px-3 py-2 bg-emerald-50 border-b border-emerald-100">
                      <p className="text-xs font-medium text-emerald-800 mb-1">🌿 Ferestre optime de tratament:</p>
                      <ul className="text-xs text-emerald-700 space-y-0.5">
                        {treatments.map((t, i) => <li key={i}>• {t}</li>)}
                      </ul>
                    </div>
                  )}

                  {/* BBCH codes */}
                  <div className="divide-y divide-gray-100">
                    {codesInStage.map(stage => {
                      const isHighlighted = stage.code === highlightCode
                      return (
                        <div
                          key={stage.code}
                          className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-white transition-colors ${
                            isHighlighted ? 'bg-yellow-50 border-l-2 border-yellow-400' : ''
                          }`}
                          onClick={() => {
                            onSelectCode?.(stage.code, stage.descriere)
                          }}
                        >
                          <div
                            className="w-9 h-7 rounded flex items-center justify-center text-xs font-mono font-bold flex-shrink-0"
                            style={{ background: color.hex }}
                          >
                            <span style={{ color: color.text }}>
                              {stage.code}
                            </span>
                          </div>
                          <span className="text-sm text-gray-700 flex-1">{stage.descriere}</span>
                          {onSelectCode && (
                            <span className="text-xs text-brand-600 hover:text-brand-700 flex-shrink-0 pr-1">
                              Selectează →
                            </span>
                          )}
                          {isHighlighted && (
                            <span className="text-xs bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded flex-shrink-0">
                              Curent
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
        <p className="text-xs text-gray-500 text-center">
          Surse: Bayer CropScience BBCH Monograph · Ordinul MADR/MMAP/ANSVSA nr. 54/570/32/2023
          {onSelectCode && ' · Clic pe un cod BBCH pentru a-l folosi în formular.'}
        </p>
      </div>
    </div>
  )
}

// Compact inline selector used inside the form
interface BBCHSelectorProps {
  cultura: string
  value: string
  onChange: (code: string, descriere: string) => void
  error?: string
}

export function BBCHSelector({ cultura, value, onChange, error }: BBCHSelectorProps) {
  const stages = useMemo(() => getBBCHForCultura(cultura), [cultura])
  const selectedStage = useMemo(() => stages.find(s => s.code === value), [stages, value])
  const selectedStagiu = selectedStage?.stagiu ?? null

  const inputCls = `w-full px-2.5 py-1.5 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-brand-500 ${
    error ? 'border-red-400 bg-red-50' : 'border-gray-300'
  }`

  return (
    <div className="space-y-2">
      <select
        value={value}
        onChange={e => {
          const s = stages.find(x => x.code === e.target.value)
          if (s) onChange(s.code, s.descriere)
        }}
        className={inputCls}
      >
        <option value="">— Selectați fenofaza BBCH —</option>
        {Array.from({ length: 10 }, (_, i) => {
          const group = stages.filter(s => s.stagiu === i)
          if (group.length === 0) return null
          return (
            <optgroup key={i} label={`Stadiu ${i}: ${STAGE_LABELS[i]} (BBCH ${i * 10}–${i * 10 + 9})`}>
              {group.map(s => (
                <option key={s.code} value={s.code}>
                  BBCH {s.code} — {s.descriere}
                </option>
              ))}
            </optgroup>
          )
        })}
      </select>

      {/* Visual progress bar */}
      {value && (
        <div className="space-y-1">
          <div className="flex rounded overflow-hidden h-4 gap-px">
            {Array.from({ length: 10 }, (_, i) => {
              const color = STAGE_COLORS[i]
              const isActive = selectedStagiu === i
              return (
                <div
                  key={i}
                  className="flex-1 transition-opacity"
                  style={{ background: color.hex, opacity: isActive ? 1 : 0.25 }}
                  title={`${STAGE_LABELS[i]}`}
                />
              )
            })}
          </div>
          <p className="text-xs text-gray-600">
            <span className="font-medium">BBCH {value}</span> — {selectedStage?.descriere}
            {selectedStagiu !== null && (
              <span className="ml-2 text-gray-400">
                (Stadiu {selectedStagiu}: {STAGE_LABELS[selectedStagiu]})
              </span>
            )}
          </p>
        </div>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
