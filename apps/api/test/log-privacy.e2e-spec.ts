import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';

/**
 * Polish · SC-007 / FR-015 / FR-027: no password, token, code, or monetary value
 * may appear in logs across the full auth flow. Captures stdout/stderr while
 * driving register → verify → login → refresh → reset and asserts none leak.
 */
describe('No secrets in logs (Polish)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('never writes secrets to stdout/stderr during the full flow', async () => {
    const email = 'log-privacy@example.com';
    const password = 'strongpassword1';
    const newPassword = 'brandnewpassword2';
    const server = app.getHttpServer();

    const chunks: string[] = [];
    const capture = (chunk: string | Uint8Array): boolean => {
      chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
      return true;
    };
    const outSpy = jest.spyOn(process.stdout, 'write').mockImplementation(capture);
    const errSpy = jest.spyOn(process.stderr, 'write').mockImplementation(capture);

    let accessToken = '';
    let refreshToken = '';
    let verifyCode = '';
    let resetCode = '';
    try {
      await request(server).post('/api/v1/auth/register').send({ email, password });
      verifyCode = mail.lastCodeFor(email) as string;

      const login = await request(server).post('/api/v1/auth/login').send({ email, password });
      accessToken = login.body.accessToken;
      refreshToken = login.body.refreshToken;

      await request(server)
        .post('/api/v1/auth/email/verify')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ code: verifyCode });

      await request(server).post('/api/v1/auth/token/refresh').send({ refreshToken });

      await request(server).post('/api/v1/auth/password/reset/request').send({ email });
      resetCode = mail.lastCodeFor(email) as string;
      await request(server)
        .post('/api/v1/auth/password/reset/confirm')
        .send({ email, code: resetCode, newPassword });
    } finally {
      outSpy.mockRestore();
      errSpy.mockRestore();
    }

    const logged = chunks.join('');
    for (const secret of [password, newPassword, accessToken, refreshToken, verifyCode, resetCode]) {
      expect(secret.length).toBeGreaterThan(0);
      expect(logged).not.toContain(secret);
    }
  });
});
