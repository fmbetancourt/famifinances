import './security/env-low-throttle'; // MUST be first: sets AUTH_RATE_LIMIT=3 before the app loads
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-test-app';

/** US4 · Stricter per-IP rate limit on credential endpoints (FR-004/FR-005). */
describe('Credential rate limit (US4)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
    process.env.AUTH_RATE_LIMIT = '1000'; // restore the relaxed default for subsequent suites
  });

  it('throttles login attempts beyond the per-IP threshold with a generic 429', async () => {
    const http = app.getHttpServer();
    const body = { email: 'throttle@example.com', password: 'wrongpassword1' };

    // Limit is 3: the first 3 attempts are processed (401 invalid credentials), then throttled.
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await request(http).post('/api/v1/auth/login').send(body);
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 3).every((s) => s === 401)).toBe(true);
    expect(statuses).toContain(429);

    // The throttled response is generic — it does not echo the submitted email.
    const throttled = await request(http).post('/api/v1/auth/login').send(body);
    expect(throttled.status).toBe(429);
    expect(JSON.stringify(throttled.body)).not.toContain('throttle@example.com');
  });

  it('does not throttle a single paced attempt on another credential route', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/password/reset/request')
      .send({ email: 'paced@example.com' });
    expect(res.status).toBe(202); // uniform, not throttled
  });
});
