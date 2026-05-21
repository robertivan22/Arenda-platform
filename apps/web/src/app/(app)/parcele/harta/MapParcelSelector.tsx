'use client'

// This file is loaded ONLY in the browser via dynamic(() => import(...), { ssr: false })
// All Leaflet imports are safe here.
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import 'leaflet-draw'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Search, MapPin, Trash2, Eye, Check, X, RefreshCw, Layers, Plus,
} from 'lucide-react'
import type { ParceleFitosanitar, GeoJSONPolygon, MapSearchResult } from '@/lib/parcele-types'

// ─── Fix Leaflet default marker icons (often break in bundled environments) ──
function fixLeafletIcons() {
  // We don't use markers in this component, but fix globally just in case
  const iconProto = L.Icon.Default.prototype as unknown as Record<string, unknown>
  delete iconProto._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  })
}

// ─── Area calculation (spherical trapezoidal formula) ────────────────────────
// coords: GeoJSON ring [[lng, lat], [lng, lat], ...] (closed – last == first)
function calcAreaHa(coords: number[][]): number {
  if (coords.length < 4) return 0
  const R = 6378137 // Earth radius in metres
  let area = 0
  const n = coords.length - 1 // skip closing duplicate point
  for (let i = 0; i < n; i++) {
    const dlon = (coords[(i + 1) % n][0] - coords[i][0]) * (Math.PI / 180)
    const phi1 = coords[i][1] * (Math.PI / 180)
    const phi2 = coords[(i + 1) % n][1] * (Math.PI / 180)
    area += dlon * (Math.sin(phi1) + Math.sin(phi2))
  }
  return Math.round(Math.abs(area * R * R / 2) / 10000 * 100) / 100
}

function getCentroid(coords: number[][]): { lat: number; lng: number } {
  const n = coords.length - 1 // skip closing duplicate
  let sumLng = 0
  let sumLat = 0
  for (let i = 0; i < n; i++) {
    sumLng += coords[i][0]
    sumLat += coords[i][1]
  }
  return { lat: sumLat / n, lng: sumLng / n }
}

// ─── Nominatim search ────────────────────────────────────────────────────────
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

async function reverseGeocode(lat: number, lng: number): Promise<{ judet: string; localitate: string; adresa: string }> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
    { headers: { 'Accept-Language': 'ro' } },
  )
  const data = await res.json() as {
    display_name?: string
    address?: { county?: string; state?: string; city?: string; town?: string; village?: string }
  }
  return {
    judet: data.address?.county ?? data.address?.state ?? '',
    localitate: data.address?.city ?? data.address?.town ?? data.address?.village ?? '',
    adresa: data.display_name ?? '',
  }
}

// ─── Component props ─────────────────────────────────────────────────────────
export interface MapParcelSelectorProps {
  mode?: 'modal' | 'inline'
  onParcelSelected?: (parcel: ParceleFitosanitar) => void
  initialParcelId?: string
  showList?: boolean
  height?: string
  allowDraw?: boolean
  initialCenter?: [number, number]
  initialZoom?: number
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
          {parcel.suprafata_ha != null && (
            <div className="text-xs font-semibold text-green-700 mt-0.5">
              {Number(parcel.suprafata_ha).toFixed(2)} ha
            </div>
          )}
          <div className="text-xs text-gray-400 mt-0.5">
            {new Date(parcel.created_at).toLocaleDateString('ro-RO')}
          </div>
        </div>
        <div className="flex flex-col gap-0.5 flex-shrink-0">
          <button
            onClick={onView}
            title="Vizualizează pe hartă"
            className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {onSelect && (
            <button
              onClick={onSelect}
              title="Selectează parcelă"
              className="p-1.5 text-gray-400 hover:text-green-600 rounded hover:bg-green-50 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onDelete}
            title="Șterge parcelă"
            className="p-1.5 text-gray-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
          >
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

  // Drawing
  const [drawnCoords, setDrawnCoords] = useState<number[][] | null>(null)
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

  // Search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<MapSearchResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)

  // ── Init Leaflet map ────────────────────────────────────────────────────────
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

    osm.addTo(map)
    L.control.layers({ OpenStreetMap: osm, Satelit: satellite, Teren: topo }, {}, {
      position: 'topright',
    }).addTo(map)

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

        const geo = layer.toGeoJSON() as GeoJSON.Feature<GeoJSON.Polygon>
        const coords = geo.geometry.coordinates[0]
        setDrawnCoords(coords)

        // Reverse geocode centroid
        const center = layer.getBounds().getCenter()
        try {
          const geo = await reverseGeocode(center.lat, center.lng)
          setSaveJudet(geo.judet)
          setSaveLocalitate(geo.localitate)
          setSaveAdresa(geo.adresa)
        } catch {
          // Non-blocking
        }

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
  }, []) // run once

  // ── Load parcels from Supabase ──────────────────────────────────────────────
  const loadParcels = useCallback(async () => {
    setLoading(true)
    const db = createClient()
    const { data, error } = await db
      .from('parcele_fitosanitar')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      toast.error('Eroare la încărcare parcele: ' + error.message)
    } else {
      setParcels((data ?? []) as ParceleFitosanitar[])
    }
    setLoading(false)
  }, [])

  useEffect(() => { void loadParcels() }, [loadParcels])

  // ── Render parcel polygons on map ──────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    // Remove all existing parcel layers
    parcelLayersRef.current.forEach(layer => map.removeLayer(layer))
    parcelLayersRef.current.clear()

    // Re-add all parcels
    parcels.forEach(parcel => {
      const isSelected = parcel.id === selectedId
      const layer = L.geoJSON(parcel.geometry_geojson as GeoJSON.GeoJsonObject, {
        style: {
          color: isSelected ? '#1d4ed8' : '#15803d',
          fillColor: isSelected ? '#3b82f6' : '#22c55e',
          fillOpacity: isSelected ? 0.3 : 0.2,
          weight: isSelected ? 3 : 2,
        },
      })
        .bindTooltip(parcel.nume_parcela, { sticky: true })
        .on('click', () => focusParcel(parcel))

      layer.addTo(map)
      parcelLayersRef.current.set(parcel.id, layer)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcels, selectedId])

  // ── Focus / select parcel ──────────────────────────────────────────────────
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

  function handleViewOnMap(parcel: ParceleFitosanitar) {
    focusParcel(parcel)
  }

  // ── Address search ─────────────────────────────────────────────────────────
  function handleSearchInput(value: string) {
    setSearchQuery(value)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    if (value.trim().length < 3) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const results = await searchNominatim(value.trim())
        setSearchResults(results)
        setShowDropdown(results.length > 0)
      } catch {
        setSearchResults([])
      }
    }, 300)
  }

  function handleSearchSelect(result: MapSearchResult) {
    setSearchQuery(result.display_name.split(',')[0])
    setSearchResults([])
    setShowDropdown(false)
    mapRef.current?.setView([result.lat, result.lng], 14)
  }

  // ── Save parcel ────────────────────────────────────────────────────────────
  async function handleSaveParcel() {
    if (!drawnCoords || !saveName.trim()) {
      toast.error('Introdu un nume pentru parcelă')
      return
    }
    const area = calcAreaHa(drawnCoords)
    if (area <= 0) {
      toast.error('Desenează un poligon valid cu minimum 3 puncte')
      return
    }
    if (area > 10000) {
      toast.error('Suprafața trebuie să fie între 0.01 și 10,000 ha')
      return
    }

    const { lat: centruLat, lng: centruLng } = getCentroid(drawnCoords)
    setSaving(true)

    const db = createClient()
    const { data, error } = await db
      .from('parcele_fitosanitar')
      .insert([{
        nume_parcela: saveName.trim(),
        judet: saveJudet || null,
        localitate: saveLocalitate || null,
        adresa: saveAdresa || null,
        suprafata_ha: area,
        geometry_geojson: { type: 'Polygon', coordinates: [drawnCoords] } as GeoJSONPolygon,
        centru_lat: centruLat,
        centru_lng: centruLng,
        note: saveNote || null,
      }])
      .select()
      .single()

    if (error) {
      toast.error('Eroare la salvare: ' + error.message)
    } else {
      toast.success(`Parcelă "${saveName}" salvată cu succes!`)
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
    setDrawnCoords(null)
    drawnItemsRef.current?.clearLayers()
  }

  // ── Delete parcel ──────────────────────────────────────────────────────────
  async function handleDeleteConfirm() {
    if (!deleteId) return
    const db = createClient()
    const { error } = await db.from('parcele_fitosanitar').delete().eq('id', deleteId)
    if (error) {
      toast.error('Eroare la ștergere: ' + error.message)
    } else {
      toast.success('Parcelă ștearsă')
      if (selectedId === deleteId) setSelectedId(null)
      await loadParcels()
    }
    setDeleteId(null)
  }

  const deleteParcel = parcels.find(p => p.id === deleteId)

  // ── Render ─────────────────────────────────────────────────────────────────
  const isModal = mode === 'modal'
  const mapHeight = isModal ? 'h-full' : `h-[${height}]`

  return (
    <div className={isModal ? 'flex gap-4 h-[calc(100vh-160px)] min-h-[500px]' : 'flex flex-col gap-3'}>

      {/* ── Sidebar ── */}
      {showList && (
        <aside className={
          isModal
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
              placeholder="Caută adresă, localitate..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
            />
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-[2000] w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    onMouseDown={() => handleSearchSelect(r)}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-green-50 border-b border-gray-100 last:border-0 transition-colors"
                  >
                    <div className="font-medium text-gray-800 truncate">
                      {r.display_name.split(',')[0]}
                    </div>
                    <div className="text-xs text-gray-500 truncate mt-0.5">
                      {[r.localitate, r.judet].filter(Boolean).join(', ')}
                    </div>
                  </button>
                ))}
              </div>
            )}
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
            <button
              onClick={() => void loadParcels()}
              className="p-1 text-gray-400 hover:text-gray-600 rounded"
              title="Reîncarcă"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Parcel list */}
          <div className={isModal ? 'flex-1 overflow-y-auto pr-1 space-y-2' : 'space-y-2 max-h-64 overflow-y-auto'}>
            {loading ? (
              <div className="text-center py-10">
                <div className="inline-block w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-gray-500 mt-2">Se încarcă...</p>
              </div>
            ) : parcels.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <MapPin className="w-10 h-10 mx-auto mb-2 opacity-20" />
                <p className="text-sm">Nu ai parcele salvate.</p>
                {allowDraw && (
                  <p className="text-xs mt-1 text-gray-400">
                    Folosește butonul <strong>✏️</strong> de pe hartă<br />pentru a desena o parcelă nouă.
                  </p>
                )}
              </div>
            ) : (
              parcels.map(parcel => (
                <ParcelItem
                  key={parcel.id}
                  parcel={parcel}
                  isSelected={selectedId === parcel.id}
                  onView={() => handleViewOnMap(parcel)}
                  onDelete={() => setDeleteId(parcel.id)}
                  onSelect={onParcelSelected ? () => focusParcel(parcel) : undefined}
                />
              ))
            )}
          </div>

          {/* Draw hint */}
          {allowDraw && parcels.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
              <Plus className="w-3.5 h-3.5 flex-shrink-0" />
              <span>Folosește bara de pe hartă pentru a adăuga o parcelă nouă</span>
            </div>
          )}
        </aside>
      )}

      {/* ── Map container ── */}
      <div
        className="flex-1 relative rounded-xl overflow-hidden border border-gray-200 shadow-sm"
        style={!isModal ? { height } : undefined}
      >
        <div ref={containerRef} className="w-full h-full" style={{ minHeight: isModal ? undefined : height }} />

        {/* Layer hint */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
          <div className="flex items-center gap-1.5 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs text-gray-600 shadow-sm border border-gray-200">
            <Layers className="w-3 h-3" />
            <span>Schimbă stratul din colțul dreapta sus</span>
          </div>
        </div>
      </div>

      {/* ── Save modal ── */}
      {showSaveModal && drawnCoords && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-800">Salvează parcelă nouă</h2>
              <button onClick={closeSaveModal} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 py-4 space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nume parcelă <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={saveName}
                  onChange={e => setSaveName(e.target.value)}
                  placeholder="ex: Teren Câmpie Nord"
                  autoFocus
                  maxLength={100}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              {/* Area (auto) */}
              <div className="flex items-center gap-3 px-3 py-2.5 bg-green-50 border border-green-200 rounded-lg">
                <MapPin className="w-4 h-4 text-green-600 flex-shrink-0" />
                <div>
                  <div className="text-xs text-green-600">Suprafață calculată automat</div>
                  <div className="text-sm font-bold text-green-800">{calcAreaHa(drawnCoords)} ha</div>
                </div>
              </div>

              {/* Judet + Localitate */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Județ</label>
                  <input
                    type="text"
                    value={saveJudet}
                    onChange={e => setSaveJudet(e.target.value)}
                    placeholder="ex: Ilfov"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Localitate</label>
                  <input
                    type="text"
                    value={saveLocalitate}
                    onChange={e => setSaveLocalitate(e.target.value)}
                    placeholder="ex: Snagov"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              {/* Note */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Note (opțional)</label>
                <textarea
                  value={saveNote}
                  onChange={e => setSaveNote(e.target.value)}
                  rows={2}
                  placeholder="Note suplimentare despre această parcelă..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={closeSaveModal}
                className="flex-1 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Anulare
              </button>
              <button
                onClick={() => void handleSaveParcel()}
                disabled={!saveName.trim() || saving}
                className="flex-1 px-4 py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Se salvează...
                  </span>
                ) : 'Salvează parcelă'}
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
              <h2 className="text-base font-semibold text-gray-800">Confirmare ștergere</h2>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600">
                Ești sigur că vrei să ștergi parcela{' '}
                <strong className="text-gray-800">„{deleteParcel?.nume_parcela}"</strong>?
              </p>
              <p className="text-xs text-red-600 mt-2">Această acțiune nu poate fi anulată.</p>
            </div>
            <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Anulare
              </button>
              <button
                onClick={() => void handleDeleteConfirm()}
                className="flex-1 px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Șterge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
