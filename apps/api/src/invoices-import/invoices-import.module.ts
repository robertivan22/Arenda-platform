import { Module } from '@nestjs/common'
import { StorageModule } from '../storage/storage.module'
import { InvoicesImportController } from './invoices-import.controller'
import { InvoicesImportService } from './invoices-import.service'
import { InvoiceOcrService } from './invoice-ocr.service'
import { InvoiceParserService } from './invoice-parser.service'
import { PdfCompressionService } from './pdf-compression.service'

@Module({
  imports: [StorageModule],
  controllers: [InvoicesImportController],
  providers: [
    InvoicesImportService,
    InvoiceOcrService,
    InvoiceParserService,
    PdfCompressionService,
  ],
  exports: [InvoiceParserService, PdfCompressionService],
})
export class InvoicesImportModule {}
