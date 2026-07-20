import { Injectable } from '@nestjs/common';
import { MovementRepository } from './movement.repository';

/** Real expense spend keyed by category id. */
export type SpendByCategory = Record<string, number>;

/** Half-open UTC month bounds [from, to) for a 'YYYY-MM' period. */
function monthBounds(period: string): { from: Date; to: Date } {
  const [year, month] = period.split('-').map(Number); // month is 1..12
  const from = new Date(Date.UTC(year, month - 1, 1));
  const to = new Date(Date.UTC(year, month, 1)); // month=12 → next January (year rolls over)
  return { from, to };
}

/**
 * Derives per-category real spend for a month from TXN-01 expense movements
 * (Principle III — never stored). Exported so BUD-01 can build its budget report
 * without movements ever depending on budgets (one-way dependency).
 */
@Injectable()
export class MovementSpendService {
  constructor(private readonly movements: MovementRepository) {}

  /** Sum of the family's non-deleted expense movements per category for a month (FR-006). */
  async expenseByCategory(familyId: string, period: string): Promise<SpendByCategory> {
    const { from, to } = monthBounds(period);
    const rows = await this.movements.sumExpenseByCategory(familyId, from, to);
    const result: SpendByCategory = {};
    for (const row of rows) {
      result[row.categoryId] = row.spend;
    }
    return result;
  }
}
