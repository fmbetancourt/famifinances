import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-test-app';

/** US1 · Global security headers on every response; no server-identifying banner (FR-001/FR-009). */
describe('Security headers (US1)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('sets the security headers and omits X-Powered-By on any response', async () => {
    // Any route works — headers are applied globally, even on a 401.
    const res = await request(app.getHttpServer()).get('/api/v1/auth/me');

    expect(res.headers['strict-transport-security']).toMatch(/max-age=\d+/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
