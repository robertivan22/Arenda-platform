import { ParcelStatus } from '../constants/enums'

export interface Parcel {
  id: string
  tenantId: string
  tarla?: string
  parcela?: string
  blocFizic?: string
  leasedSurface?: number
  totalSurface?: number
  gpsLat?: number
  gpsLng?: number
  titleNumber?: string
  titleDate?: string
  intabulated: boolean
  titleHolder?: string
  heirs?: string
  boundaryNorth?: string
  boundaryEast?: string
  boundarySouth?: string
  boundaryWest?: string
  zoneId?: string
  landUseCategoryId?: string
  apiaDeclared: boolean
  commodatSurface?: number
  observations?: string
  status: ParcelStatus
  createdAt: string
  updatedAt: string
  // Relations
  zone?: { id: string; name: string }
  landUseCategory?: { id: string; name: string; code: string }
}

export interface ParcelListItem {
  id: string
  tarla?: string
  parcela?: string
  leasedSurface?: number
  totalSurface?: number
  zoneName?: string
  landUseCategoryName?: string
  intabulated: boolean
  apiaDeclared: boolean
  status: ParcelStatus
  contractCount: number
  lessorCount: number
}
