import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { MovementHistoryPage } from '@famifinances/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FamilyScopeGuard } from '../families/guards/family-scope.guard';
import { CurrentFamily } from '../families/decorators/current-family.decorator';
import { CurrentFamilyContext } from '../families/types/current-family';
import { HistoryService } from './history.service';
import { HistoryQuery } from './dto/history-query';

@ApiTags('history')
@ApiBearerAuth()
@Controller({ path: 'history', version: '1' })
export class HistoryController {
  constructor(private readonly history: HistoryService) {}

  // Read-only; any family member (Principle-I scope only, no email/role gate).
  @Get()
  @UseGuards(JwtAuthGuard, FamilyScopeGuard)
  async list(
    @CurrentFamily() family: CurrentFamilyContext,
    @Query() query: HistoryQuery,
  ): Promise<MovementHistoryPage> {
    return this.history.search(family.familyId, query);
  }
}
