import { INestApplication } from '@nestjs/common';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { setBudget, getReport, deleteBudget, ownerWithExpenseCategory } from './budget-helpers';

/** US3 · Budgets stay within the session family and only expense categories are budgetable (FR-011, FR-003). */
describe('Budget isolation & expense-only (US3)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('never exposes or lets another family modify a budget, and ignores a client family id', async () => {
    const familyA = await ownerWithExpenseCategory(app, mail, 'iso-a@example.com');
    const familyB = await ownerWithExpenseCategory(app, mail, 'iso-b@example.com');

    const created = await setBudget(app, familyA.owner.accessToken, {
      period: '2026-07',
      categoryId: familyA.expenseCategoryId,
      plannedAmount: 200000,
    });
    expect(created.status).toBe(200);
    const budgetId = created.body.budgetId as string;

    // Family B's report for the same month does not surface A's allocation.
    const bReport = await getReport(app, familyB.owner.accessToken, '2026-07');
    expect(bReport.status).toBe(200);
    expect((bReport.body.lines as Array<{ budgetId: string }>).some((l) => l.budgetId === budgetId)).toBe(false);

    // Family B cannot delete A's allocation (foreign id → 404).
    const bDelete = await deleteBudget(app, familyB.owner.accessToken, budgetId);
    expect(bDelete.status).toBe(404);

    // A cannot budget B's category (foreign category not visible → 400).
    const foreign = await setBudget(app, familyA.owner.accessToken, {
      period: '2026-07',
      categoryId: familyB.expenseCategoryId,
      plannedAmount: 100000,
    });
    expect(foreign.status).toBe(400);

    // A family identifier in the body is rejected (whitelist) — the session family always wins.
    const spoofed = await setBudget(app, familyA.owner.accessToken, {
      period: '2026-07',
      categoryId: familyA.expenseCategoryId,
      plannedAmount: 100000,
      familyId: familyB.owner.email,
    });
    expect(spoofed.status).toBe(400);

    // A's own allocation is untouched by all of the above.
    const aReport = await getReport(app, familyA.owner.accessToken, '2026-07');
    expect(aReport.body.lines).toHaveLength(1);
    expect(aReport.body.lines[0].budgetId).toBe(budgetId);
  });
});
