import {
  Injectable, Logger, NotFoundException, BadRequestException, ConflictException,
} from '@nestjs/common'
import { PrismaService } from '../database/prisma.service'
import { AuditService } from '../audit/audit.service'
import { StorageService } from '../storage/storage.service'
import { InvoiceOcrService } from './invoice-ocr.service'
import { InvoiceParserService, ParsedInvoice } from './invoice-parser.service'
import { PdfCompressionService } from './pdf-compression.service'
import { AuditAction, InvoiceImportStatus, MatchStatus, Prisma } from '@prisma/client'
import * as fs from 'fs/promises'
import * as path from 'path'
import { randomUUID } from 'crypto'

const ALLOWED_INVOICE_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
])

const ALLOWED_CONTRACT_MIME = new Set(['application/pdf'])

@Injectable()
export class InvoicesImportService {
  private readonly logger = new Logger(InvoicesImportService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly ocr: InvoiceOcrService,
    private readonly parser: InvoiceParserService,
    private readonly compression: PdfCompressionService,
  ) {}

  // ── Invoice Import ────────────────────────────────────────────────────────

  async createInvoiceImport(
    tenantId: string,
    userId: string,
    file: Express.Multer.File,
  ) {
    this.validateFile(file, ALLOWED_INVOICE_MIME, 20)

    // Save original file
    const { storageKey } = await this.storage.upload({
      tenantSlug: tenantId,
      entityType: 'purchase_invoice',
      entityId: randomUUID(),
      filename: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
    })

    const record = await this.prisma.purchaseInvoice.create({
      data: {
        tenantId,
        sourceFilePath: storageKey,
        status: InvoiceImportStatus.PROCESSING,
        createdBy: userId,
      },
    })

    // Process OCR asynchronously (fire-and-forget, status updated in DB)
    this.processOcrAsync(record.id, tenantId, userId, storageKey, file.mimetype).catch(err => {
      this.logger.error(`OCR async failed for ${record.id}: ${err.message}`)
    })

    await this.audit.log({
      tenantId,
      userId,
      action: AuditAction.UPLOAD,
      entityType: 'purchase_invoice',
      entityId: record.id,
      metadata: { filename: file.originalname, sizeBytes: file.size, mimeType: file.mimetype },
    })

    return { importId: record.id, status: InvoiceImportStatus.PROCESSING }
  }

  private async processOcrAsync(
    invoiceId: string,
    tenantId: string,
    userId: string,
    storageKey: string,
    mimeType: string,
  ) {
    const basePath = this.storage['config'].get<string>('LOCAL_STORAGE_PATH', './uploads')
    const filePath = path.join(basePath, storageKey)

    try {
      const ocrResult = await this.ocr.processInvoice(filePath, mimeType)
      const parsed = this.parser.parseInvoiceText(ocrResult.rawText)

      // Check for duplicates
      if (parsed.invoice.number && parsed.supplier.taxId) {
        const dup = await this.prisma.purchaseInvoice.findFirst({
          where: {
            tenantId,
            supplierTaxId: parsed.supplier.taxId,
            invoiceNumber: parsed.invoice.number,
            status: { not: InvoiceImportStatus.FAILED },
            id: { not: invoiceId },
          },
        })
        if (dup) {
          await this.prisma.purchaseInvoice.update({
            where: { id: invoiceId },
            data: {
              status: InvoiceImportStatus.NEEDS_REVIEW,
              errorMessage: 'Această factură pare să fi fost deja importată.',
              rawOcrText: ocrResult.rawText,
              rawOcrJson: parsed as unknown as Prisma.JsonObject,
            },
          })
          return
        }
      }

      // Run product matching via aliases
      const itemsWithMatches = await this.matchProductAliases(tenantId, parsed.items)

      // Persist extracted data
      await this.prisma.purchaseInvoice.update({
        where: { id: invoiceId },
        data: {
          supplierName: parsed.supplier.name,
          supplierTaxId: parsed.supplier.taxId,
          supplierRegNo: parsed.supplier.registrationNumber,
          supplierAddress: parsed.supplier.address,
          invoiceNumber: parsed.invoice.number,
          invoiceDate: parsed.invoice.date ? new Date(parsed.invoice.date) : null,
          dueDate: parsed.invoice.dueDate ? new Date(parsed.invoice.dueDate) : null,
          currency: parsed.invoice.currency,
          subtotal: parsed.invoice.subtotal ?? undefined,
          vatTotal: parsed.invoice.vatTotal ?? undefined,
          total: parsed.invoice.total ?? undefined,
          searchablePdfPath: ocrResult.searchablePdfPath,
          ocrProvider: ocrResult.provider,
          rawOcrText: ocrResult.rawText,
          rawOcrJson: parsed as unknown as Prisma.JsonObject,
          status: InvoiceImportStatus.NEEDS_REVIEW,
          items: {
            create: itemsWithMatches.map(item => ({
              lineNo: item.lineNo,
              extractedName: item.description,
              normalizedName: this.parser.normalizeProductName(item.description),
              sku: item.sku,
              quantity: item.quantity ?? undefined,
              unit: item.unit,
              unitPrice: item.unitPrice ?? undefined,
              vatRate: item.vatRate ?? undefined,
              vatAmount: item.vatAmount ?? undefined,
              lineTotal: item.lineTotal ?? undefined,
              confidence: item.confidence ?? undefined,
              productId: item.matchedProductId,
              matchStatus: item.matchedProductId ? MatchStatus.MATCHED : MatchStatus.UNMATCHED,
            })),
          },
        },
      })

      this.logger.log(`OCR completat pentru factura ${invoiceId}: ${ocrResult.provider}`)
    } catch (err) {
      this.logger.error(`OCR failed pentru ${invoiceId}: ${(err as Error).message}`)
      await this.prisma.purchaseInvoice.update({
        where: { id: invoiceId },
        data: {
          status: InvoiceImportStatus.FAILED,
          errorMessage: (err as Error).message,
        },
      })
    }
  }

  private async matchProductAliases(
    tenantId: string,
    items: ParsedInvoice['items'],
  ): Promise<ParsedInvoice['items']> {
    const aliases = await this.prisma.productAlias.findMany({ where: { tenantId } })

    return items.map(item => {
      const normName = this.parser.normalizeProductName(item.description)
      // Exact alias match
      const exactAlias = aliases.find(a => a.normalizedAliasName === normName)
      if (exactAlias) {
        return { ...item, matchedProductId: exactAlias.productId, matchStatus: 'matched' as const, confidence: 95 }
      }
      // Fuzzy alias match
      const fuzzyAlias = aliases.find(a => this.parser.fuzzyMatch(a.normalizedAliasName, normName))
      if (fuzzyAlias) {
        return { ...item, matchedProductId: fuzzyAlias.productId, matchStatus: 'matched' as const, confidence: 75 }
      }
      return item
    })
  }

  async getInvoiceImport(tenantId: string, importId: string) {
    const record = await this.prisma.purchaseInvoice.findFirst({
      where: { id: importId, tenantId },
      include: { items: { orderBy: { lineNo: 'asc' } } },
    })
    if (!record) throw new NotFoundException('Import factură negăsit')
    return record
  }

  async listInvoiceImports(tenantId: string, status?: string) {
    return this.prisma.purchaseInvoice.findMany({
      where: {
        tenantId,
        ...(status ? { status: status as InvoiceImportStatus } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: { items: false },
    })
  }

  async updateInvoiceImport(
    tenantId: string,
    userId: string,
    importId: string,
    dto: Record<string, unknown>,
  ) {
    const record = await this.getInvoiceImport(tenantId, importId)
    if (record.status === InvoiceImportStatus.POSTED_TO_STOCK) {
      throw new BadRequestException('Factura a fost deja postată în stoc și nu mai poate fi modificată.')
    }

    const updateData: Prisma.PurchaseInvoiceUpdateInput = {}
    if ('supplierName' in dto) updateData.supplierName = String(dto.supplierName)
    if ('supplierTaxId' in dto) updateData.supplierTaxId = String(dto.supplierTaxId)
    if ('invoiceNumber' in dto) updateData.invoiceNumber = String(dto.invoiceNumber)
    if ('invoiceDate' in dto) updateData.invoiceDate = new Date(String(dto.invoiceDate))
    if ('currency' in dto) updateData.currency = String(dto.currency)
    if ('subtotal' in dto) updateData.subtotal = Number(dto.subtotal)
    if ('vatTotal' in dto) updateData.vatTotal = Number(dto.vatTotal)
    if ('total' in dto) updateData.total = Number(dto.total)

    await this.prisma.purchaseInvoice.update({
      where: { id: importId },
      data: updateData,
    })

    await this.audit.log({
      tenantId, userId, action: AuditAction.UPDATE,
      entityType: 'purchase_invoice', entityId: importId,
      metadata: { updated: Object.keys(dto) },
    })

    return this.getInvoiceImport(tenantId, importId)
  }

  async retryOcr(tenantId: string, userId: string, importId: string) {
    const record = await this.getInvoiceImport(tenantId, importId)
    if (!record.sourceFilePath) throw new BadRequestException('Fișier sursă indisponibil')

    await this.prisma.purchaseInvoice.update({
      where: { id: importId },
      data: {
        status: InvoiceImportStatus.PROCESSING,
        errorMessage: null,
        items: { deleteMany: {} },
      },
    })

    this.processOcrAsync(importId, tenantId, userId, record.sourceFilePath, 'application/pdf').catch(err => {
      this.logger.error(`Retry OCR failed: ${err.message}`)
    })

    return { status: InvoiceImportStatus.PROCESSING }
  }

  async approveInvoiceImport(tenantId: string, userId: string, importId: string) {
    const record = await this.prisma.purchaseInvoice.findFirst({
      where: { id: importId, tenantId },
      include: { items: true },
    })
    if (!record) throw new NotFoundException('Import factură negăsit')
    if (record.status === InvoiceImportStatus.POSTED_TO_STOCK) {
      throw new ConflictException('Factura a fost deja postată în stoc.')
    }

    // Validate
    const parsedForValidation = { invoice: record, items: record.items } as any
    if (!record.invoiceNumber) throw new BadRequestException('Factura trebuie să aibă număr înainte de confirmare.')
    if (!record.invoiceDate) throw new BadRequestException('Factura trebuie să aibă dată înainte de confirmare.')

    const mappedItems = record.items.filter(i => i.matchStatus === MatchStatus.MATCHED && i.productId)

    // Create stock movements for mapped items
    await this.prisma.$transaction(async tx => {
      for (const item of mappedItems) {
        await tx.stockMovement.create({
          data: {
            tenantId,
            productId: item.productId!,
            sourceType: 'purchase_invoice',
            sourceId: importId,
            movementType: 'IN',
            quantity: item.quantity ?? 0,
            unitCost: item.unitPrice ?? undefined,
            createdBy: userId,
          },
        })
      }

      await tx.purchaseInvoice.update({
        where: { id: importId },
        data: {
          status: InvoiceImportStatus.POSTED_TO_STOCK,
          postedAt: new Date(),
        },
      })
    })

    await this.audit.log({
      tenantId, userId, action: AuditAction.APPROVE,
      entityType: 'purchase_invoice', entityId: importId,
      metadata: { stockMovements: mappedItems.length },
    })

    return this.getInvoiceImport(tenantId, importId)
  }

  async matchItemToProduct(
    tenantId: string,
    userId: string,
    importId: string,
    itemId: string,
    productId: string,
    saveAlias: boolean,
  ) {
    const item = await this.prisma.purchaseInvoiceItem.findFirst({
      where: { id: itemId, invoice: { tenantId } },
    })
    if (!item) throw new NotFoundException('Linie factură negăsită')

    await this.prisma.purchaseInvoiceItem.update({
      where: { id: itemId },
      data: { productId, matchStatus: MatchStatus.MATCHED },
    })

    if (saveAlias && item.extractedName) {
      const normalized = this.parser.normalizeProductName(item.extractedName)
      await this.prisma.productAlias.upsert({
        where: { tenantId_normalizedAliasName: { tenantId, normalizedAliasName: normalized } },
        create: { tenantId, productId, aliasName: item.extractedName, normalizedAliasName: normalized },
        update: { productId },
      })
    }

    return this.getInvoiceImport(tenantId, importId)
  }

  async ignoreItem(tenantId: string, itemId: string) {
    await this.prisma.purchaseInvoiceItem.updateMany({
      where: { id: itemId, invoice: { tenantId } },
      data: { matchStatus: MatchStatus.IGNORED },
    })
  }

  // ── Contract File Upload + Compression ────────────────────────────────────

  async uploadContractFile(
    tenantId: string,
    userId: string,
    contractId: string,
    file: Express.Multer.File,
  ) {
    this.validateFile(file, ALLOWED_CONTRACT_MIME, 50)

    // Save original
    const entityId = randomUUID()
    const { storageKey: originalKey } = await this.storage.upload({
      tenantSlug: tenantId,
      entityType: 'contract_file',
      entityId,
      filename: file.originalname,
      mimeType: file.mimetype,
      buffer: file.buffer,
    })

    const basePath = this.storage['config'].get<string>('LOCAL_STORAGE_PATH', './uploads')
    const inputPath = path.join(basePath, originalKey)

    // Compress (async would be ideal but keeping sync for simplicity here)
    const comprResult = await this.compression.compressPdf(inputPath)

    let compressedKey: string | null = null
    if (comprResult.status === 'completed' && comprResult.outputPath !== inputPath) {
      const compressedBuf = await fs.readFile(comprResult.outputPath)
      const { storageKey } = await this.storage.upload({
        tenantSlug: tenantId,
        entityType: 'contract_file',
        entityId,
        filename: `compressed_${file.originalname}`,
        mimeType: 'application/pdf',
        buffer: compressedBuf,
      })
      compressedKey = storageKey
      await fs.unlink(comprResult.outputPath).catch(() => {})
    }

    await this.audit.log({
      tenantId, userId, action: AuditAction.UPLOAD,
      entityType: 'contract_file', entityId: contractId,
      metadata: {
        originalKey,
        compressedKey,
        originalSizeBytes: comprResult.originalSizeBytes,
        compressedSizeBytes: comprResult.compressedSizeBytes,
        compressionStatus: comprResult.status,
      },
    })

    return {
      originalFileName: file.originalname,
      originalStorageKey: originalKey,
      compressedStorageKey: compressedKey,
      originalSizeBytes: comprResult.originalSizeBytes,
      compressedSizeBytes: comprResult.compressedSizeBytes,
      compressionRatio: comprResult.compressionRatio,
      compressionStatus: comprResult.status,
      compressionSkippedReason: comprResult.skippedReason,
    }
  }

  // ── Shared ────────────────────────────────────────────────────────────────

  private validateFile(
    file: Express.Multer.File,
    allowedMimes: Set<string>,
    maxMb: number,
  ) {
    if (!file) throw new BadRequestException('Niciun fișier primit')
    if (!allowedMimes.has(file.mimetype)) {
      throw new BadRequestException(`Tip fișier neacceptat: ${file.mimetype}`)
    }
    const maxBytes = maxMb * 1024 * 1024
    if (file.size > maxBytes) {
      throw new BadRequestException(`Fișierul depășește limita de ${maxMb} MB`)
    }
  }
}
