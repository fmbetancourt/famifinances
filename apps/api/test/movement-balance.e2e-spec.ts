import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { setupMemberWithAccount, recordMovement, accountBalance } from './movement-helpers';

/** Polish (T030) · Derived balance = initial + Σ income − Σ expense, excluding deleted (SC-002, Principle III). */
describe('Derived balance from movements (Polish)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('sums income minus expense over several movements and excludes a deleted one', async () => {
    const http = app.getHttpServer();
    const { member, accountId } = await setupMemberWithAccount(app, mail, 'mv-bal@example.com', 100000);

    await recordMovement(app, member.accessToken, { type: 'income', amount: 40000, date: '2026-07-01', accountId });
    await recordMovement(app, member.accessToken, { type: 'expense', amount: 15000, date: '2026-07-02', accountId });
    const toDelete = await recordMovement(app, member.accessToken, {
      type: 'expense',
      amount: 25000,
      date: '2026-07-03',
      accountId,
    });
    // 100000 + 40000 − 15000 − 25000 = 100000
    expect(await accountBalance(app, member.accessToken, accountId)).toBe(100000);

    await request(http)
      .delete(`/api/v1/movements/${toDelete.body.movementId}`)
      .set('Authorization', `Bearer ${member.accessToken}`);
    // deleting the 25000 expense → 100000 + 40000 − 15000 = 125000
    expect(await accountBalance(app, member.accessToken, accountId)).toBe(125000);
  });

  it('reflects a new account with no movements as its initial balance (net 0)', async () => {
    const { member, accountId } = await setupMemberWithAccount(app, mail, 'mv-bal-zero@example.com', 77000);
    expect(await accountBalance(app, member.accessToken, accountId)).toBe(77000);
  });
});
