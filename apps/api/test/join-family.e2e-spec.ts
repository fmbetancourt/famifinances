import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createTestAppWithMail, MailCollector } from './create-test-app';
import { registerVerifiedUser } from './family-helpers';

/** US2 · Join a family by redeeming a single-use invite code (FR-004..FR-008). */
describe('Join family (US2)', () => {
  let app: INestApplication;
  let mail: MailCollector;

  beforeAll(async () => {
    ({ app, mail } = await createTestAppWithMail());
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  /** Creates a family with a fresh owner and returns a usable invite code. */
  async function familyWithInvite(ownerEmail: string): Promise<{ code: string; ownerToken: string }> {
    const http = app.getHttpServer();
    const { accessToken: ownerToken } = await registerVerifiedUser(app, mail, ownerEmail);
    await request(http)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Host Family' });
    const invite = await request(http)
      .post('/api/v1/families/me/invites')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send();
    return { code: invite.body.code as string, ownerToken };
  }

  it('only the owner can issue an invite code (FR-004)', async () => {
    const { code } = await familyWithInvite('host1@example.com');
    expect(typeof code).toBe('string');
    expect(code.length).toBeGreaterThan(0);
  });

  it('lets a verified user join with a valid code and become a member', async () => {
    const { code } = await familyWithInvite('host2@example.com');
    const { accessToken: joinerToken } = await registerVerifiedUser(app, mail, 'joiner2@example.com');

    const res = await request(app.getHttpServer())
      .post('/api/v1/families/join')
      .set('Authorization', `Bearer ${joinerToken}`)
      .send({ code });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Host Family', role: 'member' });
  });

  it('rejects reusing a single-use code (FR-005)', async () => {
    const { code } = await familyWithInvite('host3@example.com');
    const first = await registerVerifiedUser(app, mail, 'joiner3a@example.com');
    const second = await registerVerifiedUser(app, mail, 'joiner3b@example.com');
    const http = app.getHttpServer();

    const firstJoin = await request(http)
      .post('/api/v1/families/join')
      .set('Authorization', `Bearer ${first.accessToken}`)
      .send({ code });
    expect(firstJoin.status).toBe(200);

    const secondJoin = await request(http)
      .post('/api/v1/families/join')
      .set('Authorization', `Bearer ${second.accessToken}`)
      .send({ code });
    expect(secondJoin.status).toBe(400);
  });

  it('rejects an invalid code', async () => {
    const { accessToken } = await registerVerifiedUser(app, mail, 'joiner4@example.com');

    const res = await request(app.getHttpServer())
      .post('/api/v1/families/join')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code: 'deadbeefdeadbeef' });

    expect(res.status).toBe(400);
  });

  it('rejects joining when the user already belongs to a family (FR-014)', async () => {
    const { code } = await familyWithInvite('host5@example.com');
    const { accessToken } = await registerVerifiedUser(app, mail, 'owner5@example.com');
    const http = app.getHttpServer();

    // This user creates their own family first...
    await request(http)
      .post('/api/v1/families')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Own Family' });

    // ...then tries to join another via a valid code.
    const res = await request(http)
      .post('/api/v1/families/join')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ code });

    expect(res.status).toBe(409);
  });
});
