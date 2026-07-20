import { Injectable } from '@nestjs/common';
import type { MoneySummary } from '@famifinances/contracts';
import { MovementRepository } from './movement.repository';
import { monthBounds } from './month-bounds';

/**
 * Derives the family's monthly income/expense totals and the last movement change
 * time from TXN-01 (Principle III — never stored). Exported so DASH-01 can build its
 * money summary + "last updated" mark without movements depending on the dashboard.
 */
@Injectable()
export class MovementSummaryService {
  constructor(private readonly movements: MovementRepository) {}

  /** Total income, total expense, and net for a month (FR-002); 0s when there are none. */
  async monthlyIncomeExpense(familyId: string, period: string): Promise<MoneySummary> {
    const { from, to } = monthBounds(period);
    const { income, expense } = await this.movements.sumByTypeInPeriod(familyId, from, to);
    return { totalIncome: income, totalExpense: expense, net: income - expense };
  }

  /** The latest movement change time for the family, or null (FR-008). */
  latestChangeAt(familyId: string): Promise<Date | null> {
    return this.movements.latestChangeAt(familyId);
  }
}
