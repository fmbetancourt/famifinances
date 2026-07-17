import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-test-app';

/** US2 · Per-account lockout after repeated failed sign-ins (FR-013). */
describe('Account lockout (US2)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('blocks sign-in even with the correct password once the threshold is exceeded', async () => {
    const email = 'login-lock@example.com';
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'strongpassword1' });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'wrongpassword1' });
    }

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'strongpassword1' });

    expect(res.status).toBe(401);
  });
});
