import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { setupMemberWithAccount, recordMovement, accountBalance } from './movement-helpers';

/** US5 · Delete a movement (soft); excluded from balances/history; auditable (FR-010, FR-011). */
describe('Delete movement (US5)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('deletes a movement (204), excluding it from the balance and history', async () => {
    const http = app.getHttpServer();
    const { member, accountId } = await setupMemberWithAccount(app, mail, 'mv-del@example.com', 100000);
    const created = await recordMovement(app, member.accessToken, {
      type: 'expense',
      amount: 30000,
      date: '2026-07-05',
      accountId,
    });
    const id = created.body.movementId as string;
    expect(await accountBalance(app, member.accessToken, accountId)).toBe(70000);

    const del = await request(http).delete(`/api/v1/movements/${id}`).set('Authorization', `Bearer ${member.accessToken}`);
    expect(del.status).toBe(204);

    // Balance restored and movement absent from history.
    expect(await accountBalance(app, member.accessToken, accountId)).toBe(100000);
    const list = await request(http).get('/api/v1/movements').set('Authorization', `Bearer ${member.accessToken}`);
    expect(list.body.some((m: { movementId: string }) => m.movementId === id)).toBe(false);
    // A deleted movement is not fetchable.
    expect((await request(http).get(`/api/v1/movements/${id}`).set('Authorization', `Bearer ${member.accessToken}`)).status).toBe(404);
  });

  it('is idempotent: re-deleting a deleted movement is still 204', async () => {
    const http = app.getHttpServer();
    const { member, accountId } = await setupMemberWithAccount(app, mail, 'mv-del-idem@example.com');
    const created = await recordMovement(app, member.accessToken, {
      type: 'expense',
      amount: 1000,
      date: '2026-07-05',
      accountId,
    });
    const id = created.body.movementId as string;

    await request(http).delete(`/api/v1/movements/${id}`).set('Authorization', `Bearer ${member.accessToken}`);
    const again = await request(http).delete(`/api/v1/movements/${id}`).set('Authorization', `Bearer ${member.accessToken}`);
    expect(again.status).toBe(204);
  });

  it("rejects deleting another family's movement (404)", async () => {
    const http = app.getHttpServer();
    const a = await setupMemberWithAccount(app, mail, 'mv-del-a@example.com');
    const b = await setupMemberWithAccount(app, mail, 'mv-del-b@example.com');
    const created = await recordMovement(app, a.member.accessToken, {
      type: 'expense',
      amount: 1000,
      date: '2026-07-05',
      accountId: a.accountId,
    });

    const res = await request(http)
      .delete(`/api/v1/movements/${created.body.movementId}`)
      .set('Authorization', `Bearer ${b.member.accessToken}`);
    expect(res.status).toBe(404);
  });
});
