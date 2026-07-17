import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';

/** US6 · Verify email with a one-time code (FR-020). */
describe('POST /api/v1/auth/email/verify (US6)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  async function registerAndSignIn(email: string): Promise<{ token: string; code: string }> {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'strongpassword1' });
    const code = mail.lastCodeFor(email) as string;
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'strongpassword1' });
    return { token: login.body.accessToken as string, code };
  }

  const verify = (token: string, code: string) =>
    request(app.getHttpServer())
      .post('/api/v1/auth/email/verify')
      .set('Authorization', `Bearer ${token}`)
      .send({ code });

  it('delivers a 6-digit code on registration', async () => {
    const { code } = await registerAndSignIn('verify-code@example.com');
    expect(code).toMatch(/^[0-9]{6}$/);
  });

  it('rejects an incorrect code with 400', async () => {
    const { token, code } = await registerAndSignIn('verify-wrong@example.com');
    const wrong = code === '000000' ? '111111' : '000000';
    const res = await verify(token, wrong);
    expect(res.status).toBe(400);
  });

  it('verifies the email with the correct code and is single-use', async () => {
    const { token, code } = await registerAndSignIn('verify-ok@example.com');

    const first = await verify(token, code);
    expect(first.status).toBe(200);
    expect(first.body.emailVerified).toBe(true);

    // Re-using the consumed code fails.
    const second = await verify(token, code);
    expect(second.status).toBe(400);
  });
});
