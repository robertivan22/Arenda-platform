import { PersonType, LessorStatus } from '../constants/enums'

export interface LessorAddress {
  id: string
  lessorId: string
  localityId?: string
  countyId?: string
  uatId?: string
  streetType?: string
  streetName?: string
  number?: string
  block?: string
  staircase?: string
  apartment?: string
  floor?: string
  postalCode?: string
}

export interface LessorContact {
  id: string
  lessorId: string
  mobile?: string
  telephone?: string
  email?: string
}

export interface LessorBankAccount {
  id: string
  lessorId: string
  bankName?: string
  iban?: string
  holderSamePerson: boolean
  holderName?: string
  holderIdentifier?: string
  isPrimary: boolean
  isActive: boolean
}

export interface Lessor {
  id: string
  tenantId: string
  personType: PersonType
  lastName: string
  firstName?: string
  cnpCui: string
  idSeries?: string
  idNumber?: string
  idIssuedBy?: string
  idIssueDate?: string
  status: LessorStatus
  paymentBlocked: boolean
  blockReason?: string
  notes?: string
  createdAt: string
  updatedAt: string
  createdBy?: string
  // Relations (loaded when requested)
  address?: LessorAddress
  contact?: LessorContact
  bankAccounts?: LessorBankAccount[]
}

export interface LessorListItem {
  id: string
  personType: PersonType
  lastName: string
  firstName?: string
  cnpCui: string
  status: LessorStatus
  paymentBlocked: boolean
  locality?: string
  county?: string
  contractCount?: number
  totalSurface?: number
  createdAt: string
}
