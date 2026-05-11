import { z } from 'zod'
import { ContractStatus } from '../constants/enums'

export const ContractRateSchema = z.object({
  kgPerHa: z.number().positive().optional().nullable(),
  eurPerHa: z.number().positive().optional().nullable(),
  ronPerHa: z.number().positive().optional().nullable(),
  taxPerHa: z.number().positive().optional().nullable(),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime().optional().nullable(),
})

export const CreateContractSchema = z.object({
  lessorId: z.string().uuid('Arendatorul este obligatoriu'),
  contractTypeId: z.string().uuid().optional().nullable(),
  mayoraltyId: z.string().uuid().optional().nullable(),
  mayoraltyRegNo: z.string().max(50).optional().nullable(),
  mayoraltyRegDate: z.string().datetime().optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  expiryDate: z.string().datetime().optional().nullable(),
  durationYears: z.number().int().positive().optional().nullable(),
  paymentStartsNextYear: z.boolean().default(false),
  anafWithholding: z.boolean().default(false),
  observations: z.string().optional().nullable(),
  rates: z.array(ContractRateSchema).optional(),
})

export const UpdateContractSchema = CreateContractSchema.partial()

export const ContractFiltersSchema = z.object({
  search: z.string().optional(),
  status: z.nativeEnum(ContractStatus).optional(),
  lessorId: z.string().uuid().optional(),
  mayoraltyId: z.string().uuid().optional(),
  expiringBefore: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(25),
  sortBy: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
})

export type CreateContractDto = z.infer<typeof CreateContractSchema>
export type UpdateContractDto = z.infer<typeof UpdateContractSchema>
export type ContractFiltersDto = z.infer<typeof ContractFiltersSchema>
