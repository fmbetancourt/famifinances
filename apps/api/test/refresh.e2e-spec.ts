import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-test-app';

/** US4 · Stay signed in with secure renewal (FR-007, FR-008). */
describe('POST /api/v1/auth/token/refresh (US4)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  async function loginTokens(email: string): Promise<{ accessToken: string; refreshToken: string }> {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'strongpassword1' });
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'strongpassword1' });
    return res.body;
  }

  const refresh = (refreshToken: string) =>
    request(app.getHttpServer()).post('/api/v1/auth/token/refresh').send({ refreshToken });

  it('rotates the refresh token and returns a new pair', async () => {
    const first = await loginTokens('refresh-ok@example.com');
    const res = await refresh(first.refreshToken);

    expect(res.status).toBe(200);
    expect(res.body.tokenType).toBe('Bearer');
    expect(typeof res.body.accessToken).toBe('string');
    expect(typeof res.body.refreshToken).toBe('string');
    expect(res.body.refreshToken).not.toBe(first.refreshToken);
  });

  it('accepts the newly issued refresh token for a subsequent rotation', async () => {
    const first = await loginTokens('refresh-chain@example.com');
    const second = (await refresh(first.refreshToken)).body;
    const third = await refresh(second.refreshToken);

    expect(third.status).toBe(200);
    expect(third.body.refreshToken).not.toBe(second.refreshToken);
  });

  it('rejects an unknown refresh token', async () => {
    const res = await refresh('deadbeef'.repeat(8));
    expect(res.status).toBe(401);
  });
});
