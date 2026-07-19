import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { accountBalance, recordMovement } from './movement-helpers';
import { setupTwoAccounts, recordTransfer } from './transfer-helpers';

/** Polish (T028) · Balance effect + no double counting (SC-002/003/007, Principle III). */
describe('Transfer balance & no double counting (Polish)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('shifts balance origin→destination without changing the movement history (no double counting)', async () => {
    const http = app.getHttpServer();
    const { member, accountA, accountB } = await setupTwoAccounts(app, mail, 'tr-bal@example.com', 100000, 20000);

    // Record income/expense movements first; capture the movement history.
    await recordMovement(app, member.accessToken, { type: 'income', amount: 10000, date: '2026-07-01', accountId: accountA });
    await recordMovement(app, member.accessToken, { type: 'expense', amount: 5000, date: '2026-07-02', accountId: accountA });
    const before = (await request(http).get('/api/v1/movements').set('Authorization', `Bearer ${member.accessToken}`)).body;

    // A transfer moves balance between accounts but creates NO movement.
    const transfer = await recordTransfer(app, member.accessToken, {
      amount: 30000,
      date: '2026-07-05',
      fromAccountId: accountA,
      toAccountId: accountB,
    });
    // A: 100000 + 10000 − 5000 − 30000 = 75000 ; B: 20000 + 30000 = 50000
    expect(await accountBalance(app, member.accessToken, accountA)).toBe(75000);
    expect(await accountBalance(app, member.accessToken, accountB)).toBe(50000);

    // The movement history is UNCHANGED — the transfer is neither income nor expense (no double counting).
    const after = (await request(http).get('/api/v1/movements').set('Authorization', `Bearer ${member.accessToken}`)).body;
    expect(after).toEqual(before);

    // Deleting the transfer restores both balances.
    await request(http).delete(`/api/v1/transfers/${transfer.body.transferId}`).set('Authorization', `Bearer ${member.accessToken}`);
    expect(await accountBalance(app, member.accessToken, accountA)).toBe(105000); // 100000 + 10000 − 5000
    expect(await accountBalance(app, member.accessToken, accountB)).toBe(20000);
  });
});
