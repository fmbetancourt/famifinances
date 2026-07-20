import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { setupTwoAccounts, recordTransfer } from './transfer-helpers';
import { recordMovement, accountBalance } from './movement-helpers';
import { getDashboard } from './dashboard-helpers';

/** US2 · Account balances + net worth (derived); archived excluded; last-updated present (FR-004/FR-005/FR-008). */
describe('Dashboard net worth (US2)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('reports each active account derived balance and the summed net worth', async () => {
    const { member, accountA, accountB } = await setupTwoAccounts(app, mail, 'dash-nw@example.com', 500000, 0);
    const token = member.accessToken;
    await recordMovement(app, token, { type: 'expense', amount: 30000, date: '2026-07-05', accountId: accountA });
    await recordTransfer(app, token, { amount: 50000, date: '2026-07-07', fromAccountId: accountA, toAccountId: accountB });

    // A = 500000 − 30000 − 50000 = 420000; B = 0 + 50000 = 50000.
    const res = await getDashboard(app, token, '2026-07');
    expect(res.status).toBe(200);
    const byId = Object.fromEntries((res.body.accounts as Array<{ accountId: string; balance: number }>).map((a) => [a.accountId, a.balance]));
    expect(byId[accountA]).toBe(await accountBalance(app, token, accountA));
    expect(byId[accountB]).toBe(await accountBalance(app, token, accountB));
    expect(byId[accountA]).toBe(420000);
    expect(byId[accountB]).toBe(50000);
    expect(res.body.netWorth).toBe(470000);
    expect(typeof res.body.lastUpdated).toBe('string');
  });

  it('excludes an archived account from the accounts list and net worth', async () => {
    const { member, accountA, accountB } = await setupTwoAccounts(app, mail, 'dash-nw-arch@example.com', 300000, 40000);
    const token = member.accessToken;
    await request(app.getHttpServer())
      .post(`/api/v1/accounts/${accountB}/archive`)
      .set('Authorization', `Bearer ${token}`);

    const res = await getDashboard(app, token, '2026-07');
    const ids = (res.body.accounts as Array<{ accountId: string }>).map((a) => a.accountId);
    expect(ids).toContain(accountA);
    expect(ids).not.toContain(accountB);
    expect(res.body.netWorth).toBe(300000); // only account A
  });
});
