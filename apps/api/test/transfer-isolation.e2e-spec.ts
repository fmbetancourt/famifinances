import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { setupTwoAccounts, recordTransfer } from './transfer-helpers';

/** US3 · Family isolation & transfer integrity (Principle I, FR-003/013/014). */
describe('Transfer isolation & integrity (US3)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('rejects origin == destination (400)', async () => {
    const { member, accountA } = await setupTwoAccounts(app, mail, 'tr-same@example.com');
    const res = await recordTransfer(app, member.accessToken, {
      amount: 1000,
      date: '2026-07-05',
      fromAccountId: accountA,
      toAccountId: accountA,
    });
    expect(res.status).toBe(400);
  });

  it("rejects another family's account (400)", async () => {
    const a = await setupTwoAccounts(app, mail, 'tr-iso-a@example.com');
    const b = await setupTwoAccounts(app, mail, 'tr-iso-b@example.com');

    // Family B transfers using family A's account as origin → 400 (not available).
    const res = await recordTransfer(app, b.member.accessToken, {
      amount: 1000,
      date: '2026-07-05',
      fromAccountId: a.accountA,
      toAccountId: b.accountB,
    });
    expect(res.status).toBe(400);
  });

  it("never exposes or mutates another family's transfer (404)", async () => {
    const http = app.getHttpServer();
    const a = await setupTwoAccounts(app, mail, 'tr-iso-a2@example.com');
    const b = await setupTwoAccounts(app, mail, 'tr-iso-b2@example.com');
    const created = await recordTransfer(app, a.member.accessToken, {
      amount: 1000,
      date: '2026-07-05',
      fromAccountId: a.accountA,
      toAccountId: a.accountB,
    });
    const aId = created.body.transferId as string;

    expect(
      (await request(http).get(`/api/v1/transfers/${aId}`).set('Authorization', `Bearer ${b.member.accessToken}`)).status,
    ).toBe(404);
    expect(
      (
        await request(http)
          .patch(`/api/v1/transfers/${aId}`)
          .set('Authorization', `Bearer ${b.member.accessToken}`)
          .send({ amount: 2 })
      ).status,
    ).toBe(404);
    expect(
      (await request(http).delete(`/api/v1/transfers/${aId}`).set('Authorization', `Bearer ${b.member.accessToken}`))
        .status,
    ).toBe(404);

    const bList = await request(http).get('/api/v1/transfers').set('Authorization', `Bearer ${b.member.accessToken}`);
    expect(bList.body.some((t: { transferId: string }) => t.transferId === aId)).toBe(false);
  });

  it('treats a malformed or unknown transfer id as not found (404)', async () => {
    const http = app.getHttpServer();
    const { member } = await setupTwoAccounts(app, mail, 'tr-iso-unknown@example.com');
    expect(
      (await request(http).get('/api/v1/transfers/not-an-id').set('Authorization', `Bearer ${member.accessToken}`)).status,
    ).toBe(404);
    expect(
      (
        await request(http)
          .get('/api/v1/transfers/5f8d0d55b54764421b7156c1')
          .set('Authorization', `Bearer ${member.accessToken}`)
      ).status,
    ).toBe(404);
  });
});
