import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';

/** US6 · Resend invalidates the previous unused verification code (FR-021). */
describe('POST /api/v1/auth/email/verify/resend (US6)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('issues a new code and invalidates the previous one', async () => {
    const email = 'resend@example.com';
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'strongpassword1' });
    const firstCode = mail.lastCodeFor(email) as string;
    const token = (
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'strongpassword1' })
    ).body.accessToken as string;

    const resend = await request(app.getHttpServer())
      .post('/api/v1/auth/email/verify/resend')
      .set('Authorization', `Bearer ${token}`);
    expect(resend.status).toBe(202);

    const secondCode = mail.lastCodeFor(email) as string;
    expect(secondCode).not.toBe(firstCode);

    // The first (now invalidated) code no longer works.
    const withOld = await request(app.getHttpServer())
      .post('/api/v1/auth/email/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: firstCode });
    expect(withOld.status).toBe(400);

    // The new code works.
    const withNew = await request(app.getHttpServer())
      .post('/api/v1/auth/email/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: secondCode });
    expect(withNew.status).toBe(200);
    expect(withNew.body.emailVerified).toBe(true);
  });
});
