import {
  Controller, Post, Get, Patch, Param, Body, Query,
  UploadedFile, UseInterceptors, UseGuards, HttpCode, HttpStatus, Logger,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags, ApiBearerAuth, ApiConsumes, ApiOperation } from '@nestjs/swagger'
import { memoryStorage } from 'multer'
import { InvoicesImportService } from './invoices-import.service'
import { SupabaseJwtGuard, SupabaseTokenPayload } from '../common/guards/supabase-jwt.guard'
import { createParamDecorator, ExecutionContext } from '@nestjs/common'

// Extracts the verified Supabase user from request
const SupabaseUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SupabaseTokenPayload => {
    const req = ctx.switchToHttp().getRequest()
    return req.supabaseUser
  },
)

// For now, tenant ID comes from the token's app_metadata or a header
function resolveTenant(user: SupabaseTokenPayload, headers: Record<string, string>): string {
  return (
    user.app_metadata?.tenant_id ??
    headers['x-tenant-id'] ??
    'default'
  )
}

@ApiTags('Invoice Import (OCR)')
@ApiBearerAuth()
@UseGuards(SupabaseJwtGuard)
@Controller('api/v1/invoices/import')
export class InvoicesImportController {
  private readonly logger = new Logger(InvoicesImportController.name)

  constructor(private readonly service: InvoicesImportService) {}

  // ── POST /api/v1/invoices/import ─────────────────────────────────────────
  @Post()
  @ApiOperation({ summary: 'Încarcă factură și pornește OCR' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadInvoice(
    @UploadedFile() file: Express.Multer.File,
    @SupabaseUser() user: SupabaseTokenPayload,
    @Body() _body: unknown,
  ) {
    const tenantId = user.app_metadata?.tenant_id ?? 'default'
    return this.service.createInvoiceImport(tenantId, user.sub, file)
  }

  // ── GET /api/v1/invoices/import ──────────────────────────────────────────
  @Get()
  @ApiOperation({ summary: 'Listează importuri facturi' })
  async list(
    @SupabaseUser() user: SupabaseTokenPayload,
    @Query('status') status?: string,
  ) {
    const tenantId = user.app_metadata?.tenant_id ?? 'default'
    return this.service.listInvoiceImports(tenantId, status)
  }

  // ── GET /api/v1/invoices/import/:id ─────────────────────────────────────
  @Get(':id')
  @ApiOperation({ summary: 'Detalii import factură' })
  async getOne(
    @Param('id') id: string,
    @SupabaseUser() user: SupabaseTokenPayload,
  ) {
    const tenantId = user.app_metadata?.tenant_id ?? 'default'
    return this.service.getInvoiceImport(tenantId, id)
  }

  // ── PATCH /api/v1/invoices/import/:id ───────────────────────────────────
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizează date factură (post-OCR review)' })
  async update(
    @Param('id') id: string,
    @Body() dto: Record<string, unknown>,
    @SupabaseUser() user: SupabaseTokenPayload,
  ) {
    const tenantId = user.app_metadata?.tenant_id ?? 'default'
    return this.service.updateInvoiceImport(tenantId, user.sub, id, dto)
  }

  // ── POST /api/v1/invoices/import/:id/retry-ocr ──────────────────────────
  @Post(':id/retry-ocr')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Reprocesează OCR pentru factura importată' })
  async retryOcr(
    @Param('id') id: string,
    @SupabaseUser() user: SupabaseTokenPayload,
  ) {
    const tenantId = user.app_metadata?.tenant_id ?? 'default'
    return this.service.retryOcr(tenantId, user.sub, id)
  }

  // ── POST /api/v1/invoices/import/:id/approve ────────────────────────────
  @Post(':id/approve')
  @ApiOperation({ summary: 'Confirmă factura și actualizează stocul' })
  async approve(
    @Param('id') id: string,
    @SupabaseUser() user: SupabaseTokenPayload,
  ) {
    const tenantId = user.app_metadata?.tenant_id ?? 'default'
    return this.service.approveInvoiceImport(tenantId, user.sub, id)
  }

  // ── POST /api/v1/invoices/import/:id/items/:itemId/match-product ────────
  @Post(':id/items/:itemId/match-product')
  @ApiOperation({ summary: 'Mapează linie factură la produs' })
  async matchProduct(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() body: { productId: string; saveAlias?: boolean },
    @SupabaseUser() user: SupabaseTokenPayload,
  ) {
    const tenantId = user.app_metadata?.tenant_id ?? 'default'
    return this.service.matchItemToProduct(
      tenantId, user.sub, id, itemId, body.productId, body.saveAlias ?? false,
    )
  }

  // ── POST /api/v1/invoices/import/:id/items/:itemId/ignore ───────────────
  @Post(':id/items/:itemId/ignore')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Ignoră linie factură' })
  async ignoreItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @SupabaseUser() user: SupabaseTokenPayload,
  ) {
    const tenantId = user.app_metadata?.tenant_id ?? 'default'
    await this.service.ignoreItem(tenantId, itemId)
  }

  // ── POST /api/v1/contracts/:contractId/files ─────────────────────────────
  @Post('/contracts/:contractId/files')
  @ApiOperation({ summary: 'Încarcă PDF contract și comprimă automat' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  async uploadContractFile(
    @Param('contractId') contractId: string,
    @UploadedFile() file: Express.Multer.File,
    @SupabaseUser() user: SupabaseTokenPayload,
  ) {
    const tenantId = user.app_metadata?.tenant_id ?? 'default'
    return this.service.uploadContractFile(tenantId, user.sub, contractId, file)
  }
}
