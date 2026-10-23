'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import type { DashParcel } from '@/components/dashboard/DashboardMap'
import { createClient } from '@/lib/supabase/client'
import { Users, FileText, MapPin, CreditCard, AlertTriangle, Clock, Plus, BarChart3, MessageSquare, Wheat, Tractor, ArrowRight } from 'lucide-react'

export const runtime = 'edge'

interface CampaignWidget {
  id: string
  name: string
  year: number
  totalParcels: number
  plannedParcels: number
  harvestedParcels: number
  opsFinished: number
  opsTotal: number
}

interface Stats {
  lessorsTotal: number
  contractsActive: number
  contractsExpiring: number
  parcelsTotal: number
  surfaceTotal: string
  paymentsOverdue: number
  paymentsOverdueAmount: string
}

const EMPTY: Stats = {
  lessorsTotal: 0, contractsActive: 0, contractsExpiring: 0,
  parcelsTotal: 0, surfaceTotal: '0.00', paymentsOverdue: 0, paymentsOverdueAmount: '0.00',
}

interface StatCardProps {
  label: string
  value: string | number
  icon: React.ElementType
  sub?: string
  iconColor: string
}

function StatCard({ label, value, icon: Icon, sub, iconColor }: StatCardProps) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-1.5 border border-white/[0.07]" style={{ background: 'rgba(255,255,255,0.05)' }}>
      <div className="flex items-center gap-1.5 text-xs" style={{ color: iconColor }}>
        <Icon className="w-3 h-3" />
        <span className="text-white/60">{label}</span>
      </div>
      <div className="text-white text-2xl font-semibold">{value}</div>
      {sub && <div className="text-white/45 text-xs leading-snug">{sub}</div>}
    </div>
  )
}

const DashboardMap = dynamic(() => import('@/components/dashboard/DashboardMap'), { ssr: false })

export default function DashboardPage() {
  const router = useRouter()
  const [mapParcels, setMapParcels] = useState<DashParcel[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [s, setS] = useState<Stats>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const [campaignWidget, setCampaignWidget] = useState<CampaignWidget | null>(null)

  useEffect(() => {
    async function load() {
      const db = createClient()
      const now = new Date()
      const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const today = now.toISOString().split('T')[0]
      const [
        { count: lessorsTotal },
        { count: contractsActive },
        { count: contractsExpiring },
        { data: parcelsData },
        { data: overdueData },
      ] = await Promise.all([
        db.from('lessors').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        db.from('contracts').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
        db.from('contracts').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE').lte('end_date', in30).gte('end_date', today),
        db.from('parcels').select('surface').limit(5000),
        db.from('transactions').select('ron_net').eq('is_paid', false).eq('is_previzionata', false).limit(1000),
      ])
      const surfaceTotal = ((parcelsData ?? []) as any[]).reduce((acc, p) => acc + Number(p.surface ?? 0), 0).toFixed(2)
      const paymentsOverdue = (overdueData ?? []).length
      const paymentsOverdueAmount = ((overdueData ?? []) as any[]).reduce((acc, p) => acc + Number(p.ron_net ?? 0), 0).toFixed(2)
      setS({ lessorsTotal: lessorsTotal ?? 0, contractsActive: contractsActive ?? 0, contractsExpiring: contractsExpiring ?? 0, parcelsTotal: (parcelsData ?? []).length, surfaceTotal, paymentsOverdue, paymentsOverdueAmount })
      setLoading(false)

      const { data: mp } = await db.from('parcels')
        .select('id,bloc_fizic,tarla_nr,parcel_nr,culture,surface,lat,lng,status')
        .not('lat', 'is', null).not('lng', 'is', null).limit(1000)
      setMapParcels(((mp ?? []) as any[]).map((p) => ({
        id: p.id,
        name: `Bloc ${p.bloc_fizic ?? '-'} · T${p.tarla_nr ?? '-'} · P${p.parcel_nr ?? '-'}`,
        culture: p.culture ?? null,
        surface: Number(p.surface ?? 0),
        lat: p.lat,
        lng: p.lng,
        active: p.status === 'ACTIVE',
      })))

      // Campaign progress widget
      try {
        const { data: activeCampaign } = await db.from('campaigns').select('id,name,year').eq('is_active', true).maybeSingle()
        if (activeCampaign) {
          const [{ count: totalParcels }, { data: plans }, { count: opsTotal }, { count: opsFinished }] = await Promise.all([
            db.from('parcels').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
            db.from('crop_plans').select('parcel_id,status').eq('campaign_id', activeCampaign.id),
            db.from('work_orders').select('id', { count: 'exact', head: true }).eq('campaign_id', activeCampaign.id),
            db.from('work_orders').select('id', { count: 'exact', head: true }).eq('campaign_id', activeCampaign.id).eq('status', 'FINALIZAT'),
          ])
          setCampaignWidget({
            id: activeCampaign.id,
            name: activeCampaign.name,
            year: activeCampaign.year,
            totalParcels: totalParcels ?? 0,
            plannedParcels: (plans ?? []).length,
            harvestedParcels: (plans ?? []).filter((p: any) => p.status === 'RECOLTAT').length,
            opsFinished: opsFinished ?? 0,
            opsTotal: opsTotal ?? 0,
          })
        }
      } catch { /* campaigns table may not exist yet */ }
      // Admin: check for unread contact messages
      const { data: { user } } = await db.auth.getUser()
      if (user) {
        const { data: profile } = await db.from('profiles').select('is_admin').eq('id', user.id).single()
        if (profile?.is_admin) {
          setIsAdmin(true)
          const { count } = await db.from('contact_messages').select('id', { count: 'exact', head: true }).eq('is_read', false)
          setUnreadMessages(count ?? 0)
        }
      }
    }
    load()
  }, [])


  const dash = loading ? '—' : undefined
  const selected = mapParcels.find((p) => p.id === selectedId) ?? null
  const activeMap = mapParcels.filter((p) => p.active).length
  const now = new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })

  return (
    <div className="-m-4 md:-m-6 min-h-full" style={{ background: '#0b160b' }}>
      {/* Banner */}
      <div className="px-5 pt-4 pb-3 border-b border-white/[0.08]" style={{ background: 'linear-gradient(135deg, #0f1f0f 0%, #111e11 100%)' }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <div className="text-white text-sm font-semibold">Platforma ta agricolă</div>
            <div className="text-white/45 text-xs mt-0.5">
              {loading ? '—' : `${s.parcelsTotal} parcele · ${s.contractsActive} contracte active`} · actualizat azi {now}
            </div>
          </div>
          <button
            onClick={() => router.push('/arendatori/nou')}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-white border border-white/20 hover:border-white/40 hover:bg-white/10 transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Adaugă arendator
          </button>
        </div>
      </div>

      {isAdmin && unreadMessages > 0 && (
        <a
          href="/admin-cp"
          className="mx-5 mt-3 flex items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 hover:bg-amber-400/15 transition-colors"
          onClick={() => sessionStorage.setItem('admin_tab', 'messages')}
        >
          <MessageSquare className="w-4 h-4 text-amber-400" />
          <span className="text-sm text-amber-300 flex-1">
            {unreadMessages} mesaj{unreadMessages > 1 ? 'e' : ''} nou{unreadMessages > 1 ? 'ă' : ''} de contact
          </span>
          <span className="text-xs text-amber-300">Vezi →</span>
        </a>
      )}

      {/* KPI row */}
      <div className="px-5 py-3 border-b border-white/[0.08]">
        <div className="text-white/35 text-[10px] uppercase tracking-widest mb-2.5 font-semibold">Sumar general</div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
          <StatCard label="Arendatori activi" value={dash ?? s.lessorsTotal} icon={Users} iconColor="#4ade80" />
          <StatCard label="Contracte active" value={dash ?? s.contractsActive} icon={FileText} iconColor="#60a5fa" />
          <StatCard label="Expiră în 30 zile" value={dash ?? s.contractsExpiring} icon={Clock} iconColor="#fbbf24" />
          <StatCard label="Parcele" value={dash ?? s.parcelsTotal} icon={MapPin} iconColor="#c084fc" sub={loading ? undefined : `${s.surfaceTotal} ha total`} />
          <StatCard label="Tranzacții neplătite" value={dash ?? s.paymentsOverdue} icon={AlertTriangle} iconColor="#f87171" />
          <StatCard label="Neplătit (RON)" value={dash ?? s.paymentsOverdueAmount} icon={CreditCard} iconColor="#38bdf8" />
        </div>
      </div>

      {/* Map */}
      <div className="relative border-b border-white/[0.08]" style={{ height: 'clamp(320px, 50vh, 520px)', isolation: 'isolate' }}>
        <DashboardMap parcels={mapParcels} selectedId={selectedId} onSelect={setSelectedId} />

        <div className="absolute top-3 left-3 z-[1000] rounded-xl px-3 py-2.5 border border-white/10" style={{ background: 'rgba(10,20,10,0.88)', backdropFilter: 'blur(12px)' }}>
          <div className="text-white/40 text-[10px] uppercase tracking-wider mb-2 font-semibold">Parcele</div>
          {[{ c: '#4ade80', l: `Active (${activeMap})` }, { c: '#6b7280', l: `Inactive (${mapParcels.length - activeMap})` }].map(({ c, l }) => (
            <div key={l} className="flex items-center gap-2 text-xs text-white/60 mb-1 last:mb-0">
              <div className="w-3 h-3 rounded-full" style={{ background: c, boxShadow: `0 0 5px ${c}88` }} />{l}
            </div>
          ))}
        </div>

        {!selected && (
          <div className="absolute bottom-4 left-4 z-[1000] rounded-xl px-3 py-2 border border-white/10 text-white/45 text-xs" style={{ background: 'rgba(10,20,10,0.75)', backdropFilter: 'blur(8px)' }}>
            {mapParcels.length ? 'Apasă pe o parcelă pentru detalii' : loading ? 'Se încarcă…' : 'Nicio parcelă cu coordonate'}
          </div>
        )}

        {selected && (
          <div className="absolute bottom-4 left-4 z-[1000] w-[min(360px,calc(100%-2rem))] rounded-2xl p-4 border border-white/10" style={{ background: 'rgba(10,20,10,0.96)', backdropFilter: 'blur(16px)' }}>
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="text-white text-base font-semibold">{selected.name}</div>
                <div className="text-white/45 text-xs mt-0.5">{selected.culture ?? 'Cultură nespecificată'} · {selected.surface.toFixed(2)} ha</div>
              </div>
              <button onClick={() => setSelectedId(null)} className="text-white/40 hover:text-white/80 p-1 rounded-lg hover:bg-white/10 text-sm leading-none">✕</button>
            </div>
            <button onClick={() => router.push(`/parcele/${selected.id}`)} className="text-xs text-[#4ade80] hover:underline">Deschide parcela →</button>
          </div>
        )}
      </div>

      <div className="px-5 py-4 space-y-4">
        {campaignWidget && (
          <div className="rounded-2xl border border-white/[0.08] p-5" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-green-400/15"><Wheat className="w-5 h-5 text-green-400" /></div>
                <div>
                  <div className="text-xs text-green-400 font-semibold uppercase tracking-wide">{campaignWidget.year}</div>
                  <div className="text-base font-semibold text-white">{campaignWidget.name}</div>
                </div>
              </div>
              <a href={`/campanie/${campaignWidget.year}`} className="flex items-center gap-1 text-xs text-white/80 border border-white/20 px-3 py-1.5 rounded-lg hover:bg-white/10 transition-colors">
                Deschide <ArrowRight className="w-3 h-3" />
              </a>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Planuri culturi', val: campaignWidget.plannedParcels, tot: campaignWidget.totalParcels, unit: 'parcele', bar: '#4ade80' },
                ...(campaignWidget.harvestedParcels > 0 ? [{ label: 'Recoltat', val: campaignWidget.harvestedParcels, tot: campaignWidget.plannedParcels, unit: 'parcele planificate', bar: '#fbbf24' }] : []),
                ...(campaignWidget.opsTotal > 0 ? [{ label: 'Activități câmp finalizate', val: campaignWidget.opsFinished, tot: campaignWidget.opsTotal, unit: 'operații', bar: '#2dd4bf' }] : []),
              ].map(({ label, val, tot, unit, bar }) => (
                <div key={label}>
                  <div className="flex justify-between text-xs text-white/50 mb-1.5">
                    <span>{label}</span><span className="font-medium text-white/80">{val} / {tot} {unit}</span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${tot ? (val / tot) * 100 : 0}%`, background: bar }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/[0.08] p-5" style={{ background: 'rgba(255,255,255,0.04)' }}>
          <div className="text-sm font-semibold text-white/80 mb-3">Acțiuni rapide</div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Arendator nou', href: '/arendatori/nou', icon: Users },
              { label: 'Contract nou', href: '/contracte/nou', icon: FileText },
              { label: 'Parcelă nouă', href: '/parcele/nou', icon: MapPin },
              { label: 'Tranzacții', href: '/plati', icon: AlertTriangle },
              { label: 'Rapoarte', href: '/rapoarte', icon: BarChart3 },
            ].map(({ label, href, icon: Icon }) => (
              <button key={href} onClick={() => router.push(href)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-white/15 text-white/70 hover:border-[#4ade80] hover:text-[#4ade80] transition-colors font-medium">
                <Icon className="w-3 h-3" />{label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
