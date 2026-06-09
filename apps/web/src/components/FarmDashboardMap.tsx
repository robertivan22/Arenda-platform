'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

export interface MapParcel {
  id: string
  lat: number
  lng: number
  health_label: string
  health_score: number
  name: string
}

const HEALTH_COLOR: Record<string, string> = {
  Excelent: '#22d3ee',
  Bun: '#22c55e',
  Moderat: '#f59e0b',
  Critic: '#ef4444',
}

interface Props {
  parcels: MapParcel[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export default function FarmDashboardMap({ parcels, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layerGroupRef = useRef<L.LayerGroup | null>(null)
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map())

  // Initialise map once
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return
    let mounted = true

    import('leaflet').then(({ default: L }) => {
      if (!mounted || !containerRef.current || mapRef.current) return

      const map = L.map(containerRef.current, {
        zoomControl: true,
        preferCanvas: true,
        attributionControl: false,
      })

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map)

      L.control.attribution({ position: 'bottomright', prefix: '©OpenStreetMap ©CartoDB' }).addTo(map)

      const group = L.layerGroup().addTo(map)
      map.setView([44.8, 25.0], 8) // Romania centroid fallback

      mapRef.current = map
      layerGroupRef.current = group
    })

    return () => {
      mounted = false
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        layerGroupRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Update markers whenever parcels or selection changes
  useEffect(() => {
    if (!mapRef.current || !layerGroupRef.current || parcels.length === 0) return

    import('leaflet').then(({ default: L }) => {
      if (!layerGroupRef.current || !mapRef.current) return

      layerGroupRef.current.clearLayers()
      markersRef.current.clear()
      const bounds: [number, number][] = []

      parcels.forEach(p => {
        const isSelected = p.id === selectedId
        const color = HEALTH_COLOR[p.health_label] ?? '#6b7280'

        const marker = L.circleMarker([p.lat, p.lng], {
          radius: isSelected ? 16 : 12,
          fillColor: color,
          color: isSelected ? '#ffffff' : '#111827',
          weight: isSelected ? 3 : 2,
          fillOpacity: 0.88,
        })

        marker.bindTooltip(
          `<div style="font-size:12px;line-height:1.4"><strong>${p.name}</strong><br>${p.health_label} · ${p.health_score}%</div>`,
          { className: 'farm-map-tooltip' },
        )
        marker.on('click', () => onSelect(p.id))
        marker.addTo(layerGroupRef.current!)
        markersRef.current.set(p.id, marker)
        bounds.push([p.lat, p.lng])
      })

      if (bounds.length > 0) {
        try {
          mapRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 })
        } catch { /* ignore */ }
      }
    })
  }, [parcels, selectedId, onSelect])

  return <div ref={containerRef} className="w-full h-full" />
}
