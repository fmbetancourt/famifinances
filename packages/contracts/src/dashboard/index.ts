// Shared dashboard DTO types, mirroring specs/009-dashboard/contracts/dashboard.openapi.yaml.

import type { AccountType } from '../account/index';
import type { BudgetSummary, BudgetLine } from '../budget/index';

export interface MoneySummary {
  /** Sum of the month's income movements (CLP). */
  totalIncome: number;
  /** Sum of the month's expense movements (CLP). */
  totalExpense: number;
  /** totalIncome − totalExpense (may be negative). */
  net: number;
}

export interface DashboardAccountBalance {
  accountId: string;
  name: string;
  /** Reuses ACC-01's shared AccountType. */
  type: AccountType;
  /** Derived balance (initial + movements + transfers), CLP. */
  balance: number;
}

export interface DashboardBudget {
  summary: BudgetSummary;
  /** The month's budget lines flagged near or over (never under), in report order. */
  highlights: BudgetLine[];
}

export interface DashboardResponse {
  /** Calendar month (YYYY-MM). */
  period: string;
  moneySummary: MoneySummary;
  accounts: DashboardAccountBalance[];
  /** Sum of the active accounts' derived balances (CLP). */
  netWorth: number;
  budget: DashboardBudget;
  /** ISO timestamp of the latest movement/transfer change, or null when there is none. */
  lastUpdated: string | null;
}
