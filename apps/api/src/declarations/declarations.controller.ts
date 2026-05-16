import {
  Controller, Get, Post, Delete, Param, Body, Query,
  UseGuards, Request, ParseIntPipe, HttpCode, HttpStatus,
} from '@nestjs/common'
import {
  DeclarationsService,
  CheckApplicabilityDto,
  GenerateD112Dto,
  GenerateApiaDto,
  ApproveRunDto,
} from './declarations.service'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'

@Controller('declarations')
@UseGuards(JwtAuthGuard)
export class DeclarationsController {
  constructor(private readonly declarationsService: DeclarationsService) {}

  /**
   * Check which declarations are applicable for this tenant's setup.
   * POST body: { payerIsLegalEntity, payerIsVatRegistered, payerHasArendaVatOption? }
   */
  @Post('check-applicability')
  checkApplicability(@Request() req: any, @Body() dto: CheckApplicabilityDto) {
    return this.declarationsService.checkApplicability(req.user.tenantId, dto)
  }

  // ── D112 ────────────────────────────────────────────────────────────────

  /**
   * Generate a D112 preparation dataset for a given year+month.
   * POST body: { year, month }
   * Returns structured dataset (DRAFT). Does NOT transmit to ANAF.
   */
  @Post('d112/generate')
  generateD112(@Request() req: any, @Body() dto: GenerateD112Dto) {
    return this.declarationsService.generateD112Run(req.user.tenantId, dto, req.user.id)
  }

  // ── APIA ────────────────────────────────────────────────────────────────

  /**
   * Generate APIA campaign export for a given year.
   * POST body: { campaignYear }
   */
  @Post('apia/generate')
  generateApia(@Request() req: any, @Body() dto: GenerateApiaDto) {
    return this.declarationsService.generateApiaRun(req.user.tenantId, dto, req.user.id)
  }

  /**
   * Download APIA export as CSV.
   * GET /declarations/apia/export/:exportId/csv
   */
  @Get('apia/export/:exportId/csv')
  async downloadApiaCsv(
    @Request() req: any,
    @Param('exportId') exportId: string,
  ) {
    // Return raw CSV data — caller handles content-type headers
    // (Alternatively, use @Res() to set headers directly — kept simple for now)
    const dataset = await this.declarationsService.getApiaExportDataset(exportId, req.user.tenantId)
    return dataset
  }

  // ── Runs (all types) ────────────────────────────────────────────────────

  @Get('runs')
  listRuns(@Request() req: any, @Query('type') type?: string) {
    return this.declarationsService.listRuns(req.user.tenantId, type)
  }

  @Get('runs/:id')
  getRunById(@Request() req: any, @Param('id') id: string) {
    return this.declarationsService.getRunById(req.user.tenantId, id)
  }

  @Post('runs/:id/approve')
  @HttpCode(HttpStatus.OK)
  approveRun(@Request() req: any, @Param('id') id: string, @Body() dto: ApproveRunDto) {
    return this.declarationsService.approveRun(req.user.tenantId, id, req.user.id, dto)
  }

  @Delete('runs/:id')
  deleteRun(@Request() req: any, @Param('id') id: string) {
    return this.declarationsService.deleteRun(req.user.tenantId, id)
  }
}
