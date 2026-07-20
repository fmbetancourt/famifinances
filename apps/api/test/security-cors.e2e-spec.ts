import './security/env-cors-allowlist'; // MUST be first: sets the allowlist before the app loads
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-test-app';

/** US2 · Deny-by-default CORS allowlist; no-Origin clients unaffected (FR-002). */
describe('CORS allowlist (US2)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
    process.env.CORS_ALLOWED_ORIGINS = ''; // restore for subsequent suites
  });

  it('grants an allowlisted origin, denies an unlisted one, and allows no-Origin', async () => {
    const http = app.getHttpServer();

    const allowlisted = await request(http).get('/api/v1/auth/me').set('Origin', 'https://app.famifinances.cl');
    expect(allowlisted.headers['access-control-allow-origin']).toBe('https://app.famifinances.cl');

    const unlisted = await request(http).get('/api/v1/auth/me').set('Origin', 'https://evil.example');
    expect(unlisted.headers['access-control-allow-origin']).toBeUndefined();

    const noOrigin = await request(http).get('/api/v1/auth/me'); // native/server-to-server
    expect(noOrigin.status).toBe(401); // processed normally (no CORS block)
  });
});
