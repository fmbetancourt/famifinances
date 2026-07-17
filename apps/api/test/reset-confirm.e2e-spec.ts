import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';

/** US7 · Confirm reset: revokes all sessions, marks verified, only new pw works. */
describe('POST /api/v1/auth/password/reset/confirm (US7)', () => {
  let app: INestApplication;
  let mail: MailCollector;
  const email = 'reset-confirm@example.com';
  const oldPassword = 'strongpassword1';
  const newPassword = 'brandnewpassword2';

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  const server = () => app.getHttpServer();
  const login = (password: string) =>
    request(server()).post('/api/v1/auth/login').send({ email, password });

  it('resets the password, revokes sessions, and marks the email verified', async () => {
    await request(server()).post('/api/v1/auth/register').send({ email, password: oldPassword });
    const session = (await login(oldPassword)).body as { refreshToken: string };

    await request(server()).post('/api/v1/auth/password/reset/request').send({ email });
    const code = mail.lastCodeFor(email) as string;

    const confirm = await request(server())
      .post('/api/v1/auth/password/reset/confirm')
      .send({ email, code, newPassword });
    expect(confirm.status).toBe(204);

    // Old password no longer works; the new one does.
    expect((await login(oldPassword)).status).toBe(401);
    const newLogin = await login(newPassword);
    expect(newLogin.status).toBe(200);

    // Sessions issued before the reset are revoked.
    const oldRefresh = await request(server())
      .post('/api/v1/auth/token/refresh')
      .send({ refreshToken: session.refreshToken });
    expect(oldRefresh.status).toBe(401);

    // The email is now verified (FR-025).
    const me = await request(server())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${newLogin.body.accessToken}`);
    expect(me.body.emailVerified).toBe(true);
  });

  it('clears an existing lockout so the user can sign in right after a reset', async () => {
    const lockedEmail = 'reset-locked@example.com';
    await request(server())
      .post('/api/v1/auth/register')
      .send({ email: lockedEmail, password: oldPassword });

    // Lock the account with repeated failed sign-ins.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await request(server())
        .post('/api/v1/auth/login')
        .send({ email: lockedEmail, password: 'wrongpassword9' });
    }
    // Sanity: the account is locked (correct password rejected).
    expect(
      (await request(server()).post('/api/v1/auth/login').send({ email: lockedEmail, password: oldPassword }))
        .status,
    ).toBe(401);

    // Reset the password.
    await request(server()).post('/api/v1/auth/password/reset/request').send({ email: lockedEmail });
    const code = mail.lastCodeFor(lockedEmail) as string;
    const confirm = await request(server())
      .post('/api/v1/auth/password/reset/confirm')
      .send({ email: lockedEmail, code, newPassword });
    expect(confirm.status).toBe(204);

    // The lockout is cleared: the new password works immediately.
    expect(
      (await request(server()).post('/api/v1/auth/login').send({ email: lockedEmail, password: newPassword }))
        .status,
    ).toBe(200);
  });
});
