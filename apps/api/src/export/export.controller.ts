import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FamilyScopeGuard } from '../families/guards/family-scope.guard';
import { CurrentFamily } from '../families/decorators/current-family.decorator';
import { CurrentFamilyContext } from '../families/types/current-family';
import { ExportService } from './export.service';
import { ExportMovementsQuery } from './dto/export-movements.query';

/** Today as YYYY-MM-DD, for the download filename. */
const today = (): string => new Date().toISOString().slice(0, 10);

/** Sets the CSV download headers on the response. */
function csvHeaders(res: Response, filename: string): void {
  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${filename}"`,
  });
}

@ApiTags('export')
@ApiBearerAuth()
@Controller({ path: 'export', version: '1' })
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  // Reads of shared family data — any member (scope only, no email/role gate, FR-011).
  @Get('movements')
  @UseGuards(JwtAuthGuard, FamilyScopeGuard)
  async movements(
    @CurrentFamily() family: CurrentFamilyContext,
    @Query() query: ExportMovementsQuery,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const csv = await this.exportService.exportMovements(family.familyId, query);
    csvHeaders(res, `movimientos-${today()}.csv`);
    return csv;
  }

  @Get('transfers')
  @UseGuards(JwtAuthGuard, FamilyScopeGuard)
  async transfers(
    @CurrentFamily() family: CurrentFamilyContext,
    @Res({ passthrough: true }) res: Response,
  ): Promise<string> {
    const csv = await this.exportService.exportTransfers(family.familyId);
    csvHeaders(res, `transferencias-${today()}.csv`);
    return csv;
  }
}
