import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';

/** US7 · Request a password reset — uniform response, no enumeration (FR-022, SC-011). */
describe('POST /api/v1/auth/password/reset/request (US7)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  const requestReset = (email: string) =>
    request(app.getHttpServer()).post('/api/v1/auth/password/reset/request').send({ email });

  it('responds identically for registered and unregistered emails', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email: 'reset-known@example.com', password: 'strongpassword1' });

    const known = await requestReset('reset-known@example.com');
    const unknown = await requestReset('reset-nobody@example.com');

    expect(known.status).toBe(202);
    expect(unknown.status).toBe(202);
    expect(known.body).toEqual(unknown.body);

    // A code is emailed only for the registered account.
    expect(mail.lastCodeFor('reset-known@example.com')).toMatch(/^[0-9]{6}$/);
    expect(mail.lastCodeFor('reset-nobody@example.com')).toBeNull();
  });
});
