import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { BudgetAllocationSummary, BudgetReport } from '@famifinances/contracts';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../auth/guards/email-verified.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user';
import { FamilyScopeGuard } from '../families/guards/family-scope.guard';
import { FamilyRoleGuard } from '../families/guards/family-role.guard';
import { Roles } from '../families/decorators/roles.decorator';
import { CurrentFamily } from '../families/decorators/current-family.decorator';
import { CurrentFamilyContext } from '../families/types/current-family';
import { BudgetsService } from './budgets.service';
import { SetBudgetDto } from './dto/set-budget.dto';
import { BudgetReportQuery } from './dto/budget-report.query';
import { currentPeriod } from './budgets.constants';

@ApiTags('budgets')
@ApiBearerAuth()
@Controller({ path: 'budgets', version: '1' })
export class BudgetsController {
  constructor(private readonly budgets: BudgetsService) {}

  // Report: any family member (Principle-I scope only, no email/role gate).
  @Get()
  @UseGuards(JwtAuthGuard, FamilyScopeGuard)
  async report(
    @CurrentFamily() family: CurrentFamilyContext,
    @Query() query: BudgetReportQuery,
  ): Promise<BudgetReport> {
    return this.budgets.getReport(family.familyId, query.period ?? currentPeriod());
  }

  // Writes: Owner-only + verified email. Guard order FamilyScope → FamilyRole →
  // Email keeps no-family = 404 and role/email = 403 (ACC-01/FAM-01 convention).
  @Post()
  @UseGuards(JwtAuthGuard, FamilyScopeGuard, FamilyRoleGuard, EmailVerifiedGuard)
  @Roles('owner')
  @HttpCode(HttpStatus.OK)
  async set(
    @CurrentUser() user: AuthenticatedUser,
    @CurrentFamily() family: CurrentFamilyContext,
    @Body() dto: SetBudgetDto,
  ): Promise<BudgetAllocationSummary> {
    return this.budgets.setAllocation(family.familyId, user.accountId, dto);
  }

  @Delete(':budgetId')
  @UseGuards(JwtAuthGuard, FamilyScopeGuard, FamilyRoleGuard, EmailVerifiedGuard)
  @Roles('owner')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentFamily() family: CurrentFamilyContext,
    @Param('budgetId') budgetId: string,
  ): Promise<void> {
    await this.budgets.removeAllocation(family.familyId, budgetId);
  }
}
