import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';

/** US6 · Soft gate: unverified accounts are blocked from family/financial actions. */
describe('EmailVerifiedGuard soft gate (US6)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('blocks an unverified account and allows it after verification', async () => {
    const email = 'gate@example.com';
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'strongpassword1' });
    const code = mail.lastCodeFor(email) as string;
    const token = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'strongpassword1' })
    ).body.accessToken as string;

    // Unverified -> gated route is forbidden.
    const blocked = await request(app.getHttpServer())
      .get('/api/v1/auth/gated-demo')
      .set('Authorization', `Bearer ${token}`);
    expect(blocked.status).toBe(403);

    // Verify the email.
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ code });

    // Same (still-valid) access token now passes the gate immediately (remediation U1).
    const allowed = await request(app.getHttpServer())
      .get('/api/v1/auth/gated-demo')
      .set('Authorization', `Bearer ${token}`);
    expect(allowed.status).toBe(200);
    expect(allowed.body.ok).toBe(true);
  });
});
