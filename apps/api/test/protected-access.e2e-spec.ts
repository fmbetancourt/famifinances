import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { createTestApp } from './create-test-app';

/** US3 · Access protected resources only when authenticated (FR-009, FR-010). */
describe('GET /api/v1/auth/me guard (US3)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  async function signInToken(): Promise<string> {
    const email = 'protected-ok@example.com';
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: 'strongpassword1' });
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'strongpassword1' });
    return res.body.accessToken as string;
  }

  it('denies access with no token', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('denies access with a tampered token', async () => {
    const token = await signInToken();
    const tampered = `${token.slice(0, -2)}xx`;
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tampered}`);
    expect(res.status).toBe(401);
  });

  it('denies access with an expired token', async () => {
    const jwt = new JwtService({ secret: process.env.JWT_SECRET });
    const expired = jwt.sign({ sub: '000000000000000000000000' }, { expiresIn: '-1s' });
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expired}`);
    expect(res.status).toBe(401);
  });

  it('grants access with a valid token and returns the session identity', async () => {
    const token = await signInToken();
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('protected-ok@example.com');
    expect(res.body.emailVerified).toBe(false);
    expect(res.body.accountId).toBeDefined();
  });
});
