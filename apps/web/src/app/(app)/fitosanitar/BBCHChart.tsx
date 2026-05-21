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

// ─── Plant growth visual data ─────────────────────────────────────────────────
const GND = 96  // ground Y in SVG units

interface VisualStage {
  x: number; code: string; label: [string, string]; month: string
  h: number; tillers: number
  head: 'none'|'half'|'full'|'flower'|'grain'|'ripe'
      |'tassel-half'|'tassel'|'silk'|'corn-grain'|'corn-ripe'|'harvest'
}

const CEREALE_VISUAL: VisualStage[] = [
  { x: 42,  code:'10', label:['Răsărire','3 frunze'],       month:'Oct.',     h:14, tillers:1, head:'none' },
  { x: 127, code:'21', label:['Înc.','înfrățirii'],         month:'Noiem.',   h:19, tillers:2, head:'none' },
  { x: 213, code:'25', label:['Înfrățire','deplină'],       month:'Noiem.',   h:22, tillers:3, head:'none' },
  { x: 298, code:'29', label:['Sf.','înfrățirii'],          month:'Feb.',     h:24, tillers:3, head:'none' },
  { x: 383, code:'30', label:['Înc. alung.','paiului'],     month:'Feb.–Mar.',h:30, tillers:1, head:'none' },
  { x: 469, code:'31', label:['Primul nod','vizibil'],      month:'Apr.',     h:42, tillers:1, head:'none' },
  { x: 554, code:'32', label:['Al doilea','nod vizibil'],   month:'Apr.',     h:52, tillers:1, head:'none' },
  { x: 640, code:'37', label:['Apariția','fr. standard'],   month:'Mai',      h:62, tillers:1, head:'none' },
  { x: 725, code:'49', label:['Primele','ariste vizib.'],   month:'Mai',      h:68, tillers:1, head:'none' },
  { x: 810, code:'51', label:['Înc.','înspicării'],         month:'Mai',      h:72, tillers:1, head:'half' },
  { x: 896, code:'59', label:['Sf.','înspicării'],          month:'Mai',      h:76, tillers:1, head:'full' },
  { x: 982, code:'65', label:['Înflorire','deplină'],       month:'Mai–Iun.', h:76, tillers:1, head:'flower'},
  { x:1067, code:'75', label:['Bob','lăptos'],              month:'Iun.–Iul.',h:76, tillers:1, head:'grain' },
  { x:1152, code:'89', label:['Maturitate','deplină'],      month:'Iul.',     h:74, tillers:1, head:'ripe'  },
]

const PORUMB_VISUAL: VisualStage[] = [
  { x: 55,  code:'10', label:['Răsărire',''],              month:'Apr.',     h:10, tillers:1, head:'none'       },
  { x: 164, code:'13', label:['3 frunze','(V3)'],          month:'Apr.–Mai', h:18, tillers:1, head:'none'       },
  { x: 273, code:'15', label:['5 frunze','(V5)'],          month:'Mai',      h:28, tillers:1, head:'none'       },
  { x: 382, code:'19', label:['9+ frunze','(V9+)'],        month:'Mai–Iun.', h:40, tillers:1, head:'none'       },
  { x: 491, code:'33', label:['3 internod.',''],           month:'Iun.',     h:55, tillers:1, head:'none'       },
  { x: 600, code:'39', label:['Frunza','steag'],           month:'Iun.–Iul.',h:68, tillers:1, head:'none'       },
  { x: 709, code:'55', label:['Panicul','50%'],            month:'Iul.',     h:74, tillers:1, head:'tassel-half'},
  { x: 818, code:'61', label:['Mătasea','vizibilă'],       month:'Iul.',     h:76, tillers:1, head:'silk'       },
  { x: 927, code:'73', label:['Bob','lăptos (R3)'],        month:'Aug.',     h:76, tillers:1, head:'corn-grain' },
  { x:1036, code:'89', label:['Maturitate','fiziologică'], month:'Sep.',     h:75, tillers:1, head:'corn-ripe'  },
  { x:1145, code:'99', label:['Recoltă',''],               month:'Sep.–Oct.',h:70, tillers:1, head:'harvest'    },
]

function CerealPlant({ x, h, tillers, head }: Pick<VisualStage,'x'|'h'|'tillers'|'head'>) {
  const topY = GND - h
  const isOld  = head === 'ripe' || head === 'grain'
  const sc     = isOld ? '#a16207' : '#15803d'
  const lc     = isOld ? '#ca8a04' : '#4ade80'
  const spkClr = head==='ripe' ? '#d97706' : head==='flower' ? '#facc15' : head==='grain' ? '#eab308' : '#84cc16'
  const spkH   = head === 'half' ? 7 : head !== 'none' ? 14 : 0
  const spkTop = topY - spkH
  return (
    <g transform={`translate(${x},0)`}>
      <line x1="0" y1={GND} x2="0" y2={topY} stroke={sc} strokeWidth="1.5" strokeLinecap="round" />
      {h>8  && <path d={`M0,${GND-h*.22} C-5,${GND-h*.22-3} -8,${GND-h*.22-2} -10,${GND-h*.22}`}     stroke={lc} strokeWidth="1"   fill="none" />}
      {h>15 && <path d={`M0,${GND-h*.42} C6,${GND-h*.42-4}  10,${GND-h*.42-3}  12,${GND-h*.42}`}     stroke={lc} strokeWidth="1"   fill="none" />}
      {h>30 && <path d={`M0,${GND-h*.62} C-8,${GND-h*.62-5} -12,${GND-h*.62-4} -14,${GND-h*.62-1}`}  stroke={lc} strokeWidth="1.2" fill="none" />}
      {h>50 && <path d={`M0,${GND-h*.82} C10,${GND-h*.82-7}  15,${GND-h*.82-5}  17,${GND-h*.82-1}`}  stroke={lc} strokeWidth="1.5" fill="none" />}
      {tillers>=2 && <><line x1="-5" y1={GND} x2="-5" y2={GND-h*.58} stroke={sc} strokeWidth="1" />{h>10&&<path d={`M-5,${GND-h*.2} C-10,${GND-h*.2-3} -13,${GND-h*.2-2} -15,${GND-h*.2}`} stroke={lc} strokeWidth="0.8" fill="none" />}</>}
      {tillers>=3 && <><line x1="5"  y1={GND} x2="5"  y2={GND-h*.53} stroke={sc} strokeWidth="1" />{h>10&&<path d={`M5,${GND-h*.2} C10,${GND-h*.2-3} 13,${GND-h*.2-2} 15,${GND-h*.2}`}   stroke={lc} strokeWidth="0.8" fill="none" />}</>}
      {spkH>0 && <>
        <rect x="-2.5" y={spkTop} width="5" height={spkH} rx="2" fill={spkClr} />
        {['full','flower','grain','ripe'].includes(head) && <>
          <line x1="2.5"  y1={spkTop+2} x2="7"  y2={spkTop-4} stroke={spkClr} strokeWidth="0.7" />
          <line x1="2.5"  y1={spkTop+7} x2="7"  y2={spkTop+1} stroke={spkClr} strokeWidth="0.7" />
          <line x1="-2.5" y1={spkTop+2} x2="-7" y2={spkTop-4} stroke={spkClr} strokeWidth="0.7" />
          <line x1="-2.5" y1={spkTop+7} x2="-7" y2={spkTop+1} stroke={spkClr} strokeWidth="0.7" />
        </>}
        {(head==='ripe'||head==='grain') && <path d={`M0,${topY} Q4,${topY+8} 5,${topY+15}`} stroke={spkClr} strokeWidth="2" fill="none" strokeLinecap="round" />}
      </>}
    </g>
  )
}

function CornPlant({ x, h, head }: Pick<VisualStage,'x'|'h'|'head'>) {
  const topY  = GND - h
  const isOld = head==='corn-ripe'||head==='harvest'
  const sc    = isOld ? '#a16207' : '#166534'
  const lc    = isOld ? '#ca8a04' : '#4ade80'
  const tc    = '#d97706'
  const cobY  = GND - h*.58
  return (
    <g transform={`translate(${x},0)`}>
      <line x1="0" y1={GND} x2="0" y2={topY} stroke={sc} strokeWidth="2.5" strokeLinecap="round" />
      {h>8  && <path d={`M0,${GND-h*.18} C-10,${GND-h*.18-7}  -15,${GND-h*.18-4} -18,${GND-h*.18-1}`} stroke={lc} strokeWidth="2"   fill="none" />}
      {h>15 && <path d={`M0,${GND-h*.35} C12,${GND-h*.35-9}    18,${GND-h*.35-5}  21,${GND-h*.35-1}`}  stroke={lc} strokeWidth="2"   fill="none" />}
      {h>24 && <path d={`M0,${GND-h*.5}  C-13,${GND-h*.5-10}  -19,${GND-h*.5-6} -22,${GND-h*.5-1}`}   stroke={lc} strokeWidth="2.5" fill="none" />}
      {h>38 && <path d={`M0,${GND-h*.64} C14,${GND-h*.64-11}   21,${GND-h*.64-7}  24,${GND-h*.64-1}`}  stroke={lc} strokeWidth="2.5" fill="none" />}
      {h>54 && <path d={`M0,${GND-h*.78} C-15,${GND-h*.78-13} -22,${GND-h*.78-8} -26,${GND-h*.78-1}`} stroke={lc} strokeWidth="3"   fill="none" />}
      {h>66 && <path d={`M0,${GND-h*.9}  C16,${GND-h*.9-14}    24,${GND-h*.9-9}   28,${GND-h*.9-1}`}   stroke={lc} strokeWidth="3"   fill="none" />}
      {['silk','corn-grain','corn-ripe','harvest'].includes(head)&&h>58&&<>
        <path d={`M0,${cobY} Q8,${cobY+2} 8,${cobY+18} Q8,${cobY+22} 0,${cobY+24}`} stroke={sc} strokeWidth="2" fill={isOld?'#d97706':'#fde68a'} />
        <line x1="8" y1={cobY+5}  x2="16" y2={cobY-4}  stroke={sc} strokeWidth="1.5" />
        <line x1="8" y1={cobY+12} x2="16" y2={cobY+4}  stroke={sc} strokeWidth="1.5" />
        <line x1="8" y1={cobY+18} x2="16" y2={cobY+12} stroke={sc} strokeWidth="1.5" />
        {head==='silk'&&<path d={`M8,${cobY+2} Q14,${cobY-3} 12,${cobY-10}`} stroke="#fde68a" strokeWidth="0.8" fill="none" />}
      </>}
      {['tassel-half','tassel','silk','corn-grain','corn-ripe'].includes(head)&&<>
        <line x1="0" y1={topY} x2="0" y2={topY-10} stroke={tc} strokeWidth="1.5" />
        {head!=='tassel-half'&&<>
          <line x1="0" y1={topY-7}  x2="-7" y2={topY-15} stroke={tc} strokeWidth="1" />
          <line x1="0" y1={topY-5}  x2="7"  y2={topY-14} stroke={tc} strokeWidth="1" />
          <line x1="0" y1={topY-3}  x2="-5" y2={topY-11} stroke={tc} strokeWidth="0.8" />
        </>}
      </>}
      {head==='harvest'&&<line x1="0" y1={topY} x2="4" y2={topY+8} stroke={sc} strokeWidth="1.5" strokeLinecap="round" />}
    </g>
  )
}

function buildMonthBars(visuals: VisualStage[], svgW = 1200) {
  const bars: { month: string; x1: number; x2: number }[] = []
  visuals.forEach((s, i) => {
    const x1 = i === 0 ? 0 : Math.floor((visuals[i-1].x + s.x) / 2)
    const x2 = i === visuals.length-1 ? svgW : Math.floor((s.x + visuals[i+1].x) / 2)
    const last = bars[bars.length-1]
    if (last && last.month === s.month) { last.x2 = x2 } else { bars.push({ month: s.month, x1, x2 }) }
  })
  return bars
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

  const culturaVisuals = culturaType === 'porumb' ? PORUMB_VISUAL : CEREALE_VISUAL
  const monthBars      = useMemo(() => buildMonthBars(culturaVisuals), [culturaVisuals])

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

      {/* ── Plant growth timeline SVG ── */}
      <div className="px-4 pt-3 pb-2 border-b border-gray-100 bg-gradient-to-b from-sky-50 to-white">
        <p className="text-xs font-medium text-gray-500 mb-1.5">
          🌱 Fazele de dezvoltare — model vizual
        </p>
        <div className="overflow-x-auto rounded-lg">
          <svg viewBox="0 0 1200 168" className="w-full min-w-[820px] h-auto" style={{ display: 'block' }}>
            <defs>
              <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f0f9ff" />
                <stop offset="85%" stopColor="#e0f2fe" />
              </linearGradient>
            </defs>
            <rect width="1200" height={GND} fill="url(#skyGrad)" />
            {culturaVisuals.map(s =>
              culturaType === 'porumb'
                ? <CornPlant   key={s.code} x={s.x} h={s.h} head={s.head} />
                : <CerealPlant key={s.code} x={s.x} h={s.h} tillers={s.tillers} head={s.head} />
            )}
            {culturaVisuals.map(s => (
              <text key={`lbl-${s.code}`} x={s.x} y={GND - s.h - (s.head !== 'none' ? 18 : 5)}
                fontSize="9" textAnchor="middle" fill="#1e40af" fontWeight="bold">{s.code}</text>
            ))}
            <rect x="0" y={GND} width="1200" height="10" fill="#7c2d12" />
            <rect x="0" y={GND+10} width="1200" height="4" fill="#450a03" />
            {culturaVisuals.map(s => (
              <line key={`tick-${s.code}`} x1={s.x} y1={GND+14} x2={s.x} y2={GND+22} stroke="#9ca3af" strokeWidth="0.5" />
            ))}
            {culturaVisuals.map(s => s.label[0] ? (
              <text key={`d1-${s.code}`} x={s.x} y={GND+31} fontSize="8" textAnchor="middle" fill="#374151">{s.label[0]}</text>
            ) : null)}
            {culturaVisuals.map(s => s.label[1] ? (
              <text key={`d2-${s.code}`} x={s.x} y={GND+41} fontSize="8" textAnchor="middle" fill="#374151">{s.label[1]}</text>
            ) : null)}
            {monthBars.map((mb, i) => (
              <g key={`mb-${i}`}>
                <rect x={mb.x1+1} y={GND+50} width={mb.x2-mb.x1-2} height="18" rx="3" fill="#1e3a5f" />
                <text x={(mb.x1+mb.x2)/2} y={GND+63} fontSize="9" textAnchor="middle" fill="#ffffff" fontWeight="bold">{mb.month}</text>
              </g>
            ))}
          </svg>
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
