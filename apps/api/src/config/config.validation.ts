import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  API_PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_CORS_ORIGIN: z.string().default('http://localhost:3000'),
  STORAGE_PROVIDER: z.enum(['S3', 'AZURE_BLOB', 'LOCAL']).default('LOCAL'),

  // Supabase JWT verification (for accepting tokens issued by Supabase)
  SUPABASE_JWT_SECRET: z.string().optional(),

  // OCR configuration
  OCR_ENABLED: z.string().transform(v => v !== 'false').default('true'),
  OCR_LANGUAGE: z.string().default('ron+eng'),
  OCR_MAX_FILE_SIZE_MB: z.coerce.number().default(20),
  OCR_TEMP_DIR: z.string().default('/tmp/arendapro-ocr'),

  // PDF compression
  PDF_COMPRESSION_ENABLED: z.string().transform(v => v !== 'false').default('true'),
  PDF_COMPRESSION_PROFILE: z.enum(['screen', 'ebook', 'printer']).default('screen'),
  PDF_COMPRESSION_MAX_FILE_SIZE_MB: z.coerce.number().default(50),

  // Document storage
  DOCUMENT_STORAGE_PATH: z.string().default('./uploads'),
  LOCAL_STORAGE_PATH: z.string().default('./uploads'),
})

export function configValidation(config: Record<string, unknown>) {
  const result = envSchema.safeParse(config)
  if (!result.success) {
    throw new Error(`Configuration validation error: ${result.error.message}`)
  }
  return result.data
}
