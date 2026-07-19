import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { accountBalance } from './movement-helpers';
import { setupTwoAccounts, recordTransfer } from './transfer-helpers';

/** US5 · Delete a transfer (soft); excluded from balances/list; auditable (FR-010, FR-011). */
describe('Delete transfer (US5)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('deletes a transfer (204), restoring both balances and excluding it from the list', async () => {
    const http = app.getHttpServer();
    const { member, accountA, accountB } = await setupTwoAccounts(app, mail, 'tr-del@example.com', 100000, 20000);
    const created = await recordTransfer(app, member.accessToken, {
      amount: 30000,
      date: '2026-07-05',
      fromAccountId: accountA,
      toAccountId: accountB,
    });
    const id = created.body.transferId as string;
    expect(await accountBalance(app, member.accessToken, accountA)).toBe(70000);

    const del = await request(http).delete(`/api/v1/transfers/${id}`).set('Authorization', `Bearer ${member.accessToken}`);
    expect(del.status).toBe(204);

    expect(await accountBalance(app, member.accessToken, accountA)).toBe(100000);
    expect(await accountBalance(app, member.accessToken, accountB)).toBe(20000);
    const list = await request(http).get('/api/v1/transfers').set('Authorization', `Bearer ${member.accessToken}`);
    expect(list.body.some((t: { transferId: string }) => t.transferId === id)).toBe(false);
    expect((await request(http).get(`/api/v1/transfers/${id}`).set('Authorization', `Bearer ${member.accessToken}`)).status).toBe(404);
  });

  it('is idempotent: re-deleting a deleted transfer is still 204', async () => {
    const http = app.getHttpServer();
    const { member, accountA, accountB } = await setupTwoAccounts(app, mail, 'tr-del-idem@example.com');
    const created = await recordTransfer(app, member.accessToken, {
      amount: 1000,
      date: '2026-07-05',
      fromAccountId: accountA,
      toAccountId: accountB,
    });
    const id = created.body.transferId as string;

    await request(http).delete(`/api/v1/transfers/${id}`).set('Authorization', `Bearer ${member.accessToken}`);
    const again = await request(http).delete(`/api/v1/transfers/${id}`).set('Authorization', `Bearer ${member.accessToken}`);
    expect(again.status).toBe(204);
  });

  it("rejects deleting another family's transfer (404)", async () => {
    const http = app.getHttpServer();
    const a = await setupTwoAccounts(app, mail, 'tr-del-a@example.com');
    const b = await setupTwoAccounts(app, mail, 'tr-del-b@example.com');
    const created = await recordTransfer(app, a.member.accessToken, {
      amount: 1000,
      date: '2026-07-05',
      fromAccountId: a.accountA,
      toAccountId: a.accountB,
    });

    const res = await request(http)
      .delete(`/api/v1/transfers/${created.body.transferId}`)
      .set('Authorization', `Bearer ${b.member.accessToken}`);
    expect(res.status).toBe(404);
  });
});
