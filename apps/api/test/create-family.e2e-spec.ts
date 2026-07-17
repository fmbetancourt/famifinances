import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { registerVerifiedUser } from './family-helpers';

/** US1 · Create a family; the creator becomes its Owner (FR-001, FR-002). */
describe('Create family (US1)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('lets a verified user create a family and become owner', async () => {
    const { accessToken } = await registerVerifiedUser(app, mail, 'owner1@example.com');

    const res = await request(app.getHttpServer())
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Los Betancourt' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ name: 'Los Betancourt', role: 'owner' });
    expect(typeof res.body.familyId).toBe('string');
  });

  it('rejects a second family for a user who already belongs to one (FR-014)', async () => {
    const { accessToken } = await registerVerifiedUser(app, mail, 'owner2@example.com');
    const http = app.getHttpServer();

    await request(http)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'First Family' });

    const second = await request(http)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Second Family' });

    expect(second.status).toBe(409);
  });

  it('blocks an unverified account from creating a family (FR-019 soft gate)', async () => {
    const email = 'unverified@example.com';
    const http = app.getHttpServer();
    await request(http).post('/api/v1/auth/register').send({ email, password: 'strongpassword1' });
    const token = (
      await request(http).post('/api/v1/auth/login').send({ email, password: 'strongpassword1' })
    ).body.accessToken as string;

    const res = await request(http)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'No Access' });

    expect(res.status).toBe(403);
  });

  it('rejects an empty family name (validation)', async () => {
    const { accessToken } = await registerVerifiedUser(app, mail, 'owner3@example.com');

    const res = await request(app.getHttpServer())
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: '' });

    expect(res.status).toBe(400);
  });
});
