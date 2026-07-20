import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestApp } from './create-test-app';

/** US3 · Oversized request bodies are rejected with 413 before processing (FR-003). */
describe('Request body-size limit (US3)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('rejects a body over the limit with 413 and processes a normal body', async () => {
    // >100kb JSON payload (a huge password field) → rejected by the body parser.
    const oversized = { email: 'big@example.com', password: 'x'.repeat(200 * 1024) };
    const tooLarge = await request(app.getHttpServer()).post('/api/v1/auth/login').send(oversized);
    expect(tooLarge.status).toBe(413);

    // A normal-sized login is parsed and handled (401 invalid credentials, not 413).
    const normal = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'small@example.com', password: 'strongpassword1' });
    expect(normal.status).not.toBe(413);
  });
});
