import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-test-app';

/**
 * US3 · Identity is derived from the session, never from client input
 * (FR-011, SC-004). The foundation of the constitution's family-isolation gate.
 */
describe('Session-scoped authorization (US3)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  const register = (email: string) =>
    request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'strongpassword1' });
  const login = (email: string) =>
    request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'strongpassword1' });

  it('ignores a foreign accountId in the request body and uses the token identity', async () => {
    const alice = await register('authz-alice@example.com');
    const aliceToken = (await login('authz-alice@example.com')).body.accessToken as string;
    const bob = await register('authz-bob@example.com');

    const aliceId = alice.body.accountId as string;
    const bobId = bob.body.accountId as string;
    expect(aliceId).not.toBe(bobId);

    // Alice's token, but the body tries to impersonate Bob.
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ accountId: bobId });

    expect(res.status).toBe(200);
    expect(res.body.accountId).toBe(aliceId);
    expect(res.body.accountId).not.toBe(bobId);
    expect(res.body.email).toBe('authz-alice@example.com');
  });
});
