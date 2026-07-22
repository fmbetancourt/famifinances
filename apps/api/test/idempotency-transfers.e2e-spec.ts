import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { postTransfer, ownerWithData } from './idempotency-helpers';

/** US2 · Idempotent transfer capture — no duplicate, no double balance move (FR-004/007). */
describe('Idempotent transfer capture (US2)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('replays the same transfer and moves balances only once', async () => {
    const ctx = await ownerWithData(app, mail, 'idem-tra@example.com');
    const token = ctx.owner.accessToken;
    const body = { amount: 50000, date: '2026-07-11', fromAccountId: ctx.accountId, toAccountId: ctx.accountBId };

    const first = await postTransfer(app, token, body, 'k-tra-1');
    expect(first.status).toBe(201);
    const id = first.body.transferId as string;

    const replay = await postTransfer(app, token, body, 'k-tra-1');
    expect(replay.status).toBe(201);
    expect(replay.body.transferId).toBe(id);
    expect(replay.headers['idempotent-replayed']).toBe('true');

    // Only one transfer exists → the origin account balance reflects a single −50000 move.
    const list = await request(app.getHttpServer())
      .get('/api/v1/transfers')
      .set('Authorization', `Bearer ${token}`);
    expect(list.body).toHaveLength(1);
  });
});
