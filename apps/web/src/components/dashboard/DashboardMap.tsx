'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import { isLikelyStereo70, ringStereo70ToWgs84 } from '@/lib/stereo70'

export interface DashPolygon {
  id: string
  name: string
  ha: number | null
  color: string
  ring: number[][]
  fresh: boolean
}

export interface DashPoint {
  id: string
  name: string
  ha: number | null
  color: string
  lat: number
  lng: number
  fresh: boolean
}

const safeColor = (c: string) => (/^#[0-9a-fA-F]{3,8}$/.test(c) ? c : '#4a6640')
const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`)

export default function DashboardMap({ polygons, points }: { polygons: DashPolygon[]; points: DashPoint[] }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let map: any
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

      const bounds: [number, number][] = []
      const label = (n: string, ha: number | null) =>
        `<b>${esc(n)}</b>${ha != null ? ` · ${Number(ha).toLocaleString('ro-RO', { maximumFractionDigits: 2 })} ha` : ''}`

      polygons.forEach((p) => {
        if (!p.ring || p.ring.length < 3) return
        const wgs = isLikelyStereo70(p.ring[0]) ? ringStereo70ToWgs84(p.ring) : p.ring
        const c = safeColor(p.color)
        L.geoJSON({ type: 'Polygon', coordinates: [wgs] } as any, {
          style: { color: c, fillColor: c, fillOpacity: p.fresh ? 0.45 : 0.25, weight: p.fresh ? 3 : 2, dashArray: p.fresh ? '4 3' : undefined },
        }).bindTooltip(label(p.name, p.ha), { sticky: true }).addTo(map)
        wgs.forEach(([lng, lat]) => bounds.push([lat, lng]))
      })

      points.forEach((p) => {
        L.circleMarker([p.lat, p.lng], { radius: 8, color: '#fff', weight: 2, fillColor: safeColor(p.color), fillOpacity: 0.9 })
          .bindTooltip(label(p.name, p.ha))
          .addTo(map)
        bounds.push([p.lat, p.lng])
      })

      if (bounds.length) map.fitBounds(L.latLngBounds(bounds), { padding: [36, 36], maxZoom: 15 })
      else map.setView([45.9432, 24.9668], 6)
      setTimeout(() => map.invalidateSize(), 100)
    })
    return () => {
      cancelled = true
      map?.remove()
    }
  }, [polygons, points])

  return <div ref={ref} className="absolute inset-0 z-0" />
}
