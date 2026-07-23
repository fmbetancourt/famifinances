import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-test-app';

/**
 * FAM-25 · US2 — Liveness probe contract (contracts/health-endpoint.md):
 * public, un-prefixed `/health` returning `{"status":"ok"}`, not throttled.
 */
describe('GET /health liveness (US2)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('returns 200 and {"status":"ok"} without an Authorization header (A1, A2)', async () => {
    const res = await request(app.getHttpServer()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('is not exposed under the /api/v1 prefix (A3)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');
    expect(res.status).toBe(404);
  });

  it('is not rate limited beyond the global throttle budget (A4)', async () => {
    // Global throttle is 30 req / 60s; @SkipThrottle() must exempt /health. Fire more
    // than the limit sequentially — without the skip, request 31+ would return 429.
    for (let i = 0; i < 35; i++) {
      const res = await request(app.getHttpServer()).get('/health');
      expect(res.status).toBe(200);
    }
  });
});
