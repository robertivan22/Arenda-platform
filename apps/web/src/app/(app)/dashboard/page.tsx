'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Users, FileText, MapPin, CreditCard, AlertTriangle, Clock, Plus, BarChart3, MessageSquare, Wheat, Tractor, ArrowRight } from 'lucide-react'
import { GuidedTour } from '@/components/onboarding/GuidedTour'

export const runtime = 'edge'

// ─── Animated agricultural dawn SVG ──────────────────────────────────────────
function AgriLandscape() {
  const stalks = Array.from({ length: 46 })
  const particles = Array.from({ length: 14 })
  return (
    <div className="w-full h-full" style={{ minHeight: 200, position: 'relative' }}>
      <style>{`
        @keyframes ap-sway-a { 0%,100%{transform:rotate(-2.5deg)}50%{transform:rotate(2.5deg)} }
        @keyframes ap-sway-b { 0%,100%{transform:rotate(-3.5deg)}50%{transform:rotate(3.5deg)} }
        @keyframes ap-cloud-a { 0%{transform:translateX(0)}100%{transform:translateX(38px)} }
        @keyframes ap-cloud-b { 0%{transform:translateX(0)}100%{transform:translateX(-26px)} }
        @keyframes ap-tractor { 0%{transform:translateX(895px)}100%{transform:translateX(-115px)} }
        @keyframes ap-glow-pulse { 0%,100%{opacity:.78}50%{opacity:1} }
        @keyframes ap-smoke { 0%{transform:translateY(0) scale(1);opacity:.45}100%{transform:translateY(-22px) scale(2.2);opacity:0} }
        @keyframes ap-bird { 0%{transform:translate(0,0)}100%{transform:translate(130px,-18px)} }
        @keyframes ap-pollen { 0%{transform:translateY(0);opacity:.8}100%{transform:translateY(-40px);opacity:0} }
        @keyframes ap-beacon { 0%,100%{opacity:.6}50%{opacity:1} }
        .ap-stalk { transform-box:fill-box; transform-origin:bottom center; }
      `}</style>
      <svg viewBox="0 0 900 480" xmlns="http://www.w3.org/2000/svg" className="w-full h-full" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="apl-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0b1828" /><stop offset="38%" stopColor="#4a1e00" stopOpacity=".9" />
            <stop offset="68%" stopColor="#c05500" /><stop offset="88%" stopColor="#e8820a" /><stop offset="100%" stopColor="#fbbf24" />
          </linearGradient>
          <radialGradient id="apl-sun-aura" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff7aa" stopOpacity=".95" /><stop offset="30%" stopColor="#fbbf24" stopOpacity=".55" />
            <stop offset="70%" stopColor="#f59e0b" stopOpacity=".18" /><stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="apl-horizon-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f59e0b" stopOpacity=".3" /><stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="apl-hills-far" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#183a14" /><stop offset="100%" stopColor="#0c2309" />
          </linearGradient>
          <linearGradient id="apl-hills-mid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1e5218" /><stop offset="100%" stopColor="#12360d" />
          </linearGradient>
          <linearGradient id="apl-field" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c28018" /><stop offset="100%" stopColor="#6e3e05" />
          </linearGradient>
          <linearGradient id="apl-ground" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4a2c05" /><stop offset="100%" stopColor="#2e1a02" />
          </linearGradient>
          <filter id="apl-blur"><feGaussianBlur stdDeviation="2" /></filter>
        </defs>
        <rect width="900" height="480" fill="url(#apl-sky)" />
        <ellipse cx="450" cy="308" rx="520" ry="90" fill="url(#apl-horizon-glow)" />
        <circle cx="760" cy="108" r="108" fill="url(#apl-sun-aura)" style={{ animation: 'ap-glow-pulse 4.5s ease-in-out infinite' }} />
        <circle cx="760" cy="108" r="50" fill="#fef3c7" opacity=".96"><animate attributeName="r" values="49;52;49" dur="4.5s" repeatCount="indefinite" /></circle>
        <circle cx="760" cy="108" r="30" fill="#ffffff" opacity=".7" />
        <rect x="0" y="304" width="900" height="3" fill="#f59e0b" opacity=".22" />
        <g style={{ animation: 'ap-cloud-a 15s ease-in-out infinite alternate' }}>
          <ellipse cx="155" cy="76" rx="76" ry="24" fill="rgba(255,180,90,.38)" />
          <ellipse cx="128" cy="88" rx="46" ry="19" fill="rgba(255,160,70,.3)" />
          <ellipse cx="184" cy="86" rx="54" ry="18" fill="rgba(255,160,70,.3)" />
        </g>
        <g style={{ animation: 'ap-cloud-b 20s ease-in-out infinite alternate' }}>
          <ellipse cx="435" cy="50" rx="62" ry="18" fill="rgba(255,160,70,.28)" />
          <ellipse cx="410" cy="61" rx="38" ry="16" fill="rgba(255,160,70,.22)" />
          <ellipse cx="460" cy="59" rx="44" ry="15" fill="rgba(255,160,70,.22)" />
        </g>
        <g style={{ animation: 'ap-bird 25s linear infinite' }}>
          <path d="M70,145 Q74,140 78,145" stroke="rgba(255,160,50,.65)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <path d="M83,136 Q87,131 91,136" stroke="rgba(255,160,50,.65)" strokeWidth="1.6" fill="none" strokeLinecap="round" />
          <path d="M96,143 Q100,138 104,143" stroke="rgba(255,160,50,.5)" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </g>
        <g style={{ animation: 'ap-bird 32s 6s linear infinite' }}>
          <path d="M190,108 Q194,104 198,108" stroke="rgba(255,160,50,.55)" strokeWidth="1.3" fill="none" strokeLinecap="round" />
          <path d="M204,100 Q208,96 212,100" stroke="rgba(255,160,50,.55)" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </g>
        <path d="M0,305 Q100,260 210,285 Q340,248 460,278 Q580,252 710,272 Q810,254 900,265 L900,480 L0,480 Z" fill="url(#apl-hills-far)" opacity=".93" />
        <path d="M0,345 Q130,310 270,332 Q410,308 540,328 Q670,304 820,322 Q868,312 900,316 L900,480 L0,480 Z" fill="url(#apl-hills-mid)" />
        <path d="M0,392 Q220,370 450,380 Q700,370 900,376 L900,480 L0,480 Z" fill="url(#apl-field)" />
        <path d="M0,434 L900,428 L900,480 L0,480 Z" fill="url(#apl-ground)" />
        {Array.from({ length: 7 }).map((_, i) => (
          <path key={i} d={`M${i*145-10},480 Q${i*145+62},${434+i%3} ${i*145+155},480`} stroke="#5e3806" strokeWidth="1.2" fill="none" opacity=".55" />
        ))}
        {stalks.map((_, i) => {
          const x = 10 + (i/45)*880, h = 52 + Math.sin(i*1.76)*13 + (i%4)*3
          const delay = ((i*0.16)%2.8).toFixed(2), dur = (1.9+(i%6)*0.21).toFixed(2)
          const hc = ['#d4a017','#c8911a','#b87e14','#daa820'][i%4]
          return (
            <g key={i} transform={`translate(${x},402)`}>
              <g className="ap-stalk" style={{ animation: `${i%3===1?'ap-sway-b':'ap-sway-a'} ${dur}s ${delay}s ease-in-out infinite` }}>
                <line x1="0" y1="0" x2="0" y2={-h} stroke="#8b6914" strokeWidth="1.6" />
                <ellipse cx="0" cy={-h*0.56} rx="1.5" ry="2.2" fill="#7a5a10" />
                <path d={`M0,${-h*0.44} Q7,${-h*0.52} 3.5,${-h*0.63}`} stroke="#4a7a14" strokeWidth="1.3" fill="none" />
                <ellipse cx="0" cy={-h-8} rx="3.4" ry="9.5" fill={hc} />
                <line x1="0" y1={-h+1} x2="-6" y2={-h-9} stroke="#a07018" strokeWidth=".9" />
                <line x1="0" y1={-h-1} x2="6" y2={-h-9} stroke="#a07018" strokeWidth=".9" />
                <line x1="0" y1={-h-4} x2="-5" y2={-h-13} stroke="#a07018" strokeWidth=".75" />
                <line x1="0" y1={-h-4} x2="5" y2={-h-13} stroke="#a07018" strokeWidth=".75" />
                <line x1="0" y1={-h-7} x2="-3" y2={-h-16} stroke="#a07018" strokeWidth=".6" />
                <line x1="0" y1={-h-7} x2="3" y2={-h-16} stroke="#a07018" strokeWidth=".6" />
              </g>
            </g>
          )
        })}
        {particles.map((_, i) => {
          const xP = 40+(i/13)*820, yP = 385+(i%4)*9
          return <circle key={i} cx={xP} cy={yP} r="1.6" fill="#fbbf24" opacity=".7" style={{ animation: `ap-pollen ${(2.8+(i%5)*0.65).toFixed(1)}s ${((i*0.55)%3.2).toFixed(1)}s ease-in-out infinite` }} />
        })}
        <g style={{ animation: 'ap-tractor 24s linear infinite' }}>
          <ellipse cx="52" cy="436" rx="48" ry="5.5" fill="rgba(0,0,0,.28)" filter="url(#apl-blur)" />
          <circle cx="62" cy="414" r="27" fill="#0c0804" /><circle cx="62" cy="414" r="21" fill="#1a1008" /><circle cx="62" cy="414" r="7" fill="#0c0804" />
          {Array.from({length:8}).map((_,wi)=>{const a=(wi/8)*Math.PI*2;return<line key={wi} x1={62+Math.cos(a)*12} y1={414+Math.sin(a)*12} x2={62+Math.cos(a)*24} y2={414+Math.sin(a)*24} stroke="#0c0804" strokeWidth="3.2"/>})}
          <path d="M34,396 Q50,386 72,390 Q86,391 88,398 L88,403 Q85,396 72,393 Q50,389 34,401 Z" fill="#0c0804" />
          <rect x="22" y="398" width="66" height="20" rx="3" fill="#0c0804" />
          <rect x="6" y="398" width="24" height="19" rx="2.5" fill="#0c0804" />
          {Array.from({length:4}).map((_,gi)=><line key={gi} x1={9} y1={402+gi*3.5} x2={27} y2={402+gi*3.5} stroke="#1e1208" strokeWidth="1" opacity=".7"/>)}
          <rect x="18" y="382" width="5" height="18" rx="2" fill="#0c0804" />
          <rect x="15" y="380" width="11" height="5" rx="2" fill="#0c0804" />
          <circle cx="21" cy="377" r="4.5" fill="rgba(60,40,15,.45)" style={{animation:'ap-smoke 2.1s 0s ease-out infinite'}} />
          <circle cx="23" cy="368" r="3.8" fill="rgba(60,40,15,.3)" style={{animation:'ap-smoke 2.1s .75s ease-out infinite'}} />
          <circle cx="20" cy="360" r="3" fill="rgba(60,40,15,.18)" style={{animation:'ap-smoke 2.1s 1.5s ease-out infinite'}} />
          <rect x="48" y="372" width="42" height="28" rx="3" fill="#0c0804" />
          <rect x="52" y="376" width="15" height="20" rx="2" fill="rgba(90,160,230,.22)" />
          <rect x="68" y="376" width="18" height="20" rx="2" fill="rgba(90,160,230,.17)" />
          <rect x="47" y="369" width="44" height="5" rx="2.5" fill="#0c0804" />
          <circle cx="78" cy="368" r="3.5" fill="#f59e0b" style={{animation:'ap-beacon 1.6s ease-in-out infinite'}} />
          <circle cx="14" cy="420" r="14.5" fill="#0c0804" /><circle cx="14" cy="420" r="10" fill="#1a1008" /><circle cx="14" cy="420" r="4" fill="#0c0804" />
          {Array.from({length:6}).map((_,wi)=>{const a=(wi/6)*Math.PI*2;return<line key={wi} x1={14+Math.cos(a)*6} y1={420+Math.sin(a)*6} x2={14+Math.cos(a)*12} y2={420+Math.sin(a)*12} stroke="#0c0804" strokeWidth="2.5"/>})}
          <rect x="10" y="415" width="16" height="4" rx="1.5" fill="#0c0804" />
          <line x1="88" y1="410" x2="100" y2="422" stroke="#0c0804" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="88" y1="416" x2="100" y2="428" stroke="#0c0804" strokeWidth="3.5" strokeLinecap="round" />
          <line x1="94" y1="407" x2="100" y2="415" stroke="#0c0804" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  )
}

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
  iconBg: string
  iconColor: string
}

function StatCard({ label, value, icon: Icon, sub, iconBg, iconColor }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 flex items-start gap-4 shadow-sm">
      <div className={`p-2.5 rounded-xl flex-shrink-0 ${iconBg}`}>
        <Icon className={`w-5 h-5 ${iconColor}`} />
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-gray-900 leading-none mb-1">{value}</div>
        <div className="text-sm text-gray-500">{label}</div>
        {sub && <div className="text-xs mt-0.5" style={{ color: '#2d6a4f' }}>{sub}</div>}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
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

  return (
    <div>
      {/* Page title */}
      <div className="mb-5">
        <h1 className="text-xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Vizualizare generală platformă</p>
      </div>

      {/* Notification: unread contact messages (admin only) */}
      {isAdmin && unreadMessages > 0 && (
        <a
          href="/admin-cp"
          className="block mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 hover:bg-amber-100 transition-colors"
          onClick={() => sessionStorage.setItem('admin_tab', 'messages')}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-5 h-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold text-amber-800">
                {unreadMessages} mesaj{unreadMessages > 1 ? 'e' : ''} nou{unreadMessages > 1 ? 'ă' : ''} de contact
              </div>
              <div className="text-xs text-amber-600 mt-0.5">Deschide Admin Panel → Mesaje Contact pentru a le vizualiza</div>
            </div>
            <span className="text-xs font-semibold text-amber-700 border border-amber-300 px-3 py-1.5 rounded-lg">Vezi →</span>
          </div>
        </a>
      )}

      {/* Hero banner */}
      <div className="rounded-2xl mb-6 overflow-hidden relative" style={{ minHeight: '200px' }}>
        {/* Animated SVG landscape */}
        <div className="absolute inset-0">
          <AgriLandscape />
        </div>
        {/* Dark gradient overlay — text readable on left, fades right */}
        <div className="absolute inset-0" style={{ background: 'linear-gradient(100deg, rgba(10,16,10,0.88) 0%, rgba(15,25,15,0.65) 50%, transparent 100%)' }} />
        <div className="px-8 py-7 flex items-center relative z-10">
          <div>
            <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-2">Bun venit înapoi</p>
            <h2 className="text-2xl font-bold text-white mb-2">Platforma ta agricolă</h2>
            <p className="text-[#74c69d] text-sm mb-5 max-w-xs">
              Gestionează arendatorii, contractele, parcelele dintr-un singur loc.
            </p>
            <button
              onClick={() => router.push('/arendatori/nou')}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Adaugă arendator
            </button>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard label="Arendatori activi"           value={dash ?? s.lessorsTotal}         icon={Users}          iconBg="bg-green-100"   iconColor="text-green-600" />
        <StatCard label="Contracte active"            value={dash ?? s.contractsActive}       icon={FileText}       iconBg="bg-blue-100"    iconColor="text-blue-600" />
        <StatCard label="Contracte ce expiră (30 zile)" value={dash ?? s.contractsExpiring}  icon={Clock}          iconBg="bg-amber-100"   iconColor="text-amber-600" />
        <StatCard label="Parcele înregistrate"        value={dash ?? s.parcelsTotal}          icon={MapPin}         iconBg="bg-violet-100"  iconColor="text-violet-600"
          sub={loading ? undefined : `Suprafață totală: ${s.surfaceTotal} ha`} />
        <StatCard label="Tranzacții neplătite"         value={dash ?? s.paymentsOverdue}       icon={AlertTriangle}  iconBg="bg-red-100"     iconColor="text-red-500"
          sub={loading ? undefined : `${s.paymentsOverdueAmount} RON total neplătit`} />
        <StatCard label="Valoare neplătită (RON)"       value={dash ?? s.paymentsOverdueAmount} icon={CreditCard}     iconBg="bg-sky-100"     iconColor="text-sky-600" />
      </div>

      {/* Campaign Progress Widget */}
      {campaignWidget && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-xl"><Wheat className="w-5 h-5 text-green-700" /></div>
              <div>
                <div className="text-xs text-green-600 font-semibold uppercase tracking-wide">{campaignWidget.year}</div>
                <div className="text-base font-bold text-gray-800">{campaignWidget.name}</div>
              </div>
            </div>
            <a href={`/campanie/${campaignWidget.year}`}
              className="flex items-center gap-1 text-xs text-brand-600 border border-brand-200 px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors">
              Deschide <ArrowRight className="w-3 h-3" />
            </a>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                <span>Planuri culturi</span>
                <span className="font-medium text-gray-700">{campaignWidget.plannedParcels} / {campaignWidget.totalParcels} parcele</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-brand-500 rounded-full transition-all"
                  style={{ width: `${campaignWidget.totalParcels ? (campaignWidget.plannedParcels / campaignWidget.totalParcels) * 100 : 0}%` }} />
              </div>
            </div>
            {campaignWidget.harvestedParcels > 0 && (
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span>Recoltat</span>
                  <span className="font-medium text-gray-700">{campaignWidget.harvestedParcels} / {campaignWidget.plannedParcels} parcele planificate</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full transition-all"
                    style={{ width: `${campaignWidget.plannedParcels ? (campaignWidget.harvestedParcels / campaignWidget.plannedParcels) * 100 : 0}%` }} />
                </div>
              </div>
            )}
            {campaignWidget.opsTotal > 0 && (
              <div>
                <div className="flex justify-between text-xs text-gray-500 mb-1.5">
                  <span>Activități câmp finalizate</span>
                  <span className="font-medium text-gray-700">{campaignWidget.opsFinished} / {campaignWidget.opsTotal} operații</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full transition-all"
                    style={{ width: `${(campaignWidget.opsFinished / campaignWidget.opsTotal) * 100}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
        <div className="text-sm font-semibold text-gray-700 mb-3">Acțiuni rapide</div>
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'Arendator nou', href: '/arendatori/nou', icon: Users },
            { label: 'Contract nou', href: '/contracte/nou', icon: FileText },
            { label: 'Parcelă nouă', href: '/parcele/nou', icon: MapPin },
            { label: 'Tranzacții', href: '/plati', icon: AlertTriangle },
            { label: 'Rapoarte', href: '/rapoarte', icon: BarChart3 },
          ].map(({ label, href, icon: Icon }) => (
            <button
              key={href}
              onClick={() => router.push(href)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:border-[#2d6a4f] hover:text-[#2d6a4f] transition-colors font-medium"
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Guided tour — runs once after onboarding completion */}
      <GuidedTour />
    </div>
  )
}
