import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-test-app';

/** US4 · Reuse detection: a replayed (rotated) refresh token revokes the chain. */
describe('Refresh token reuse detection (US4)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  const refresh = (refreshToken: string) =>
    request(app.getHttpServer()).post('/api/v1/auth/token/refresh').send({ refreshToken });

  it('rejects a reused token and revokes the whole rotation chain', async () => {
    const email = 'refresh-reuse@example.com';
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'strongpassword1' });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'strongpassword1' });

    const original = login.body.refreshToken as string;

    // Legitimate rotation: original -> rotated.
    const rotated = (await refresh(original)).body.refreshToken as string;

    // Replay the original (now revoked) token -> reuse detected -> 401.
    const reuse = await refresh(original);
    expect(reuse.status).toBe(401);

    // The chain is revoked, so even the rotated token no longer works.
    const afterReuse = await refresh(rotated);
    expect(afterReuse.status).toBe(401);
  });
});
