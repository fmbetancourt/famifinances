import { INestApplication } from '@nestjs/common';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { createCategory } from './category-helpers';
import { recordMovement } from './movement-helpers';
import { setBudget, getReport, ownerWithExpenseCategory } from './budget-helpers';
import { getDashboard } from './dashboard-helpers';

/** US3 · Budget overview reconciles with the BUD-01 report; only over/near are highlighted (FR-006/FR-007). */
describe('Dashboard budget overview (US3)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('mirrors the report summary and highlights only near/over categories', async () => {
    const { owner, accountId, expenseCategoryId } = await ownerWithExpenseCategory(app, mail, 'dash-bud@example.com');
    const token = owner.accessToken;

    const expense = (amount: number, categoryId: string) =>
      recordMovement(app, token, { type: 'expense', amount, date: '2026-07-10', accountId, categoryId });

    // Alimentación: 180000/200000 → 90% near.
    await setBudget(app, token, { period: '2026-07', categoryId: expenseCategoryId, plannedAmount: 200000 });
    await expense(180000, expenseCategoryId);
    // Transporte: 130000/100000 → over.
    const transporte = (await createCategory(app, token, { name: 'Transporte', kind: 'expense' })).body.categoryId as string;
    await setBudget(app, token, { period: '2026-07', categoryId: transporte, plannedAmount: 100000 });
    await expense(130000, transporte);
    // Ocio: 20000/200000 → 10% under (must NOT be highlighted).
    const ocio = (await createCategory(app, token, { name: 'Ocio', kind: 'expense' })).body.categoryId as string;
    await setBudget(app, token, { period: '2026-07', categoryId: ocio, plannedAmount: 200000 });
    await expense(20000, ocio);

    const dashboard = await getDashboard(app, token, '2026-07');
    const report = await getReport(app, token, '2026-07');

    expect(dashboard.status).toBe(200);
    expect(dashboard.body.budget.summary).toEqual(report.body.summary);
    expect((dashboard.body.budget.highlights as Array<{ categoryId: string; status: string }>).map((l) => l.categoryId)).toEqual([expenseCategoryId, transporte]);
    expect((dashboard.body.budget.highlights as Array<{ status: string }>).every((l) => l.status !== 'under')).toBe(true);
  });

  it('shows a zeroed summary and no highlights when no budgets exist', async () => {
    const { owner } = await ownerWithExpenseCategory(app, mail, 'dash-bud-empty@example.com');
    const res = await getDashboard(app, owner.accessToken, '2026-07');
    expect(res.body.budget.summary).toEqual({ totalPlanned: 0, totalRealSpend: 0, totalAvailable: 0, percentConsumed: 0 });
    expect(res.body.budget.highlights).toEqual([]);
  });
});
