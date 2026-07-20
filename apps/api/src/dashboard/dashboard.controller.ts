import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { DashboardResponse } from '@famifinances/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FamilyScopeGuard } from '../families/guards/family-scope.guard';
import { CurrentFamily } from '../families/decorators/current-family.decorator';
import { CurrentFamilyContext } from '../families/types/current-family';
import { currentPeriod } from '../budgets/budgets.constants';
import { DashboardService } from './dashboard.service';
import { DashboardQuery } from './dto/dashboard.query';

@ApiTags('dashboard')
@ApiBearerAuth()
@Controller({ path: 'dashboard', version: '1' })
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  // Read-only; any family member (Principle-I scope only, no email/role gate).
  @Get()
  @UseGuards(JwtAuthGuard, FamilyScopeGuard)
  async get(
    @CurrentFamily() family: CurrentFamilyContext,
    @Query() query: DashboardQuery,
  ): Promise<DashboardResponse> {
    return this.dashboard.getDashboard(family.familyId, query.period ?? currentPeriod());
  }
}
