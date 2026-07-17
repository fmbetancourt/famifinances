import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-test-app';

/** US2 · Sign in and obtain a session (FR-006, FR-007, FR-014). */
describe('POST /api/v1/auth/login (US2)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  const register = (email: string, password: string) =>
    request(app.getHttpServer()).post('/api/v1/auth/register').send({ email, password });
  const login = (email: string, password: string) =>
    request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password });

  it('returns an access + refresh token pair for correct credentials', async () => {
    await register('login-ok@example.com', 'strongpassword1');
    const res = await login('login-ok@example.com', 'strongpassword1');

    expect(res.status).toBe(200);
    expect(res.body.tokenType).toBe('Bearer');
    expect(typeof res.body.accessToken).toBe('string');
    expect(typeof res.body.refreshToken).toBe('string');
    expect(res.body.expiresIn).toBe(900);

    const payload = JSON.parse(
      Buffer.from(res.body.accessToken.split('.')[1], 'base64').toString('utf8'),
    );
    expect(payload.sub).toBeDefined();
  });

  it('rejects wrong password and unknown email identically (no enumeration, SC-008)', async () => {
    await register('login-enum@example.com', 'strongpassword1');
    const wrong = await login('login-enum@example.com', 'wrongpassword1');
    const unknown = await login('nobody-unknown@example.com', 'whatever123456');

    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });
});
