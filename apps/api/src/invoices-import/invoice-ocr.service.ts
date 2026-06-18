import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { execFile } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import { randomUUID } from 'crypto'

const execFileAsync = promisify(execFile)

export interface OcrResult {
  rawText: string
  searchablePdfPath?: string
  provider: 'pdftotext' | 'ocrmypdf' | 'tesseract'
}

@Injectable()
export class InvoiceOcrService {
  private readonly logger = new Logger(InvoiceOcrService.name)
  private readonly language: string
  private readonly tempDir: string
  private readonly enabled: boolean

  constructor(private readonly config: ConfigService) {
    this.language = config.get<string>('OCR_LANGUAGE', 'ron+eng')
    this.tempDir = config.get<string>('OCR_TEMP_DIR', path.join(os.tmpdir(), 'arendapro-ocr'))
    this.enabled = config.get<string>('OCR_ENABLED', 'true') !== 'false'
  }

  async processInvoice(filePath: string, mimeType: string): Promise<OcrResult> {
    if (!this.enabled) {
      throw new Error('OCR procesarea nu este disponibilă momentan.')
    }
    await fs.mkdir(this.tempDir, { recursive: true })

    if (mimeType === 'application/pdf') {
      return this.processPdf(filePath)
    }
    // image types: image/jpeg, image/png, image/webp
    return this.processImage(filePath, mimeType)
  }

  private async processPdf(filePath: string): Promise<OcrResult> {
    // Try direct text extraction first (searchable PDF)
    const directText = await this.extractTextFromPdf(filePath)
    if (directText.length >= 100) {
      this.logger.log('PDF searchable — using pdftotext')
      return { rawText: directText, provider: 'pdftotext' }
    }

    // Scanned PDF — run OCRmyPDF then extract text
    this.logger.log('PDF scanat — rulare OCRmyPDF')
    try {
      const searchablePath = await this.runOcrMyPdf(filePath)
      const ocrText = await this.extractTextFromPdf(searchablePath)
      return { rawText: ocrText, searchablePdfPath: searchablePath, provider: 'ocrmypdf' }
    } catch (err) {
      this.logger.warn(`OCRmyPDF eșuat, încercare Tesseract direct: ${(err as Error).message}`)
      // Fallback: convert first PDF page to image then tesseract
      const imagePath = await this.pdfPageToImage(filePath)
      const text = await this.runTesseract(imagePath)
      await fs.unlink(imagePath).catch(() => {})
      return { rawText: text, provider: 'tesseract' }
    }
  }

  private async processImage(filePath: string, mimeType: string): Promise<OcrResult> {
    let workPath = filePath

    // Convert WEBP to PNG for Tesseract compatibility
    if (mimeType === 'image/webp') {
      workPath = await this.convertImageToPng(filePath)
    }

    const text = await this.runTesseract(workPath)
    if (workPath !== filePath) await fs.unlink(workPath).catch(() => {})

    return { rawText: text, provider: 'tesseract' }
  }

  async extractTextFromPdf(filePath: string): Promise<string> {
    try {
      const { stdout } = await execFileAsync('pdftotext', ['-enc', 'UTF-8', '-layout', filePath, '-'])
      return stdout.trim()
    } catch {
      return ''
    }
  }

  async runOcrMyPdf(inputPath: string): Promise<string> {
    const outputPath = path.join(this.tempDir, `${randomUUID()}_ocr.pdf`)
    await execFileAsync('ocrmypdf', [
      '--language', this.language,
      '--deskew',
      '--rotate-pages',
      '--quiet',
      '--output-type', 'pdf',
      inputPath,
      outputPath,
    ])
    return outputPath
  }

  async runTesseract(imagePath: string): Promise<string> {
    const { stdout } = await execFileAsync('tesseract', [
      imagePath,
      'stdout',
      '-l', this.language,
      '--psm', '6',
    ])
    return stdout.trim()
  }

  private async pdfPageToImage(pdfPath: string): Promise<string> {
    const outputPath = path.join(this.tempDir, `${randomUUID()}_page`)
    // pdftoppm from poppler: convert first page to PNG at 300 DPI
    await execFileAsync('pdftoppm', [
      '-png', '-r', '300', '-f', '1', '-l', '1',
      pdfPath, outputPath,
    ])
    // pdftoppm appends -1.png
    return `${outputPath}-1.png`
  }

  private async convertImageToPng(imagePath: string): Promise<string> {
    const outputPath = path.join(this.tempDir, `${randomUUID()}.png`)
    // Use ImageMagick convert if available, otherwise copy as-is
    try {
      await execFileAsync('convert', [imagePath, outputPath])
    } catch {
      await fs.copyFile(imagePath, outputPath)
    }
    return outputPath
  }

  async cleanupTempFile(filePath: string): Promise<void> {
    if (filePath.startsWith(this.tempDir)) {
      await fs.unlink(filePath).catch(() => {})
    }
  }
}
