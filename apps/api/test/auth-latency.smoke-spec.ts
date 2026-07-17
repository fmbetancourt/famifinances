import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-test-app';

/**
 * Polish · Coarse latency guard for SC-001 (registration→signed-in < 2 min) and
 * SC-002 (sign-in < 30 s). Not a load test — it fails only if a flow blows past
 * its budget, catching gross regressions. Server-side times are far under these.
 */
describe('Auth latency smoke (Polish)', () => {
  let app: INestApplication;
  const REGISTER_TO_SIGNED_IN_BUDGET_MS = 120_000; // SC-001
  const SIGN_IN_BUDGET_MS = 30_000; // SC-002

  beforeAll(async () => {
    app = await createTestApp();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  const server = () => app.getHttpServer();

  it('registration → signed-in stays within the SC-001 budget', async () => {
    const email = 'latency-reg@example.com';
    const started = Date.now();
    await request(server()).post('/api/v1/auth/register').send({ email, password: 'strongpassword1' });
    const login = await request(server())
      .post('/api/v1/auth/login')
      .send({ email, password: 'strongpassword1' });
    const elapsed = Date.now() - started;

    expect(login.status).toBe(200);
    expect(elapsed).toBeLessThan(REGISTER_TO_SIGNED_IN_BUDGET_MS);
    // eslint-disable-next-line no-console
    console.log(`[latency] register→signed-in: ${elapsed}ms (budget ${REGISTER_TO_SIGNED_IN_BUDGET_MS}ms)`);
  });

  it('sign-in stays within the SC-002 budget', async () => {
    const email = 'latency-login@example.com';
    await request(server()).post('/api/v1/auth/register').send({ email, password: 'strongpassword1' });

    const started = Date.now();
    const login = await request(server())
      .post('/api/v1/auth/login')
      .send({ email, password: 'strongpassword1' });
    const elapsed = Date.now() - started;

    expect(login.status).toBe(200);
    expect(elapsed).toBeLessThan(SIGN_IN_BUDGET_MS);
    // eslint-disable-next-line no-console
    console.log(`[latency] sign-in: ${elapsed}ms (budget ${SIGN_IN_BUDGET_MS}ms)`);
  });
});
