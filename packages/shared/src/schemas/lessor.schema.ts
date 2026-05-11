import { z } from 'zod'
import { PersonType, LessorStatus } from '../constants/enums'

export const LessorAddressSchema = z.object({
  localityId: z.string().uuid().optional().nullable(),
  countyId: z.string().uuid().optional().nullable(),
  uatId: z.string().uuid().optional().nullable(),
  streetType: z.string().max(50).optional().nullable(),
  streetName: z.string().max(200).optional().nullable(),
  number: z.string().max(20).optional().nullable(),
  block: z.string().max(20).optional().nullable(),
  staircase: z.string().max(10).optional().nullable(),
  apartment: z.string().max(10).optional().nullable(),
  floor: z.string().max(10).optional().nullable(),
  postalCode: z.string().max(10).optional().nullable(),
})

export const LessorContactSchema = z.object({
  mobile: z.string().max(20).optional().nullable(),
  telephone: z.string().max(20).optional().nullable(),
  email: z.string().email().optional().nullable(),
})

export const LessorBankAccountSchema = z.object({
  bankName: z.string().max(100).optional().nullable(),
  iban: z.string().max(34).optional().nullable(),
  holderSamePerson: z.boolean().default(true),
  holderName: z.string().max(200).optional().nullable(),
  holderIdentifier: z.string().max(20).optional().nullable(),
  isPrimary: z.boolean().default(false),
})

export const CreateLessorSchema = z.object({
  personType: z.nativeEnum(PersonType).default(PersonType.INDIVIDUAL),
  lastName: z.string().min(1, 'Numele este obligatoriu').max(100),
  firstName: z.string().max(100).optional().nullable(),
  cnpCui: z.string().min(5, 'CNP/CUI este obligatoriu').max(20),
  idSeries: z.string().max(5).optional().nullable(),
  idNumber: z.string().max(10).optional().nullable(),
  idIssuedBy: z.string().max(100).optional().nullable(),
  idIssueDate: z.string().datetime().optional().nullable(),
  notes: z.string().optional().nullable(),
  address: LessorAddressSchema.optional(),
  contact: LessorContactSchema.optional(),
  bankAccounts: z.array(LessorBankAccountSchema).optional(),
})

export const UpdateLessorSchema = CreateLessorSchema.partial()

export const LessorFiltersSchema = z.object({
  search: z.string().optional(),
  status: z.nativeEnum(LessorStatus).optional(),
  blocked: z.coerce.boolean().optional(),
  countyId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(25),
  sortBy: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
})

export type CreateLessorDto = z.infer<typeof CreateLessorSchema>
export type UpdateLessorDto = z.infer<typeof UpdateLessorSchema>
export type LessorFiltersDto = z.infer<typeof LessorFiltersSchema>
