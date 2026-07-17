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

  it('ignores a caller-supplied accountId and derives identity from the token (FR-011)', async () => {
    const alice = await register('authz-alice@example.com');
    const bob = await register('authz-bob@example.com');
    const aliceToken = (await login('authz-alice@example.com')).body.accessToken as string;
    const bobToken = (await login('authz-bob@example.com')).body.accessToken as string;

    const aliceId = alice.body.accountId as string;
    const bobId = bob.body.accountId as string;
    expect(aliceId).not.toBe(bobId);

    // whoami-demo RECEIVES a claimedAccountId; with Alice's token, passing Bob's id
    // must still resolve to Alice — the identifier from the caller is not trusted.
    const spoofed = await request(app.getHttpServer())
      .get(`/api/v1/auth/whoami-demo?claimedAccountId=${bobId}`)
      .set('Authorization', `Bearer ${aliceToken}`);
    expect(spoofed.status).toBe(200);
    expect(spoofed.body.accountId).toBe(aliceId);

    // Identity is per-token: Bob's token resolves to Bob.
    const bobWho = await request(app.getHttpServer())
      .get('/api/v1/auth/whoami-demo')
      .set('Authorization', `Bearer ${bobToken}`);
    expect(bobWho.status).toBe(200);
    expect(bobWho.body.accountId).toBe(bobId);
  });
});
