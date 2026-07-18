import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { verifiedMemberWithFamily, createAccount } from './account-helpers';

/** US4 · Edit an account; changing the initial balance recomputes the derived balance (FR-008, FR-009a). */
describe('Edit account (US4)', () => {
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
      name: 'Editable',
      type: 'bank',
      initialBalance: 100000,
      startDate: '2026-07-01',
    });
    return { token: member.accessToken, accountId: created.body.accountId };
  }

  it('updates fields and recomputes the balance when initialBalance changes', async () => {
    const { token, accountId } = await anAccount('edit-ok');

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/accounts/${accountId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed', initialBalance: 250000 });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Renamed', initialBalance: 250000, balance: 250000 });
  });

  it('rejects an invalid field and leaves the account unchanged (400)', async () => {
    const { token, accountId } = await anAccount('edit-invalid');

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/accounts/${accountId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ type: 'crypto' });
    expect(res.status).toBe(400);

    const after = await request(app.getHttpServer())
      .get(`/api/v1/accounts/${accountId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(after.body).toMatchObject({ name: 'Editable', type: 'bank' });
  });

  it('rejects an empty PATCH body (400, contract minProperties: 1)', async () => {
    const { token, accountId } = await anAccount('edit-empty');

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/accounts/${accountId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('rejects a date-time startDate on edit (400, date-only contract)', async () => {
    const { token, accountId } = await anAccount('edit-datetime');

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/accounts/${accountId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ startDate: '2026-07-01T00:00:00Z' });
    expect(res.status).toBe(400);
  });

  it('rejects a client-supplied balance field (400, whitelist guards SC-004)', async () => {
    const { token, accountId } = await anAccount('edit-whitelist');

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/accounts/${accountId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ balance: 999999 });
    expect(res.status).toBe(400);
  });

  it('rejects editing an archived account (409 read-only)', async () => {
    const { token, accountId } = await anAccount('edit-archived');
    await request(app.getHttpServer())
      .post(`/api/v1/accounts/${accountId}/archive`)
      .set('Authorization', `Bearer ${token}`);

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/accounts/${accountId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Nope' });
    expect(res.status).toBe(409);
  });
});
