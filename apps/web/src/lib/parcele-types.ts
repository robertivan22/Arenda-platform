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
  parcela_id?: string | null
  cultura_label?: string | null
  cultura_color?: string | null
}

export interface RegistryParcel {
  id: string
  bloc_fizic?: string | null
  tarla_nr?: string | null
  parcel_nr?: string | null
  county?: string | null
  locality?: string | null
  surface?: number | null
  status?: string | null
  culture?: string | null
  apia_eligible?: boolean | null
  lat?: number | null
  lng?: number | null
  lessor_name?: string | null
  contract_id?: string | null
  contract_number?: string | null
  contract_end_date?: string | null
  // APIA shapefile fields (1:1)
  apia_farm_id?: string | null
  apia_year?: number | null
  siruta?: string | null
  crop_nr?: string | null
  crop_code?: number | null
  agro_env?: boolean | null
  full_bloc?: number | null
  apia_comment?: string | null
  apia_inserted?: string | null
  apia_updated?: string | null
  geom_geojson?: GeoJSONPolygon | null
  centru_lat?: number | null
  centru_lng?: number | null
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
