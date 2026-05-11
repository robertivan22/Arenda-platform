import { z } from 'zod'
import { ParcelStatus } from '../constants/enums'

export const CreateParcelSchema = z.object({
  tarla: z.string().max(50).optional().nullable(),
  parcela: z.string().max(50).optional().nullable(),
  blocFizic: z.string().max(50).optional().nullable(),
  leasedSurface: z.number().positive().optional().nullable(),
  totalSurface: z.number().positive().optional().nullable(),
  gpsLat: z.number().min(-90).max(90).optional().nullable(),
  gpsLng: z.number().min(-180).max(180).optional().nullable(),
  titleNumber: z.string().max(50).optional().nullable(),
  titleDate: z.string().datetime().optional().nullable(),
  intabulated: z.boolean().default(false),
  titleHolder: z.string().max(200).optional().nullable(),
  heirs: z.string().optional().nullable(),
  boundaryNorth: z.string().max(200).optional().nullable(),
  boundaryEast: z.string().max(200).optional().nullable(),
  boundarySouth: z.string().max(200).optional().nullable(),
  boundaryWest: z.string().max(200).optional().nullable(),
  zoneId: z.string().uuid().optional().nullable(),
  landUseCategoryId: z.string().uuid().optional().nullable(),
  apiaDeclared: z.boolean().default(false),
  commodatSurface: z.number().positive().optional().nullable(),
  observations: z.string().optional().nullable(),
  // Link to contract on creation
  contractId: z.string().uuid().optional().nullable(),
  surfaceAssigned: z.number().positive().optional().nullable(),
})

export const UpdateParcelSchema = CreateParcelSchema.partial()

export const ParcelFiltersSchema = z.object({
  search: z.string().optional(),
  status: z.nativeEnum(ParcelStatus).optional(),
  zoneId: z.string().uuid().optional(),
  landUseCategoryId: z.string().uuid().optional(),
  contractId: z.string().uuid().optional(),
  lessorId: z.string().uuid().optional(),
  apiaDeclared: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(25),
  sortBy: z.string().optional(),
  sortDir: z.enum(['asc', 'desc']).optional(),
})

export type CreateParcelDto = z.infer<typeof CreateParcelSchema>
export type UpdateParcelDto = z.infer<typeof UpdateParcelSchema>
export type ParcelFiltersDto = z.infer<typeof ParcelFiltersSchema>
