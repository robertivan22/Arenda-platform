'use client'

import { useState, useEffect, useCallback } from 'react'
import { Package, TrendingDown, CheckCircle, Users, Clock } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { SearchArendator } from '@/components/distribuire/SearchArendator'
import { FormDistribuire } from '@/components/distribuire/FormDistribuire'
import { SumarArendator } from '@/components/distribuire/SumarArendator'
import { RecentDistribuiri } from '@/components/distribuire/RecentDistribuiri'
import { getDistribuirePageStats } from './actions'
import type { LandlordSearchResult, DistribuirePageStats } from '@/types/distribuire'

// ─── Stat chip ────────────────────────────────────────────────────────────────

interface StatChipProps {
  label: string
  value: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
  sub?: string
}

function StatChip({ label, value, icon: Icon, iconBg, iconColor, sub }: StatChipProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3 shadow-sm">
      <div className={`p-2 rounded-lg flex-shrink-0 ${iconBg}`}>
        <Icon className={`w-4 h-4 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <div className="text-xl font-bold text-gray-900 leading-tight">{value}</div>
        <div className="text-xs text-gray-500 mt-0.5">{label}</div>
        {sub && <div className="text-xs text-brand-600 font-medium mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DistribuireArendaPage() {
  const [stats, setStats] = useState<DistribuirePageStats | null>(null)
  const [selectedLandlord, setSelectedLandlord] = useState<LandlordSearchResult | null>(null)
  const [sumarRefreshKey, setSumarRefreshKey] = useState(0)
  const [recentRefreshKey, setRecentRefreshKey] = useState(0)
  const [loadingStats, setLoadingStats] = useState(true)
  // Track the from_quantity being entered in the form for live preview in SumarArendator
  const [previewFromKg, setPreviewFromKg] = useState(0)

  const loadStats = useCallback(async () => {
    setLoadingStats(true)
    try {
      const data = await getDistribuirePageStats()
      setStats(data)
    } finally {
      setLoadingStats(false)
    }
  }, [])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  function handleLandlordSelect(l: LandlordSearchResult) {
    setSelectedLandlord(l)
    setPreviewFromKg(0)
  }

  function handleLandlordClear() {
    setSelectedLandlord(null)
    setPreviewFromKg(0)
  }

  function handleDistributionSuccess() {
    setSumarRefreshKey((k) => k + 1)
    setRecentRefreshKey((k) => k + 1)
    setPreviewFromKg(0)
    void loadStats()
  }

  function fmtKg(kg: number): string {
    return `${kg.toLocaleString('ro-RO', { maximumFractionDigits: 0 })} kg`
  }

  return (
    <div>
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <PageHeader
        title="Distribuire Arendă"
        subtitle="Gestionare arendă"
        actions={
          <div className="flex items-center gap-2">
            {stats?.activeCampaignName && (
              <span className="px-2.5 py-1 text-xs font-semibold bg-brand-100 text-brand-700 rounded-full">
                {stats.activeCampaignName}
              </span>
            )}
            {stats != null && stats.pendingPaymentsCount > 0 && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-amber-100 text-amber-700 rounded-full">
                <Clock className="w-3 h-3" />
                {stats.pendingPaymentsCount} plăți în așteptare
              </span>
            )}
          </div>
        }
      />

      {/* ── Stat chips ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatChip
          label="Total de distribuit"
          value={loadingStats ? '...' : fmtKg(stats?.totalToDistributeKg ?? 0)}
          icon={Package}
          iconBg="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatChip
          label="Nedistribuit rămas"
          value={loadingStats ? '...' : fmtKg(stats?.remainingKg ?? 0)}
          icon={TrendingDown}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
          sub={
            stats && stats.totalToDistributeKg > 0
              ? `${Math.round((stats.remainingKg / stats.totalToDistributeKg) * 100)}% neachitat`
              : undefined
          }
        />
        <StatChip
          label="Distribuit până acum"
          value={loadingStats ? '...' : fmtKg(stats?.distributedKg ?? 0)}
          icon={CheckCircle}
          iconBg="bg-green-50"
          iconColor="text-green-600"
          sub={
            stats && stats.totalToDistributeKg > 0
              ? `${Math.round((stats.distributedKg / stats.totalToDistributeKg) * 100)}% realizat`
              : undefined
          }
        />
        <StatChip
          label="Arendatori activi"
          value={loadingStats ? '...' : String(stats?.activeLandlordsCount ?? 0)}
          icon={Users}
          iconBg="bg-purple-50"
          iconColor="text-purple-600"
        />
      </div>

      {/* ── Two-column layout ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">

        {/* ── LEFT: Search + Form ────────────────────────────────────────────── */}
        <div className="space-y-4 min-w-0">
          {/* Search */}
          <SearchArendator
            onSelect={handleLandlordSelect}
            selectedId={selectedLandlord?.id}
            onClear={handleLandlordClear}
          />

          {/* Form — shown only after selecting a landlord */}
          {selectedLandlord ? (
            <FormDistribuire
              landlord={selectedLandlord}
              remainingKg={0}  // SumarArendator tracks remaining; pass from status if needed
              onSuccess={handleDistributionSuccess}
            />
          ) : (
            <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                <Users className="w-6 h-6 text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Caută și selectează un arendator</p>
                <p className="text-xs text-gray-400 mt-1">
                  Formularul de distribuire va apărea după selecție
                </p>
              </div>
            </div>
          )}

          {/* Recent distributions (below form on desktop left side) */}
          <RecentDistribuiri key={recentRefreshKey} />
        </div>

        {/* ── RIGHT: Summary + Prices ───────────────────────────────────────── */}
        <div className="min-w-0">
          <SumarArendator
            landlord={selectedLandlord}
            refreshKey={sumarRefreshKey}
            currentDistributionKg={previewFromKg}
          />
        </div>
      </div>
    </div>
  )
}
