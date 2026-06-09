'use client'
export const runtime = 'edge'

import { useEffect, useRef, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import {
  Thermometer, Droplets, Leaf, CloudRain, Sun, AlertTriangle,
  RefreshCw, MapPin, Activity, CheckCircle2, Clock, BarChart3,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { FarmDashboardResult, ParcelResult, FarmSummary, Alert, HealthLabel } from '@/lib/farm-dashboard/types'
import type { MapParcel } from '@/components/FarmDashboardMap'

const FarmDashboardMap = dynamic(() => import('@/components/FarmDashboardMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-800 rounded-xl">
      <p className="text-gray-400 text-sm">Se încarcă harta…</p>
    </div>
  ),
})

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, suffix = '', decimals = 1): string {
  if (v == null) return '—'
  return `${Number(v).toFixed(decimals)}${suffix}`
}

function healthColor(label: HealthLabel): string {
  switch (label) {
    case 'Excelent': return '#22d3ee'
    case 'Bun':      return '#22c55e'
    case 'Moderat':  return '#f59e0b'
    case 'Critic':   return '#ef4444'
  }
}

function healthBg(label: HealthLabel): string {
  switch (label) {
    case 'Excelent': return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
    case 'Bun':      return 'bg-green-500/20 text-green-300 border-green-500/30'
    case 'Moderat':  return 'bg-amber-500/20 text-amber-300 border-amber-500/30'
    case 'Critic':   return 'bg-red-500/20 text-red-300 border-red-500/30'
  }
}

function alertSeverityStyle(s: Alert['severity']): string {
  if (s === 'critical') return 'text-red-400 bg-red-500/10 border-red-500/30'
  if (s === 'high')     return 'text-amber-400 bg-amber-500/10 border-amber-500/30'
  return 'text-blue-400 bg-blue-500/10 border-blue-500/30'
}

function ndviTrendLabel(result: ParcelResult): string {
  const { trend, drop_pct } = result.ndvi
  if (trend === 'up') return `↑${Math.abs(drop_pct ?? 0).toFixed(1)}%`
  if (trend === 'down') return `↓${Math.abs(drop_pct ?? 0).toFixed(1)}%`
  if (trend === 'stable') return '→ stabil'
  if (result.ndvi.cloud_block) return 'cloud block'
  return '—'
}

function soilStatusLabel(s: string | null): string {
  switch (s) {
    case 'critic':   return 'Critic'
    case 'scazut':   return 'Scăzut'
    case 'optim':    return 'Optim'
    case 'ridicat':  return 'Ridicat'
    default:         return '—'
  }
}

// ─── sub-components ───────────────────────────────────────────────────────────

function CircularGauge({ score, label }: { score: number; label: HealthLabel }) {
  const r = 28
  const c = 2 * Math.PI * r
  const offset = c * (1 - score / 100)
  const color = healthColor(label)
  return (
    <div className="relative w-20 h-20 flex-shrink-0">
      <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="40" cy="40" r={r} fill="none" stroke="#374151" strokeWidth="6" />
        <circle
          cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-bold text-white leading-tight">{score}%</span>
      </div>
    </div>
  )
}

function SummaryKpiTile({
  label, icon: Icon, value, sub, color,
}: {
  label: string; icon: React.ElementType; value: string; sub?: string; color: string
}) {
  return (
    <div className="bg-gray-800 rounded-xl p-3 border border-gray-700">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-2 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
      <p className="text-base font-semibold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function ParcelKpiMini({
  label, icon: Icon, value, sub, iconClass,
}: {
  label: string; icon: React.ElementType; value: string; sub?: string; iconClass: string
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-2.5 flex flex-col gap-0.5 min-w-0">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${iconClass}`} />
        <span className="text-[10px] text-gray-400 truncate">{label}</span>
      </div>
      <span className="text-sm font-semibold text-white leading-tight">{value}</span>
      {sub && <span className="text-[10px] text-gray-500 leading-tight">{sub}</span>}
    </div>
  )
}

function ParcelCard({
  result,
  name,
  selected,
  onClick,
}: {
  result: ParcelResult
  name: string
  selected: boolean
  onClick: () => void
}) {
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (selected && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [selected])

  const meta: string[] = []
  if (result.apia_code) meta.push(result.apia_code)
  if (result.crop_type) meta.push(result.crop_type)
  if (result.bbch_stage != null) meta.push(`BBCH ${result.bbch_stage}`)
  if (result.area_ha != null) meta.push(`${result.area_ha.toFixed(1)} ha`)

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      className={`rounded-xl p-4 cursor-pointer transition-all border-2 ${
        selected
          ? 'bg-gray-800 border-green-500'
          : 'bg-gray-900 border-gray-700 hover:border-gray-500'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-white truncate text-sm">{name}</h3>
          <p className="text-xs text-gray-400 mt-0.5">{meta.join(' · ') || '—'}</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${healthBg(result.health_label)}`}>
          {result.health_label} · {result.health_score}%
        </span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-5 gap-2 mb-3">
        <ParcelKpiMini
          label="Temp" icon={Thermometer} iconClass="text-orange-400"
          value={fmt(result.weather.temp_current, '°C', 1)}
          sub={result.weather.temp_min_48h != null ? `Min 48h: ${result.weather.temp_min_48h}°C` : undefined}
        />
        <ParcelKpiMini
          label="Sol" icon={Droplets} iconClass="text-blue-400"
          value={fmt(result.soil.moisture_avg, '', 3)}
          sub={soilStatusLabel(result.soil.status)}
        />
        <ParcelKpiMini
          label="NDVI" icon={Leaf} iconClass="text-green-400"
          value={fmt(result.ndvi.current, '', 2)}
          sub={ndviTrendLabel(result)}
        />
        <ParcelKpiMini
          label="Ploaie 48h" icon={CloudRain} iconClass="text-sky-400"
          value={fmt(result.weather.forecast_rain_48h, 'mm', 1)}
          sub="prognozat"
        />
        <ParcelKpiMini
          label="ET₀" icon={Sun} iconClass="text-yellow-400"
          value={fmt(result.weather.et0_today, 'mm', 1)}
          sub="evapotranspirație"
        />
      </div>

      {/* Alerts */}
      {result.alerts.length === 0 ? (
        <p className="text-xs text-green-400 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> Fără alerte active pe această parcelă
        </p>
      ) : (
        <div className="space-y-1">
          {result.alerts.slice(0, 3).map((a, i) => (
            <p key={i} className={`text-[11px] px-2 py-1 rounded border leading-snug ${alertSeverityStyle(a.severity)}`}>
              ● {a.message}
            </p>
          ))}
          {result.alerts.length > 3 && (
            <p className="text-[11px] text-gray-500">+{result.alerts.length - 3} alerte suplimentare</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

interface SupabaseParcel {
  id: string
  bloc_fizic: string | null
  tarla_nr: string | null
  parcel_nr: string | null
  culture: string | null
  surface: number | null
  lat: number | null
  lng: number | null
  status: string | null
}

export default function FermaPage() {
  const [parcelsDb, setParcelsDb] = useState<SupabaseParcel[]>([])
  const [data, setData] = useState<FarmDashboardResult | null>(null)
  const [loadingDb, setLoadingDb] = useState(true)
  const [loadingApi, setLoadingApi] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [now, setNow] = useState(new Date())

  // Live clock
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Load parcels from Supabase
  useEffect(() => {
    const db = createClient()
    db.from('parcels')
      .select('id,bloc_fizic,tarla_nr,parcel_nr,culture,surface,lat,lng,status')
      .eq('status', 'ACTIVE')
      .not('lat', 'is', null)
      .not('lng', 'is', null)
      .limit(100)
      .then(({ data, error }) => {
        if (error) { setError(error.message); setLoadingDb(false); return }
        setParcelsDb((data ?? []) as SupabaseParcel[])
        setLoadingDb(false)
      })
  }, [])

  const fetchDashboard = useCallback(async (parcels: SupabaseParcel[]) => {
    if (parcels.length === 0) return
    setLoadingApi(true)
    setError(null)
    try {
      const inputs = parcels.map(p => ({
        id: p.id,
        apia_code: p.bloc_fizic,
        crop_type: p.culture,
        bbch_stage: null,
        area_ha: p.surface,
        lat: p.lat!,
        lng: p.lng!,
      }))
      const res = await fetch('/api/farm-dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parcels: inputs }),
      })
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const result: FarmDashboardResult = await res.json()
      setData(result)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoadingApi(false)
    }
  }, [])

  // Trigger API once parcels loaded
  useEffect(() => {
    if (!loadingDb && parcelsDb.length > 0) fetchDashboard(parcelsDb)
  }, [loadingDb, parcelsDb, fetchDashboard])

  const parcelName = (p: SupabaseParcel) =>
    [p.bloc_fizic, p.tarla_nr, p.parcel_nr].filter(Boolean).join(' – ') || `Parcelă ${p.id.slice(0, 6)}`

  const loading = loadingDb || loadingApi
  const summary: FarmSummary | null = data?.summary ?? null

  const mapParcels: MapParcel[] = (data?.parcels ?? []).map(r => {
    const db = parcelsDb.find(p => p.id === r.id)
    return { id: r.id, lat: db?.lat ?? 0, lng: db?.lng ?? 0, health_label: r.health_label, health_score: r.health_score, name: parcelName(db ?? ({} as SupabaseParcel)) }
  }).filter(p => p.lat !== 0)

  const lastUpdate = data?.fetched_at
    ? new Date(data.fetched_at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
    : null

  const dateStr = now.toLocaleDateString('ro-RO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const timeStr = now.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-5">

        {/* ── Header ── */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-green-400" />
              Monitorizare Fermă
            </h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {dateStr} · {timeStr}
              {lastUpdate && <span> · actualizat la {lastUpdate}</span>}
            </p>
          </div>
          <button
            onClick={() => fetchDashboard(parcelsDb)}
            disabled={loading || parcelsDb.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors border border-gray-600"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loadingDb ? 'Se încarcă parcele…' : loadingApi ? 'Analizează…' : 'Actualizează'}
          </button>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* ── No parcels with coords ── */}
        {!loadingDb && parcelsDb.length === 0 && (
          <div className="rounded-xl border border-gray-700 bg-gray-900 p-8 text-center">
            <MapPin className="w-10 h-10 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Nu există parcele active cu coordonate geografice.<br />Adaugă coordonate parcelelor din secțiunea Parcele.</p>
          </div>
        )}

        {/* ── Farm Health Summary ── */}
        {(loading || summary) && (
          <div className="bg-gray-900 rounded-2xl border border-gray-700 p-5 mb-5">
            {/* Top row */}
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-4">
                {loading ? (
                  <div className="w-20 h-20 rounded-full border-[6px] border-gray-700 animate-pulse flex-shrink-0" />
                ) : summary ? (
                  <CircularGauge score={summary.farm_health_score} label={summary.farm_health_label} />
                ) : null}
                <div>
                  <p className="text-lg font-semibold text-white">
                    {loading ? <span className="inline-block w-40 h-5 bg-gray-700 rounded animate-pulse" /> : `Sănătate fermă — ${summary?.farm_health_label}`}
                  </p>
                  <p className="text-sm text-gray-400 mt-1">
                    {loading ? <span className="inline-block w-64 h-4 bg-gray-800 rounded animate-pulse mt-1" /> : (
                      `${parcelsDb.length} parcele active · ${summary?.total_alerts ?? 0} alerte · ${lastUpdate ? `actualizat azi ${lastUpdate}` : '—'}`
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {summary && summary.critical_alerts > 0 && (
                  <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-400 text-sm font-medium">
                    <AlertTriangle className="w-4 h-4" /> {summary.critical_alerts} critice
                  </span>
                )}
                <a href="/rapoarte" className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-semibold transition-colors">
                  Analizează →
                </a>
              </div>
            </div>

            {/* KPI grid */}
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Sumar general</p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              <SummaryKpiTile label="Temperatură" icon={Thermometer} color="bg-orange-500/15 text-orange-400"
                value={loading ? '—' : fmt(summary?.avg_temp, '°C', 1)}
              />
              <SummaryKpiTile label="Umiditate sol" icon={Droplets} color="bg-blue-500/15 text-blue-400"
                value={loading ? '—' : fmt(summary?.avg_soil_moisture, '', 3)}
              />
              <SummaryKpiTile label="NDVI mediu" icon={Leaf} color="bg-green-500/15 text-green-400"
                value={loading ? '—' : fmt(summary?.avg_ndvi, '', 2)}
              />
              <SummaryKpiTile label="Precipitații" icon={CloudRain} color="bg-sky-500/15 text-sky-400"
                value={loading ? '—' : (
                  data?.parcels?.length
                    ? fmt(data.parcels.reduce((s, p) => s + (p.weather.forecast_rain_48h ?? 0), 0) / data.parcels.length, 'mm', 1)
                    : '—'
                )}
                sub="medie 48h"
              />
              <SummaryKpiTile label="Alerte active" icon={AlertTriangle} color="bg-amber-500/15 text-amber-400"
                value={loading ? '—' : String(summary?.total_alerts ?? 0)}
                sub={summary?.critical_alerts ? `${summary.critical_alerts} critice` : undefined}
              />
              <SummaryKpiTile label="Suprafață totală" icon={BarChart3} color="bg-violet-500/15 text-violet-400"
                value={loading ? '—' : fmt(summary?.total_area_ha, ' ha', 2)}
              />
            </div>
          </div>
        )}

        {/* ── Map + Cards ── */}
        {(loading || data) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Map */}
            <div className="bg-gray-900 rounded-2xl border border-gray-700 overflow-hidden" style={{ height: 480 }}>
              {loadingDb ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-gray-500 text-sm">Se încarcă…</p>
                </div>
              ) : (
                <FarmDashboardMap
                  parcels={mapParcels}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              )}
            </div>

            {/* Parcel cards */}
            <div className="flex flex-col gap-3 overflow-y-auto" style={{ maxHeight: 480 }}>
              {loading && data == null && (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-gray-900 rounded-xl border border-gray-700 p-4 animate-pulse">
                    <div className="h-4 bg-gray-700 rounded w-1/2 mb-2" />
                    <div className="h-3 bg-gray-800 rounded w-3/4 mb-4" />
                    <div className="grid grid-cols-5 gap-2">
                      {Array.from({ length: 5 }).map((_, j) => (
                        <div key={j} className="h-16 bg-gray-800 rounded-lg" />
                      ))}
                    </div>
                  </div>
                ))
              )}

              {data?.parcels?.map(result => {
                const db = parcelsDb.find(p => p.id === result.id)
                return (
                  <ParcelCard
                    key={result.id}
                    result={result}
                    name={parcelName(db ?? ({} as SupabaseParcel))}
                    selected={selectedId === result.id}
                    onClick={() => setSelectedId(prev => prev === result.id ? null : result.id)}
                  />
                )
              })}

              {!loading && data && data.parcels.length === 0 && (
                <div className="flex items-center justify-center h-40 text-gray-500 text-sm">
                  <div className="text-center">
                    <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                    Nicio parcelă procesată
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
