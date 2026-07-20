import { BadRequestException } from '@nestjs/common';
import { CategoryRepository } from '../categories/category.repository';
import { MovementSpendService } from '../movements/movement-spend.service';
import { BudgetAllocationRepository } from './budget-allocation.repository';
import { BudgetAllocationDocument } from './budget-allocation.schema';
import { BudgetsService } from './budgets.service';
import { SetBudgetDto } from './dto/set-budget.dto';

/** Builds a fake allocation document (only the fields the service reads). */
function allocation(id: string, categoryId: string, plannedAmount: number): BudgetAllocationDocument {
  return {
    id,
    categoryId: { toString: () => categoryId },
    plannedAmount,
    period: '2026-07',
  } as unknown as BudgetAllocationDocument;
}

describe('BudgetsService (BUD-01)', () => {
  const budgets = {
    upsert: jest.fn(),
    listByFamilyPeriod: jest.fn(),
    deleteInFamily: jest.fn(),
  };
  const categories = { findVisible: jest.fn(), listVisible: jest.fn() };
  const spend = { expenseByCategory: jest.fn() };

  const service = new BudgetsService(
    budgets as unknown as BudgetAllocationRepository,
    categories as unknown as CategoryRepository,
    spend as unknown as MovementSpendService,
  );

  beforeEach(() => jest.clearAllMocks());

  describe('setAllocation · expense-only integrity (FR-003)', () => {
    const dto: SetBudgetDto = { period: '2026-07', categoryId: 'cat1', plannedAmount: 200000 };

    it('upserts when the category is a visible active expense category', async () => {
      categories.findVisible.mockResolvedValue({ scope: 'system', kind: 'expense', archivedAt: null });
      budgets.upsert.mockResolvedValue(allocation('b1', 'cat1', 200000));

      const result = await service.setAllocation('fam1', 'owner1', dto);

      expect(budgets.upsert).toHaveBeenCalledWith('fam1', '2026-07', 'cat1', 200000, 'owner1');
      expect(result).toEqual({ budgetId: 'b1', period: '2026-07', categoryId: 'cat1', plannedAmount: 200000 });
    });

    it('rejects an income category (400)', async () => {
      categories.findVisible.mockResolvedValue({ scope: 'system', kind: 'income', archivedAt: null });
      await expect(service.setAllocation('fam1', 'owner1', dto)).rejects.toBeInstanceOf(BadRequestException);
      expect(budgets.upsert).not.toHaveBeenCalled();
    });

    it('rejects an archived custom category (400)', async () => {
      categories.findVisible.mockResolvedValue({ scope: 'family', kind: 'expense', archivedAt: new Date() });
      await expect(service.setAllocation('fam1', 'owner1', dto)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a foreign/unknown category (findVisible null → 400)', async () => {
      categories.findVisible.mockResolvedValue(null);
      await expect(service.setAllocation('fam1', 'owner1', dto)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('getReport · lines, status and summary (FR-007/FR-008)', () => {
    beforeEach(() => {
      categories.listVisible.mockResolvedValue([
        { id: 'cat1', name: 'Alimentación' },
        { id: 'cat2', name: 'Transporte' },
        { id: 'cat3', name: 'Salud' },
      ]);
    });

    it('computes available, percent and under/near/over per line', async () => {
      budgets.listByFamilyPeriod.mockResolvedValue([
        allocation('b1', 'cat1', 200000), // real 120000 → 60% under
        allocation('b2', 'cat2', 200000), // real 160000 → 80% near
        allocation('b3', 'cat3', 200000), // real 210000 → over
      ]);
      spend.expenseByCategory.mockResolvedValue({ cat1: 120000, cat2: 160000, cat3: 210000 });

      const report = await service.getReport('fam1', '2026-07');

      expect(report.lines).toEqual([
        { budgetId: 'b1', categoryId: 'cat1', categoryName: 'Alimentación', plannedAmount: 200000, realSpend: 120000, available: 80000, percentConsumed: 60, status: 'under' },
        { budgetId: 'b2', categoryId: 'cat2', categoryName: 'Transporte', plannedAmount: 200000, realSpend: 160000, available: 40000, percentConsumed: 80, status: 'near' },
        { budgetId: 'b3', categoryId: 'cat3', categoryName: 'Salud', plannedAmount: 200000, realSpend: 210000, available: -10000, percentConsumed: 105, status: 'over' },
      ]);
      expect(report.summary).toEqual({
        totalPlanned: 600000,
        totalRealSpend: 490000,
        totalAvailable: 110000,
        percentConsumed: 82,
      });
    });

    it('shows real 0 / available = planned / 0% for a budgeted category with no movements', async () => {
      budgets.listByFamilyPeriod.mockResolvedValue([allocation('b1', 'cat1', 200000)]);
      spend.expenseByCategory.mockResolvedValue({});

      const report = await service.getReport('fam1', '2026-07');

      expect(report.lines[0]).toMatchObject({ realSpend: 0, available: 200000, percentConsumed: 0, status: 'under' });
    });

    it('returns an empty report (percent 0) when there are no allocations', async () => {
      budgets.listByFamilyPeriod.mockResolvedValue([]);
      spend.expenseByCategory.mockResolvedValue({});

      const report = await service.getReport('fam1', '2026-07');

      expect(report.lines).toEqual([]);
      expect(report.summary).toEqual({ totalPlanned: 0, totalRealSpend: 0, totalAvailable: 0, percentConsumed: 0 });
      expect(categories.listVisible).not.toHaveBeenCalled();
    });
  });
});
