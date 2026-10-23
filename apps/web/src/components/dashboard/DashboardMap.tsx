'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import { isLikelyStereo70, ringStereo70ToWgs84 } from '@/lib/stereo70'

export interface DashPolygon {
  id: string
  parcelId: string | null
  name: string
  color: string
  ring: number[][]
  fresh: boolean
  info: string[]
}

export interface DashPoint {
  id: string
  name: string
  color: string
  lat: number
  lng: number
  fresh: boolean
  info: string[]
}

const safeColor = (c: string) => (/^#[0-9a-fA-F]{3,8}$/.test(c) ? c : '#4a6640')
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`)

const tip = (name: string, info: string[]) =>
  `<div style="font-size:12px;line-height:1.5"><b>${esc(name)}</b>${info.map((l) => `<br/>${esc(l)}`).join('')}</div>`

// Same legend colours the parcel map uses (stored per browser).
function legendColors(): Record<string, string> {
  try {
    const items = JSON.parse(localStorage.getItem('map_legend_items') ?? '[]') as { id: string; color: string }[]
    const map = JSON.parse(localStorage.getItem('map_parcel_legend_map') ?? '{}') as Record<string, string>
    const byId = new Map(items.map((i) => [i.id, i.color]))
    const out: Record<string, string> = {}
    Object.entries(map).forEach(([pid, lid]) => { const c = byId.get(lid); if (c) out[pid] = c })
    return out
  } catch {
    return {}
  }
}

export default function DashboardMap({ polygons, points }: { polygons: DashPolygon[]; points: DashPoint[] }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let map: any
    let timer: ReturnType<typeof setTimeout> | undefined
    let cancelled = false
    import('leaflet').then(({ default: L }) => {
      if (cancelled || !ref.current) return
      map = L.map(ref.current, { scrollWheelZoom: false, attributionControl: false })
      const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 })
      const sat = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19 },
      )
      sat.addTo(map)
      L.control.layers({ Satelit: sat, OpenStreetMap: osm }, {}, { position: 'topright' }).addTo(map)

      const legend = legendColors()
      const bounds: [number, number][] = []
      const polyPane = L.layerGroup().addTo(map)
      const pinPane = L.layerGroup().addTo(map)

      polygons.forEach((p) => {
        if (!p.ring || p.ring.length < 3) return
        const wgs = isLikelyStereo70(p.ring[0]) ? ringStereo70ToWgs84(p.ring) : p.ring
        const c = safeColor((p.parcelId && legend[p.parcelId]) || legend[p.id] || p.color)
        const html = tip(p.name, p.info)
        L.geoJSON({ type: 'Polygon', coordinates: [wgs] } as any, {
          style: { color: c, fillColor: c, fillOpacity: p.fresh ? 0.55 : 0.4, weight: 2.5, dashArray: p.fresh ? '5 4' : undefined },
        }).bindTooltip(html, { sticky: true }).addTo(polyPane)

        // Pin at the centre so parcels stay visible when zoomed out.
        const lats = wgs.map((q) => q[1]), lngs = wgs.map((q) => q[0])
        const cLat = (Math.min(...lats) + Math.max(...lats)) / 2
        const cLng = (Math.min(...lngs) + Math.max(...lngs)) / 2
        L.circleMarker([cLat, cLng], { radius: 5, color: '#fff', weight: 2, fillColor: c, fillOpacity: 1 })
          .bindTooltip(html).addTo(pinPane)
        wgs.forEach(([lng, lat]) => bounds.push([lat, lng]))
      })

      points.forEach((p) => {
        L.circleMarker([p.lat, p.lng], { radius: 7, color: '#fff', weight: 2, fillColor: safeColor(p.color), fillOpacity: 0.95 })
          .bindTooltip(tip(p.name, p.info)).addTo(pinPane)
        bounds.push([p.lat, p.lng])
      })

      if (bounds.length) map.fitBounds(L.latLngBounds(bounds), { padding: [36, 36], maxZoom: 15 })
      else map.setView([45.9432, 24.9668], 6)
      timer = setTimeout(() => { if (!cancelled) map?.invalidateSize() }, 100)
    }).catch(() => { /* map is optional; never break the page */ })
    return () => {
      cancelled = true
      clearTimeout(timer)
      try { map?.remove() } catch { /* already torn down */ }
    }
  }, [polygons, points])

  return <div ref={ref} className="absolute inset-0 z-0" />
}
