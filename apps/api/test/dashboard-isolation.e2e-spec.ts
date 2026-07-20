import { INestApplication } from '@nestjs/common';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { verifiedMemberWithFamily } from './account-helpers';
import { registerVerifiedUser } from './family-helpers';
import { setupTwoAccounts } from './transfer-helpers';
import { recordMovement } from './movement-helpers';
import { getDashboard } from './dashboard-helpers';

/** US1–US3 · The dashboard is scoped to the session family; no other family leaks in (FR-009). */
describe('Dashboard isolation (US1–US3)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('shows family B its own (empty) dashboard, never family A figures', async () => {
    const familyA = await setupTwoAccounts(app, mail, 'dash-iso-a@example.com', 500000, 0);
    await recordMovement(app, familyA.member.accessToken, {
      type: 'income',
      amount: 200000,
      date: '2026-07-04',
      accountId: familyA.accountA,
    });

    const familyB = await verifiedMemberWithFamily(app, mail, 'dash-iso-b@example.com');
    const res = await getDashboard(app, familyB.accessToken, '2026-07');

    expect(res.status).toBe(200);
    expect(res.body.moneySummary).toEqual({ totalIncome: 0, totalExpense: 0, net: 0 });
    expect(res.body.accounts).toEqual([]);
    expect(res.body.netWorth).toBe(0);
    expect(res.body.lastUpdated).toBeNull();
  });

  it('rejects a caller who belongs to no family (404)', async () => {
    const stranger = await registerVerifiedUser(app, mail, 'dash-iso-nofamily@example.com');
    const res = await getDashboard(app, stranger.accessToken, '2026-07');
    expect(res.status).toBe(404);
  });
});
