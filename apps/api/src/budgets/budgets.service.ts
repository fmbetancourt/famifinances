import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  BudgetAllocationSummary,
  BudgetLine,
  BudgetReport,
  BudgetStatus,
  BudgetSummary,
} from '@famifinances/contracts';
import { CategoryRepository } from '../categories/category.repository';
import { MovementSpendService } from '../movements/movement-spend.service';
import { BudgetAllocationRepository } from './budget-allocation.repository';
import { BudgetAllocationDocument } from './budget-allocation.schema';
import { SetBudgetDto } from './dto/set-budget.dto';
import { BUDGET_NEAR_THRESHOLD } from './budgets.constants';

@Injectable()
export class BudgetsService {
  private readonly logger = new Logger('Budgets');

  constructor(
    private readonly budgets: BudgetAllocationRepository,
    private readonly categories: CategoryRepository,
    private readonly spend: MovementSpendService,
  ) {}

  /** US1 · Owner sets (creates or updates) a category's planned amount for a month (FR-001..FR-005). */
  async setAllocation(
    familyId: string,
    createdBy: string,
    dto: SetBudgetDto,
  ): Promise<BudgetAllocationSummary> {
    await this.requireBudgetableCategory(familyId, dto.categoryId);
    const doc = await this.budgets.upsert(
      familyId,
      dto.period,
      dto.categoryId,
      dto.plannedAmount,
      createdBy,
    );
    // No monetary amount in logs (FR-014).
    this.logger.log(`budget.set id=${doc.id} family=${familyId} period=${dto.period}`);
    return this.toSummary(doc);
  }

  /** US2 · The month's report: planned vs derived real spend, per category + overall summary (FR-006..FR-009). */
  async getReport(familyId: string, period: string): Promise<BudgetReport> {
    const [allocations, spendByCategory] = await Promise.all([
      this.budgets.listByFamilyPeriod(familyId, period),
      this.spend.expenseByCategory(familyId, period),
    ]);
    if (allocations.length === 0) {
      return { period, lines: [], summary: this.summarize([]) };
    }
    // Resolve display names for a self-contained report (system + custom, incl. archived).
    const categories = await this.categories.listVisible(familyId, { status: 'all' });
    const nameById = new Map(categories.map((c) => [c.id as string, c.name]));
    const lines = allocations.map((alloc) => {
      const categoryId = alloc.categoryId.toString();
      return this.toLine(alloc, nameById.get(categoryId) ?? 'Unknown', spendByCategory[categoryId] ?? 0);
    });
    return { period, lines, summary: this.summarize(lines) };
  }

  /** US4 · Owner removes an allocation; movements are never touched (FR-010). */
  async removeAllocation(familyId: string, budgetId: string): Promise<void> {
    const removed = await this.budgets.deleteInFamily(familyId, budgetId);
    if (!removed) {
      throw new NotFoundException('Budget not found in this family.');
    }
    this.logger.log(`budget.removed id=${budgetId} family=${familyId}`);
  }

  /** The category must be visible to the family, active, and of kind `expense` (FR-003). */
  private async requireBudgetableCategory(familyId: string, categoryId: string): Promise<void> {
    const category = await this.categories.findVisible(familyId, categoryId);
    if (!category || (category.scope === 'family' && category.archivedAt !== null)) {
      throw new BadRequestException('Category is not budgetable.');
    }
    if (category.kind !== 'expense') {
      throw new BadRequestException('Only expense categories can be budgeted.');
    }
  }

  private toLine(
    alloc: BudgetAllocationDocument,
    categoryName: string,
    realSpend: number,
  ): BudgetLine {
    const plannedAmount = alloc.plannedAmount;
    const available = plannedAmount - realSpend;
    // plannedAmount > 0 (FR-002) so there is no division by zero.
    const percentConsumed = Math.round((realSpend / plannedAmount) * 100);
    return {
      budgetId: alloc.id,
      categoryId: alloc.categoryId.toString(),
      categoryName,
      plannedAmount,
      realSpend,
      available,
      percentConsumed,
      status: this.statusFor(plannedAmount, realSpend, percentConsumed),
    };
  }

  private statusFor(
    plannedAmount: number,
    realSpend: number,
    percentConsumed: number,
  ): BudgetStatus {
    if (realSpend > plannedAmount) {
      return 'over';
    }
    if (percentConsumed >= BUDGET_NEAR_THRESHOLD) {
      return 'near';
    }
    return 'under';
  }

  private summarize(lines: BudgetLine[]): BudgetSummary {
    const totalPlanned = lines.reduce((sum, line) => sum + line.plannedAmount, 0);
    const totalRealSpend = lines.reduce((sum, line) => sum + line.realSpend, 0);
    const totalAvailable = totalPlanned - totalRealSpend;
    const percentConsumed =
      totalPlanned > 0 ? Math.round((totalRealSpend / totalPlanned) * 100) : 0;
    return { totalPlanned, totalRealSpend, totalAvailable, percentConsumed };
  }

  private toSummary(doc: BudgetAllocationDocument): BudgetAllocationSummary {
    return {
      budgetId: doc.id,
      period: doc.period,
      categoryId: doc.categoryId.toString(),
      plannedAmount: doc.plannedAmount,
    };
  }
}
