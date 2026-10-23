'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { ArrowUpRight, Banknote, FileText, Layers, MapPin, MessageSquare, Plus, Ruler, Wheat } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { DashPoint, DashPolygon } from '@/components/dashboard/DashboardMap'

export const runtime = 'edge'

const DashboardMap = dynamic(() => import('@/components/dashboard/DashboardMap'), { ssr: false })

const BRAND = '#4a6640'
const CROP_COLORS = ['#4a6640', '#f59e0b', '#7e9e6a', '#b45309', '#a8bd96', '#5c7f4c', '#d6c7a1']
const STATUS_COLOR: Record<string, string> = { ACTIVE: '#4a6640', INACTIVE: '#9ca3af', EXPIRED: '#b91c1c' }
const STATUS_LABEL: Record<string, string> = { ACTIVE: 'Activă', INACTIVE: 'Inactivă', EXPIRED: 'Expirată' }

const fmt = (n: number, d = 0) => n.toLocaleString('ro-RO', { minimumFractionDigits: d, maximumFractionDigits: d })
const MONTHS = ['ian', 'feb', 'mar', 'apr', 'mai', 'iun', 'iul', 'aug', 'sep', 'oct', 'nov', 'dec']
const fmtDate = (iso?: string | null) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

interface ParcelRow {
  id: string; bloc_fizic: string | null; tarla_nr: string | null; parcel_nr: string | null
  locality: string | null; culture: string | null; surface: number | null; status: string | null
  apia_eligible: boolean | null; created_at: string | null; lat: number | null; lng: number | null
  lessors: { first_name: string | null; last_name: string | null; company_name: string | null; type: string | null } | null
}
interface ContractRow { id: string; contract_number: string | null; status: string | null; end_date: string | null; created_at: string | null }
interface TxRow { ron_net: number | null; is_paid: boolean | null }
interface FitoRow {
  id: string; parcela_id: string | null; nume_parcela: string | null; suprafata_ha: number | null
  cultura_color: string | null; geometry_geojson: { coordinates?: number[][][] } | null; created_at: string | null
}

const parcelName = (p: ParcelRow) => `Bloc ${p.bloc_fizic ?? '-'} · T${p.tarla_nr ?? '-'} · P${p.parcel_nr ?? '-'}`
const lessorName = (l: ParcelRow['lessors']) =>
  !l ? '—' : l.type === 'LEGAL' ? l.company_name ?? '—' : `${l.last_name ?? ''} ${l.first_name ?? ''}`.trim() || '—'

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm ${className}`}>{children}</div>
}

function CardHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {action && (
        <button onClick={onAction} className="text-xs font-medium text-brand-600 hover:text-brand-800 flex items-center gap-0.5">
          {action} <ArrowUpRight size={12} />
        </button>
      )}
    </div>
  )
}

function Kpi({ icon, label, value, unit, sub, tone }: { icon: React.ReactNode; label: string; value: string; unit?: string; sub: string; tone: string }) {
  return (
    <Card className="p-4 flex items-start gap-3.5">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: tone + '1F', color: tone }}>{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-[22px] leading-tight font-bold text-gray-900 mt-0.5 tabular-nums">
          {value}{unit && <span className="text-[13px] font-semibold text-gray-500 ml-1">{unit}</span>}
        </div>
        <div className="text-xs text-gray-500 mt-1">{sub}</div>
      </div>
    </Card>
  )
}

function Donut({ data, total }: { data: { name: string; ha: number }[]; total: number }) {
  const r = 70, c = 2 * Math.PI * r
  let acc = 0
  return (
    <div className="relative h-[190px] flex items-center justify-center">
      <svg width={190} height={190} viewBox="0 0 190 190" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={95} cy={95} r={r} fill="none" stroke="#f3f4f6" strokeWidth={24} />
        {total > 0 && data.map((d, i) => {
          const len = (d.ha / total) * c
          const el = (
            <circle key={d.name} cx={95} cy={95} r={r} fill="none" stroke={CROP_COLORS[i % CROP_COLORS.length]} strokeWidth={24}
              strokeDasharray={`${Math.max(len - 2, 0)} ${c}`} strokeDashoffset={-acc} />
          )
          acc += len
          return el
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <div className="text-xl font-bold text-gray-900 tabular-nums">{fmt(total)} ha</div>
        <div className="text-[11px] text-gray-500">Total</div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState('')
  const [parcels, setParcels] = useState<ParcelRow[]>([])
  const [contracts, setContracts] = useState<ContractRow[]>([])
  const [txs, setTxs] = useState<TxRow[]>([])
  const [fito, setFito] = useState<FitoRow[]>([])
  const [lessorsCount, setLessorsCount] = useState(0)
  const [isAdmin, setIsAdmin] = useState(false)
  const [unread, setUnread] = useState(0)
  const [mapMode, setMapMode] = useState<'toate' | 'noi'>('toate')

  useEffect(() => {
    async function load() {
      const db = createClient()
      const [p, c, t, f, l] = await Promise.all([
        db.from('parcels')
          .select('id,bloc_fizic,tarla_nr,parcel_nr,locality,culture,surface,status,apia_eligible,created_at,lat,lng,lessors(first_name,last_name,company_name,type)')
          .order('created_at', { ascending: false }).limit(5000),
        db.from('contracts').select('id,contract_number,status,end_date,created_at').order('created_at', { ascending: false }).limit(2000),
        db.from('transactions').select('ron_net,is_paid').eq('is_previzionata', false).limit(5000),
        db.from('parcele_fitosanitar').select('id,parcela_id,nume_parcela,suprafata_ha,cultura_color,geometry_geojson,created_at').order('created_at', { ascending: false }),
        db.from('lessors').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
      ])
      setParcels((p.data ?? []) as unknown as ParcelRow[])
      setContracts((c.data ?? []) as ContractRow[])
      setTxs((t.data ?? []) as TxRow[])
      setFito((f.data ?? []) as unknown as FitoRow[])
      setLessorsCount(l.count ?? 0)
      setLoading(false)

      const { data: { user } } = await db.auth.getUser()
      if (user) {
        const meta = user.user_metadata as { full_name?: string } | undefined
        setName((meta?.full_name ?? user.email?.split('@')[0] ?? '').split(' ')[0])
        const { data: profile } = await db.from('profiles').select('is_admin').eq('id', user.id).single()
        if (profile?.is_admin) {
          setIsAdmin(true)
          const { count } = await db.from('contact_messages').select('id', { count: 'exact', head: true }).eq('is_read', false)
          setUnread(count ?? 0)
        }
      }
    }
    load()
  }, [])

  const d = useMemo(() => {
    const ha = (p: ParcelRow) => Number(p.surface ?? 0)
    const totalHa = parcels.reduce((s, p) => s + ha(p), 0)
    const activeHa = parcels.filter((p) => p.status === 'ACTIVE').reduce((s, p) => s + ha(p), 0)
    const apiaHa = parcels.filter((p) => p.apia_eligible).reduce((s, p) => s + ha(p), 0)
    const activeContracts = contracts.filter((c) => c.status === 'ACTIVE')
    const expiring = activeContracts.filter((c) => {
      if (!c.end_date) return false
      const diff = (new Date(c.end_date).getTime() - Date.now()) / 86400000
      return diff >= 0 && diff <= 90
    }).length

    const byCrop = new Map<string, number>()
    parcels.forEach((p) => byCrop.set(p.culture || 'Nespecificată', (byCrop.get(p.culture || 'Nespecificată') ?? 0) + ha(p)))
    const crops = [...byCrop.entries()].map(([n, h]) => ({ name: n, ha: h })).sort((a, b) => b.ha - a.ha)

    const paid = txs.filter((x) => x.is_paid).reduce((s, x) => s + Number(x.ron_net ?? 0), 0)
    const unpaid = txs.filter((x) => !x.is_paid).reduce((s, x) => s + Number(x.ron_net ?? 0), 0)

    const recent = parcels.slice(0, 4)
    const acts = [
      ...contracts.slice(0, 6).map((c) => ({ date: c.created_at, title: `Contract ${c.contract_number ?? ''} înregistrat`, sub: c.status === 'ACTIVE' ? 'Activ' : c.status ?? '', icon: <FileText size={13} /> })),
      ...parcels.slice(0, 6).map((p) => ({ date: p.created_at, title: `Parcelă adăugată · ${parcelName(p)}`, sub: `${fmt(ha(p), 2)} ha · ${p.culture ?? 'Cultură nespecificată'}`, icon: <MapPin size={13} /> })),
    ].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, 6)

    return { totalHa, activeHa, apiaHa, activeContracts, expiring, crops, paid, unpaid, recent, acts }
  }, [parcels, contracts, txs])

  const { polygons, points } = useMemo(() => {
    const newest = new Set(parcels.slice(0, 3).map((p) => p.id))
    const byId = new Map(parcels.map((p) => [p.id, p]))
    const cropColor = new Map(d.crops.map((c, i) => [c.name, CROP_COLORS[i % CROP_COLORS.length]]))
    const colorOf = (p?: ParcelRow) => STATUS_COLOR[p?.status ?? 'ACTIVE'] ?? STATUS_COLOR.INACTIVE

    const polys: DashPolygon[] = fito
      .filter((f) => f.geometry_geojson?.coordinates?.[0]?.length)
      .map((f) => {
        const lp = f.parcela_id ? byId.get(f.parcela_id) : undefined
        return {
          id: f.id, name: f.nume_parcela ?? 'Parcelă', ha: f.suprafata_ha,
          color: f.cultura_color ?? (lp?.culture ? cropColor.get(lp.culture) ?? BRAND : colorOf(lp)),
          ring: f.geometry_geojson!.coordinates![0], fresh: !!(f.parcela_id && newest.has(f.parcela_id)),
        }
      })
    const withPoly = new Set(fito.filter((f) => f.parcela_id).map((f) => f.parcela_id))
    const pts: DashPoint[] = parcels
      .filter((p) => p.lat != null && p.lng != null && !withPoly.has(p.id))
      .map((p) => ({ id: p.id, name: parcelName(p), ha: p.surface, color: colorOf(p), lat: p.lat!, lng: p.lng!, fresh: newest.has(p.id) }))

    if (mapMode === 'noi') {
      return { polygons: polys.filter((x) => x.fresh), points: pts.filter((x) => x.fresh) }
    }
    return { polygons: polys, points: pts }
  }, [parcels, fito, d.crops, mapMode])

  const totalRon = d.paid + d.unpaid
  const pct = (v: number) => (totalRon ? (v / totalRon) * 100 : 0)
  const v = (x: string) => (loading ? '—' : x)

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bună ziua{name ? `, ${name}` : ''}!</h1>
          <p className="text-sm text-gray-500 mt-1">Iată situația fermei tale astăzi.</p>
        </div>
        <button onClick={() => router.push('/parcele/nou')}
          className="h-9 px-3.5 rounded-xl text-sm font-semibold text-white flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 transition-colors">
          <Plus size={14} /> Parcelă nouă
        </button>
      </div>

      {isAdmin && unread > 0 && (
        <a href="/admin-cp" onClick={() => sessionStorage.setItem('admin_tab', 'messages')}
          className="mb-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 hover:bg-amber-100 transition-colors">
          <MessageSquare className="w-5 h-5 text-amber-600" />
          <span className="text-sm font-semibold text-amber-800 flex-1">{unread} mesaj{unread > 1 ? 'e' : ''} nou{unread > 1 ? 'ă' : ''} de contact</span>
          <span className="text-xs font-semibold text-amber-700">Vezi →</span>
        </a>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <Kpi icon={<Ruler size={18} />} tone="#4a6640" label="Suprafață totală" value={v(fmt(d.totalHa, 0))} unit="ha" sub={`${fmt(d.activeHa)} ha în arendă activă`} />
        <Kpi icon={<FileText size={18} />} tone="#f59e0b" label="Contracte active" value={v(String(d.activeContracts.length))}
          sub={d.expiring ? `${d.expiring} expiră în 90 zile` : `${lessorsCount} arendatori activi`} />
        <Kpi icon={<Layers size={18} />} tone="#7e9e6a" label="Parcele" value={v(String(parcels.length))} sub={`${fmt(d.apiaHa)} ha marcate eligibile APIA`} />
        <Kpi icon={<Banknote size={18} />} tone="#b45309" label="Arendă plătită" value={v(fmt(d.paid, 0))} unit="RON"
          sub={`${fmt(pct(d.paid), 0)}% din ${fmt(totalRon, 0)} RON`} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        <Card className="xl:col-span-2 p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="text-sm font-semibold text-gray-900">Parcele</h3>
            <div className="flex p-0.5 rounded-lg bg-gray-100 text-xs">
              {([['toate', 'Toate'], ['noi', 'Adăugate recent']] as const).map(([k, l]) => (
                <button key={k} onClick={() => setMapMode(k)}
                  className={`px-3 py-1 rounded-md font-medium transition ${mapMode === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>{l}</button>
              ))}
            </div>
          </div>
          <div className="relative rounded-xl overflow-hidden min-h-[340px] flex-1 border border-gray-200" style={{ isolation: 'isolate' }}>
            {!loading && <DashboardMap key={mapMode} polygons={polygons} points={points} />}
            <button onClick={() => router.push('/parcele/harta')}
              className="absolute z-[500] bottom-3 right-3 h-8 px-3 rounded-lg bg-white/95 text-xs font-medium text-gray-900 shadow flex items-center gap-1 hover:bg-white">
              Deschide harta <ArrowUpRight size={12} />
            </button>
            {!loading && polygons.length + points.length === 0 && (
              <div className="absolute inset-0 z-[400] flex items-center justify-center text-sm text-gray-500 bg-white/70">Nicio parcelă pe hartă încă</div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <CardHead title="Culturile din fermă" action="Vezi detalii" onAction={() => router.push('/parcele')} />
          <Donut data={d.crops} total={d.totalHa} />
          <ul className="mt-3 space-y-2">
            {d.crops.slice(0, 6).map((c, i) => (
              <li key={c.name} className="flex items-center gap-2 text-[13px]">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: CROP_COLORS[i % CROP_COLORS.length] }} />
                <span className="flex-1 text-gray-900 truncate">{c.name}</span>
                <span className="text-gray-500 tabular-nums">{fmt(c.ha)} ha</span>
                <span className="w-9 text-right text-gray-900 font-medium tabular-nums">{fmt(d.totalHa ? (c.ha / d.totalHa) * 100 : 0, 0)}%</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 pb-6">
        <Card className="p-5">
          <CardHead title="Distribuire arendă" action="Distribuie" onAction={() => router.push('/distribuire-arenda')} />
          <div className="flex items-baseline gap-2">
            <span className="text-[28px] font-bold text-gray-900 tabular-nums">{fmt(pct(d.paid), 0)}%</span>
            <span className="text-[13px] text-gray-500">plătit</span>
          </div>
          <div className="mt-3 h-2.5 rounded-full overflow-hidden flex bg-gray-100">
            <div style={{ width: `${pct(d.paid)}%`, background: BRAND }} />
          </div>
          <div className="mt-4 space-y-2 text-[13px]">
            {[['Plătit', d.paid, BRAND], ['Rămas de plătit', d.unpaid, '#d1d5db']].map(([l, val, col]) => (
              <div key={l as string} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-sm" style={{ background: col as string }} />
                <span className="flex-1 text-gray-900">{l}</span>
                <span className="tabular-nums text-gray-900 font-medium">{fmt(val as number, 2)} RON</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-1.5 text-xs text-gray-500">
            <Wheat size={13} /> {d.activeContracts.length} contracte active
          </div>
        </Card>

        <Card className="p-5">
          <CardHead title="Parcele adăugate recent" action="Toate parcelele" onAction={() => router.push('/parcele')} />
          <ul className="divide-y divide-gray-100">
            {d.recent.length === 0 && <li className="text-sm text-gray-500">Nicio parcelă încă.</li>}
            {d.recent.map((p) => {
              const st = p.status ?? 'ACTIVE'
              const col = STATUS_COLOR[st] ?? STATUS_COLOR.INACTIVE
              return (
                <li key={p.id} className="py-2.5 flex items-center gap-3 first:pt-0 last:pb-0">
                  <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0"><MapPin size={15} /></div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-gray-900 truncate">{parcelName(p)} · {fmt(Number(p.surface ?? 0), 2)} ha</div>
                    <div className="text-xs text-gray-500 truncate">{p.culture ?? '—'} · {p.locality || '—'} · {lessorName(p.lessors)}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs text-gray-500">{fmtDate(p.created_at)}</div>
                    <span className="inline-block mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: col + '22', color: col }}>
                      {STATUS_LABEL[st] ?? st}
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>

        <Card className="p-5">
          <CardHead title="Activitate recentă" />
          <ul className="divide-y divide-gray-100">
            {d.acts.length === 0 && <li className="text-sm text-gray-500">Nicio activitate încă.</li>}
            {d.acts.map((a, i) => (
              <li key={i} className="py-2.5 flex items-center gap-3 first:pt-0 last:pb-0">
                <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">{a.icon}</div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-gray-900 truncate">{a.title}</div>
                  <div className="text-xs text-gray-500 truncate">{a.sub}</div>
                </div>
                <div className="text-[11px] text-gray-400 shrink-0">{fmtDate(a.date)}</div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  )
}
