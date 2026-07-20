// Shared budget DTO types, mirroring specs/008-budget/contracts/budgets.openapi.yaml.

export type BudgetStatus = 'under' | 'near' | 'over';

export interface SetBudgetRequest {
  /** Calendar month (YYYY-MM). */
  period: string;
  categoryId: string;
  /** Positive whole-peso CLP amount (> 0). */
  plannedAmount: number;
}

export interface BudgetAllocationSummary {
  budgetId: string;
  period: string;
  categoryId: string;
  plannedAmount: number;
}

export interface BudgetLine {
  /** The allocation id — the client uses it to DELETE the budget from the report. */
  budgetId: string;
  categoryId: string;
  categoryName: string;
  plannedAmount: number;
  /** Sum of the month's expense movements for the category (derived). */
  realSpend: number;
  /** plannedAmount − realSpend (may be negative). */
  available: number;
  /** round(realSpend / plannedAmount × 100). */
  percentConsumed: number;
  status: BudgetStatus;
}

export interface BudgetSummary {
  totalPlanned: number;
  totalRealSpend: number;
  totalAvailable: number;
  percentConsumed: number;
}

export interface BudgetReport {
  period: string;
  lines: BudgetLine[];
  summary: BudgetSummary;
}
