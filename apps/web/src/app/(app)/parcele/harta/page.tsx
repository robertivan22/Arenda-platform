'use client'

import dynamic from 'next/dynamic'
import { PageHeader } from '@/components/layout/PageHeader'
import { Map } from 'lucide-react'

// Leaflet must be loaded only in the browser (it accesses `window`).
// ssr: false ensures the import never runs on the server / edge.
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

export default function HartaParcelePage() {
  return (
    <div className="flex flex-col gap-4 h-full">
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

      <MapParcelSelector
        mode="modal"
        allowDraw={true}
        showList={true}
        initialCenter={[45.9432, 24.9668]}
        initialZoom={7}
      />
    </div>
  )
}
