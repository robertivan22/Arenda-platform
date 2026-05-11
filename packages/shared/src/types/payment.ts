export interface Payment {
  id: string
  tenantId: string
  batchId?: string
  contractId?: string
  lessorId: string
  paymentMethodId?: string
  amountRon?: number
  amountEur?: number
  surfacePaid?: number
  periodFrom?: string
  periodTo?: string
  status: string
  notes?: string
  createdAt: string
}
