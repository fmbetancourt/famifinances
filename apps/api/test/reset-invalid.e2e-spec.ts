import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';

/** US7 · Confirm reset rejects invalid/used codes and weak passwords (FR-023). */
describe('Password reset confirm — invalid inputs (US7)', () => {
  let app: INestApplication;
  let mail: MailCollector;
  const email = 'reset-invalid@example.com';

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  const server = () => app.getHttpServer();
  const confirm = (code: string, newPassword: string) =>
    request(server()).post('/api/v1/auth/password/reset/confirm').send({ email, code, newPassword });

  it('rejects a wrong code, then accepts the correct one (which is single-use)', async () => {
    await request(server())
      .post('/api/v1/auth/register')
      .send({ email, password: 'strongpassword1' });
    await request(server()).post('/api/v1/auth/password/reset/request').send({ email });
    const code = mail.lastCodeFor(email) as string;
    const wrong = code === '000000' ? '111111' : '000000';

    // Wrong code -> 400.
    expect((await confirm(wrong, 'brandnewpassword2')).status).toBe(400);

    // Weak password -> 400 (and does not consume the code).
    expect((await confirm(code, 'short1')).status).toBe(400);

    // Correct code + strong password -> 204.
    expect((await confirm(code, 'brandnewpassword2')).status).toBe(204);

    // Reusing the now-consumed code -> 400.
    expect((await confirm(code, 'anotherstrongpw3')).status).toBe(400);
  });
});
