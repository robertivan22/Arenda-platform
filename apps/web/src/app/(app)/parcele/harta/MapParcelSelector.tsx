'use client'

// Loaded ONLY in the browser via dynamic(() => import(...), { ssr: false })
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import 'leaflet-draw'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Search, MapPin, Trash2, Eye, Check, X, RefreshCw, Plus, Info,
} from 'lucide-react'
import type { ParceleFitosanitar, GeoJSONPolygon, MapSearchResult } from '@/lib/parcele-types'
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

// ─── Nominatim address search ────────────────────────────────────────────────
async function searchNominatim(query: string): Promise<MapSearchResult[]> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&countrycodes=ro&addressdetails=1`,
    { headers: { 'Accept-Language': 'ro' } },
  )
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
  initialCenter?: [number, number] // WGS84 [lat, lng]
  initialZoom?: number
}

// ─── Coordinate display badge ─────────────────────────────────────────────────
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

// ─── Parcel list item ─────────────────────────────────────────────────────────
function ParcelItem({
  parcel,
  isSelected,
  onView,
  onDelete,
  onSelect,
}: {
  parcel: ParceleFitosanitar
  isSelected: boolean
  onView: () => void
  onDelete: () => void
  onSelect?: () => void
}) {
  const ring = parcel.geometry_geojson?.coordinates?.[0] ?? []
  const isStereo = ring.length > 0 && isLikelyStereo70(ring[0])

  return (
    <div className={`p-3 rounded-lg border transition-all ${
      isSelected
        ? 'border-blue-500 bg-blue-50 shadow-sm'
        : 'border-gray-200 bg-white hover:border-green-300 hover:bg-green-50'
    }`}>
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
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
              isStereo
                ? 'text-blue-600 bg-blue-50 border-blue-200'
                : 'text-orange-600 bg-orange-50 border-orange-200'
            }`}>
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

  const [parcels, setParcels] = useState<ParceleFitosanitar[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(initialParcelId ?? null)

  // Drawing state — ring always kept in Stereo 70
  const [drawnRingStereo, setDrawnRingStereo] = useState<number[][] | null>(null)
  const [showSaveModal, setShowSaveModal] = useState(false)

  // Save form
  const [saveName, setSaveName] = useState('')
  const [saveLocalitate, setSaveLocalitate] = useState('')
  const [saveJudet, setSaveJudet] = useState('')
  const [saveAdresa, setSaveAdresa] = useState('')
  const [saveNote, setSaveNote] = useState('')
  const [saving, setSaving] = useState(false)

  // Delete
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // Address search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<MapSearchResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

  // Status bar cursor coords
  const [cursorWgs84, setCursorWgs84] = useState<{ lat: number; lng: number } | null>(null)
  const [cursorStereo, setCursorStereo] = useState<{ x: number; y: number } | null>(null)

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
      attribution: '© OpenTopoMap',
      maxZoom: 17,
    })

    // ANCPI cadastru WMS overlay (Romanian national cadastre — public INSPIRE)
    const cadastru = L.tileLayer.wms('https://inspire.ancpi.ro/maps/geoserver/ows', {
      layers: 'CP.CadastralParcel',
      format: 'image/png',
      transparent: true,
      version: '1.3.0',
      attribution: '© ANCPI Cadastru',
      opacity: 0.55,
    })

    osm.addTo(map)
    L.control.layers(
      { OpenStreetMap: osm, Satelit: satellite, Teren: topo },
      { 'Cadastru ANCPI': cadastru },
      { position: 'topright' },
    ).addTo(map)

    // Cursor coordinate tracker → convert to Stereo 70 in real time
    map.on('mousemove', (e: L.LeafletMouseEvent) => {
      setCursorWgs84({ lat: e.latlng.lat, lng: e.latlng.lng })
      const [x, y] = wgs84ToStereo70(e.latlng.lng, e.latlng.lat)
      setCursorStereo({ x, y })
    })
    map.on('mouseout', () => {
      setCursorWgs84(null)
      setCursorStereo(null)
    })

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
            shapeOptions: {
              color: '#16a34a',
              fillColor: '#16a34a',
              fillOpacity: 0.25,
              weight: 2,
            },
          },
          polyline: false,
          rectangle: false,
          circle: false,
          circlemarker: false,
          marker: false,
        },
        edit: { featureGroup: drawnItems },
      })
      map.addControl(drawControl)

      map.on('draw:created', async (e: L.LeafletEvent) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const layer = (e as any).layer as L.Polygon
        drawnItems.clearLayers()
        drawnItems.addLayer(layer)

        // Leaflet returns WGS84 [lng, lat] coordinates in GeoJSON
        const geo = layer.toGeoJSON() as GeoJSON.Feature<GeoJSON.Polygon>
        const ringWgs84 = geo.geometry.coordinates[0]

        // Convert to Stereo 70 for storage + accurate area
        const ringStereo = ringWgs84ToStereo70(ringWgs84)
        setDrawnRingStereo(ringStereo)

        // Auto-fill address via reverse geocoding
        const center = layer.getBounds().getCenter()
        try {
          const addr = await reverseGeocode(center.lat, center.lng)
          setSaveJudet(addr.judet)
          setSaveLocalitate(addr.localitate)
          setSaveAdresa(addr.adresa)
        } catch { /* non-blocking */ }

        setSaveName('')
        setSaveNote('')
        setShowSaveModal(true)
      })
    }

    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      drawnItemsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Load parcels from Supabase ──────────────────────────────────────────
  const loadParcels = useCallback(async () => {
    setLoading(true)
    const db = createClient()
    const { data, error } = await db
      .from('parcele_fitosanitar')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) {
      toast.error('Eroare la incarcare: ' + error.message)
    } else {
      setParcels((data ?? []) as ParceleFitosanitar[])
    }
    setLoading(false)
  }, [])

  useEffect(() => { void loadParcels() }, [loadParcels])

  // ── Render parcel polygons on map ───────────────────────────────────────
  // Stored in Stereo 70 → convert back to WGS84 [lng,lat] for Leaflet
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    parcelLayersRef.current.forEach(l => map.removeLayer(l))
    parcelLayersRef.current.clear()

    parcels.forEach(parcel => {
      const ring = parcel.geometry_geojson?.coordinates?.[0]
      if (!ring || ring.length < 3) return

      // Auto-detect projection and normalise to WGS84 for display
      const ringWgs84 = isLikelyStereo70(ring[0])
        ? ringStereo70ToWgs84(ring)
        : ring

      const isSelected = parcel.id === selectedId
      const layer = L.geoJSON(
        { type: 'Polygon', coordinates: [ringWgs84] } as GeoJSON.GeoJsonObject,
        {
          style: {
            color: isSelected ? '#1d4ed8' : '#15803d',
            fillColor: isSelected ? '#3b82f6' : '#22c55e',
            fillOpacity: isSelected ? 0.35 : 0.2,
            weight: isSelected ? 3 : 2,
          },
        },
      )
        .bindTooltip(parcel.nume_parcela, { sticky: true })
        .on('click', () => focusParcel(parcel))

      layer.addTo(map)
      parcelLayersRef.current.set(parcel.id, layer)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcels, selectedId])

  // ── Focus / select parcel ───────────────────────────────────────────────
  function focusParcel(parcel: ParceleFitosanitar) {
    setSelectedId(parcel.id)
    onParcelSelected?.(parcel)
    const layer = parcelLayersRef.current.get(parcel.id)
    if (layer && mapRef.current) {
      mapRef.current.fitBounds(layer.getBounds(), { padding: [30, 30], maxZoom: 16 })
    } else if (parcel.centru_lat && parcel.centru_lng && mapRef.current) {
      mapRef.current.setView([parcel.centru_lat, parcel.centru_lng], 14)
    }
  }

  // ── Address search (Nominatim → WGS84 → pan map) ───────────────────────
  function handleSearchInput(value: string) {
    setSearchQuery(value)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    if (value.trim().length < 3) { setSearchResults([]); setShowDropdown(false); return }
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const results = await searchNominatim(value.trim())
        setSearchResults(results)
        setShowDropdown(results.length > 0)
      } catch { setSearchResults([]) }
    }, 300)
  }

  function handleSearchSelect(r: MapSearchResult) {
    setSearchQuery(r.display_name.split(',')[0])
    setSearchResults([])
    setShowDropdown(false)
    mapRef.current?.setView([r.lat, r.lng], 14)
  }

  // ── Save parcel (geometry stored in Stereo 70) ──────────────────────────
  async function handleSaveParcel() {
    if (!drawnRingStereo || !saveName.trim()) {
      toast.error('Introdu un nume pentru parcela')
      return
    }
    const area = calcAreaHaStereo70(drawnRingStereo)
    if (area <= 0) {
      toast.error('Deseneaza un poligon valid cu minimum 3 puncte')
      return
    }
    if (area > 10000) {
      toast.error('Suprafata trebuie sa fie intre 0.01 si 10,000 ha')
      return
    }

    // Centroid in Stereo 70 → convert to WGS84 for map panning
    const [cx, cy] = centroidStereo70(drawnRingStereo)
    const [centruLat, centruLng] = stereo70ToLeaflet(cx, cy)

    setSaving(true)
    const db = createClient()
    const { data: { user } } = await db.auth.getUser()
    if (!user) {
      toast.error('Trebuie sa fii autentificat')
      setSaving(false)
      return
    }

    // geometry stored in Stereo 70 (EPSG:3844) — APIA/ANCPI compliant
    const geometryStereo70: GeoJSONPolygon = {
      type: 'Polygon',
      coordinates: [drawnRingStereo],
    }

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
        centru_lat: centruLat,  // WGS84 for quick map pan
        centru_lng: centruLng,
        note: saveNote || null,
      }])
      .select()
      .single()

    if (error) {
      toast.error('Eroare la salvare: ' + error.message)
    } else {
      toast.success(`Parcela "${saveName}" salvata in Stereo 70!`)
      closeSaveModal()
      await loadParcels()
      if (data) focusParcel(data as ParceleFitosanitar)
    }
    setSaving(false)
  }

  function closeSaveModal() {
    setShowSaveModal(false)
    setSaveName('')
    setSaveLocalitate('')
    setSaveJudet('')
    setSaveAdresa('')
    setSaveNote('')
    setDrawnRingStereo(null)
    drawnItemsRef.current?.clearLayers()
  }

  // ── Delete ──────────────────────────────────────────────────────────────
  async function handleDeleteConfirm() {
    if (!deleteId) return
    const db = createClient()
    const { error } = await db.from('parcele_fitosanitar').delete().eq('id', deleteId)
    if (error) {
      toast.error('Eroare la stergere: ' + error.message)
    } else {
      toast.success('Parcela stearsa')
      if (selectedId === deleteId) setSelectedId(null)
      await loadParcels()
    }
    setDeleteId(null)
  }

  const deleteParcel = parcels.find(p => p.id === deleteId)
  const isModal = mode === 'modal'

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className={isModal ? 'flex gap-4 h-[calc(100vh-160px)] min-h-[500px]' : 'flex flex-col gap-3'}>

      {/* ── Sidebar ── */}
      {showList && (
        <aside className={isModal
          ? 'w-72 xl:w-80 flex-shrink-0 flex flex-col gap-3 overflow-hidden'
          : 'space-y-3'
        }>

          {/* Address search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
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

          {/* Projection badge */}
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
            <Info className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
            <div className="text-xs text-blue-700">
              <span className="font-semibold">Stereo 70</span> (EPSG:3844) — stocare APIA/ANCPI
            </div>
          </div>

          {/* List header */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-green-600" />
              Parcelele mele
              {!loading && <span className="text-xs font-normal text-gray-400 ml-1">({parcels.length})</span>}
            </h3>
            <button onClick={() => void loadParcels()} title="Reincarcare"
              className="p-1 text-gray-400 hover:text-gray-600 rounded">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Parcel list */}
          <div className={isModal ? 'flex-1 overflow-y-auto pr-1 space-y-2' : 'space-y-2 max-h-64 overflow-y-auto'}>
            {loading ? (
              <div className="text-center py-10">
                <div className="inline-block w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-500 mt-2">Se incarca...</p>
              </div>
            ) : parcels.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <MapPin className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Nu ai parcele salvate.</p>
                {allowDraw && (
                  <p className="text-xs mt-1">Foloseste butonul ✏️ de pe harta pentru a desena.</p>
                )}
              </div>
            ) : (
              parcels.map(parcel => (
                <ParcelItem
                  key={parcel.id}
                  parcel={parcel}
                  isSelected={selectedId === parcel.id}
                  onView={() => focusParcel(parcel)}
                  onDelete={() => setDeleteId(parcel.id)}
                  onSelect={onParcelSelected ? () => focusParcel(parcel) : undefined}
                />
              ))
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
        className="flex-1 flex flex-col rounded-xl overflow-hidden border border-gray-200 shadow-sm"
        style={!isModal ? { height } : undefined}
      >
        {/* Leaflet canvas */}
        <div
          ref={containerRef}
          className="flex-1 w-full"
          style={!isModal ? { minHeight: height } : undefined}
        />

        {/* Coordinate status bar */}
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
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nume parcela <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  placeholder="ex: Teren Campie Nord"
                  autoFocus
                  maxLength={100}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Coordinate info with area */}
              <CoordBadge ring={drawnRingStereo} />

              {/* Judet + Localitate */}
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

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note (optional)</label>
                <textarea value={saveNote} onChange={e => setSaveNote(e.target.value)} rows={2}
                  placeholder="Note suplimentare..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
              </div>

              {/* APIA compliance notice */}
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
    </div>
  )
}
