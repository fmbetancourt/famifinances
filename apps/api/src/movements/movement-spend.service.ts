import { Injectable } from '@nestjs/common';
import { MovementRepository } from './movement.repository';
import { monthBounds } from './month-bounds';

/** Real expense spend keyed by category id. */
export type SpendByCategory = Record<string, number>;

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
