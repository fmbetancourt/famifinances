import { Injectable } from '@nestjs/common';
import type { MovementHistoryPage, MovementSummary } from '@famifinances/contracts';
import { MovementRepository } from '../movements/movement.repository';
import { MovementDocument } from '../movements/movement.schema';
import { HistoryQuery } from './dto/history-query';

/** Default page size when the caller omits `limit` (FR-010). */
const DEFAULT_LIMIT = 20;

/**
 * HIS-01 · read-only movement history. Maps the family-scoped `searchHistory` result to
 * `MovementSummary` pages with offset/limit paging metadata. Nothing is stored; the query
 * reads the TXN-01 movements one-way (no `forwardRef`).
 */
@Injectable()
export class HistoryService {
  constructor(private readonly movements: MovementRepository) {}

  /** A filtered, paginated page of the family's movements (FR-001..FR-010). */
  async search(familyId: string, query: HistoryQuery): Promise<MovementHistoryPage> {
    const limit = query.limit ?? DEFAULT_LIMIT;
    const offset = query.offset ?? 0;
    const { items, total } = await this.movements.searchHistory(
      familyId,
      {
        from: query.from,
        to: query.to,
        type: query.type,
        account: query.account,
        category: query.category,
        search: query.search,
      },
      { limit, offset },
    );
    return {
      items: items.map((doc) => this.toSummary(doc)),
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    };
  }

  private toSummary(doc: MovementDocument): MovementSummary {
    return {
      movementId: doc.id,
      type: doc.type,
      amount: doc.amount,
      date: doc.date.toISOString().slice(0, 10),
      accountId: doc.accountId.toString(),
      categoryId: doc.categoryId ? doc.categoryId.toString() : null,
      note: doc.note,
    };
  }
}
