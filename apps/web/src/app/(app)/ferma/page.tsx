'use client'
export const runtime = 'edge'

import { useEffect, useRef, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import {
  Thermometer, Droplets, Leaf, CloudRain, Sun, AlertTriangle,
  RefreshCw, MapPin, Activity, CheckCircle2, Clock, BarChart3,
  Info, ChevronDown, ChevronUp, Satellite,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { FarmDashboardResult, ParcelResult, FarmSummary, Alert, HealthLabel } from '@/lib/farm-dashboard/types'
import type { MapParcel } from '@/components/FarmDashboardMap'

const FarmDashboardMap = dynamic(() => import('@/components/FarmDashboardMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-gray-100 rounded-xl border border-gray-200">
      <p className="text-gray-500 text-sm">Se încarcă harta satelit…</p>
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
    case 'Excelent': return '#0891b2'
    case 'Bun':      return '#16a34a'
    case 'Moderat':  return '#d97706'
    case 'Critic':   return '#dc2626'
  }
}

function healthBg(label: HealthLabel): string {
  switch (label) {
    case 'Excelent': return 'bg-cyan-50 text-cyan-700 border-cyan-200'
    case 'Bun':      return 'bg-green-50 text-green-700 border-green-200'
    case 'Moderat':  return 'bg-amber-50 text-amber-700 border-amber-200'
    case 'Critic':   return 'bg-red-50 text-red-700 border-red-200'
  }
}

function alertSeverityStyle(s: Alert['severity']): string {
  if (s === 'critical') return 'text-red-700 bg-red-50 border-red-200'
  if (s === 'high')     return 'text-amber-700 bg-amber-50 border-amber-200'
  return 'text-blue-700 bg-blue-50 border-blue-200'
}

function ndviTrendLabel(result: ParcelResult): string {
  const { trend, drop_pct } = result.ndvi
  if (trend === 'up') return `↑ +${Math.abs(drop_pct ?? 0).toFixed(1)}%`
  if (trend === 'down') return `↓ -${Math.abs(drop_pct ?? 0).toFixed(1)}%`
  if (trend === 'stable') return '→ stabil'
  if (result.ndvi.cloud_block) return 'acoperire nori'
  return '—'
}

function soilStatusLabel(s: string | null): string {
  switch (s) {
    case 'critic':  return 'Critic'
    case 'scazut':  return 'Scăzut'
    case 'optim':   return 'Optim'
    case 'ridicat': return 'Ridicat'
    default:        return '—'
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
        <circle cx="40" cy="40" r={r} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle
          cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-bold text-gray-900 leading-tight">{score}%</span>
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
    <div className="bg-white rounded-xl p-3 border border-gray-200 shadow-sm">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-2 ${color}`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-xs text-gray-500 mb-0.5">{label}</p>
      <p className="text-base font-semibold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

function ParcelKpiMini({
  label, icon: Icon, value, sub, iconClass,
}: {
  label: string; icon: React.ElementType; value: string; sub?: string; iconClass: string
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-2.5 flex flex-col gap-0.5 min-w-0 border border-gray-100">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${iconClass}`} />
        <span className="text-[10px] text-gray-500 truncate">{label}</span>
      </div>
      <span className="text-sm font-semibold text-gray-900 leading-tight">{value}</span>
      {sub && <span className="text-[10px] text-gray-400 leading-tight">{sub}</span>}
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
          ? 'bg-green-50 border-green-400 shadow-sm'
          : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 truncate text-sm">{name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{meta.join(' · ') || '—'}</p>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${healthBg(result.health_label)}`}>
          {result.health_label} · {result.health_score}%
        </span>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-5 gap-2 mb-3">
        <ParcelKpiMini
          label="Temp" icon={Thermometer} iconClass="text-orange-500"
          value={fmt(result.weather.temp_current, '°C', 1)}
          sub={result.weather.temp_min_48h != null ? `Min 48h: ${result.weather.temp_min_48h}°C` : undefined}
        />
        <ParcelKpiMini
          label="Sol" icon={Droplets} iconClass="text-blue-500"
          value={fmt(result.soil.moisture_avg, '', 3)}
          sub={soilStatusLabel(result.soil.status)}
        />
        <ParcelKpiMini
          label="NDVI" icon={Leaf} iconClass="text-green-600"
          value={fmt(result.ndvi.current, '', 2)}
          sub={ndviTrendLabel(result)}
        />
        <ParcelKpiMini
          label="Ploaie 48h" icon={CloudRain} iconClass="text-sky-500"
          value={fmt(result.weather.forecast_rain_48h, 'mm', 1)}
          sub="prognozat"
        />
        <ParcelKpiMini
          label="ET₀" icon={Sun} iconClass="text-yellow-500"
          value={fmt(result.weather.et0_today, 'mm', 1)}
          sub="evapotranspirație"
        />
      </div>

      {/* Alerts */}
      {result.alerts.length === 0 ? (
        <p className="text-xs text-green-600 flex items-center gap-1">
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
            <p className="text-[11px] text-gray-400">+{result.alerts.length - 3} alerte suplimentare</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Description / KPI Guide section ─────────────────────────────────────────

function KpiGuide() {
  const [open, setOpen] = useState(false)

  const kpis = [
    {
      icon: Activity, color: 'text-green-600 bg-green-50',
      title: 'Scor sănătate (0–100%)',
      desc: 'Indicator compozit calculat din NDVI (40 pts), umiditatea solului (35 pts) și penalizări pentru alerte active. Un scor ≥85% = Excelent, 66–85% = Bun, 41–65% = Moderat, ≤40% = Critic.',
    },
    {
      icon: Thermometer, color: 'text-orange-500 bg-orange-50',
      title: 'Temperatură (°C)',
      desc: 'Temperatura aerului la 2 metri înălțime, actualizată în timp real de la Open-Meteo. "Min 48h" indică minimul prognozat pentru următoarele 48 ore — relevant pentru detectarea riscului de îngheț.',
    },
    {
      icon: Droplets, color: 'text-blue-500 bg-blue-50',
      title: 'Umiditate sol (m³/m³)',
      desc: 'Umiditatea volumetrică medie a solului pe primii 10 cm adâncime. Valori: Critic < 0.15 (secetă severă), Scăzut 0.15–0.25, Optim 0.25–0.40, Ridicat > 0.40 (risc de asfixiere).',
    },
    {
      icon: Leaf, color: 'text-green-600 bg-green-50',
      title: 'NDVI (Indice de vegetație)',
      desc: 'Normalized Difference Vegetation Index calculat din imagini satelitare Sentinel-2. Valori: < 0.2 = vegetație absentă sau degradată, 0.2–0.4 = vegetație slabă, 0.4–0.6 = vegetație medie, > 0.6 = vegetație sănătoasă și densă. Săgeata arată tendința față de perioada anterioară de 10 zile.',
    },
    {
      icon: CloudRain, color: 'text-sky-500 bg-sky-50',
      title: 'Ploaie 48h (mm)',
      desc: 'Precipitații prognozate cumulate pentru următoarele 48 de ore. Sursa: Open-Meteo (model ECMWF). Util pentru planificarea lucrărilor de câmp și irigațiilor.',
    },
    {
      icon: Sun, color: 'text-yellow-500 bg-yellow-50',
      title: 'ET₀ — Evapotranspirație de referință (mm/zi)',
      desc: 'Estimarea necesarului de apă al culturilor pentru ziua curentă, conform metodei FAO-56 Penman-Monteith. Valori ridicate (> 5 mm/zi) indică necesitate crescută de irigare în condiții de secetă.',
    },
    {
      icon: AlertTriangle, color: 'text-amber-600 bg-amber-50',
      title: 'Alerte automate',
      desc: 'Generate deterministic pe baza pragurilor: Scădere NDVI > 15% (risc boli/dăunători), NDVI < 0.2 (degradare), umiditate sol critică (secetă), temperatură minimă < 2°C în faza de înflorire (brumă), exces umiditate > 0.45 (asfixiere), precipitații < 5mm/7 zile cu sol critic (stres hidric sever).',
    },
  ]

  return (
    <div className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <Info className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-gray-900">Ghid funcționalitate și KPI-uri</p>
            <p className="text-xs text-gray-500">Ce date sunt afișate, de unde provin și cum se interpretează</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
      </button>

      {open && (
        <div className="px-5 pb-5 border-t border-gray-100">
          {/* Overview */}
          <div className="bg-indigo-50 rounded-xl p-4 my-4 border border-indigo-100">
            <div className="flex items-center gap-2 mb-2">
              <Satellite className="w-4 h-4 text-indigo-600" />
              <span className="text-sm font-semibold text-indigo-800">Cum funcționează</span>
            </div>
            <p className="text-sm text-indigo-700 leading-relaxed">
              Modulul de monitorizare combină două surse de date în timp real: <strong>Open-Meteo</strong> (meteo + umiditate sol, gratuit, actualizare orară) și <strong>Sentinel Hub</strong> (imagini satelitare Sentinel-2, rezoluție 10m, actualizare la ~5 zile). Pentru fiecare parcelă activă cu coordonate GPS, sistemul calculează automat un scor de sănătate și generează alerte dacă sunt detectate anomalii. Datele sunt procesate pe server, fără a expune cheile API în browser.
            </p>
          </div>

          {/* KPI list */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {kpis.map((k, i) => (
              <div key={i} className="flex gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${k.color}`}>
                  <k.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-900 mb-0.5">{k.title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{k.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="mt-4 p-3 rounded-xl bg-gray-50 border border-gray-100">
            <p className="text-xs font-semibold text-gray-700 mb-2">Legendă hartă satelit</p>
            <div className="flex flex-wrap gap-3">
              {([['Excelent', '#0891b2'], ['Bun', '#16a34a'], ['Moderat', '#d97706'], ['Critic', '#dc2626']] as const).map(([label, color]) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm" style={{ background: color }} />
                  <span className="text-xs text-gray-600">{label}</span>
                </div>
              ))}
              <span className="text-xs text-gray-400">— culoarea markerilor corespunde scorului de sănătate al parcelei</span>
            </div>
          </div>
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
    return {
      id: r.id,
      lat: db?.lat ?? 0,
      lng: db?.lng ?? 0,
      health_label: r.health_label,
      health_score: r.health_score,
      name: parcelName(db ?? ({} as SupabaseParcel)),
    }
  }).filter(p => p.lat !== 0)

  const lastUpdate = data?.fetched_at
    ? new Date(data.fetched_at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
    : null

  const dateStr = now.toLocaleDateString('ro-RO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const timeStr = now.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="max-w-7xl mx-auto px-4 py-5">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-5 h-5 text-green-600" />
            Monitorizare Fermă
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {dateStr} · {timeStr}
            {lastUpdate && <span> · actualizat la {lastUpdate}</span>}
          </p>
        </div>
        <button
          onClick={() => fetchDashboard(parcelsDb)}
          disabled={loading || parcelsDb.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors border border-gray-200 shadow-sm text-gray-700"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loadingDb ? 'Se încarcă parcele…' : loadingApi ? 'Analizează…' : 'Actualizează'}
        </button>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── No parcels with coords ── */}
      {!loadingDb && parcelsDb.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">
            Nu există parcele active cu coordonate geografice.<br />
            Adaugă coordonate parcelelor din secțiunea Parcele.
          </p>
        </div>
      )}

      {/* ── Farm Health Summary ── */}
      {(loading || summary) && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-5">
          {/* Top row */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-4">
              {loading ? (
                <div className="w-20 h-20 rounded-full border-[6px] border-gray-100 animate-pulse flex-shrink-0" />
              ) : summary ? (
                <CircularGauge score={summary.farm_health_score} label={summary.farm_health_label} />
              ) : null}
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  {loading
                    ? <span className="inline-block w-40 h-5 bg-gray-100 rounded animate-pulse" />
                    : `Sănătate fermă — ${summary?.farm_health_label}`}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {loading
                    ? <span className="inline-block w-64 h-4 bg-gray-100 rounded animate-pulse mt-1" />
                    : `${parcelsDb.length} parcele active · ${summary?.total_alerts ?? 0} alerte · ${lastUpdate ? `actualizat azi ${lastUpdate}` : '—'}`}
                </p>
              </div>
            </div>
            {summary && summary.critical_alerts > 0 && (
              <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
                <AlertTriangle className="w-4 h-4" /> {summary.critical_alerts} alerte critice
              </span>
            )}
          </div>

          {/* KPI grid */}
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Sumar general</p>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            <SummaryKpiTile label="Temperatură" icon={Thermometer} color="bg-orange-50 text-orange-500"
              value={loading ? '—' : fmt(summary?.avg_temp, '°C', 1)}
            />
            <SummaryKpiTile label="Umiditate sol" icon={Droplets} color="bg-blue-50 text-blue-500"
              value={loading ? '—' : fmt(summary?.avg_soil_moisture, '', 3)}
            />
            <SummaryKpiTile label="NDVI mediu" icon={Leaf} color="bg-green-50 text-green-600"
              value={loading ? '—' : fmt(summary?.avg_ndvi, '', 2)}
            />
            <SummaryKpiTile label="Precipitații" icon={CloudRain} color="bg-sky-50 text-sky-500"
              value={loading ? '—' : (
                data?.parcels?.length
                  ? fmt(data.parcels.reduce((s, p) => s + (p.weather.forecast_rain_48h ?? 0), 0) / data.parcels.length, 'mm', 1)
                  : '—'
              )}
              sub="medie 48h"
            />
            <SummaryKpiTile label="Alerte active" icon={AlertTriangle} color="bg-amber-50 text-amber-600"
              value={loading ? '—' : String(summary?.total_alerts ?? 0)}
              sub={summary?.critical_alerts ? `${summary.critical_alerts} critice` : undefined}
            />
            <SummaryKpiTile label="Suprafață totală" icon={BarChart3} color="bg-violet-50 text-violet-600"
              value={loading ? '—' : fmt(summary?.total_area_ha, ' ha', 2)}
            />
          </div>
        </div>
      )}

      {/* ── Full-width Satellite Map ── */}
      {(loading || data || parcelsDb.length > 0) && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mb-5" style={{ height: 560 }}>
          {loadingDb ? (
            <div className="flex flex-col items-center justify-center h-full bg-gray-50">
              <Satellite className="w-10 h-10 text-gray-300 mb-3 animate-pulse" />
              <p className="text-gray-500 text-sm">Se încarcă harta satelit…</p>
            </div>
          ) : (
            <FarmDashboardMap
              parcels={mapParcels}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
          )}
        </div>
      )}

      {/* ── Parcel Cards Grid ── */}
      {(loading || data) && (
        <>
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            Parcele monitorizate {data ? `(${data.parcels.length})` : ''}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-2">
            {/* Loading skeletons */}
            {loading && data == null && Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 animate-pulse">
                <div className="h-4 bg-gray-100 rounded w-1/2 mb-2" />
                <div className="h-3 bg-gray-100 rounded w-3/4 mb-4" />
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <div key={j} className="h-16 bg-gray-100 rounded-lg" />
                  ))}
                </div>
              </div>
            ))}

            {/* Results */}
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
              <div className="col-span-full flex items-center justify-center h-32 text-gray-400 text-sm">
                <div className="text-center">
                  <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  Nicio parcelă procesată
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── KPI Guide & Description ── */}
      <KpiGuide />

    </div>
  )
}

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
