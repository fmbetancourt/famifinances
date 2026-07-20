import { Injectable } from '@nestjs/common';
import type {
  BudgetLine,
  DashboardAccountBalance,
  DashboardResponse,
} from '@famifinances/contracts';
import { FinancialAccountsService } from '../financial-accounts/financial-accounts.service';
import { MovementSummaryService } from '../movements/movement-summary.service';
import { TransferSummaryService } from '../transfers/transfer-summary.service';
import { BudgetsService } from '../budgets/budgets.service';

/**
 * DASH-01 · the family's shared monthly dashboard — a READ-ONLY view assembled on
 * demand from ACC-01 balances, TXN-01 income/expense, TXN-02 transfers (freshness),
 * and the BUD-01 report. Nothing is stored (Principle III); every figure is scoped to
 * the session family (Principle I). All reads are one-way (no `forwardRef`).
 */
@Injectable()
export class DashboardService {
  constructor(
    private readonly accounts: FinancialAccountsService,
    private readonly movementSummary: MovementSummaryService,
    private readonly transferSummary: TransferSummaryService,
    private readonly budgets: BudgetsService,
  ) {}

  /** The dashboard for one month (FR-001..FR-008). */
  async getDashboard(familyId: string, period: string): Promise<DashboardResponse> {
    const [moneySummary, accounts, report, movementChange, transferChange] = await Promise.all([
      this.movementSummary.monthlyIncomeExpense(familyId, period),
      this.accounts.listAccounts(familyId, 'active'),
      this.budgets.getReport(familyId, period),
      this.movementSummary.latestChangeAt(familyId),
      this.transferSummary.latestChangeAt(familyId),
    ]);

    // Net worth = Σ of the active accounts' derived balances (archived already excluded).
    const accountBalances: DashboardAccountBalance[] = accounts.map((account) => ({
      accountId: account.accountId,
      name: account.name,
      type: account.type,
      balance: account.balance,
    }));
    const netWorth = accountBalances.reduce((sum, account) => sum + account.balance, 0);

    // Budget overview: the report summary + only the actionable (near/over) lines.
    const highlights: BudgetLine[] = report.lines.filter((line) => line.status !== 'under');

    return {
      period,
      moneySummary,
      accounts: accountBalances,
      netWorth,
      budget: { summary: report.summary, highlights },
      lastUpdated: this.latest(movementChange, transferChange),
    };
  }

  /** The later of two change times as an ISO string, or null when both are null (FR-008). */
  private latest(a: Date | null, b: Date | null): string | null {
    const times = [a, b].filter((date): date is Date => date !== null);
    if (times.length === 0) {
      return null;
    }
    return new Date(Math.max(...times.map((date) => date.getTime()))).toISOString();
  }
}
