import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { UniformErrorFilter } from '../src/common/filters/uniform-error.filter';

/** US1 · Register a new account (FR-001..FR-005). Mongo + env come from global-setup.js. */
describe('POST /api/v1/auth/register (US1)', () => {
  let app: INestApplication;
  const url = '/api/v1/auth/register';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    app.useGlobalFilters(new UniformErrorFilter());
    await app.init();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('creates an account (normalized email, unverified) and never returns the hash', async () => {
    const res = await request(app.getHttpServer())
      .post(url)
      .send({ email: 'Alice@Example.com', password: 'strongpassword1' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: 'alice@example.com', emailVerified: false });
    expect(res.body.accountId).toBeDefined();
    expect(res.body.passwordHash).toBeUndefined();
  });

  it('rejects a duplicate email (case-insensitive) with a non-committal 409', async () => {
    await request(app.getHttpServer())
      .post(url)
      .send({ email: 'dup@example.com', password: 'strongpassword1' });

    const res = await request(app.getHttpServer())
      .post(url)
      .send({ email: 'DUP@example.com', password: 'strongpassword1' });

    expect(res.status).toBe(409);
    expect(res.body.message).toBe('Registration could not be completed.');
    expect(JSON.stringify(res.body).toLowerCase()).not.toContain('exist');
  });

  it('rejects a weak password with 400 and rule detail', async () => {
    const res = await request(app.getHttpServer())
      .post(url)
      .send({ email: 'weak@example.com', password: 'short1' });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toContain('at least 12');
  });

  it('rejects a malformed email with 400', async () => {
    const res = await request(app.getHttpServer())
      .post(url)
      .send({ email: 'not-an-email', password: 'strongpassword1' });

    expect(res.status).toBe(400);
  });

  it('rejects unknown fields (server-side validation, FR-017)', async () => {
    const res = await request(app.getHttpServer())
      .post(url)
      .send({ email: 'x@example.com', password: 'strongpassword1', role: 'admin' });

    expect(res.status).toBe(400);
  });
});
