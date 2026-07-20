import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { registerVerifiedUser } from './family-helpers';

/** US5 · Verified error/log hygiene: no internal detail, no enumeration on reset, no secrets in logs (FR-006/008). */
describe('Error and log hygiene (US5)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  const noInternalDetail = (body: unknown): void => {
    const text = JSON.stringify(body);
    expect(text).not.toMatch(/\bat \/|\.ts:\d+|Mongo|stack|node_modules/i);
  };

  it('returns safe errors for validation/401/404 with no internal detail', async () => {
    const http = app.getHttpServer();

    const validation = await request(http).post('/api/v1/auth/login').send({});
    expect(validation.status).toBe(400);
    expect(Array.isArray(validation.body.errors)).toBe(true);
    noInternalDetail(validation.body);

    const unauthorized = await request(http).get('/api/v1/auth/me');
    expect(unauthorized.status).toBe(401);
    noInternalDetail(unauthorized.body);

    const notFound = await request(http).get('/api/v1/this-route-does-not-exist');
    expect(notFound.status).toBe(404);
    noInternalDetail(notFound.body);
  });

  it('responds uniformly to password reset for a registered vs unregistered email (no enumeration)', async () => {
    const user = await registerVerifiedUser(app, mail, 'hygiene-reset@example.com');

    const registered = await request(app.getHttpServer())
      .post('/api/v1/auth/password/reset/request')
      .send({ email: user.email });
    const unregistered = await request(app.getHttpServer())
      .post('/api/v1/auth/password/reset/request')
      .send({ email: 'nobody-here@example.com' });

    expect(registered.status).toBe(unregistered.status); // uniform (202)
    expect(registered.body).toEqual(unregistered.body);
  });

  it('does not write the submitted password to stdout/stderr', async () => {
    const chunks: string[] = [];
    const capture = (chunk: string | Uint8Array): boolean => {
      chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
      return true;
    };
    const outSpy = jest.spyOn(process.stdout, 'write').mockImplementation(capture);
    const errSpy = jest.spyOn(process.stderr, 'write').mockImplementation(capture);
    try {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'hygiene-log@example.com', password: 'SuperSecretPw123' });
    } finally {
      outSpy.mockRestore();
      errSpy.mockRestore();
    }
    expect(chunks.join('')).not.toContain('SuperSecretPw123');
  });
});
