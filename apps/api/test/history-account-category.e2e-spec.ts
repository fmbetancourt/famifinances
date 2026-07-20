import { INestApplication } from '@nestjs/common';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { setupTwoAccounts } from './transfer-helpers';
import { createCategory } from './category-helpers';
import { recordMovement } from './movement-helpers';
import { getHistory } from './history-helpers';

/** US2 · Filter by account and category; filters combine with AND; foreign ids → empty (FR-004/005/007/012). */
describe('History account + category (US2)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('applies account, category and combined filters with AND semantics', async () => {
    const { member, accountA, accountB } = await setupTwoAccounts(app, mail, 'hist-ac@example.com');
    const token = member.accessToken;
    const food = (await createCategory(app, token, { name: 'Alimentación', kind: 'expense' })).body.categoryId as string;
    const transport = (await createCategory(app, token, { name: 'Transporte', kind: 'expense' })).body.categoryId as string;

    const target = await recordMovement(app, token, { type: 'expense', amount: 1000, date: '2026-07-05', accountId: accountA, categoryId: food });
    await recordMovement(app, token, { type: 'expense', amount: 2000, date: '2026-07-06', accountId: accountA, categoryId: transport });
    await recordMovement(app, token, { type: 'expense', amount: 3000, date: '2026-07-07', accountId: accountB, categoryId: food });

    // account A AND category food → only the target movement.
    const combined = await getHistory(app, token, `?account=${accountA}&category=${food}`);
    expect(combined.status).toBe(200);
    expect((combined.body.items as Array<{ movementId: string }>).map((m) => m.movementId)).toEqual([target.body.movementId]);

    // category food alone → account A and account B food movements (2).
    const byFood = await getHistory(app, token, `?category=${food}`);
    expect(byFood.body.total).toBe(2);

    // account B alone → the single account B movement.
    const byAccountB = await getHistory(app, token, `?account=${accountB}`);
    expect(byAccountB.body.total).toBe(1);
  });

  it('returns an empty page for a foreign or malformed account/category id', async () => {
    const { member } = await setupTwoAccounts(app, mail, 'hist-ac-foreign@example.com');
    const token = member.accessToken;

    const malformed = await getHistory(app, token, '?account=not-an-objectid');
    expect(malformed.status).toBe(200);
    expect(malformed.body.items).toEqual([]);

    const foreign = await getHistory(app, token, '?category=5f8d0d55b54764421b7156c1');
    expect(foreign.status).toBe(200);
    expect(foreign.body.items).toEqual([]);
  });
});
