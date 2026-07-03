'use client'

import { useEffect, useState, useCallback } from 'react'

interface TourStep {
  target: string
  fallback?: string
  title: string
  description: string
}

const TOUR_STEPS: TourStep[] = [
  {
    target: 'nav-arendatori',
    title: 'Arendatori',
    description:
      'Gestionează toți proprietarii de teren: date de contact, suprafețe deținute și istoricul relațiilor contractuale.',
  },
  {
    target: 'nav-contracte',
    title: 'Contracte',
    description:
      'Creează și urmărește contractele de arendă. Primești alerte automate cu 45, 7 și 1 zile înainte de expirare.',
  },
  {
    target: 'nav-distribuire',
    title: 'Distribuire Arendă',
    description:
      'Calculează și urmărește automat distribuirea arenzii per proprietar și parcelă, în bani sau producție agricolă.',
  },
  {
    target: 'nav-stocuri',
    fallback: 'nav-campanie',
    title: 'Stocuri & Inputuri',
    description:
      'Monitorizează în timp real stocurile de semințe, fertilizanți și pesticide. Primești alerte când nivelul devine critic.',
  },
  {
    target: 'nav-activitati',
    fallback: 'nav-campanie',
    title: 'Activități Câmp',
    description:
      'Planifică și înregistrează operațiunile agricole (arat, semănat, fertilizat, recoltat) pe parcele și campanii.',
  },
  {
    target: 'nav-ferma',
    title: 'Monitorizare Fermă',
    description:
      'Tabloul de bord operațional — KPI-uri live, alerte active și starea generală a întregii exploatații agricole.',
  },
  {
    target: 'nav-harta-parcele',
    fallback: 'nav-parcele',
    title: 'Harta Parcele',
    description:
      'Vizualizează și editează parcelele pe hartă interactivă cu strat APIA LPIS 2024. Import GeoJSON, SHP (Stereo70 & WGS84).',
  },
]

interface SpotlightRect {
  x: number; y: number; w: number; h: number
}

function findTarget(step: TourStep): HTMLElement | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`)
  if (el && el.getBoundingClientRect().height > 0) return el
  if (step.fallback) {
    const fb = document.querySelector<HTMLElement>(`[data-tour="${step.fallback}"]`)
    if (fb && fb.getBoundingClientRect().height > 0) return fb
  }
  return null
}

export function GuidedTour() {
  const [active, setActive] = useState(false)
  const [stepIdx, setStepIdx] = useState(0)
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null)
  const [winSize, setWinSize] = useState({ w: 0, h: 0 })

  // Check tour state once on mount
  useEffect(() => {
    fetch('/api/onboarding/state')
      .then(r => r.json())
      .then((data: { completed_at: string | null; tour_seen_at: string | null }) => {
        if (data.completed_at && !data.tour_seen_at) {
          setActive(true)
          setWinSize({ w: window.innerWidth, h: window.innerHeight })
        }
      })
      .catch(() => {})
  }, [])

  const measureStep = useCallback(() => {
    if (!active) return
    const step = TOUR_STEPS[stepIdx]
    if (!step) return
    const el = findTarget(step)
    if (!el) { setSpotlight(null); return }
    const r = el.getBoundingClientRect()
    setSpotlight({ x: r.left, y: r.top, w: r.width, h: r.height })
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    setWinSize({ w: window.innerWidth, h: window.innerHeight })
  }, [active, stepIdx])

  useEffect(() => {
    if (!active) return
    // Small delay to let sidebar animations settle
    const t = setTimeout(measureStep, 80)
    window.addEventListener('resize', measureStep)
    return () => { clearTimeout(t); window.removeEventListener('resize', measureStep) }
  }, [active, stepIdx, measureStep])

  async function dismiss() {
    setActive(false)
    try { await fetch('/api/onboarding/tour-seen', { method: 'POST' }) } catch { /* silent */ }
  }

  function handleNext() {
    if (stepIdx >= TOUR_STEPS.length - 1) {
      void dismiss()
    } else {
      setStepIdx(i => i + 1)
    }
  }

  if (!active || !spotlight) return null

  const PAD = 8
  const sx = spotlight.x - PAD
  const sy = spotlight.y - PAD
  const sw = spotlight.w + PAD * 2
  const sh = spotlight.h + PAD * 2

  // Tooltip: try right of spotlight; if near right edge, go left
  const TOOLTIP_W = 300
  const TOOLTIP_MARGIN = 16
  const isNearRightEdge = sx + sw + TOOLTIP_MARGIN + TOOLTIP_W > winSize.w
  const tooltipLeft = isNearRightEdge
    ? Math.max(8, sx - TOOLTIP_MARGIN - TOOLTIP_W)
    : sx + sw + TOOLTIP_MARGIN

  const tooltipTop = Math.max(TOOLTIP_MARGIN, Math.min(sy, winSize.h - 220))
  const step = TOUR_STEPS[stepIdx]

  return (
    <>
      {/* ── Spotlight overlay (SVG mask) ────────────────────────────────────── */}
      <svg
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          pointerEvents: 'all',
          zIndex: 9998,
          cursor: 'default',
        }}
        onClick={e => e.stopPropagation()}
      >
        <defs>
          <mask id="guided-tour-mask">
            <rect width="100%" height="100%" fill="white" />
            <rect x={sx} y={sy} width={sw} height={sh} rx={8} fill="black" />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.62)"
          mask="url(#guided-tour-mask)"
        />
        {/* Highlight border around spotlight */}
        <rect
          x={sx}
          y={sy}
          width={sw}
          height={sh}
          rx={8}
          fill="none"
          stroke="rgba(255,255,255,0.35)"
          strokeWidth={2}
        />
      </svg>

      {/* ── Tooltip ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'fixed',
          left: tooltipLeft,
          top: tooltipTop,
          width: TOOLTIP_W,
          zIndex: 9999,
        }}
        className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-5"
      >
        {/* Header: step counter + close */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-bold text-brand-600 bg-brand-50 px-2.5 py-1 rounded-full">
            {stepIdx + 1} / {TOUR_STEPS.length}
          </span>
          <button
            onClick={() => void dismiss()}
            className="text-gray-300 hover:text-gray-500 transition-colors"
            aria-label="Închide turul"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <h3 className="font-bold text-gray-900 text-base mb-1.5">{step.title}</h3>
        <p className="text-sm text-gray-500 leading-relaxed mb-4">{step.description}</p>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 mb-4">
          {TOUR_STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === stepIdx ? 'w-5 bg-brand-600' : i < stepIdx ? 'w-1.5 bg-brand-300' : 'w-1.5 bg-gray-200'
              }`}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => void dismiss()}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-2"
          >
            Sari peste tur
          </button>
          <button
            onClick={handleNext}
            className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
          >
            {stepIdx >= TOUR_STEPS.length - 1 ? '✓ Gata' : 'Următor →'}
          </button>
        </div>
      </div>
    </>
  )
}
