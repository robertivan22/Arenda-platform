'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { PageHeader } from '@/components/layout/PageHeader'
import { Map } from 'lucide-react'

const MapParcelSelector = dynamic(
  () => import('./MapParcelSelector'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-[500px] bg-gray-50 rounded-xl border border-gray-200">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-3 border-green-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-500">Se încarcă harta...</p>
        </div>
      </div>
    ),
  },
)

function MapWithParams() {
  const params = useSearchParams()
  const rawLat  = parseFloat(params.get('lat')  ?? '')
  const rawLng  = parseFloat(params.get('lng')  ?? '')
  const rawZoom = parseInt(params.get('zoom')  ?? '')
  const center: [number, number] = (!isNaN(rawLat) && !isNaN(rawLng))
    ? [rawLat, rawLng]
    : [45.9432, 24.9668]
  const zoom = !isNaN(rawZoom) ? rawZoom : 7
  return (
    <MapParcelSelector
      mode="modal"
      allowDraw={true}
      showList={true}
      initialCenter={center}
      initialZoom={zoom}
    />
  )
}

export default function HartaParcelePage() {
  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Sub-nav */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <a href="/parcele" className="px-4 py-1.5 text-sm rounded-md text-gray-500 hover:text-gray-700 transition-colors">Lista parcele</a>
        <span className="px-4 py-1.5 text-sm rounded-md bg-white shadow text-brand-700 font-medium">Hartă parcele</span>
      </div>

      <PageHeader
        title="Hartă Parcele"
        subtitle="Desenează și gestionează parcelele tale agricole pe hartă"
        actions={
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
            <Map className="w-3.5 h-3.5" />
            <span>OpenStreetMap + Leaflet Draw</span>
          </div>
        }
      />
      <Suspense fallback={<div className="h-[500px] bg-gray-50 rounded-xl border border-gray-200" />}>
        <MapWithParams />
      </Suspense>
    </div>
  )
}
