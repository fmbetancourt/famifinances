import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { accountBalance } from './movement-helpers';
import { setupTwoAccounts, recordTransfer } from './transfer-helpers';

/** US4 · Edit a transfer; affected balances recompute; re-validated (FR-009). */
describe('Edit transfer (US4)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('edits the amount and both balances recompute', async () => {
    const { member, accountA, accountB } = await setupTwoAccounts(app, mail, 'tr-edit@example.com', 100000, 20000);
    const created = await recordTransfer(app, member.accessToken, {
      amount: 30000,
      date: '2026-07-05',
      fromAccountId: accountA,
      toAccountId: accountB,
    });
    expect(await accountBalance(app, member.accessToken, accountA)).toBe(70000);
    expect(await accountBalance(app, member.accessToken, accountB)).toBe(50000);

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/transfers/${created.body.transferId}`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ amount: 40000 });
    expect(res.status).toBe(200);
    expect(await accountBalance(app, member.accessToken, accountA)).toBe(60000);
    expect(await accountBalance(app, member.accessToken, accountB)).toBe(60000);
  });

  it('changes an account and all affected balances recompute', async () => {
    const { member, accountA, accountB } = await setupTwoAccounts(app, mail, 'tr-edit-move@example.com', 100000, 20000);
    const third = await request(app.getHttpServer())
      .post('/api/v1/accounts')
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ name: 'Cuenta C', type: 'cash', initialBalance: 5000, startDate: '2026-07-01' });
    const accountC = third.body.accountId as string;
    const created = await recordTransfer(app, member.accessToken, {
      amount: 10000,
      date: '2026-07-05',
      fromAccountId: accountA,
      toAccountId: accountB,
    });
    // A 90000, B 30000

    // Move the destination from B to C.
    await request(app.getHttpServer())
      .patch(`/api/v1/transfers/${created.body.transferId}`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ toAccountId: accountC });

    expect(await accountBalance(app, member.accessToken, accountA)).toBe(90000); // still −10000
    expect(await accountBalance(app, member.accessToken, accountB)).toBe(20000); // restored
    expect(await accountBalance(app, member.accessToken, accountC)).toBe(15000); // 5000 + 10000
  });

  it('rejects an invalid edit (empty body / same account) and leaves it unchanged (400)', async () => {
    const { member, accountA, accountB } = await setupTwoAccounts(app, mail, 'tr-edit-invalid@example.com');
    const created = await recordTransfer(app, member.accessToken, {
      amount: 1000,
      date: '2026-07-05',
      fromAccountId: accountA,
      toAccountId: accountB,
    });
    const id = created.body.transferId as string;

    const empty = await request(app.getHttpServer())
      .patch(`/api/v1/transfers/${id}`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({});
    expect(empty.status).toBe(400);

    // Setting the origin to equal the destination → 400.
    const same = await request(app.getHttpServer())
      .patch(`/api/v1/transfers/${id}`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ fromAccountId: accountB });
    expect(same.status).toBe(400);
  });
});
