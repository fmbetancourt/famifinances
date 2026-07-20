import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { aSystemCategoryId } from './category-helpers';
import { recordMovement } from './movement-helpers';
import {
  setBudget,
  getReport,
  deleteBudget,
  ownerWithExpenseCategory,
  familyWithMember,
} from './budget-helpers';

/** US4 · The Owner removes an allocation without touching any movements (FR-010). */
describe('Delete budget (US4)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('removes the allocation (204), leaves movements intact, and is idempotent (404 next time)', async () => {
    const { owner, accountId, expenseCategoryId } = await ownerWithExpenseCategory(
      app,
      mail,
      'bud-del@example.com',
    );
    const token = owner.accessToken;
    const created = await setBudget(app, token, {
      period: '2026-07',
      categoryId: expenseCategoryId,
      plannedAmount: 200000,
    });
    const budgetId = created.body.budgetId as string;

    // An expense movement in the same category (its history must survive the budget removal).
    const movement = await recordMovement(app, token, {
      type: 'expense',
      amount: 30000,
      date: '2026-07-10',
      accountId,
      categoryId: expenseCategoryId,
    });
    const movementId = movement.body.movementId as string;

    const removed = await deleteBudget(app, token, budgetId);
    expect(removed.status).toBe(204);

    // Gone from the report.
    const report = await getReport(app, token, '2026-07');
    expect((report.body.lines as Array<{ budgetId: string }>).some((l) => l.budgetId === budgetId)).toBe(false);

    // The category's movements are unchanged (removing a budget never touches money records).
    const movements = await request(app.getHttpServer())
      .get('/api/v1/movements')
      .set('Authorization', `Bearer ${token}`);
    expect((movements.body as Array<{ movementId: string }>).some((m) => m.movementId === movementId)).toBe(true);

    // Removing again → 404 (idempotent from the client's perspective).
    const again = await deleteBudget(app, token, budgetId);
    expect(again.status).toBe(404);
  });

  it('rejects a non-owner Member removing an allocation (403)', async () => {
    const { owner, member } = await familyWithMember(app, mail, 'bud-del-role');
    const categoryId = await aSystemCategoryId(app, owner.accessToken, 'expense');
    const created = await setBudget(app, owner.accessToken, {
      period: '2026-07',
      categoryId,
      plannedAmount: 100000,
    });

    const res = await deleteBudget(app, member.accessToken, created.body.budgetId as string);
    expect(res.status).toBe(403);
  });
});
