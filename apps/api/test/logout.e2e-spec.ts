import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-test-app';

/** US5 · Sign out and revoke a session (FR-012). */
describe('POST /api/v1/auth/logout (US5)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  async function signIn(email: string): Promise<{ accessToken: string; refreshToken: string }> {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'strongpassword1' });
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'strongpassword1' });
    return res.body;
  }

  it('requires authentication', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken: 'anything' });
    expect(res.status).toBe(401);
  });

  it('revokes the session so its refresh token can no longer be used', async () => {
    const { accessToken, refreshToken } = await signIn('logout-ok@example.com');

    const logout = await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ refreshToken });
    expect(logout.status).toBe(204);

    const afterLogout = await request(app.getHttpServer())
      .post('/api/v1/auth/token/refresh')
      .send({ refreshToken });
    expect(afterLogout.status).toBe(401);
  });
});
