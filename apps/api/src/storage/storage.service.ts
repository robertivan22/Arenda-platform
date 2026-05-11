import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as crypto from 'crypto'
import * as fs from 'fs/promises'
import * as path from 'path'

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name)
  private readonly provider: string

  constructor(private readonly config: ConfigService) {
    this.provider = config.get<string>('STORAGE_PROVIDER', 'LOCAL')
  }

  async upload(params: {
    tenantSlug: string
    entityType: string
    entityId: string
    filename: string
    mimeType: string
    buffer: Buffer
  }): Promise<{ storageKey: string; storageProvider: string; sizeBytes: number; checksum: string }> {
    const checksum = crypto.createHash('sha256').update(params.buffer).digest('hex')
    const ext = path.extname(params.filename)
    const safeFilename = `${Date.now()}-${checksum.substring(0, 8)}${ext}`
    const storageKey = `${params.tenantSlug}/${params.entityType.toLowerCase()}/${params.entityId}/${safeFilename}`

    if (this.provider === 'LOCAL') {
      const basePath = this.config.get<string>('LOCAL_STORAGE_PATH', './uploads')
      const fullPath = path.join(basePath, storageKey)
      await fs.mkdir(path.dirname(fullPath), { recursive: true })
      await fs.writeFile(fullPath, params.buffer)
    }
    // S3 / Azure Blob: inject respective SDK client here in Phase 2

    return {
      storageKey,
      storageProvider: this.provider,
      sizeBytes: params.buffer.length,
      checksum,
    }
  }

  async getSignedUrl(storageKey: string, expiresInSeconds = 300): Promise<string> {
    if (this.provider === 'LOCAL') {
      // In dev: return local file URL
      return `/api/v1/files/serve/${storageKey}`
    }
    // S3: generate presigned URL; Azure: generate SAS URL
    throw new Error('Storage provider not fully configured')
  }

  async delete(storageKey: string): Promise<void> {
    if (this.provider === 'LOCAL') {
      const basePath = this.config.get<string>('LOCAL_STORAGE_PATH', './uploads')
      await fs.unlink(path.join(basePath, storageKey)).catch(() => {})
    }
  }
}
