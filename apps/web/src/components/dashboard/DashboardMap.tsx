'use client'

import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

export interface DashParcel {
  id: string
  name: string
  culture: string | null
  surface: number
  lat: number
  lng: number
  active: boolean
}

interface Props {
  parcels: DashParcel[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}

const color = (p: DashParcel) => (p.active ? '#4ade80' : '#6b7280')

export default function DashboardMap({ parcels, selectedId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const layerRef = useRef<any>(null)
  const LRef = useRef<any>(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  useEffect(() => {
    let mounted = true
    import('leaflet').then(({ default: L }) => {
      if (!mounted || !containerRef.current || mapRef.current) return
      LRef.current = L
      const map = L.map(containerRef.current, { center: [45.4, 25.2], zoom: 6, zoomControl: false })
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OSM &copy; CARTO',
        maxZoom: 19,
      }).addTo(map)
      L.control.zoom({ position: 'topright' }).addTo(map)
      map.on('click', () => onSelectRef.current(null))
      layerRef.current = L.layerGroup().addTo(map)
      mapRef.current = map
      map.fire('dashready')
    })
    return () => {
      mounted = false
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const draw = () => {
      const L = LRef.current
      if (cancelled || !L || !mapRef.current) return false
      layerRef.current.clearLayers()
      parcels.forEach((p) => {
        const sel = p.id === selectedId
        const c = color(p)
        const sz = sel ? 24 : 16
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${c};border:${sel ? '3px solid #fff' : '2px solid rgba(255,255,255,.25)'};box-shadow:0 0 ${sel ? 16 : 8}px ${c}99"></div>`,
          iconSize: [sz, sz],
          iconAnchor: [sz / 2, sz / 2],
        })
        L.marker([p.lat, p.lng], { icon })
          .on('click', (e: any) => {
            L.DomEvent.stopPropagation(e)
            onSelectRef.current(p.id)
          })
          .addTo(layerRef.current)
      })
      return true
    }
    if (!draw()) {
      const t = setInterval(() => { if (draw()) clearInterval(t) }, 100)
      return () => { cancelled = true; clearInterval(t) }
    }
    return () => { cancelled = true }
  }, [parcels, selectedId])

  // Fit once when parcels first arrive
  const fitted = useRef(false)
  useEffect(() => {
    if (fitted.current || !parcels.length) return
    const t = setInterval(() => {
      const L = LRef.current
      if (!L || !mapRef.current) return
      mapRef.current.fitBounds(L.latLngBounds(parcels.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 13 })
      fitted.current = true
      clearInterval(t)
    }, 100)
    return () => clearInterval(t)
  }, [parcels])

  return <div ref={containerRef} className="w-full h-full" />
}
