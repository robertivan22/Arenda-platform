// Types for the Parcele Fitosanitar geographic parcel system

export interface ParceleFitosanitar {
  id: string
  user_id: string
  nume_parcela: string
  nr_cvi?: string | null
  judet?: string | null
  localitate?: string | null
  adresa?: string | null
  suprafata_ha?: number | null
  geometry_geojson: GeoJSONPolygon
  centru_lat?: number | null
  centru_lng?: number | null
  created_at: string
  updated_at: string
  note?: string | null
}

export interface GeoJSONPolygon {
  type: 'Polygon'
  coordinates: number[][][]
}

export interface NominatimResult {
  lat: string
  lon: string
  display_name: string
  address?: {
    county?: string
    state?: string
    city?: string
    town?: string
    village?: string
    postcode?: string
    country?: string
  }
}

export interface MapSearchResult {
  lat: number
  lng: number
  display_name: string
  judet: string
  localitate: string
}
