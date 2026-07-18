import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { verifiedMemberWithFamily, createAccount } from './account-helpers';

/** US5 · Archive/unarchive; read-only when archived; never deleted (FR-009, FR-009a, FR-010, SC-005). */
describe('Archive account (US5)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  async function anAccount(prefix: string): Promise<{ token: string; accountId: string }> {
    const member = await verifiedMemberWithFamily(app, mail, `${prefix}@example.com`);
    const created = await createAccount(app, member.accessToken, {
      name: 'Wallet',
      type: 'digital_wallet',
      institution: 'Mercado Pago',
      initialBalance: 20000,
      startDate: '2026-07-01',
    });
    return { token: member.accessToken, accountId: created.body.accountId };
  }

  it('archives (excluded from active list, retrievable via status) and unarchives', async () => {
    const http = app.getHttpServer();
    const { token, accountId } = await anAccount('arch');

    const archived = await request(http)
      .post(`/api/v1/accounts/${accountId}/archive`)
      .set('Authorization', `Bearer ${token}`);
    expect(archived.status).toBe(200);
    expect(archived.body.archived).toBe(true);

    // Excluded from the default (active) list.
    const active = await request(http).get('/api/v1/accounts').set('Authorization', `Bearer ${token}`);
    expect(active.body).toEqual([]);

    // Retrievable via status=archived and status=all.
    const archivedList = await request(http)
      .get('/api/v1/accounts?status=archived')
      .set('Authorization', `Bearer ${token}`);
    expect(archivedList.body).toHaveLength(1);
    const allList = await request(http)
      .get('/api/v1/accounts?status=all')
      .set('Authorization', `Bearer ${token}`);
    expect(allList.body).toHaveLength(1);

    // Unarchive restores it to the active list.
    const unarchived = await request(http)
      .post(`/api/v1/accounts/${accountId}/unarchive`)
      .set('Authorization', `Bearer ${token}`);
    expect(unarchived.status).toBe(200);
    expect(unarchived.body.archived).toBe(false);
    const activeAgain = await request(http)
      .get('/api/v1/accounts')
      .set('Authorization', `Bearer ${token}`);
    expect(activeAgain.body).toHaveLength(1);
  });

  it('is idempotent: re-archiving an already-archived account is a 200 no-op', async () => {
    const http = app.getHttpServer();
    const { token, accountId } = await anAccount('arch-idem');

    await request(http).post(`/api/v1/accounts/${accountId}/archive`).set('Authorization', `Bearer ${token}`);
    const again = await request(http)
      .post(`/api/v1/accounts/${accountId}/archive`)
      .set('Authorization', `Bearer ${token}`);
    expect(again.status).toBe(200);
    expect(again.body.archived).toBe(true);
  });

  it('has no delete route (accounts are archived, never destroyed)', async () => {
    const { token, accountId } = await anAccount('arch-nodelete');

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/accounts/${accountId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404); // no DELETE handler registered
  });
});
