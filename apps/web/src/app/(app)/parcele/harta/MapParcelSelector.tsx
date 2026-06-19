'use client'

// Loaded ONLY in the browser via dynamic(() => import(...), { ssr: false })
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import 'leaflet-draw'
import * as EsriLeaflet from 'esri-leaflet'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Search, MapPin, Trash2, Eye, Check, X, RefreshCw, Plus, Info, Layers, Pencil, Navigation, Tractor, Upload, Download, Move,
} from 'lucide-react'
import { area as turfArea } from '@turf/area'
import ImportWizardModal from './ImportWizardModal'
import type { ParsedFeature } from './ImportWizardModal'
import type { ParceleFitosanitar, GeoJSONPolygon, MapSearchResult, RegistryParcel } from '@/lib/parcele-types'
import {
  wgs84ToStereo70,
  stereo70ToLeaflet,
  ringWgs84ToStereo70,
  ringStereo70ToWgs84,
  calcAreaHaStereo70,
  centroidStereo70,
  isLikelyStereo70,
  fmtStereo70,
  fmtDeg,
} from '@/lib/stereo70'

// ─── Fix Leaflet marker icons in bundled environments ────────────────────────
function fixLeafletIcons() {
  const proto = L.Icon.Default.prototype as unknown as Record<string, unknown>
  delete proto._getIconUrl
  L.Icon.Default.mergeOptions({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  })
}

// ─── esri-leaflet ArcGIS dynamic layer factory ───────────────────────────────
// APIA and ANCPI are ArcGIS MapServer services, not GeoServer WMS.
// dynamicMapLayer makes requests directly from the user's browser to the ArcGIS
// export endpoint. <img> elements load cross-origin images without CORS headers,
// and the browser's certificate trust store handles Romanian government SSL certs
// (which fail in Node.js/Cloudflare edge due to missing intermediate CAs).
function createEsriLayer(url: string, opacity: number): EsriLeaflet.DynamicMapLayer {
  return EsriLeaflet.dynamicMapLayer({ url, opacity })
}

// ─── ArcGIS Layer catalogue ───────────────────────────────────────────────────
interface WmsLayerDef {
  id: string
  label: string
  sublabel: string
  color: 'blue' | 'green' | 'amber'
  url: string           // ArcGIS MapServer REST URL (no /WMSServer)
  defaultOpacity: number
  defaultVisible: boolean
  minZoom?: number
}

const WMS_LAYER_DEFS: WmsLayerDef[] = [
  {
    id: 'apia_lpis_2024',
    label: 'LPIS APIA',
    sublabel: 'APIA INSPIRE',
    color: 'green',
    // APIA INSPIRE ArcGIS MapServer — 2024 dataset (most current)
    url: 'https://inspire.apia.org.ro/network/rest/services/INSPIRE/LPIS_referinta_2024/MapServer',
    defaultOpacity: 0.55,
    defaultVisible: false,
    minZoom: 12,
  },
]

type LegendItem = {
  id: string
  label: string
  color: string
}

const DEFAULT_LEGEND_ITEMS: LegendItem[] = [
  { id: 'grau', label: 'Grau', color: '#ef4444' },
  { id: 'porumb', label: 'Porumb', color: '#f59e0b' },
]

const OPERATION_TYPES = [
  { value: 'ARAT', label: 'Arat' },
  { value: 'DISCUIT', label: 'Discuit' },
  { value: 'GRAPAT', label: 'Grăpat' },
  { value: 'SEMANAT', label: 'Semănat' },
  { value: 'FERTILIZAT', label: 'Fertilizat' },
  { value: 'ERBICIDAT', label: 'Erbicidat' },
  { value: 'FUNGICIDAT', label: 'Fungicidat' },
  { value: 'INSECTICID', label: 'Insecticid' },
  { value: 'IRIGAT', label: 'Irigat' },
  { value: 'RECOLTAT', label: 'Recoltat' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'ALTELE', label: 'Altele' },
]

const STATUS_OPTS = [
  { value: 'PLANIFICAT', label: 'Planificat' },
  { value: 'IN_EXECUTIE', label: 'În execuție' },
  { value: 'FINALIZAT', label: 'Finalizat' },
  { value: 'ANULAT', label: 'Anulat' },
]

const INPUT_TYPES_MAP: Record<string, string> = {
  SEED: 'SAMANTA', FERTILIZER: 'INGRASAMANT', PPP: 'ERBICID', FUEL: 'CARBURANT', OTHER: 'ALTELE',
}

// ─── Nominatim address search ────────────────────────────────────────────────
async function searchNominatim(query: string): Promise<MapSearchResult[]> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=ro&addressdetails=1`,
      { headers: { 'Accept-Language': 'ro' } },
    )
    if (!res.ok) {
      console.error(`Nominatim API error: ${res.status} ${res.statusText}`)
      return []
    }
    const data = await res.json() as Array<{
      lat: string; lon: string; display_name: string
      address?: { county?: string; state?: string; city?: string; town?: string; village?: string }
    }>
    return data.map(r => ({
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      display_name: r.display_name,
      judet: r.address?.county ?? r.address?.state ?? '',
      localitate: r.address?.city ?? r.address?.town ?? r.address?.village ?? '',
    }))
  } catch (err) {
    console.error('Nominatim fetch error:', err)
    return []
  }
}

async function reverseGeocode(lat: number, lng: number) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
    { headers: { 'Accept-Language': 'ro' } },
  )
  const d = await res.json() as {
    display_name?: string
    address?: { county?: string; state?: string; city?: string; town?: string; village?: string }
  }
  return {
    judet: d.address?.county ?? d.address?.state ?? '',
    localitate: d.address?.city ?? d.address?.town ?? d.address?.village ?? '',
    adresa: d.display_name ?? '',
  }
}

// ─── Props ───────────────────────────────────────────────────────────────────
export interface MapParcelSelectorProps {
  mode?: 'modal' | 'inline'
  onParcelSelected?: (parcel: ParceleFitosanitar) => void
  initialParcelId?: string
  showList?: boolean
  height?: string
  allowDraw?: boolean
  initialCenter?: [number, number]  // WGS84 [lat, lng]
  initialZoom?: number
}

// ─── Coordinate badge ─────────────────────────────────────────────────────────
function CoordBadge({ ring }: { ring: number[][] }) {
  const [cx, cy] = centroidStereo70(ring)
  const [lat, lng] = stereo70ToLeaflet(cx, cy)
  const area = calcAreaHaStereo70(ring)
  return (
    <div className="mt-2 p-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs font-mono space-y-1">
      <div className="font-semibold text-blue-800 text-[11px] uppercase tracking-wide mb-1.5">
        Stereo 70 (EPSG:3844)
      </div>
      <div className="flex justify-between text-blue-700">
        <span>X:</span><span>{fmtStereo70(cx)} m</span>
      </div>
      <div className="flex justify-between text-blue-700">
        <span>Y:</span><span>{fmtStereo70(cy)} m</span>
      </div>
      <div className="border-t border-blue-200 my-1.5" />
      <div className="font-semibold text-gray-600 text-[11px] uppercase tracking-wide mb-1">
        WGS84 (EPSG:4326)
      </div>
      <div className="flex justify-between text-gray-600">
        <span>Lat:</span><span>{fmtDeg(lat)}</span>
      </div>
      <div className="flex justify-between text-gray-600">
        <span>Lng:</span><span>{fmtDeg(lng)}</span>
      </div>
      <div className="border-t border-blue-200 my-1.5" />
      <div className="flex justify-between font-bold text-green-700">
        <span>Suprafata (plan Stereo 70):</span><span>{area} ha</span>
      </div>
    </div>
  )
}

// ─── WMS layer color helper ───────────────────────────────────────────────────
function layerColors(color: WmsLayerDef['color']) {
  const map = {
    blue:  { bg: 'bg-blue-50',  border: 'border-blue-200',  text: 'text-blue-700',  dot: 'bg-blue-500',  toggle: 'bg-blue-500'  },
    green: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700', dot: 'bg-green-500', toggle: 'bg-green-500' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-500', toggle: 'bg-amber-500' },
  }
  return map[color]
}

function makeLegendId(label: string) {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `legend-${Date.now()}`
}

// ─── Geometry helpers ─────────────────────────────────────────────────────────
function pointInPolygon(x: number, y: number, ring: number[][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1]
    const xj = ring[j][0], yj = ring[j][1]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/** Returns a point guaranteed to be inside the polygon ring (Stereo 70 coords). */
function safeCenterStereo70(ring: number[][]): [number, number] {
  const [cx, cy] = centroidStereo70(ring)
  if (pointInPolygon(cx, cy, ring)) return [cx, cy]
  // Fallback: bounding-box centre (always in the bounding box)
  const xs = ring.map(p => p[0])
  const ys = ring.map(p => p[1])
  return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]
}

function sanitizeColor(color: string): string {
  return /^#[0-9a-fA-F]{3,8}$/.test(color) ? color : '#22c55e'
}

function makeCentreIcon(color: string): L.DivIcon {
  const c = sanitizeColor(color)
  return L.divIcon({
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 26 34"><path d="M13 0C5.82 0 0 5.82 0 13c0 9.75 13 21 13 21S26 22.75 26 13C26 5.82 20.18 0 13 0z" fill="${c}" stroke="white" stroke-width="2"/><circle cx="13" cy="13" r="5" fill="white" opacity="0.9"/></svg>`,
    iconSize: [26, 34],
    iconAnchor: [13, 34],
  })
}

function makeRegistryIcon(color: string): L.DivIcon {
  const c = sanitizeColor(color)
  return L.divIcon({
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22"><circle cx="11" cy="11" r="9" fill="${c}" stroke="white" stroke-width="2.5"/><circle cx="11" cy="11" r="4" fill="white"/></svg>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })
}

// ─── Parcel details popup ─────────────────────────────────────────────────────
function ParcelMapPopup({ parcel, onClose, onRegisterActivity }: { parcel: RegistryParcel; onClose: () => void; onRegisterActivity?: () => void }) {
  const statusColors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-700 border-green-200',
    INACTIVE: 'bg-gray-100 text-gray-600 border-gray-200',
    EXPIRED: 'bg-orange-100 text-orange-600 border-orange-200',
  }
  return (
    <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden w-72">
      {/* Header */}
      <div className="px-4 py-3 bg-green-800 text-white flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-bold text-base truncate">{parcel.bloc_fizic || 'Parcelă'}</div>
          {(parcel.parcel_nr || parcel.tarla_nr) && (
            <div className="text-xs text-green-200 mt-0.5">
              {[parcel.parcel_nr && `Nr. ${parcel.parcel_nr}`, parcel.tarla_nr && `Tarla ${parcel.tarla_nr}`].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        <button onClick={onClose} className="p-1 hover:bg-green-700 rounded flex-shrink-0 mt-0.5 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      {/* Body */}
      <div className="px-4 py-3 space-y-2">
        {(parcel.locality || parcel.county) && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span>{[parcel.locality, parcel.county].filter(Boolean).join(', ')}</span>
          </div>
        )}
        {parcel.culture && (
          <div className="flex items-center gap-2 text-sm">
            <span>🌾</span>
            <span className="text-green-700 font-medium">{parcel.culture}</span>
          </div>
        )}
        {parcel.lessor_name && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>👤</span>
            <span>{parcel.lessor_name}</span>
          </div>
        )}
        {parcel.apia_eligible && (
          <div className="flex items-center gap-2 text-sm text-green-600">
            <Check className="w-3.5 h-3.5 flex-shrink-0" />
            <span>APIA Eligibil</span>
          </div>
        )}
      </div>
      {/* Footer */}
      <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
        {parcel.status ? (
          <span className={`text-xs font-semibold px-2 py-1 rounded border ${statusColors[parcel.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
            {parcel.status}
          </span>
        ) : <span />}
        {parcel.surface != null && (
          <span className="text-sm font-bold text-gray-800">{Number(parcel.surface).toFixed(2)} HA</span>
        )}
      </div>
      {parcel.contract_number && (
        <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-1.5 text-xs">
          <span className="text-gray-500">Contract:</span>
          <a
            href={parcel.contract_id ? `/contracte/${parcel.contract_id}` : '#'}
            className="text-green-700 font-semibold hover:underline"
          >
            {parcel.contract_number}
          </a>
          {parcel.contract_end_date && (
            <span className="text-gray-400">· exp. {parcel.contract_end_date}</span>
          )}
        </div>
      )}
      {onRegisterActivity && (
        <div className="px-4 py-3 border-t border-gray-100">
          <button
            onClick={onRegisterActivity}
            className="w-full py-2.5 text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <Tractor className="w-4 h-4" />
            Înregistrare activitate
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Parcel list item ─────────────────────────────────────────────────────────
function ParcelItem({
  parcel, isSelected, onView, onDelete, onEdit, onEditGeometry, onSelect, legendLabel, legendColor,
}: {
  parcel: ParceleFitosanitar
  isSelected: boolean
  onView: () => void
  onDelete: () => void
  onEdit: () => void
  onEditGeometry: () => void
  onSelect?: () => void
  legendLabel?: string
  legendColor?: string
}) {
  const ring = parcel.geometry_geojson?.coordinates?.[0] ?? []
  const isStereo = ring.length > 0 && isLikelyStereo70(ring[0])
  return (
    <div className={`p-3 rounded-lg border transition-all ${isSelected
      ? 'border-blue-500 bg-blue-50 shadow-sm'
      : 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-50'}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-gray-800 truncate">{parcel.nume_parcela}</div>
          {(parcel.localitate || parcel.judet) && (
            <div className="text-xs text-gray-500 mt-0.5 truncate">
              {[parcel.localitate, parcel.judet].filter(Boolean).join(', ')}
            </div>
          )}
          <div className="flex items-center gap-2 mt-1">
            {parcel.suprafata_ha != null && (
              <span className="text-xs font-semibold text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                {Number(parcel.suprafata_ha).toFixed(2)} ha
              </span>
            )}
            {legendLabel && (
              <span className="text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: legendColor ?? '#22c55e' }} />
                {legendLabel}
              </span>
            )}
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${isStereo
              ? 'text-blue-600 bg-blue-50 border-blue-200'
              : 'text-orange-600 bg-orange-50 border-orange-200'}`}>
              {isStereo ? 'Stereo 70' : 'WGS84'}
            </span>
          </div>
          <div className="text-xs text-gray-400 mt-1">
            {new Date(parcel.created_at).toLocaleDateString('ro-RO')}
          </div>
        </div>
        <div className="flex flex-col gap-0.5 flex-shrink-0">
          <button onClick={onView} title="Vizualizează pe hartă"
            className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors">
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button onClick={onEdit} title="Editează parcela"
            className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={onEditGeometry} title="Editează geometria (mută vârfurile)"
            className="p-1.5 text-gray-400 hover:text-amber-600 rounded hover:bg-amber-50 transition-colors">
            <Move className="w-3.5 h-3.5" />
          </button>
          {onSelect && (
            <button onClick={onSelect} title="Selecteaza"
              className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50 transition-colors">
              <Check className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onDelete} title="Sterge"
            className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Quick Activity Modal (launched from map parcel popup) ───────────────────
interface QuickActivityModalProps {
  parcelId: string | null
  parcelName: string
  parcelSurface?: number | null
  onClose: () => void
}

function QuickActivityModal({ parcelId, parcelName, parcelSurface, onClose }: QuickActivityModalProps) {
  const [campaign, setCampaign] = useState<{ id: string; name: string; year: number } | null>(null)
  const [machines, setMachines] = useState<{ id: string; name: string; type: string }[]>([])
  const [parcelsForSelect, setParcelsForSelect] = useState<{ id: string; bloc_fizic: string | null; locality: string | null; surface: number }[]>([])
  const [inventoryLots, setInventoryLots] = useState<{ id: string; product_name: string; unit: string; category: string; quantity_available: number; unit_price: number | null }[]>([])
  const [form, setForm] = useState({
    parcel_id: parcelId ?? '',
    operation_type: 'SEMANAT',
    machine_id: '',
    planned_date: new Date().toISOString().split('T')[0],
    area_ha: parcelSurface != null ? String(parcelSurface) : '',
    status: 'FINALIZAT',
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [showMaterials, setShowMaterials] = useState(false)
  const [materials, setMaterials] = useState<Array<{ lot_id: string; product_name: string; quantity: string; unit: string; input_type: string; cost_per_unit: string }>>([])
  const [matForm, setMatForm] = useState({ lot_id: '', product_name: '', quantity: '', unit: 'kg', input_type: 'SAMANTA', cost_per_unit: '' })

  useEffect(() => {
    const db = createClient()
    db.from('campaigns').select('id,name,year').order('year', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { if (data) setCampaign(data as { id: string; name: string; year: number }) })
    db.from('machines').select('id,name,type').eq('is_active', true).order('name')
      .then(({ data }) => { if (data) setMachines(data as { id: string; name: string; type: string }[]) })
    db.from('input_lots').select('id,product_name,unit,category,quantity_available,unit_price').gt('quantity_available', 0).order('product_name')
      .then(({ data }) => { if (data) setInventoryLots(data as { id: string; product_name: string; unit: string; category: string; quantity_available: number; unit_price: number | null }[]) })
    if (!parcelId) {
      db.from('parcels').select('id,bloc_fizic,locality,surface').eq('status', 'ACTIVE').order('bloc_fizic')
        .then(({ data }) => { if (data) setParcelsForSelect(data as { id: string; bloc_fizic: string | null; locality: string | null; surface: number }[]) })
    }
  }, [parcelId])

  function addMaterial() {
    if (!matForm.product_name.trim() || !matForm.quantity) return
    setMaterials(prev => [...prev, { ...matForm }])
    setMatForm({ lot_id: '', product_name: '', quantity: '', unit: 'kg', input_type: 'SAMANTA', cost_per_unit: '' })
  }

  async function handleSave(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!campaign) { toast.error('Nu s-a putut detecta campania activă.'); return }
    setSaving(true)
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) { toast.error('Neautentificat.'); setSaving(false); return }
    const today = form.planned_date || new Date().toISOString().split('T')[0]
    const { data: wo, error } = await db.from('work_orders').insert({
      user_id: user.id,
      campaign_id: campaign.id,
      parcel_id: form.parcel_id || null,
      machine_id: form.machine_id || null,
      operation_type: form.operation_type,
      planned_date: today,
      executed_date: form.status === 'FINALIZAT' ? today : null,
      area_ha: form.area_ha ? parseFloat(form.area_ha) : null,
      status: form.status,
      notes: form.notes || null,
    }).select('id').single()
    if (error || !wo) { toast.error(error?.message ?? 'Eroare la salvare.'); setSaving(false); return }

    for (const mat of materials) {
      const { error: iErr } = await db.from('work_order_inputs').insert({
        user_id: user.id,
        work_order_id: wo.id,
        input_type: mat.input_type,
        product_name: mat.product_name.trim(),
        quantity: parseFloat(mat.quantity),
        unit: mat.unit,
        cost_per_unit: mat.cost_per_unit ? parseFloat(mat.cost_per_unit) : null,
        lot_id: mat.lot_id || null,
      })
      if (!iErr && mat.lot_id) {
        await db.from('input_stock_mvt').insert({
          user_id: user.id,
          lot_id: mat.lot_id,
          work_order_id: wo.id,
          campaign_id: campaign.id,
          mvt_type: 'OUT',
          quantity: parseFloat(mat.quantity),
          mvt_date: today,
          notes: `Consum campanie: ${mat.product_name.trim()}`,
        })
      }
    }
    setSaving(false)
    toast.success('Activitate înregistrată în campanie!')
    onClose()
  }

  const inputCls = 'w-full px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500'
  const labelCls = 'block text-xs font-medium text-gray-700 mb-1'

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
              <Tractor className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-800">Înregistrare activitate</h2>
              <p className="text-xs text-gray-500 truncate max-w-[220px]">{parcelName || 'Selectează parcela'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {campaign && (
          <div className="mx-5 mt-3 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700 flex items-center gap-2 flex-shrink-0">
            <Check className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Campania: <strong>{campaign.name}</strong></span>
          </div>
        )}

        <form onSubmit={e => void handleSave(e)} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {!parcelId && (
            <div>
              <label className={labelCls}>Parcelă *</label>
              <select className={inputCls} required value={form.parcel_id} onChange={e => {
                const p = parcelsForSelect.find(x => x.id === e.target.value)
                setForm(f => ({ ...f, parcel_id: e.target.value, area_ha: p ? String(p.surface) : f.area_ha }))
              }}>
                <option value="">— Selectează parcela —</option>
                {parcelsForSelect.map(p => (
                  <option key={p.id} value={p.id}>{p.bloc_fizic ?? p.id.slice(0, 8)}{p.locality ? ` — ${p.locality}` : ''}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tip operație *</label>
              <select className={inputCls} required value={form.operation_type}
                onChange={e => setForm(f => ({ ...f, operation_type: e.target.value }))}>
                {OPERATION_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select className={inputCls} value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Dată</label>
              <input className={inputCls} type="date" value={form.planned_date}
                onChange={e => setForm(f => ({ ...f, planned_date: e.target.value || new Date().toISOString().split('T')[0] }))} />
            </div>
            <div>
              <label className={labelCls}>Suprafață (ha)</label>
              <input className={inputCls} type="number" step="0.01" min="0" placeholder="ha"
                value={form.area_ha} onChange={e => setForm(f => ({ ...f, area_ha: e.target.value }))} />
            </div>
          </div>

          {machines.length > 0 && (
            <div>
              <label className={labelCls}>Utilaj</label>
              <select className={inputCls} value={form.machine_id}
                onChange={e => setForm(f => ({ ...f, machine_id: e.target.value }))}>
                <option value="">— Fără utilaj —</option>
                {machines.map(m => <option key={m.id} value={m.id}>{m.name} ({m.type})</option>)}
              </select>
            </div>
          )}

          <div>
            <label className={labelCls}>Observații</label>
            <input className={inputCls} placeholder="Opțional..." value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          <div>
            <button type="button" onClick={() => setShowMaterials(v => !v)}
              className="flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-800 transition-colors">
              <Plus className="w-4 h-4" />
              {showMaterials ? 'Ascunde materiale' : 'Adaugă materiale consumate'}
            </button>
          </div>

          {showMaterials && (
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              {materials.length > 0 && (
                <div className="space-y-2 pb-2 border-b border-gray-100">
                  {materials.map((m, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <span className="text-gray-700 font-medium">{m.product_name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">{m.quantity} {m.unit}</span>
                        <button type="button" onClick={() => setMaterials(prev => prev.filter((_, j) => j !== i))}
                          className="text-gray-300 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {inventoryLots.length > 0 && (
                <div>
                  <label className={labelCls}>Din inventar</label>
                  <select className={inputCls} value={matForm.lot_id} onChange={e => {
                    const lot = inventoryLots.find(l => l.id === e.target.value)
                    if (lot) setMatForm(f => ({ ...f, lot_id: lot.id, product_name: lot.product_name, unit: lot.unit, input_type: INPUT_TYPES_MAP[lot.category] ?? 'ALTELE', cost_per_unit: lot.unit_price != null ? String(lot.unit_price) : '' }))
                    else setMatForm(f => ({ ...f, lot_id: '' }))
                  }}>
                    <option value="">— Selectează din stoc —</option>
                    {inventoryLots.map(l => (
                      <option key={l.id} value={l.id}>{l.product_name} ({l.quantity_available} {l.unit})</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className={labelCls}>Produs *</label>
                  <input className={inputCls} placeholder="ex: Uree" value={matForm.product_name}
                    onChange={e => setMatForm(f => ({ ...f, product_name: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Cantitate *</label>
                  <div className="flex gap-1">
                    <input className="flex-1 px-3 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none" type="number" step="0.01" placeholder="0"
                      value={matForm.quantity} onChange={e => setMatForm(f => ({ ...f, quantity: e.target.value }))} />
                    <select className="px-2 text-sm border border-gray-300 rounded-lg focus:outline-none" value={matForm.unit}
                      onChange={e => setMatForm(f => ({ ...f, unit: e.target.value }))}>
                      {['kg', 'L', 't', 'buc'].map(u => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <button type="button" onClick={addMaterial} disabled={!matForm.product_name.trim() || !matForm.quantity}
                className="w-full py-2 text-sm bg-brand-50 border border-brand-200 text-brand-700 rounded-lg hover:bg-brand-100 disabled:opacity-50 font-medium transition-colors">
                + Adaugă material
              </button>
            </div>
          )}

          <div className="sticky bottom-0 bg-white pt-2 pb-2">
            <button type="submit" disabled={saving || !campaign}
              className="w-full py-3.5 text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
              {saving
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Se salvează...</>
                : <><Check className="w-4 h-4" />Înregistrează activitatea</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function MapParcelSelector({
  mode = 'modal',
  onParcelSelected,
  initialParcelId,
  showList = true,
  height = '500px',
  allowDraw = true,
  initialCenter = [45.9432, 24.9668],
  initialZoom = 7,
}: MapParcelSelectorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null)
  const parcelLayersRef = useRef<Map<string, L.GeoJSON>>(new Map())
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Live esri-leaflet DynamicMapLayer instances keyed by layer id
  const wmsLayerRefs = useRef<Map<string, EsriLeaflet.DynamicMapLayer>>(new Map())
  // Centre-pin markers and registry markers (not inside drawnItems)
  const centreMarkersGroupRef = useRef<L.LayerGroup | null>(null)
  const registryMarkersGroupRef = useRef<L.LayerGroup | null>(null)
  // Import wizard preview layer — stored as FeatureGroup so we can enable vertex editing
  const importPreviewLayerRef = useRef<L.FeatureGroup | null>(null)

  const [parcels, setParcels] = useState<ParceleFitosanitar[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(initialParcelId ?? null)
  const [registryParcels, setRegistryParcels] = useState<RegistryParcel[]>([])
  const [popupParcel, setPopupParcel] = useState<RegistryParcel | null>(null)
  const [popupRegistryParcelId, setPopupRegistryParcelId] = useState<string | null>(null)
  const [showActivityModal, setShowActivityModal] = useState(false)

  // Import wizard
  const [showImportWizard, setShowImportWizard] = useState(false)
  const [importPreviewFC, setImportPreviewFC] = useState<{ fc: GeoJSON.FeatureCollection; features: ParsedFeature[] } | null>(null)
  const [importEditMode, setImportEditMode] = useState(false)

  // Drawing — ring stored in Stereo 70
  const [drawnRingStereo, setDrawnRingStereo] = useState<number[][] | null>(null)
  const [showSaveModal, setShowSaveModal] = useState(false)

  // Save form
  const [saveName, setSaveName] = useState('')
  const [saveLocalitate, setSaveLocalitate] = useState('')
  const [saveJudet, setSaveJudet] = useState('')
  const [saveAdresa, setSaveAdresa] = useState('')
  const [saveNote, setSaveNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveLinkedParcelId, setSaveLinkedParcelId] = useState<string>('')
  const [linkedParcelOptions, setLinkedParcelOptions] = useState<{ id: string; label: string }[]>([])

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Edit
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editLocalitate, setEditLocalitate] = useState('')
  const [editJudet, setEditJudet] = useState('')
  const [editNote, setEditNote] = useState('')
  const [editLegendId, setEditLegendId] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  // Geometry editing of existing parcel
  const [geoEditId, setGeoEditId] = useState<string | null>(null)
  const geoEditLayerRef = useRef<L.Polygon | null>(null)

  // Address search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<MapSearchResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

  // Cursor coordinates
  const [cursorWgs84, setCursorWgs84] = useState<{ lat: number; lng: number } | null>(null)
  const [cursorStereo, setCursorStereo] = useState<{ x: number; y: number } | null>(null)

  // WMS layer panel
  const [showLayerPanel, setShowLayerPanel] = useState(false)
  const [wmsLayerState, setWmsLayerState] = useState<Record<string, { visible: boolean; opacity: number }>>(
    () => Object.fromEntries(
      WMS_LAYER_DEFS.map(d => [d.id, { visible: d.defaultVisible, opacity: d.defaultOpacity }])
    )
  )
  const [wmsLayerErrors, setWmsLayerErrors] = useState<Record<string, boolean>>({})
  const [legendItems, setLegendItems] = useState<LegendItem[]>(DEFAULT_LEGEND_ITEMS)
  const [parcelLegendMap, setParcelLegendMap] = useState<Record<string, string>>({})
  const [saveLegendId, setSaveLegendId] = useState(DEFAULT_LEGEND_ITEMS[0].id)
  const [showLegendAdd, setShowLegendAdd] = useState(false)
  const [newLegendLabel, setNewLegendLabel] = useState('')
  const [newLegendColor, setNewLegendColor] = useState('#22c55e')
  const [showCulturePicker, setShowCulturePicker] = useState(false)

  useEffect(() => {
    try {
      const rawLegend = localStorage.getItem('map_legend_items')
      const rawParcelLegend = localStorage.getItem('map_parcel_legend_map')
      if (rawLegend) {
        const parsed = JSON.parse(rawLegend) as LegendItem[]
        if (Array.isArray(parsed) && parsed.length > 0) setLegendItems(parsed)
      }
      if (rawParcelLegend) {
        const parsed = JSON.parse(rawParcelLegend) as Record<string, string>
        if (parsed && typeof parsed === 'object') setParcelLegendMap(parsed)
      }
    } catch {
      // ignore localStorage parsing errors
    }
    // Also load from Supabase user metadata (persisted across devices)
    createClient().auth.getUser().then(({ data }) => {
      const meta = data?.user?.user_metadata
      if (meta?.map_legend_items && Array.isArray(meta.map_legend_items) && meta.map_legend_items.length > 0) {
        setLegendItems(meta.map_legend_items as LegendItem[])
        localStorage.setItem('map_legend_items', JSON.stringify(meta.map_legend_items))
      }
    }).catch(() => { /* ignore */ })
  }, [])

  useEffect(() => {
    localStorage.setItem('map_legend_items', JSON.stringify(legendItems))
    // Persist to Supabase user metadata (debounced — only after first user change)
    const t = setTimeout(() => {
      createClient().auth.updateUser({ data: { map_legend_items: legendItems } }).catch(() => { /* ignore */ })
    }, 1500)
    return () => clearTimeout(t)
  }, [legendItems])

  useEffect(() => {
    localStorage.setItem('map_parcel_legend_map', JSON.stringify(parcelLegendMap))
  }, [parcelLegendMap])

  useEffect(() => {
    if (!legendItems.some(item => item.id === saveLegendId) && legendItems[0]) {
      setSaveLegendId(legendItems[0].id)
    }
  }, [legendItems, saveLegendId])

  // ── Init Leaflet map ────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return
    fixLeafletIcons()

    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      zoomControl: true,
    })

    // Base layers
    const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    })
    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { attribution: '© Esri World Imagery', maxZoom: 19 },
    )
    const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenTopoMap', maxZoom: 17,
    })
    satellite.addTo(map)
    L.control.layers(
      { Satelit: satellite, OpenStreetMap: osm, Teren: topo },
      {},
      { position: 'topright' },
    ).addTo(map)

    // Build esri-leaflet ArcGIS dynamic layers (browser-direct, no proxy)
    WMS_LAYER_DEFS.forEach(def => {
      const layer = createEsriLayer(def.url, def.defaultOpacity)
      // Error / load tracking
      let errorFired = false
      layer.on('loaderror', () => {
        if (!errorFired) {
          errorFired = true
          setWmsLayerErrors(prev => ({ ...prev, [def.id]: true }))
        }
      })
      layer.on('load', () => {
        setWmsLayerErrors(prev => {
          if (!prev[def.id]) return prev
          return { ...prev, [def.id]: false }
        })
      })
      if (def.defaultVisible) layer.addTo(map)
      wmsLayerRefs.current.set(def.id, layer)
    })

    // Cursor coordinate tracker → realtime Stereo 70 conversion
    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      setCursorWgs84({ lat: e.latlng.lat, lng: e.latlng.lng })
      const [x, y] = wgs84ToStereo70(e.latlng.lng, e.latlng.lat)
      setCursorStereo({ x, y })
    })
    map.on('mouseout', () => { setCursorWgs84(null); setCursorStereo(null) })

    // Separate layer-groups so markers are never inside the editable featureGroup
    const centreMarkersGroup = L.layerGroup().addTo(map)
    centreMarkersGroupRef.current = centreMarkersGroup
    const registryMarkersGroup = L.layerGroup().addTo(map)
    registryMarkersGroupRef.current = registryMarkersGroup

    // Draw controls
    if (allowDraw) {
      const drawnItems = new L.FeatureGroup()
      map.addLayer(drawnItems)
      drawnItemsRef.current = drawnItems
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const DrawControl = (L as any).Control.Draw
      const drawControl = new DrawControl({
        position: 'topleft',
        draw: {
          polygon: {
            allowIntersection: false,
            showArea: true,
            shapeOptions: { color: '#16a34a', fillColor: '#16a34a', fillOpacity: 0.25, weight: 2 },
          },
          polyline: false, rectangle: false, circle: false, circlemarker: false, marker: false,
        },
        edit: { featureGroup: drawnItems },
      })
      map.addControl(drawControl)

      map.on('draw:created', async (e: L.LeafletEvent) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const layer = (e as any).layer as L.Polygon
        drawnItems.clearLayers()
        drawnItems.addLayer(layer)
        const geo = layer.toGeoJSON() as GeoJSON.Feature<GeoJSON.Polygon>
        const ringStereo = ringWgs84ToStereo70(geo.geometry.coordinates[0])
        setDrawnRingStereo(ringStereo)
        const center = layer.getBounds().getCenter()
        try {
          const addr = await reverseGeocode(center.lat, center.lng)
          setSaveJudet(addr.judet)
          setSaveLocalitate(addr.localitate)
          setSaveAdresa(addr.adresa)
        } catch { /* non-blocking */ }
        setSaveName('')
        setSaveNote('')
        setSaveLinkedParcelId('')
        // Load linkable parcels from parcels table
        createClient()
          .from('parcels')
          .select('id, bloc_fizic, tarla_nr, parcel_nr, lessors(first_name, last_name, company_name, type)')
          .order('created_at', { ascending: false })
          .limit(200)
          .then(({ data }) => {
            if (data) {
              setLinkedParcelOptions((data as any[]).map(p => {
                const ref = [p.bloc_fizic, p.tarla_nr, p.parcel_nr].filter(Boolean).join('/')
                const lessor = p.lessors
                  ? (p.lessors.type === 'LEGAL' ? p.lessors.company_name : `${p.lessors.last_name} ${p.lessors.first_name}`.trim())
                  : ''
                return { id: p.id, label: [ref, lessor].filter(Boolean).join(' — ') || p.id.slice(0, 8) }
              }))
            }
          })
        setShowSaveModal(true)
      })

      // Handle edits on the in-progress (unsaved) drawing
      map.on('draw:edited', (e: L.LeafletEvent) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const layers = (e as any).layers as L.FeatureGroup
        layers.eachLayer((layer: L.Layer) => {
          const geo = (layer as L.Polygon).toGeoJSON() as GeoJSON.Feature<GeoJSON.Polygon>
          const ringStereo = ringWgs84ToStereo70(geo.geometry.coordinates[0])
          setDrawnRingStereo(ringStereo)
        })
      })
      // Handle deletion of the in-progress (unsaved) drawing
      map.on('draw:deleted', () => {
        setDrawnRingStereo(null)
        setShowSaveModal(false)
      })
    }

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      drawnItemsRef.current = null
      centreMarkersGroupRef.current = null
      registryMarkersGroupRef.current = null
      wmsLayerRefs.current.clear()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Sync WMS visibility + opacity → Leaflet ─────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    WMS_LAYER_DEFS.forEach(def => {
      const layer = wmsLayerRefs.current.get(def.id)
      if (!layer) return
      const { visible, opacity } = wmsLayerState[def.id]
      layer.setOpacity(opacity)
      if (visible && !map.hasLayer(layer)) {
        layer.addTo(map)
      } else if (!visible && map.hasLayer(layer)) {
        map.removeLayer(layer)
      }
    })
  }, [wmsLayerState])

  // ── Load parcels ────────────────────────────────────────────────────────
  const loadParcels = useCallback(async () => {
    setLoading(true)
    const db = createClient()
    const { data, error } = await db
      .from('parcele_fitosanitar')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) toast.error('Eroare la incarcare: ' + error.message)
    else setParcels((data ?? []) as ParceleFitosanitar[])
    setLoading(false)
  }, [])

  useEffect(() => { void loadParcels() }, [loadParcels])

  // ── Load registry parcels (parcels table with GPS coords) ───────────────
  const loadRegistryParcels = useCallback(async () => {
    const db = createClient()
    const { data } = await db
      .from('parcels')
      .select('id, bloc_fizic, tarla_nr, parcel_nr, county, locality, surface, status, culture, apia_eligible, lat, lng, contract_id, lessors(first_name, last_name, company_name, type), contracts(contract_number, end_date)')
      .not('lat', 'is', null)
      .not('lng', 'is', null)
    if (data) {
      setRegistryParcels((data as any[]).map(p => {
        const lessor = p.lessors
          ? (p.lessors.type === 'LEGAL'
            ? p.lessors.company_name
            : `${p.lessors.last_name ?? ''} ${p.lessors.first_name ?? ''}`.trim())
          : null
        return {
          id: p.id, bloc_fizic: p.bloc_fizic, tarla_nr: p.tarla_nr, parcel_nr: p.parcel_nr,
          county: p.county, locality: p.locality, surface: p.surface, status: p.status,
          culture: p.culture, apia_eligible: p.apia_eligible, lat: p.lat, lng: p.lng,
          contract_id: p.contract_id, lessor_name: lessor,
          contract_number: (p.contracts as any)?.contract_number ?? null,
          contract_end_date: (p.contracts as any)?.end_date ?? null,
        } as RegistryParcel
      }))
    }
  }, [])

  useEffect(() => { void loadRegistryParcels() }, [loadRegistryParcels])

  // ── Render parcel polygons + centre-pin markers ─────────────────────────
  useEffect(() => {
    const map = mapRef.current
    const centreGroup = centreMarkersGroupRef.current
    if (!map) return
    parcelLayersRef.current.forEach(l => map.removeLayer(l))
    parcelLayersRef.current.clear()
    if (centreGroup) centreGroup.clearLayers()
    parcels.forEach(parcel => {
      const ring = parcel.geometry_geojson?.coordinates?.[0]
      if (!ring || ring.length < 3) return
      const ringWgs84 = isLikelyStereo70(ring[0]) ? ringStereo70ToWgs84(ring) : ring
      const ringStereo = isLikelyStereo70(ring[0]) ? ring : ringWgs84ToStereo70(ring)
      const isSelected = parcel.id === selectedId
      const legendId = parcelLegendMap[parcel.id]
      const legend = legendItems.find(item => item.id === legendId)
      const parcelColor = legend?.color ?? parcel.cultura_color ?? '#22c55e'
      const layer = L.geoJSON(
        { type: 'Polygon', coordinates: [ringWgs84] } as GeoJSON.GeoJsonObject,
        {
          style: {
            color: isSelected ? '#1d4ed8' : parcelColor,
            fillColor: isSelected ? '#3b82f6' : parcelColor,
            fillOpacity: isSelected ? 0.35 : 0.2,
            weight: isSelected ? 3 : 2,
          },
        },
      )
        .bindTooltip(parcel.nume_parcela, { sticky: true })
        .on('click', () => focusParcel(parcel))
      layer.addTo(map)
      parcelLayersRef.current.set(parcel.id, layer)
      // Centre-pin marker – uses point-in-polygon safe centroid
      if (centreGroup) {
        const [cx, cy] = safeCenterStereo70(ringStereo)
        const [cLat, cLng] = stereo70ToLeaflet(cx, cy)
        const centreMarker = L.marker([cLat, cLng], { icon: makeCentreIcon(sanitizeColor(parcelColor)) })
        centreMarker.on('click', () => {
          const linked = registryParcels.find(rp => rp.id === parcel.parcela_id)
          if (linked) {
            setPopupParcel(linked)
            setPopupRegistryParcelId(linked.id)
          } else {
            setPopupParcel({
              id: parcel.id,
              bloc_fizic: parcel.nume_parcela,
              locality: parcel.localitate ?? undefined,
              county: parcel.judet ?? undefined,
              surface: parcel.suprafata_ha ?? undefined,
              culture: parcel.cultura_label ?? undefined,
            })
            setPopupRegistryParcelId(null)
          }
        })
        centreGroup.addLayer(centreMarker)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcels, selectedId, parcelLegendMap, legendItems, registryParcels])

  // ── Render registry-parcel markers (parcels with coords but no polygon) ─
  useEffect(() => {
    const map = mapRef.current
    const regGroup = registryMarkersGroupRef.current
    if (!map || !regGroup) return
    regGroup.clearLayers()
    const linkedIds = new Set(parcels.map(p => p.parcela_id).filter(Boolean))
    registryParcels.forEach(rp => {
      if (!rp.lat || !rp.lng) return
      if (linkedIds.has(rp.id)) return  // polygon centre marker already covers this
      const marker = L.marker([rp.lat, rp.lng], { icon: makeRegistryIcon('#16a34a') })
      marker.bindTooltip(rp.bloc_fizic ?? rp.id.slice(0, 8), { sticky: true })
      marker.on('click', () => { setPopupParcel(rp); setPopupRegistryParcelId(rp.id) })
      regGroup.addLayer(marker)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registryParcels, parcels])

  // ── Import preview layer ────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Remove existing preview layer
    if (importPreviewLayerRef.current) {
      map.removeLayer(importPreviewLayerRef.current)
      importPreviewLayerRef.current = null
    }
    if (!importPreviewFC) return
    setImportEditMode(false)

    const { fc, features } = importPreviewFC
    const fg = new L.FeatureGroup()

    fc.features.forEach((feature, idx) => {
      const geom = feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon
      if (!geom) return
      const attrs = (feature.properties ?? {}) as Record<string, unknown>
      const parsed = features[idx]
      const name = String(attrs['BLOC_FIZIC'] ?? attrs['NR_PARCEL'] ?? attrs['COD_UNIC'] ?? `Parcelă ${idx + 1}`)
      const areaHa = parsed ? parsed.areaHa.toFixed(2) + ' ha' : '—'
      const tooltipHtml = `<strong>${name}</strong><br/>Suprafață: ${areaHa}` +
        (parsed?.isValid === false ? `<br/><span style="color:#ef4444">⚠ ${parsed.validationMsg}</span>` : '')
      const style = { color: '#f97316', fillColor: '#f97316', fillOpacity: 0.15, weight: 2.5, dashArray: '6 4' }

      let poly: L.Polygon | null = null
      if (geom.type === 'Polygon') {
        const latlngs = (geom.coordinates[0] as [number, number][]).map(([lng, lat]) => L.latLng(lat, lng))
        poly = L.polygon(latlngs, style)
      } else if (geom.type === 'MultiPolygon') {
        const rings = geom.coordinates.map(ring =>
          (ring[0] as [number, number][]).map(([lng, lat]) => L.latLng(lat, lng))
        )
        poly = L.polygon(rings as unknown as L.LatLngTuple[][], style)
      }
      if (poly) {
        poly.bindTooltip(tooltipHtml, { sticky: true })
        fg.addLayer(poly)
      }
    })

    fg.addTo(map)
    importPreviewLayerRef.current = fg
    try {
      const bounds = fg.getBounds()
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 })
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [importPreviewFC])

  // ── Vertex editing for import preview ──────────────────────────────────
  function toggleImportEdit() {
    const fg = importPreviewLayerRef.current
    if (!fg || !mapRef.current) return

    if (!importEditMode) {
      // Enable leaflet-draw editing on each polygon
      fg.eachLayer(layer => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const poly = layer as any
        if (poly.editing) poly.editing.enable()
      })
      setImportEditMode(true)
      toast('Mod editare activat — trage vârfurile pentru a modifica geometria.', { duration: 3000 })
    } else {
      // Disable editing and collect updated geometries
      const updatedGeoms: GeoJSON.Feature[] = []
      fg.eachLayer(layer => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const poly = layer as any
        if (poly.editing) poly.editing.disable()
        updatedGeoms.push((layer as L.Polygon).toGeoJSON() as GeoJSON.Feature)
      })

      // Update importPreviewFC with edited geometries + recalculate areas
      if (importPreviewFC) {
        const updatedFC: GeoJSON.FeatureCollection = {
          type: 'FeatureCollection',
          features: importPreviewFC.fc.features.map((f, i) => ({
            ...f,
            geometry: updatedGeoms[i]?.geometry ?? f.geometry,
          })),
        }
        const updatedFeatures: ParsedFeature[] = importPreviewFC.features.map((pf, i) => ({
          ...pf,
          geometry: (updatedGeoms[i]?.geometry ?? pf.geometry) as GeoJSON.Polygon | GeoJSON.MultiPolygon,
          areaHa: updatedGeoms[i] ? turfArea(updatedGeoms[i]) / 10000 : pf.areaHa,
        }))
        setImportPreviewFC({ fc: updatedFC, features: updatedFeatures })
        toast.success('Geometrii actualizate. Continuă la mapare câmpuri pentru salvare.')
      }
      setImportEditMode(false)
    }
  }

  function focusParcel(parcel: ParceleFitosanitar) {
    onParcelSelected?.(parcel)
    const layer = parcelLayersRef.current.get(parcel.id)
    if (layer && mapRef.current) {
      mapRef.current.fitBounds(layer.getBounds(), { padding: [30, 30], maxZoom: 16 })
    } else if (parcel.centru_lat && parcel.centru_lng && mapRef.current) {
      mapRef.current.setView([parcel.centru_lat, parcel.centru_lng], 14)
    }
  }

  // ── GPS – my location ───────────────────────────────────────────────────
  function handleMyLocation() {
    if (!mapRef.current) return
    if (!navigator.geolocation) { toast.error('GPS indisponibil pe acest dispozitiv.'); return }
    toast('Se caută locația GPS...')
    navigator.geolocation.getCurrentPosition(
      pos => {
        mapRef.current!.setView([pos.coords.latitude, pos.coords.longitude], 15)
        toast.success('Locație găsită.')
      },
      () => toast.error('Nu s-a putut obține locația. Verificați permisiunile GPS.'),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }

  // ── Address search ──────────────────────────────────────────────────────
  function handleSearchInput(value: string) {
    setSearchQuery(value)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    if (value.trim().length < 3) { setSearchResults([]); setShowDropdown(false); return }
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const results = await searchNominatim(value.trim())
        setSearchResults(results)
        // Only show dropdown if there are results
        setShowDropdown(results.length > 0)
      } catch (err) {
        console.error('Search error:', err)
        toast.error('Eroare la căutare. Încercați din nou.')
        setSearchResults([])
        setShowDropdown(false)
      }
    }, 300)
  }

  function handleSearchSelect(r: MapSearchResult) {
    setSearchQuery(r.display_name.split(',')[0])
    setSearchResults([])
    setShowDropdown(false)
    mapRef.current?.setView([r.lat, r.lng], 14)
  }

  // ── WMS layer controls ──────────────────────────────────────────────────
  function toggleWmsLayer(id: string) {
    setWmsLayerState(prev => ({ ...prev, [id]: { ...prev[id], visible: !prev[id].visible } }))
    setWmsLayerErrors(prev => ({ ...prev, [id]: false }))
  }

  function setWmsOpacity(id: string, opacity: number) {
    setWmsLayerState(prev => ({ ...prev, [id]: { ...prev[id], opacity } }))
  }

  function addLegendItem() {
    const label = newLegendLabel.trim()
    if (!label) {
      toast.error('Introdu denumirea culturii')
      return
    }
    const baseId = makeLegendId(label)
    const id = legendItems.some(item => item.id === baseId) ? `${baseId}-${Date.now()}` : baseId
    const newItem: LegendItem = { id, label, color: newLegendColor }
    setLegendItems(prev => [...prev, newItem])
    setSaveLegendId(id)
    setNewLegendLabel('')
    setNewLegendColor('#22c55e')
    setShowLegendAdd(false)
  }

  function deleteLegendItem(id: string) {
    setLegendItems(prev => {
      const updated = prev.filter(item => item.id !== id)
      localStorage.setItem('map_legend_items', JSON.stringify(updated))
      return updated
    })
  }

  function getLegendForParcel(parcelId: string) {
    const legendId = parcelLegendMap[parcelId]
    return legendItems.find(item => item.id === legendId)
  }

  // ── Save parcel ─────────────────────────────────────────────────────────
  async function handleSaveParcel() {
    if (!drawnRingStereo || !saveName.trim()) {
      toast.error('Introdu un nume pentru parcela'); return
    }
    const area = calcAreaHaStereo70(drawnRingStereo)
    if (area <= 0) { toast.error('Deseneaza un poligon valid'); return }
    if (area > 10000) { toast.error('Suprafata maxima 10,000 ha'); return }
    const [cx, cy] = safeCenterStereo70(drawnRingStereo)
    const [centruLat, centruLng] = stereo70ToLeaflet(cx, cy)
    setSaving(true)
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) { toast.error('Trebuie sa fii autentificat'); setSaving(false); return }
    const geometryStereo70: GeoJSONPolygon = { type: 'Polygon', coordinates: [drawnRingStereo] }
    const legendItem = legendItems.find(i => i.id === saveLegendId)

    // ── Step 1: resolve or create the linked registry parcel ────────────
    let resolvedParcelaId = saveLinkedParcelId || null
    if (!resolvedParcelaId) {
      // Auto-create a parcels entry so the polygon appears in Lista Parcele
      const { data: newReg, error: regErr } = await db
        .from('parcels')
        .insert([{
          user_id: user.id,
          bloc_fizic: saveName.trim(),
          county: saveJudet || '',
          locality: saveLocalitate || '',
          surface: area,
          culture: legendItem?.label ?? null,
          lat: centruLat,
          lng: centruLng,
          status: 'ACTIVE',
        }])
        .select('id')
        .single()
      if (regErr) {
        console.warn('Could not auto-create registry parcel:', regErr.message)
      } else if (newReg) {
        resolvedParcelaId = newReg.id
      }
    } else {
      // Sync centroid + culture back to the existing registry parcel
      await db.from('parcels').update({
        lat: centruLat,
        lng: centruLng,
        culture: legendItem?.label ?? null,
      }).eq('id', resolvedParcelaId)
    }

    // ── Step 2: save the polygon ─────────────────────────────────────────
    const { data, error } = await db
      .from('parcele_fitosanitar')
      .insert([{
        user_id: user.id,
        nume_parcela: saveName.trim(),
        judet: saveJudet || null,
        localitate: saveLocalitate || null,
        adresa: saveAdresa || null,
        suprafata_ha: area,
        geometry_geojson: geometryStereo70,
        centru_lat: centruLat,
        centru_lng: centruLng,
        note: saveNote || null,
        cultura_label: legendItem?.label ?? null,
        cultura_color: legendItem?.color ?? null,
        ...(resolvedParcelaId ? { parcela_id: resolvedParcelaId } : {}),
      }])
      .select()
      .single()
    if (error) toast.error('Eroare la salvare: ' + error.message)
    else {
      toast.success(`Parcela "${saveName}" salvata — vizibila în Lista și pe Hartă!`)
      closeSaveModal()
      await Promise.all([loadParcels(), loadRegistryParcels()])
      if (data) {
        setParcelLegendMap(prev => ({ ...prev, [data.id]: saveLegendId }))
        focusParcel(data as ParceleFitosanitar)
      }
    }
    setSaving(false)
  }

  function closeSaveModal() {
    setShowSaveModal(false)
    setSaveName(''); setSaveLocalitate(''); setSaveJudet(''); setSaveAdresa(''); setSaveNote('')
    setSaveLinkedParcelId('')
    setDrawnRingStereo(null)
    drawnItemsRef.current?.clearLayers()
  }

  // ── Edit ────────────────────────────────────────────────────────────────
  function openEditModal(parcel: ParceleFitosanitar) {
    setEditId(parcel.id)
    setEditName(parcel.nume_parcela)
    setEditLocalitate(parcel.localitate ?? '')
    setEditJudet(parcel.judet ?? '')
    setEditNote(parcel.note ?? '')
    // Resolve legend from DB cultura_label or from localStorage map
    const dbCultura = (parcel as any).cultura_label
    if (dbCultura) {
      const found = legendItems.find(i => i.label === dbCultura)
      setEditLegendId(found?.id ?? legendItems[0]?.id ?? '')
    } else {
      setEditLegendId(parcelLegendMap[parcel.id] ?? legendItems[0]?.id ?? '')
    }
  }

  async function handleSaveEdit() {
    if (!editId || !editName.trim()) { toast.error('Introdu un nume.'); return }
    setEditSaving(true)
    const db = createClient()
    const legendItem = legendItems.find(i => i.id === editLegendId)
    const parcel = parcels.find(p => p.id === editId)
    const { error } = await db
      .from('parcele_fitosanitar')
      .update({
        nume_parcela: editName.trim(),
        localitate: editLocalitate || null,
        judet: editJudet || null,
        note: editNote || null,
        cultura_label: legendItem?.label ?? null,
        cultura_color: legendItem?.color ?? null,
      })
      .eq('id', editId)
    setEditSaving(false)
    if (error) { toast.error('Eroare la editare: ' + error.message); return }
    // Sync changes back to the linked registry parcel
    if (parcel?.parcela_id) {
      await db.from('parcels').update({
        bloc_fizic: editName.trim(),
        locality: editLocalitate || null,
        county: editJudet || null,
        culture: legendItem?.label ?? null,
      }).eq('id', parcel.parcela_id)
    }
    setParcelLegendMap(prev => ({ ...prev, [editId]: editLegendId }))
    toast.success('Parcela actualizată.')
    setEditId(null)
    await Promise.all([loadParcels(), loadRegistryParcels()])
  }

  // ── Delete ──────────────────────────────────────────────────────────────
  async function handleDeleteConfirm() {
    if (!deleteId) return
    const db = createClient()
    const toDelete = parcels.find(p => p.id === deleteId)
    const { error } = await db.from('parcele_fitosanitar').delete().eq('id', deleteId)
    if (error) toast.error('Eroare la stergere: ' + error.message)
    else {
      toast.success('Parcela stearsa')
      if (selectedId === deleteId) setSelectedId(null)
      setParcelLegendMap(prev => {
        const next = { ...prev }
        delete next[deleteId]
        return next
      })
      // Clear GPS coords from linked registry parcel
      if (toDelete?.parcela_id) {
        await db.from('parcels').update({ lat: null, lng: null }).eq('id', toDelete.parcela_id)
      }
      await Promise.all([loadParcels(), ...(toDelete?.parcela_id ? [loadRegistryParcels()] : [])])
    }
    setDeleteId(null)
  }

  const deleteParcel = parcels.find(p => p.id === deleteId)
  const isModal = mode === 'modal'
  const activeLayerCount = Object.values(wmsLayerState).filter(s => s.visible).length

  // ── Edit geometry of existing parcel ────────────────────────────────────
  function startGeometryEdit(parcel: ParceleFitosanitar) {
    const map = mapRef.current
    if (!map || !parcel.geometry_geojson?.coordinates?.[0]) return
    // Cancel any existing geo edit
    cancelGeometryEdit()
    const ring = parcel.geometry_geojson.coordinates[0]
    const ringWgs84 = isLikelyStereo70(ring[0]) ? ringStereo70ToWgs84(ring) : ring
    const latLngs = ringWgs84.map(([lng, lat]: number[]) => L.latLng(lat, lng))
    const poly = L.polygon(latLngs, { color: '#ef4444', fillColor: '#fca5a5', fillOpacity: 0.3, weight: 3, dashArray: '6 4' })
    poly.addTo(map)
    // Enable vertex editing
    ;(poly as any).editing?.enable()
    geoEditLayerRef.current = poly
    setGeoEditId(parcel.id)
    // Hide the original layer
    const origLayer = parcelLayersRef.current.get(parcel.id)
    if (origLayer) map.removeLayer(origLayer)
    map.fitBounds(poly.getBounds(), { padding: [40, 40] })
  }

  function cancelGeometryEdit() {
    const map = mapRef.current
    if (geoEditLayerRef.current && map) {
      ;(geoEditLayerRef.current as any).editing?.disable()
      map.removeLayer(geoEditLayerRef.current)
    }
    geoEditLayerRef.current = null
    setGeoEditId(null)
  }

  async function saveGeometryEdit() {
    const poly = geoEditLayerRef.current
    if (!poly || !geoEditId) return
    ;(poly as any).editing?.disable()
    const latLngs = poly.getLatLngs()[0] as L.LatLng[]
    const ringWgs84 = latLngs.map(ll => [ll.lng, ll.lat])
    // Close the ring
    if (ringWgs84.length > 0 && (ringWgs84[0][0] !== ringWgs84[ringWgs84.length - 1][0] || ringWgs84[0][1] !== ringWgs84[ringWgs84.length - 1][1])) {
      ringWgs84.push([...ringWgs84[0]])
    }
    const ringStereo = ringWgs84ToStereo70(ringWgs84)
    const area = calcAreaHaStereo70(ringStereo)
    const [cx, cy] = centroidStereo70(ringStereo)
    const [centruLat, centruLng] = stereo70ToLeaflet(cx, cy)
    const geometryStereo70 = { type: 'Polygon' as const, coordinates: [ringStereo] }

    const db = createClient()
    const { error } = await db
      .from('parcele_fitosanitar')
      .update({
        geometry_geojson: geometryStereo70,
        suprafata_ha: area,
        centru_lat: centruLat,
        centru_lng: centruLng,
      })
      .eq('id', geoEditId)
    if (error) { toast.error('Eroare la salvare geometrie: ' + error.message); return }
    toast.success(`Geometrie actualizată — ${area.toFixed(2)} ha`)
    cancelGeometryEdit()
    await loadParcels()
  }

  // ── Export parcels as Shapefile ZIP ──────────────────────────────────────
  async function handleExport() {
    if (parcels.length === 0) { toast.error('Nu ai parcele de exportat.'); return }
    try {
      // shp-write is CJS and synchronous; dynamic import wraps it — access via .default
      const shpWriteMod = await import('shp-write')
      const shpWrite = (shpWriteMod as any).default ?? shpWriteMod
      const features = parcels
        .filter(p => p.geometry_geojson?.coordinates?.[0]?.length >= 3)
        .map(p => {
          const ring = p.geometry_geojson.coordinates[0]
          const ringWgs84 = isLikelyStereo70(ring[0]) ? ringStereo70ToWgs84(ring) : ring
          return {
            type: 'Feature' as const,
            geometry: { type: 'Polygon' as const, coordinates: [ringWgs84] },
            properties: {
              NUME: p.nume_parcela,
              JUDET: p.judet ?? '',
              LOCALITATE: p.localitate ?? '',
              SUPRAFATA: p.suprafata_ha ?? 0,
              CULTURA: p.cultura_label ?? '',
              NR_CVI: p.nr_cvi ?? '',
              ADRESA: p.adresa ?? '',
              NOTE: p.note ?? '',
              CREAT: p.created_at?.slice(0, 10) ?? '',
            },
          }
        })
      const fc = { type: 'FeatureCollection' as const, features }
      // shp-write v0.3 zip() is synchronous and returns base64 string in browser
      const base64 = shpWrite.zip(fc, {
        folder: 'parcele_export',
        types: { polygon: 'parcele' },
      })
      // Convert base64 → Uint8Array → Blob
      const binary = atob(base64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'application/zip' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `parcele_export_${new Date().toISOString().slice(0, 10)}.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success(`${features.length} parcele exportate ca Shapefile.`)
    } catch (err) {
      toast.error('Eroare la export: ' + (err instanceof Error ? err.message : 'necunoscută'))
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className={isModal ? 'flex flex-col-reverse gap-4' : 'flex flex-col-reverse gap-3'}>

      {/* ── Sidebar ── */}
      {showList && (
        <aside className={isModal
          ? 'flex flex-col gap-3'
          : 'space-y-3'
        }>

          {/* Address search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text" value={searchQuery}
              onChange={e => handleSearchInput(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              placeholder="Cauta adresa, localitate..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
            />
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-[2000] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
                {searchResults.map((r, i) => (
                  <button key={i} onMouseDown={() => handleSearchSelect(r)}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-green-50 border-b border-gray-100 last:border-0 transition-colors">
                    <div className="font-medium text-gray-800 truncate">{r.display_name.split(',')[0]}</div>
                    <div className="text-xs text-gray-500 truncate mt-0.5">
                      {[r.localitate, r.judet].filter(Boolean).join(', ')}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Layer panel toggle ── */}
          <button
            onClick={() => setShowLayerPanel(v => !v)}
            className={`flex items-center justify-between w-full px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              showLayerPanel
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : 'bg-white border-gray-200 text-gray-700 hover:border-indigo-300 hover:bg-indigo-50'
            }`}
          >
            <span className="flex items-center gap-2">
              <Layers className="w-4 h-4" />
              Straturi hartă
            </span>
            <span className="flex items-center gap-1.5">
              {activeLayerCount > 0 && (
                <span className="text-xs bg-indigo-600 text-white rounded-full px-1.5 py-0.5 leading-none">
                  {activeLayerCount}
                </span>
              )}
              <span className="text-xs text-gray-400">{showLayerPanel ? '▲' : '▼'}</span>
            </span>
          </button>

          {/* ── Layer panel ── */}
          {showLayerPanel && (
            <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  Straturi oficiale România
                </p>
              </div>

              <div className="divide-y divide-gray-100">
                {WMS_LAYER_DEFS.map(def => {
                  const state = wmsLayerState[def.id]
                  const hasError = wmsLayerErrors[def.id]
                  const c = layerColors(def.color)
                  return (
                    <div key={def.id} className={`p-3 transition-colors ${state.visible ? c.bg : 'bg-white'}`}>
                      {/* Toggle row */}
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleWmsLayer(def.id)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0 ${
                            state.visible ? c.toggle : 'bg-gray-200'
                          }`}
                          title={state.visible ? 'Dezactiveaza' : 'Activeaza'}
                        >
                          <span className={`absolute left-0.5 top-1/2 h-4 w-4 -translate-y-1/2 bg-white rounded-full shadow transition-transform ${
                            state.visible ? 'translate-x-4' : 'translate-x-0.5'
                          }`} />
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
                            <span className={`text-sm font-medium ${state.visible ? c.text : 'text-gray-700'}`}>
                              {def.label}
                            </span>
                            {hasError && state.visible && (
                              <span className="text-[10px] bg-red-100 text-red-600 border border-red-200 px-1 py-0.5 rounded font-medium">
                                indisponibil
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5 truncate">{def.sublabel}</div>
                        </div>
                      </div>

                      {/* Opacity slider */}
                      {state.visible && (
                        <div className="mt-2.5 flex items-center gap-2">
                          <span className="text-xs text-gray-500 w-16 flex-shrink-0">Opacitate</span>
                          <input
                            type="range" min={10} max={100}
                            value={Math.round(state.opacity * 100)}
                            onChange={e => setWmsOpacity(def.id, parseInt(e.target.value) / 100)}
                            className="flex-1 h-1.5 accent-indigo-500"
                          />
                          <span className="text-xs text-gray-500 w-8 text-right">
                            {Math.round(state.opacity * 100)}%
                          </span>
                        </div>
                      )}

                      {/* Error hint */}
                      {hasError && state.visible && (
                        <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 flex items-start gap-1.5">
                          <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span>Stratul poate fi temporar indisponibil.</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

            </div>
          )}

          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Legenda culturi</p>
              <button
                onClick={() => setShowLegendAdd(v => !v)}
                className="inline-flex items-center justify-center w-6 h-6 rounded bg-white border border-gray-300 text-gray-600 hover:bg-gray-100"
                title="Adauga legenda"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-3 space-y-2 bg-white">
              {legendItems.map(item => (
                <div key={item.id} className="flex items-center gap-2 text-sm text-gray-700 group">
                  <span className="inline-block w-3 h-3 rounded-full border border-gray-200 flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="flex-1">{item.label}</span>
                  <button
                    onClick={() => deleteLegendItem(item.id)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-all"
                    title="Șterge"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              {showLegendAdd && (
                <div className="mt-2 pt-2 border-t border-gray-100 space-y-2">
                  <input
                    type="text"
                    value={newLegendLabel}
                    onChange={e => setNewLegendLabel(e.target.value)}
                    placeholder="Ex: Rapita"
                    className="w-full px-2.5 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newLegendColor}
                      onChange={e => setNewLegendColor(e.target.value)}
                      className="w-10 h-8 p-0 border border-gray-300 rounded cursor-pointer"
                    />
                    <button
                      onClick={addLegendItem}
                      className="px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded"
                    >
                      Adauga
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Projection badge */}
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
            <Info className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
            <div className="text-xs text-blue-700">
              <span className="font-semibold">Stereo 70</span> (EPSG:3844) — stocare APIA/ANCPI
            </div>
          </div>

          {/* Parcel list header */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-green-600" />
              Parcelele mele
              {!loading && (
                <span className="text-xs font-normal text-gray-400 ml-1">({parcels.length})</span>
              )}
            </h3>
            <div className="flex items-center gap-1">
              {/* Import button */}
              <button
                onClick={() => setShowImportWizard(true)}
                className="flex items-center gap-1 px-2 py-1 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded hover:bg-orange-100 transition-colors font-medium"
                title="Importă parcele din Shapefile / GeoJSON"
              >
                <Upload className="w-3 h-3" /> Import
              </button>
              <button
                onClick={() => void handleExport()}
                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors font-medium"
                title="Exportă parcele ca Shapefile (.zip)"
              >
                <Download className="w-3 h-3" /> Export
              </button>
              <button onClick={() => void loadParcels()} title="Reincarcare"
                className="p-1 text-gray-400 hover:text-gray-600 rounded">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Import preview banner */}
          {importPreviewFC && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg text-xs text-orange-700">
                <div className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5" />
                  <span><strong>{importPreviewFC.features.length}</strong> parcele previzualizate</span>
                </div>
                <button
                  onClick={() => { setImportPreviewFC(null); setImportEditMode(false) }}
                  className="p-0.5 hover:text-orange-900 rounded" title="Șterge previzualizare"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={toggleImportEdit}
                  className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded border font-medium transition-colors flex-1 justify-center ${
                    importEditMode
                      ? 'bg-amber-100 border-amber-300 text-amber-800 hover:bg-amber-200'
                      : 'bg-white border-gray-300 text-gray-600 hover:border-amber-300 hover:bg-amber-50'
                  }`}
                  title={importEditMode ? 'Finalizează editarea geometriei' : 'Editează vârfurile poligoanelor importate'}
                >
                  <Pencil className="w-3 h-3" />
                  {importEditMode ? 'Finalizează' : 'Editează geometrie'}
                </button>
                <button
                  onClick={() => setShowImportWizard(true)}
                  disabled={importEditMode}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs rounded border bg-green-600 border-green-600 text-white hover:bg-green-700 font-medium transition-colors flex-1 justify-center disabled:opacity-40"
                >
                  Continuă import →
                </button>
              </div>
            </div>
          )}

          {/* Parcel list */}
          <div className={isModal ? 'max-h-44 lg:flex-1 overflow-y-auto pr-1 space-y-2' : 'space-y-2 max-h-64 overflow-y-auto'}>
            {loading ? (
              <div className="text-center py-10">
                <div className="inline-block w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-500 mt-2">Se incarca...</p>
              </div>
            ) : parcels.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <MapPin className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Nu ai parcele salvate.</p>
                {allowDraw && <p className="text-xs mt-1">Foloseste butonul ✏️ de pe harta pentru a desena.</p>}
              </div>
            ) : (
              parcels.map(parcel => {
                const legend = getLegendForParcel(parcel.id)
                return (
                  <ParcelItem
                    key={parcel.id}
                    parcel={parcel}
                    isSelected={selectedId === parcel.id}
                    onView={() => focusParcel(parcel)}
                    onDelete={() => setDeleteId(parcel.id)}
                    onEdit={() => openEditModal(parcel)}
                    onEditGeometry={() => startGeometryEdit(parcel)}
                    onSelect={onParcelSelected ? () => focusParcel(parcel) : undefined}
                    legendLabel={legend?.label}
                    legendColor={legend?.color}
                  />
                )
              })
            )}
          </div>

          {allowDraw && parcels.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
              <Plus className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Foloseste bara de pe harta pentru a adauga o parcela noua</span>
            </div>
          )}
        </aside>
      )}

      {/* ── Map + status bar ── */}
      <div
        className={`relative flex flex-col rounded-xl overflow-hidden border border-gray-200 shadow-sm${isModal ? ' h-[65vh] min-h-[400px]' : ' order-1'}`}
        style={!isModal ? { height } : undefined}
      >
        <div
          ref={containerRef}
          className="flex-1 w-full"
          style={!isModal ? { minHeight: height } : undefined}
        />

        {/* GPS – My location button */}
        <button
          onClick={handleMyLocation}
          className="absolute top-[52px] right-2 z-[1000] bg-white border border-gray-300 rounded-lg p-2 shadow-md hover:bg-green-50 active:bg-green-100 transition-colors"
          title="Locația mea"
          aria-label="Locația mea"
        >
          <Navigation className="w-4 h-4 text-green-700" />
        </button>

        {/* Geometry edit toolbar */}
        {geoEditId && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1100] flex items-center gap-2 px-4 py-2 bg-white border border-red-300 rounded-lg shadow-lg">
            <Move className="w-4 h-4 text-red-600" />
            <span className="text-sm font-medium text-gray-700">Editare geometrie</span>
            <button
              onClick={() => void saveGeometryEdit()}
              className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700"
            >
              Salvează
            </button>
            <button
              onClick={() => { cancelGeometryEdit(); void loadParcels() }}
              className="px-3 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Anulează
            </button>
          </div>
        )}

        {/* Parcel detail popup – click centre marker or registry marker */}
        {popupParcel && (
          <div className="absolute bottom-12 right-3 z-[2000]">
            <ParcelMapPopup
              parcel={popupParcel}
              onClose={() => { setPopupParcel(null); setPopupRegistryParcelId(null) }}
              onRegisterActivity={() => setShowActivityModal(true)}
            />
          </div>
        )}

        {/* Status bar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900 text-xs font-mono border-t border-gray-700 flex-shrink-0">
          {cursorStereo ? (
            <>
              <span className="text-blue-300">
                X:&nbsp;{fmtStereo70(cursorStereo.x)}&nbsp;&nbsp;
                Y:&nbsp;{fmtStereo70(cursorStereo.y)}
                <span className="text-gray-500 ml-1.5">Stereo 70</span>
              </span>
              {cursorWgs84 && (
                <span className="text-gray-400 hidden sm:inline">
                  {fmtDeg(cursorWgs84.lat)},&nbsp;{fmtDeg(cursorWgs84.lng)}
                  <span className="text-gray-600 ml-1.5">WGS84</span>
                </span>
              )}
            </>
          ) : (
            <span className="text-gray-600">Muta cursorul pe harta pentru coordonate Stereo 70</span>
          )}
          {activeLayerCount > 0 && (
            <span className="text-indigo-400 hidden md:inline ml-2">
              {activeLayerCount} {activeLayerCount === 1 ? 'strat activ' : 'straturi active'}
            </span>
          )}
        </div>
      </div>

      {/* ── Save modal ── */}
      {showSaveModal && drawnRingStereo && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-base font-semibold text-gray-800">Salveaza parcela noua</h2>
              <button onClick={closeSaveModal}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Leagă de parcelă din registru <span className="text-gray-400 font-normal">(opțional)</span>
                </label>
                <select
                  value={saveLinkedParcelId}
                  onChange={e => {
                    const id = e.target.value
                    setSaveLinkedParcelId(id)
                    // Auto-fill name from registry parcel if name is still empty
                    if (id && !saveName.trim()) {
                      const opt = linkedParcelOptions.find(p => p.id === id)
                      if (opt) setSaveName(opt.label.split(' — ')[0].trim())
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                >
                  <option value="">— Fără legătură —</option>
                  {linkedParcelOptions.map(p => (
                    <option key={p.id} value={p.id}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nume parcelă <span className="text-red-500">*</span>
                </label>
                <input type="text" value={saveName} onChange={e => setSaveName(e.target.value)}
                  placeholder="ex: Teren Campie Nord" autoFocus maxLength={100}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <CoordBadge ring={drawnRingStereo} />
              {/* Culture / polygon colour picker */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cultură (culoare poligon)</label>
                <div className="relative">
                  {/* Trigger button — shows selected colour swatch + label */}
                  <button
                    type="button"
                    onClick={() => setShowCulturePicker(v => !v)}
                    className="w-full flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white hover:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <span
                      className="inline-block w-4 h-4 rounded-full border border-gray-300 flex-shrink-0"
                      style={{ backgroundColor: legendItems.find(i => i.id === saveLegendId)?.color ?? '#22c55e' }}
                    />
                    <span className="flex-1 text-left text-gray-800">
                      {legendItems.find(i => i.id === saveLegendId)?.label ?? 'Selecteaza...'}
                    </span>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${showCulturePicker ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {/* Dropdown list */}
                  {showCulturePicker && (
                    <div className="absolute z-[10000] top-full mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
                      {legendItems.map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => { setSaveLegendId(item.id); setShowCulturePicker(false) }}
                          className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors ${saveLegendId === item.id ? 'bg-green-50' : ''}`}
                        >
                          <span
                            className="inline-block w-4 h-4 rounded-full border border-gray-300 flex-shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className={`flex-1 text-left ${saveLegendId === item.id ? 'font-medium text-green-700' : 'text-gray-700'}`}>
                            {item.label}
                          </span>
                          {saveLegendId === item.id && (
                            <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Judet</label>
                  <input type="text" value={saveJudet} onChange={e => setSaveJudet(e.target.value)}
                    placeholder="ex: Ilfov"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Localitate</label>
                  <input type="text" value={saveLocalitate} onChange={e => setSaveLocalitate(e.target.value)}
                    placeholder="ex: Snagov"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
                <textarea value={saveNote} onChange={e => setSaveNote(e.target.value)} rows={2}
                  placeholder="Note suplimentare..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
              </div>
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  Geometria se stocheaza in <strong>Stereo 70 (EPSG:3844)</strong> conform
                  standardelor APIA/ANCPI. Suprafata este calculata planar pe proiectie.
                </span>
              </div>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white rounded-b-2xl">
              <button onClick={closeSaveModal}
                className="flex-1 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Anulare
              </button>
              <button onClick={() => void handleSaveParcel()} disabled={!saveName.trim() || saving}
                className="flex-1 px-4 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors">
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Se salveaza...
                  </span>
                ) : 'Salveaza parcela'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm ── */}
      {deleteId && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">Confirmare stergere</h2>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600">
                Esti sigur ca vrei sa stergi parcela{' '}
                <strong className="text-gray-800">"{deleteParcel?.nume_parcela}"</strong>?
              </p>
              <p className="text-xs text-red-600 mt-2">Aceasta actiune nu poate fi anulata.</p>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setDeleteId(null)}
                className="flex-1 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                Anulare
              </button>
              <button onClick={() => void handleDeleteConfirm()}
                className="flex-1 px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors">
                Sterge
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit parcel modal ── */}
      {editId && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">Editează parcela</h2>
              <button onClick={() => setEditId(null)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nume parcelă <span className="text-red-500">*</span></label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} maxLength={100}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Localitate</label>
                  <input type="text" value={editLocalitate} onChange={e => setEditLocalitate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Județ</label>
                  <input type="text" value={editJudet} onChange={e => setEditJudet(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cultură</label>
                <select value={editLegendId} onChange={e => setEditLegendId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                  <option value="">— Fără cultură —</option>
                  {legendItems.map(item => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
                <textarea value={editNote} onChange={e => setEditNote(e.target.value)} rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-5">
              <button onClick={() => void handleSaveEdit()} disabled={editSaving}
                className="flex-1 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors">
                {editSaving ? 'Se salvează...' : 'Salvează modificările'}
              </button>
              <button onClick={() => setEditId(null)} className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Anulează
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick activity modal ── */}
      {showActivityModal && (
        <QuickActivityModal
          parcelId={popupRegistryParcelId}
          parcelName={popupParcel?.bloc_fizic ?? ''}
          parcelSurface={popupParcel?.surface}
          onClose={() => setShowActivityModal(false)}
        />
      )}

      {/* ── Import wizard modal ── */}
      <ImportWizardModal
        open={showImportWizard}
        onClose={() => setShowImportWizard(false)}
        onPreview={(fc, features) => {
          setImportPreviewFC({ fc, features })
          setShowImportWizard(false)
        }}
        currentFC={importPreviewFC?.fc}
        onSaveComplete={() => { void loadParcels(); void loadRegistryParcels() }}
      />
    </div>
  )
}
