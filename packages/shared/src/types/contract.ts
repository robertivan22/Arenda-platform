import { ContractStatus } from '../constants/enums'

export interface ContractRate {
  id: string
  contractId: string
  kgPerHa?: number
  eurPerHa?: number
  ronPerHa?: number
  taxPerHa?: number
  validFrom: string
  validTo?: string
}

export interface Contract {
  id: string
  tenantId: string
  lessorId: string
  contractTypeId?: string
  mayoraltyId?: string
  mayoraltyRegNo?: string
  mayoraltyRegDate?: string
  startDate?: string
  expiryDate?: string
  durationYears?: number
  paymentStartsNextYear: boolean
  anafWithholding: boolean
  status: ContractStatus
  observations?: string
  createdAt: string
  updatedAt: string
  createdBy?: string
  // Relations
  rates?: ContractRate[]
  lessor?: { id: string; lastName: string; firstName?: string; cnpCui: string }
  mayoralty?: { id: string; name: string }
  parcelCount?: number
  totalLeasedSurface?: number
}

export interface ContractListItem {
  id: string
  lessorName: string
  lessorCnpCui: string
  mayoraltyName?: string
  contractTypeName?: string
  startDate?: string
  expiryDate?: string
  status: ContractStatus
  parcelCount: number
  totalSurface: number
  createdAt: string
}
