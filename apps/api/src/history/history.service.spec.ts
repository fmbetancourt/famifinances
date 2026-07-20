import { MovementRepository } from '../movements/movement.repository';
import { MovementDocument } from '../movements/movement.schema';
import { HistoryService } from './history.service';
import { HistoryQuery } from './dto/history-query';

function doc(id: string, note: string | null): MovementDocument {
  return {
    id,
    type: 'expense',
    amount: 12345,
    date: new Date('2026-07-05T00:00:00.000Z'),
    accountId: { toString: () => 'acc1' },
    categoryId: { toString: () => 'cat1' },
    note,
  } as unknown as MovementDocument;
}

describe('HistoryService (HIS-01)', () => {
  const movements = { searchHistory: jest.fn() };
  const service = new HistoryService(movements as unknown as MovementRepository);

  beforeEach(() => jest.clearAllMocks());

  it('defaults limit to 20 / offset to 0 and maps docs to summaries', async () => {
    movements.searchHistory.mockResolvedValue({ items: [doc('m1', 'Farmacia')], total: 1 });

    const page = await service.search('fam1', {} as HistoryQuery);

    expect(movements.searchHistory).toHaveBeenCalledWith(
      'fam1',
      { from: undefined, to: undefined, type: undefined, account: undefined, category: undefined, search: undefined },
      { limit: 20, offset: 0 },
    );
    expect(page.items).toEqual([
      { movementId: 'm1', type: 'expense', amount: 12345, date: '2026-07-05', accountId: 'acc1', categoryId: 'cat1', note: 'Farmacia' },
    ]);
    expect(page).toMatchObject({ total: 1, limit: 20, offset: 0, hasMore: false });
  });

  it('computes hasMore = offset + items.length < total', async () => {
    movements.searchHistory.mockResolvedValue({ items: [doc('m1', null), doc('m2', null)], total: 25 });

    const page = await service.search('fam1', { limit: 10, offset: 0 } as HistoryQuery);

    expect(page.hasMore).toBe(true); // 0 + 2 < 25
    expect(page.limit).toBe(10);
  });

  it('reports hasMore false on the last page', async () => {
    movements.searchHistory.mockResolvedValue({ items: [doc('m1', null)], total: 21 });

    const page = await service.search('fam1', { limit: 10, offset: 20 } as HistoryQuery);

    expect(page.hasMore).toBe(false); // 20 + 1 = 21, not < 21
    expect(page.offset).toBe(20);
  });
});
