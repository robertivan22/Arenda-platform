/**
 * Supabase DB types — mirrors the real DB schema (snake_case).
 * Import createClient from ./client in 'use client' pages.
 */

export type LessorType = 'NATURAL' | 'LEGAL' | 'PFA'
export type LessorStatus = 'ACTIVE' | 'INACTIVE'
export type PaymentStatus = 'PENDING' | 'PAID' | 'OVERDUE'
export type ContractStatus = 'ACTIVE' | 'EXPIRED' | 'DRAFT'

export interface DbLessor {
  id: string
  user_id: string
  code: string
  type: LessorType
  first_name: string
  last_name: string
  company_name: string | null
  cnp: string          // 13-digit CNP (physical person) or CUI (legal)
  gender: string | null
  county: string
  locality: string
  address: string | null
  phone: string | null
  mobile: string | null
  email: string | null
  iban: string | null
  bank_name: string | null
  notes: string | null
  status: LessorStatus
  created_at: string
}

export interface DbPayment {
  id: string
  user_id: string
  lessor_id: string
  contract_id: string | null
  contract_number: string | null
  amount: number
  due_date: string
  paid_date: string | null
  status: PaymentStatus
  notes: string | null
  created_at: string
}

export interface DbContract {
  id: string
  user_id: string
  lessor_id: string
  contract_number: string
  contract_type: string
  zone: string | null
  sign_date: string | null
  start_date: string
  end_date: string
  total_parcels: number
  annual_rent: number
  status: ContractStatus
  created_at: string
}

export interface DbParcel {
  id: string
  user_id: string
  parcel_code: string | null
  tarla_nr: string | null
  parcel_nr: string | null
  county: string
  locality: string
  land_use_category: string | null
  surface: number
  surface_rented: number | null
  lessor_id: string | null
  contract_id: string | null
  status: string
  created_at: string
}

/** Compute display name for a lessor row */
export function lessorDisplayName(l: Pick<DbLessor, 'type' | 'first_name' | 'last_name' | 'company_name'>): string {
  return l.type === 'LEGAL' ? (l.company_name ?? '') : `${l.last_name} ${l.first_name}`.trim()
}
