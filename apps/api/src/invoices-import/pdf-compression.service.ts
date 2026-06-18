import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { execFile } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'
import { randomUUID } from 'crypto'

const execFileAsync = promisify(execFile)

export type CompressionProfile = 'screen' | 'ebook' | 'printer'

export interface CompressionResult {
  outputPath: string
  originalSizeBytes: number
  compressedSizeBytes: number
  compressionRatio: number   // e.g. 0.42 = 42% reduction
  status: 'completed' | 'skipped' | 'failed'
  skippedReason?: string
}

@Injectable()
export class PdfCompressionService {
  private readonly logger = new Logger(PdfCompressionService.name)
  private readonly enabled: boolean
  private readonly profile: CompressionProfile

  constructor(private readonly config: ConfigService) {
    this.enabled = config.get<string>('PDF_COMPRESSION_ENABLED', 'true') !== 'false'
    this.profile = (config.get<string>('PDF_COMPRESSION_PROFILE', 'screen') as CompressionProfile)
  }

  async compressPdf(inputPath: string): Promise<CompressionResult> {
    const originalSizeBytes = await this.getPdfSize(inputPath)

    if (!this.enabled) {
      return {
        outputPath: inputPath,
        originalSizeBytes,
        compressedSizeBytes: originalSizeBytes,
        compressionRatio: 0,
        status: 'skipped',
        skippedReason: 'PDF_COMPRESSION_ENABLED=false',
      }
    }

    const outputPath = path.join(path.dirname(inputPath), `${randomUUID()}_compressed.pdf`)

    try {
      await this.runGhostscript(inputPath, outputPath, this.profile)
    } catch (err) {
      this.logger.warn(`Ghostscript eșuat cu profil ${this.profile}: ${(err as Error).message}`)
      return {
        outputPath: inputPath,
        originalSizeBytes,
        compressedSizeBytes: originalSizeBytes,
        compressionRatio: 0,
        status: 'failed',
        skippedReason: 'Ghostscript indisponibil sau eroare de procesare',
      }
    }

    // Validate output exists
    if (!await this.validateCompressedPdf(outputPath)) {
      await fs.unlink(outputPath).catch(() => {})
      return {
        outputPath: inputPath,
        originalSizeBytes,
        compressedSizeBytes: originalSizeBytes,
        compressionRatio: 0,
        status: 'failed',
        skippedReason: 'PDF comprimat invalid',
      }
    }

    const compressedSizeBytes = await this.getPdfSize(outputPath)

    // If compressed is larger or equal, keep original
    if (compressedSizeBytes >= originalSizeBytes) {
      await fs.unlink(outputPath).catch(() => {})
      this.logger.log('Compresia nu a redus dimensiunea — păstrat originalul')
      return {
        outputPath: inputPath,
        originalSizeBytes,
        compressedSizeBytes: originalSizeBytes,
        compressionRatio: 0,
        status: 'skipped',
        skippedReason: 'Compresia nu a redus dimensiunea. A fost păstrat fișierul original.',
      }
    }

    const compressionRatio = (originalSizeBytes - compressedSizeBytes) / originalSizeBytes

    this.logger.log(
      `PDF comprimat: ${originalSizeBytes} → ${compressedSizeBytes} bytes (${(compressionRatio * 100).toFixed(1)}% reducere)`,
    )

    return { outputPath, originalSizeBytes, compressedSizeBytes, compressionRatio, status: 'completed' }
  }

  async getPdfSize(filePath: string): Promise<number> {
    const stat = await fs.stat(filePath)
    return stat.size
  }

  calculateCompressionRatio(originalSize: number, compressedSize: number): number {
    if (originalSize === 0) return 0
    return (originalSize - compressedSize) / originalSize
  }

  async validateCompressedPdf(filePath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(filePath)
      if (stat.size < 100) return false
      // Check PDF magic bytes
      const fd = await fs.open(filePath, 'r')
      const buf = Buffer.alloc(5)
      await fd.read(buf, 0, 5, 0)
      await fd.close()
      return buf.toString('ascii') === '%PDF-'
    } catch {
      return false
    }
  }

  private async runGhostscript(
    inputPath: string,
    outputPath: string,
    profile: CompressionProfile,
  ): Promise<void> {
    await execFileAsync('gs', [
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.4',
      `-dPDFSETTINGS=/${profile}`,
      '-dNOPAUSE',
      '-dQUIET',
      '-dBATCH',
      `-sOutputFile=${outputPath}`,
      inputPath,
    ])
  }
}
