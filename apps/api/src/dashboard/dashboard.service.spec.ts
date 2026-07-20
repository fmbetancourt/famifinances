import type { BudgetReport, FinancialAccountSummary } from '@famifinances/contracts';
import { FinancialAccountsService } from '../financial-accounts/financial-accounts.service';
import { MovementSummaryService } from '../movements/movement-summary.service';
import { TransferSummaryService } from '../transfers/transfer-summary.service';
import { BudgetsService } from '../budgets/budgets.service';
import { DashboardService } from './dashboard.service';

function account(id: string, name: string, balance: number): FinancialAccountSummary {
  return {
    accountId: id,
    name,
    type: 'bank',
    institution: null,
    initialBalance: balance,
    balance,
    currency: 'CLP',
    startDate: '2026-07-01',
    archived: false,
  };
}

function report(lines: BudgetReport['lines']): BudgetReport {
  const totalPlanned = lines.reduce((s, l) => s + l.plannedAmount, 0);
  const totalRealSpend = lines.reduce((s, l) => s + l.realSpend, 0);
  return {
    period: '2026-07',
    lines,
    summary: {
      totalPlanned,
      totalRealSpend,
      totalAvailable: totalPlanned - totalRealSpend,
      percentConsumed: totalPlanned > 0 ? Math.round((totalRealSpend / totalPlanned) * 100) : 0,
    },
  };
}

describe('DashboardService (DASH-01)', () => {
  const accounts = { listAccounts: jest.fn() };
  const movementSummary = { monthlyIncomeExpense: jest.fn(), latestChangeAt: jest.fn() };
  const transferSummary = { latestChangeAt: jest.fn() };
  const budgets = { getReport: jest.fn() };

  const service = new DashboardService(
    accounts as unknown as FinancialAccountsService,
    movementSummary as unknown as MovementSummaryService,
    transferSummary as unknown as TransferSummaryService,
    budgets as unknown as BudgetsService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('assembles the money summary, net worth, budget highlights, and last-updated', async () => {
    movementSummary.monthlyIncomeExpense.mockResolvedValue({
      totalIncome: 500000,
      totalExpense: 200000,
      net: 300000,
    });
    accounts.listAccounts.mockResolvedValue([account('a1', 'Cuenta A', 480000), account('a2', 'Cuenta B', 20000)]);
    budgets.getReport.mockResolvedValue(
      report([
        { budgetId: 'b1', categoryId: 'c1', categoryName: 'Alimentación', plannedAmount: 200000, realSpend: 60000, available: 140000, percentConsumed: 30, status: 'under' },
        { budgetId: 'b2', categoryId: 'c2', categoryName: 'Transporte', plannedAmount: 100000, realSpend: 90000, available: 10000, percentConsumed: 90, status: 'near' },
        { budgetId: 'b3', categoryId: 'c3', categoryName: 'Ocio', plannedAmount: 50000, realSpend: 70000, available: -20000, percentConsumed: 140, status: 'over' },
      ]),
    );
    movementSummary.latestChangeAt.mockResolvedValue(new Date('2026-07-10T08:00:00.000Z'));
    transferSummary.latestChangeAt.mockResolvedValue(new Date('2026-07-12T09:30:00.000Z'));

    const result = await service.getDashboard('fam1', '2026-07');

    expect(result.period).toBe('2026-07');
    expect(result.moneySummary).toEqual({ totalIncome: 500000, totalExpense: 200000, net: 300000 });
    expect(result.accounts).toEqual([
      { accountId: 'a1', name: 'Cuenta A', type: 'bank', balance: 480000 },
      { accountId: 'a2', name: 'Cuenta B', type: 'bank', balance: 20000 },
    ]);
    expect(result.netWorth).toBe(500000);
    // Only near/over lines are highlighted, in report order.
    expect(result.budget.highlights.map((l) => l.categoryId)).toEqual(['c2', 'c3']);
    expect(result.budget.summary.totalPlanned).toBe(350000);
    // The later of the two change times.
    expect(result.lastUpdated).toBe('2026-07-12T09:30:00.000Z');
  });

  it('returns null lastUpdated when there are no movements or transfers', async () => {
    movementSummary.monthlyIncomeExpense.mockResolvedValue({ totalIncome: 0, totalExpense: 0, net: 0 });
    accounts.listAccounts.mockResolvedValue([]);
    budgets.getReport.mockResolvedValue(report([]));
    movementSummary.latestChangeAt.mockResolvedValue(null);
    transferSummary.latestChangeAt.mockResolvedValue(null);

    const result = await service.getDashboard('fam1', '2026-07');

    expect(result.netWorth).toBe(0);
    expect(result.accounts).toEqual([]);
    expect(result.budget.highlights).toEqual([]);
    expect(result.budget.summary).toEqual({ totalPlanned: 0, totalRealSpend: 0, totalAvailable: 0, percentConsumed: 0 });
    expect(result.lastUpdated).toBeNull();
  });
});
