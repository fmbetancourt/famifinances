import { INestApplication } from '@nestjs/common';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { recordMovement } from './movement-helpers';
import { ownerWithExpenseCategory } from './budget-helpers';
import { getDashboard } from './dashboard-helpers';

/** US4 · Month selection: default = current month; invalid rejected; per-month figures differ (FR-013). */
describe('Dashboard period selection (US4)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('defaults to the current calendar month when no period is given', async () => {
    const { owner } = await ownerWithExpenseCategory(app, mail, 'dash-period-default@example.com');
    const res = await getDashboard(app, owner.accessToken); // no ?period=
    expect(res.status).toBe(200);
    expect(res.body.period).toBe(new Date().toISOString().slice(0, 7));
  });

  it('rejects an invalid month (400)', async () => {
    const { owner } = await ownerWithExpenseCategory(app, mail, 'dash-period-invalid@example.com');
    expect((await getDashboard(app, owner.accessToken, '2026-13')).status).toBe(400);
    expect((await getDashboard(app, owner.accessToken, '2026-7')).status).toBe(400);
  });

  it('scopes the money summary to the requested month', async () => {
    const { owner, accountId } = await ownerWithExpenseCategory(app, mail, 'dash-period-month@example.com');
    const token = owner.accessToken;
    await recordMovement(app, token, { type: 'expense', amount: 40000, date: '2026-05-10', accountId });
    await recordMovement(app, token, { type: 'expense', amount: 70000, date: '2026-06-10', accountId });

    const may = await getDashboard(app, token, '2026-05');
    const june = await getDashboard(app, token, '2026-06');
    expect(may.body.moneySummary.totalExpense).toBe(40000);
    expect(june.body.moneySummary.totalExpense).toBe(70000);
  });
});
