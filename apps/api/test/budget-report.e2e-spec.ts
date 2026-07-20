import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { recordMovement } from './movement-helpers';
import { setBudget, getReport, ownerWithExpenseCategory } from './budget-helpers';

/** US2 · The month's budget report reconciles planned vs derived real spend (FR-006..FR-009). */
describe('Budget report (US2)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('reconciles real spend with the month expense movements and flags under→near→over', async () => {
    const { owner, accountId, expenseCategoryId } = await ownerWithExpenseCategory(
      app,
      mail,
      'bud-report@example.com',
    );
    const token = owner.accessToken;
    await setBudget(app, token, { period: '2026-07', categoryId: expenseCategoryId, plannedAmount: 200000 });

    const expense = (amount: number, date: string) =>
      recordMovement(app, token, { type: 'expense', amount, date, accountId, categoryId: expenseCategoryId });

    // 120000 spent → 60% → under.
    await expense(120000, '2026-07-10');
    let report = await getReport(app, token, '2026-07');
    expect(report.status).toBe(200);
    expect(report.body.lines[0]).toMatchObject({
      categoryId: expenseCategoryId,
      categoryName: 'Alimentación',
      plannedAmount: 200000,
      realSpend: 120000,
      available: 80000,
      percentConsumed: 60,
      status: 'under',
    });
    // Summary equals the single line (SC-007).
    expect(report.body.summary).toEqual({
      totalPlanned: 200000,
      totalRealSpend: 120000,
      totalAvailable: 80000,
      percentConsumed: 60,
    });

    // +40000 → 160000 → 80% → near.
    await expense(40000, '2026-07-12');
    report = await getReport(app, token, '2026-07');
    expect(report.body.lines[0]).toMatchObject({ realSpend: 160000, percentConsumed: 80, status: 'near' });

    // A deleted movement is excluded from real spend (consistent with TXN-01).
    const throwaway = await expense(50000, '2026-07-13');
    await request(app.getHttpServer())
      .delete(`/api/v1/movements/${throwaway.body.movementId}`)
      .set('Authorization', `Bearer ${token}`);
    report = await getReport(app, token, '2026-07');
    expect(report.body.lines[0]).toMatchObject({ realSpend: 160000 });

    // +60000 → 220000 > planned → over, available negative.
    await expense(60000, '2026-07-14');
    report = await getReport(app, token, '2026-07');
    expect(report.body.lines[0]).toMatchObject({
      realSpend: 220000,
      available: -20000,
      percentConsumed: 110,
      status: 'over',
    });
  });

  it('shows real 0 / available = planned / 0% for a budgeted category with no movements', async () => {
    const { owner, expenseCategoryId } = await ownerWithExpenseCategory(app, mail, 'bud-empty@example.com');
    await setBudget(app, owner.accessToken, {
      period: '2026-08',
      categoryId: expenseCategoryId,
      plannedAmount: 150000,
    });

    const report = await getReport(app, owner.accessToken, '2026-08');
    expect(report.body.lines[0]).toMatchObject({
      realSpend: 0,
      available: 150000,
      percentConsumed: 0,
      status: 'under',
    });
  });

  it('defaults the report period to the current calendar month when none is given', async () => {
    const { owner, expenseCategoryId } = await ownerWithExpenseCategory(app, mail, 'bud-default@example.com');
    const period = new Date().toISOString().slice(0, 7);
    await setBudget(app, owner.accessToken, {
      period,
      categoryId: expenseCategoryId,
      plannedAmount: 100000,
    });

    const report = await getReport(app, owner.accessToken); // no ?period=
    expect(report.status).toBe(200);
    expect(report.body.period).toBe(period);
    expect(report.body.lines).toHaveLength(1);
    expect(report.body.lines[0]).toMatchObject({ categoryId: expenseCategoryId, plannedAmount: 100000 });
  });
});
