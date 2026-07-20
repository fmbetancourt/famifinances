import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { setupTwoAccounts, recordTransfer } from './transfer-helpers';
import { recordMovement } from './movement-helpers';
import { getDashboard } from './dashboard-helpers';

/** US1 · The month's money summary reconciles with TXN-01; transfers/deleted excluded (FR-002/FR-003). */
describe('Dashboard money summary (US1)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('sums income/expense for the month, excludes transfers and deleted movements', async () => {
    const { member, accountA, accountB } = await setupTwoAccounts(app, mail, 'dash-money@example.com');
    const token = member.accessToken;

    await recordMovement(app, token, { type: 'income', amount: 500000, date: '2026-07-03', accountId: accountA });
    await recordMovement(app, token, { type: 'expense', amount: 120000, date: '2026-07-05', accountId: accountA });
    const removable = await recordMovement(app, token, { type: 'expense', amount: 80000, date: '2026-07-06', accountId: accountA });
    // A transfer between the family's own accounts must NOT count as income or expense.
    await recordTransfer(app, token, { amount: 50000, date: '2026-07-07', fromAccountId: accountA, toAccountId: accountB });

    let res = await getDashboard(app, token, '2026-07');
    expect(res.status).toBe(200);
    expect(res.body.moneySummary).toEqual({ totalIncome: 500000, totalExpense: 200000, net: 300000 });

    // Delete the 80000 expense → excluded from the summary.
    await request(app.getHttpServer())
      .delete(`/api/v1/movements/${removable.body.movementId}`)
      .set('Authorization', `Bearer ${token}`);
    res = await getDashboard(app, token, '2026-07');
    expect(res.body.moneySummary).toEqual({ totalIncome: 500000, totalExpense: 120000, net: 380000 });
  });

  it('shows zeros for a month with no movements', async () => {
    const { member } = await setupTwoAccounts(app, mail, 'dash-money-empty@example.com');
    const res = await getDashboard(app, member.accessToken, '2026-09');
    expect(res.body.moneySummary).toEqual({ totalIncome: 0, totalExpense: 0, net: 0 });
  });
});
