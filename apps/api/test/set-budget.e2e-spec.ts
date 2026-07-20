import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { createCategory, aSystemCategoryId } from './category-helpers';
import { setBudget, getReport, ownerWithExpenseCategory, familyWithMember } from './budget-helpers';

/** US1 · The Owner sets (creates/updates) a category's monthly budget (FR-001..FR-005, FR-013). */
describe('Set budget (US1)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('creates an allocation (200) and upserts it on a second set (no duplicate)', async () => {
    const { owner, expenseCategoryId } = await ownerWithExpenseCategory(app, mail, 'bud-set@example.com');

    const created = await setBudget(app, owner.accessToken, {
      period: '2026-07',
      categoryId: expenseCategoryId,
      plannedAmount: 300000,
    });
    expect(created.status).toBe(200);
    expect(created.body).toMatchObject({
      period: '2026-07',
      categoryId: expenseCategoryId,
      plannedAmount: 300000,
    });
    expect(created.body.budgetId).toBeDefined();

    // Re-set the same (period, category) with a new amount → updates in place.
    const updated = await setBudget(app, owner.accessToken, {
      period: '2026-07',
      categoryId: expenseCategoryId,
      plannedAmount: 250000,
    });
    expect(updated.status).toBe(200);
    expect(updated.body.budgetId).toBe(created.body.budgetId);
    expect(updated.body.plannedAmount).toBe(250000);

    // The report has exactly one line for the category, with the updated amount.
    const report = await getReport(app, owner.accessToken, '2026-07');
    expect(report.body.lines).toHaveLength(1);
    expect(report.body.lines[0]).toMatchObject({ categoryId: expenseCategoryId, plannedAmount: 250000 });
  });

  it('rejects an income category (400)', async () => {
    const { owner } = await ownerWithExpenseCategory(app, mail, 'bud-income@example.com');
    const incomeCategoryId = await aSystemCategoryId(app, owner.accessToken, 'income');

    const res = await setBudget(app, owner.accessToken, {
      period: '2026-07',
      categoryId: incomeCategoryId,
      plannedAmount: 100000,
    });
    expect(res.status).toBe(400);
  });

  it('rejects an archived custom category (400)', async () => {
    const { owner } = await ownerWithExpenseCategory(app, mail, 'bud-archived@example.com');
    const category = await createCategory(app, owner.accessToken, { name: 'Ocio', kind: 'expense' });
    const categoryId = category.body.categoryId as string;
    await request(app.getHttpServer())
      .post(`/api/v1/categories/${categoryId}/archive`)
      .set('Authorization', `Bearer ${owner.accessToken}`);

    const res = await setBudget(app, owner.accessToken, {
      period: '2026-07',
      categoryId,
      plannedAmount: 100000,
    });
    expect(res.status).toBe(400);
  });

  it('rejects a non-owner Member (403); the Member may still view (200)', async () => {
    const { owner, member } = await familyWithMember(app, mail, 'bud-role');
    const categoryId = await aSystemCategoryId(app, owner.accessToken, 'expense');

    const write = await setBudget(app, member.accessToken, {
      period: '2026-07',
      categoryId,
      plannedAmount: 100000,
    });
    expect(write.status).toBe(403);

    const view = await getReport(app, member.accessToken, '2026-07');
    expect(view.status).toBe(200);
  });

  it('blocks an unverified account (403 soft gate / 404 no family)', async () => {
    const http = app.getHttpServer();
    const email = 'bud-unverified@example.com';
    await request(http).post('/api/v1/auth/register').send({ email, password: 'strongpassword1' });
    const token = (
      await request(http).post('/api/v1/auth/login').send({ email, password: 'strongpassword1' })
    ).body.accessToken as string;

    // Unverified + no family → FamilyScopeGuard 404 first; a family member is always
    // verified, so 403 is reserved for the email gate. Either way, the write is blocked.
    const res = await setBudget(app, token, {
      period: '2026-07',
      categoryId: '5f8d0d55b54764421b7156c1',
      plannedAmount: 100000,
    });
    expect([403, 404]).toContain(res.status);
  });

  it('validates the input server-side (amount, month, unknown field)', async () => {
    const { owner, expenseCategoryId } = await ownerWithExpenseCategory(app, mail, 'bud-validate@example.com');
    const base = { period: '2026-07', categoryId: expenseCategoryId, plannedAmount: 100000 };

    const zero = await setBudget(app, owner.accessToken, { ...base, plannedAmount: 0 });
    expect(zero.status).toBe(400);

    const negative = await setBudget(app, owner.accessToken, { ...base, plannedAmount: -5000 });
    expect(negative.status).toBe(400);

    const fractional = await setBudget(app, owner.accessToken, { ...base, plannedAmount: 100.5 });
    expect(fractional.status).toBe(400);

    const badMonth = await setBudget(app, owner.accessToken, { ...base, period: '2026-13' });
    expect(badMonth.status).toBe(400);

    const unknownField = await setBudget(app, owner.accessToken, { ...base, familyId: 'sneaky' });
    expect(unknownField.status).toBe(400);
  });
});
